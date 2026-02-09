// Kernel Module
// Core system: boot, module management, storage coordination
// FIXED: Atomic transactions - in-memory cache only updated after successful DB write

class Kernel {
    constructor() {
        this.version = '1.0.1';
        this.bootLog = [];
        this.loadedModules = new Map();
        this.coreModules = new Map();
        
        // System state
        this.booted = false;
        this.db = null;
        this.useMemory = false;
        
        // Storage
        this.vfs = null;  // VFS instance
        this.userModules = {};  // Kernel cache (RAM) - mirrors VFS (disk)
    }

    // ====================================================================
    // BOOT SYSTEM
    // ====================================================================

    async boot(options = {}) {
        const { 
            terminal = null,
            vfs = null,
            shell = null,
            editor = null,
            network = null
        } = options;
        
        this.log('Kernel boot initiated');
        
        // Initialize storage
        await this._initStorage();
        
        // Register core modules
        if (vfs) {
            this.registerCoreModule('vfs', vfs);
            this.vfs = vfs;
        }
        if (shell) this.registerCoreModule('shell', shell);
        if (editor) this.registerCoreModule('editor', editor);
        if (network) this.registerCoreModule('network', network);
        
        // Load VFS data into kernel cache
        if (this.vfs) {
            await this._loadVFS();
        }
        
        this.booted = true;
        this.log('Kernel boot complete');
        
        return {
            success: true,
            version: this.version,
            storage: this.useMemory ? 'memory' : 'indexeddb',
            modules: this.coreModules.size,
            userModules: Object.keys(this.userModules).length
        };
    }

    async _initStorage() {
        try {
            this.db = await this._openDB();
            this.useMemory = false;
            this.log('IndexedDB initialized');
        } catch (error) {
            this.useMemory = true;
            this.userModules = {};
            this.log(`Storage fallback to memory: ${error.message}`);
        }
    }

    _openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('PillboxDB', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('files')) {
                    db.createObjectStore('files', { keyPath: 'path' });
                }
                if (!db.objectStoreNames.contains('logs')) {
                    db.createObjectStore('logs');
                }
            };
        });
    }

    async _loadVFS() {
        if (this.useMemory) {
            return;
        }

        try {
            const tx = this.db.transaction(['files'], 'readonly');
            const store = tx.objectStore('files');
            const files = await new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });

            this.userModules = {};
            for (const file of files) {
                if (file && file.path && file.content !== undefined) {
                    this.userModules[file.path] = file.content;
                }
            }
            
            this.log(`Loaded ${files.length} files from VFS`);
        } catch (error) {
            this.log(`VFS load error: ${error.message}`);
            this.userModules = {};
        }
    }

    // ====================================================================
    // MODULE MANAGEMENT
    // ====================================================================

    registerCoreModule(name, instance) {
        this.coreModules.set(name, instance);
        this.log(`Core module registered: ${name}`);
    }

    getCoreModule(name) {
        return this.coreModules.get(name);
    }

    listCoreModules() {
        return Array.from(this.coreModules.keys());
    }

    async loadUserModule(filename) {
        const content = this.userModules[filename];
        
        if (!content) {
            throw new Error(`Module not found: ${filename}`);
        }

        // Verify syntax
        const verification = this.verifyModule(filename, content);
        if (!verification.valid) {
            throw new Error(`Module verification failed: ${verification.errors.join(', ')}`);
        }

        try {
            // Execute module in global scope (intentional for userland dev)
            const func = new Function(content);
            func();
            
            this.loadedModules.set(filename, {
                filename,
                loaded: Date.now(),
                content
            });
            
            this.log(`Module loaded: ${filename}`);
            return true;
        } catch (error) {
            this.log(`Module load error: ${filename} - ${error.message}`);
            throw error;
        }
    }

    verifyModule(filename, content) {
        const errors = [];
        
        if (!content || !content.trim()) {
            errors.push('File is empty');
            return { valid: false, errors };
        }

        if (filename.endsWith('.js')) {
            // Syntax check
            try {
                new Function(content);
            } catch (error) {
                errors.push(`Syntax error: ${error.message}`);
            }

            // Import dependency check
            const importMatches = content.match(/import\s+.*\s+from\s+['"](.+)['"]/g);
            if (importMatches) {
                for (const match of importMatches) {
                    const pathMatch = match.match(/from\s+['"](.+)['"]/);
                    if (pathMatch) {
                        const importPath = pathMatch[1];
                        if (importPath.startsWith('./') || importPath.startsWith('../')) {
                            const resolved = this._resolvePath(filename, importPath);
                            if (!this.userModules[resolved]) {
                                errors.push(`Missing dependency: ${importPath}`);
                            }
                        }
                    }
                }
            }
        }

        return { valid: errors.length === 0, errors };
    }

    _resolvePath(base, relative) {
        const baseParts = base.split('/').filter(p => p);
        baseParts.pop();  // Remove filename
        
        const relativeParts = relative.split('/').filter(p => p);
        
        for (const part of relativeParts) {
            if (part === '.') continue;
            if (part === '..') {
                baseParts.pop();
            } else {
                baseParts.push(part);
            }
        }
        
        return baseParts.join('/');
    }

    listUserModules() {
        return Object.keys(this.userModules);
    }

    listLoadedModules() {
        return Array.from(this.loadedModules.keys());
    }

    // ====================================================================
    // FILE OPERATIONS (ATOMIC TRANSACTIONS)
    // ====================================================================

    // FIXED: Atomic transaction - only update cache after successful DB write
    async saveFile(path, content) {
        if (this.useMemory) {
            // Memory mode - no transaction needed
            this.userModules[path] = content;
            return true;
        }

        try {
            // Write to DB first
            const tx = this.db.transaction(['files'], 'readwrite');
            const store = tx.objectStore('files');
            await new Promise((resolve, reject) => {
                const request = store.put({ path, content });
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
            
            // FIXED: Only update in-memory cache after successful DB write
            this.userModules[path] = content;
            this.log(`File saved: ${path}`);
            return true;
        } catch (error) {
            this.log(`File save error: ${path} - ${error.message}`, 'error');
            // In-memory cache NOT updated, so it stays consistent with DB
            return false;
        }
    }

    // FIXED: Atomic transaction for delete
    async deleteFile(path) {
        if (this.useMemory) {
            delete this.userModules[path];
            return true;
        }

        try {
            // Delete from DB first
            const tx = this.db.transaction(['files'], 'readwrite');
            const store = tx.objectStore('files');
            await new Promise((resolve, reject) => {
                const request = store.delete(path);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
            
            // FIXED: Only remove from cache after successful DB delete
            delete this.userModules[path];
            this.log(`File deleted: ${path}`);
            return true;
        } catch (error) {
            this.log(`File delete error: ${path} - ${error.message}`, 'error');
            // Cache NOT updated, stays consistent with DB
            return false;
        }
    }

    getFile(path) {
        return this.userModules[path] || null;
    }

    // ====================================================================
    // LOGGING
    // ====================================================================

    log(message, level = 'info') {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            message
        };
        
        this.bootLog.push(entry);
        
        // Limit log size
        if (this.bootLog.length > 100) {
            this.bootLog.shift();
        }
        
        if (level === 'error') {
            console.error(`[Kernel] ${message}`);
        } else {
            console.log(`[Kernel] ${message}`);
        }
    }

    getLog() {
        return [...this.bootLog];
    }

    clearLog() {
        this.bootLog = [];
    }

    // ====================================================================
    // SYSTEM INFO
    // ====================================================================

    getInfo() {
        return {
            version: this.version,
            booted: this.booted,
            storage: this.useMemory ? 'memory' : 'indexeddb',
            coreModules: this.listCoreModules(),
            userModules: this.listUserModules(),
            loadedModules: this.listLoadedModules(),
            uptime: this.booted ? Date.now() - new Date(this.bootLog[0]?.timestamp).getTime() : 0
        };
    }

    // ====================================================================
    // SHUTDOWN
    // ====================================================================

    async shutdown() {
        this.log('Kernel shutdown initiated');
        
        // Close database connection
        if (this.db) {
            this.db.close();
            this.db = null;
            this.log('Database connection closed');
        }
        
        this.booted = false;
        this.log('Kernel shutdown complete');
    }
}

// Export as ES6 module
export default Kernel;

// Also expose as global for backward compatibility
if (typeof window !== 'undefined') {
    window.Kernel = Kernel;
}
