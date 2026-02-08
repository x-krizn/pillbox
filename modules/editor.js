// Editor Module
// Provides text editing capabilities with syntax awareness

class EditorModule {
    constructor() {
        this.name = 'EditorModule';
        this.version = '1.0.0';
        this.buffers = new Map();
        this.currentBuffer = null;
    }

    createBuffer(name, content = '') {
        const buffer = {
            name,
            content,
            cursor: { line: 0, col: 0 },
            modified: false,
            readonly: false,
            syntax: this.detectSyntax(name),
            history: [],
            historyIndex: -1
        };
        
        this.buffers.set(name, buffer);
        return buffer;
    }

    getBuffer(name) {
        return this.buffers.get(name) || null;
    }

    deleteBuffer(name) {
        return this.buffers.delete(name);
    }

    listBuffers() {
        return Array.from(this.buffers.keys());
    }

    openBuffer(name, content = '') {
        let buffer = this.getBuffer(name);
        
        if (!buffer) {
            buffer = this.createBuffer(name, content);
        }
        
        this.currentBuffer = name;
        return buffer;
    }

    closeBuffer(name) {
        if (this.currentBuffer === name) {
            this.currentBuffer = null;
        }
        return this.deleteBuffer(name);
    }

    getCurrentBuffer() {
        if (!this.currentBuffer) return null;
        return this.getBuffer(this.currentBuffer);
    }

    setContent(name, content) {
        const buffer = this.getBuffer(name);
        if (!buffer) return false;
        
        if (buffer.readonly) {
            console.warn('[Editor] Buffer is readonly:', name);
            return false;
        }
        
        // Save to history
        buffer.history.push(buffer.content);
        buffer.historyIndex = buffer.history.length - 1;
        
        // Limit history
        if (buffer.history.length > 100) {
            buffer.history.shift();
            buffer.historyIndex--;
        }
        
        buffer.content = content;
        buffer.modified = true;
        return true;
    }

    getContent(name) {
        const buffer = this.getBuffer(name);
        return buffer ? buffer.content : null;
    }

    undo(name) {
        const buffer = this.getBuffer(name);
        if (!buffer || buffer.historyIndex < 0) return null;
        
        const content = buffer.history[buffer.historyIndex];
        buffer.historyIndex--;
        buffer.content = content;
        return content;
    }

    redo(name) {
        const buffer = this.getBuffer(name);
        if (!buffer || buffer.historyIndex >= buffer.history.length - 1) return null;
        
        buffer.historyIndex++;
        const content = buffer.history[buffer.historyIndex];
        buffer.content = content;
        return content;
    }

    detectSyntax(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        
        const syntaxMap = {
            js: 'javascript',
            mjs: 'javascript',
            ts: 'typescript',
            json: 'json',
            html: 'html',
            htm: 'html',
            css: 'css',
            md: 'markdown',
            py: 'python',
            sh: 'shell',
            bash: 'shell',
            yml: 'yaml',
            yaml: 'yaml',
            xml: 'xml',
            c: 'c',
            cpp: 'cpp',
            h: 'c',
            hpp: 'cpp',
            rs: 'rust',
            go: 'go',
            rb: 'ruby',
            php: 'php',
            java: 'java',
            sql: 'sql'
        };
        
        return syntaxMap[ext] || 'text';
    }

    getStats(name) {
        const buffer = this.getBuffer(name);
        if (!buffer) return null;
        
        const lines = buffer.content.split('\n');
        const chars = buffer.content.length;
        const words = buffer.content.split(/\s+/).filter(w => w.length > 0).length;
        
        return {
            lines: lines.length,
            chars,
            words,
            syntax: buffer.syntax,
            modified: buffer.modified,
            readonly: buffer.readonly
        };
    }

    find(name, pattern, options = {}) {
        const buffer = this.getBuffer(name);
        if (!buffer) return [];
        
        const { caseSensitive = false, regex = false } = options;
        const content = buffer.content;
        const matches = [];
        
        if (regex) {
            const flags = caseSensitive ? 'g' : 'gi';
            const re = new RegExp(pattern, flags);
            let match;
            
            while ((match = re.exec(content)) !== null) {
                matches.push({
                    index: match.index,
                    length: match[0].length,
                    text: match[0]
                });
            }
        } else {
            const searchStr = caseSensitive ? pattern : pattern.toLowerCase();
            const searchContent = caseSensitive ? content : content.toLowerCase();
            let pos = 0;
            
            while ((pos = searchContent.indexOf(searchStr, pos)) !== -1) {
                matches.push({
                    index: pos,
                    length: pattern.length,
                    text: content.substr(pos, pattern.length)
                });
                pos += pattern.length;
            }
        }
        
        return matches;
    }

    replace(name, pattern, replacement, options = {}) {
        const buffer = this.getBuffer(name);
        if (!buffer || buffer.readonly) return false;
        
        const { caseSensitive = false, regex = false, all = true } = options;
        let content = buffer.content;
        
        if (regex) {
            const flags = caseSensitive ? (all ? 'g' : '') : (all ? 'gi' : 'i');
            const re = new RegExp(pattern, flags);
            content = content.replace(re, replacement);
        } else {
            if (all) {
                const re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? 'g' : 'gi');
                content = content.replace(re, replacement);
            } else {
                const index = caseSensitive 
                    ? content.indexOf(pattern)
                    : content.toLowerCase().indexOf(pattern.toLowerCase());
                
                if (index !== -1) {
                    content = content.slice(0, index) + replacement + content.slice(index + pattern.length);
                }
            }
        }
        
        return this.setContent(name, content);
    }

    markClean(name) {
        const buffer = this.getBuffer(name);
        if (buffer) {
            buffer.modified = false;
            return true;
        }
        return false;
    }

    setReadonly(name, readonly) {
        const buffer = this.getBuffer(name);
        if (buffer) {
            buffer.readonly = readonly;
            return true;
        }
        return false;
    }
}

// Export as ES6 module
export default EditorModule;

// Also expose as global for backward compatibility
if (typeof window !== 'undefined') {
    window.EditorModule = EditorModule;
}
