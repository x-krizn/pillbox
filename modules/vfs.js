// Virtual File System Module
// Provides persistent storage for Pillbox using IndexedDB
// FIXED: Supports atomic operations, proper transaction handling

class VirtualFileSystem {
    constructor() {
        this.db = null;
        this.useMemory = false;
        this.memoryStore = {};
    }

    async init() {
        try {
            this.db = await this._openDB();
            this.useMemory = false;
            return { success: true, storage: 'indexeddb' };
        } catch (error) {
            this.useMemory = true;
            console.warn('[VFS] IndexedDB unavailable, using memory storage:', error);
            return { success: true, storage: 'memory', warning: error.message };
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
            };
        });
    }

    // FIXED: Atomic write operation
    async write(path, content) {
        if (this.useMemory) {
            this.memoryStore[path] = content;
            return true;
        }

        try {
            const tx = this.db.transaction(['files'], 'readwrite');
            const store = tx.objectStore('files');
            
            // Wait for transaction to complete
            await new Promise((resolve, reject) => {
                const request = store.put({ path, content });
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
            
            return true;
        } catch (error) {
            console.error('[VFS] Write error:', error);
            return false;
        }
    }

    async read(path) {
        if (this.useMemory) {
            return this.memoryStore[path] || null;
        }

        try {
            const tx = this.db.transaction(['files'], 'readonly');
            const store = tx.objectStore('files');
            const result = await new Promise((resolve, reject) => {
                const request = store.get(path);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            return result ? result.content : null;
        } catch (error) {
            console.error('[VFS] Read error:', error);
            return null;
        }
    }

    async exists(path) {
        if (this.useMemory) {
            return path in this.memoryStore;
        }

        const content = await this.read(path);
        return content !== null;
    }

    async list(prefix = '') {
        if (this.useMemory) {
            return Object.keys(this.memoryStore).filter(p => p.startsWith(prefix));
        }

        try {
            const tx = this.db.transaction(['files'], 'readonly');
            const store = tx.objectStore('files');
            const keys = await new Promise((resolve, reject) => {
                const request = store.getAllKeys();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            return keys.filter(k => k.startsWith(prefix));
        } catch (error) {
            console.error('[VFS] List error:', error);
            return [];
        }
    }

    // FIXED: Atomic delete operation
    async delete(path) {
        if (this.useMemory) {
            delete this.memoryStore[path];
            return true;
        }

        try {
            const tx = this.db.transaction(['files'], 'readwrite');
            const store = tx.objectStore('files');
            
            await new Promise((resolve, reject) => {
                const request = store.delete(path);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
            
            return true;
        } catch (error) {
            console.error('[VFS] Delete error:', error);
            return false;
        }
    }

    async loadAll() {
        if (this.useMemory) {
            return { ...this.memoryStore };
        }

        try {
            const tx = this.db.transaction(['files'], 'readonly');
            const store = tx.objectStore('files');
            const files = await new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });

            const result = {};
            for (const file of files) {
                if (file && file.path && file.content !== undefined) {
                    result[file.path] = file.content;
                }
            }
            return result;
        } catch (error) {
            console.error('[VFS] Load all error:', error);
            return {};
        }
    }

    // FIXED: Proper shutdown/cleanup
    async shutdown() {
        if (this.db) {
            this.db.close();
            this.db = null;
            console.log('[VFS] Database connection closed');
        }
    }
}

// Export as ES6 module
export default VirtualFileSystem;

// Also expose as global for backward compatibility
if (typeof window !== 'undefined') {
    window.VFS = VirtualFileSystem;
}
