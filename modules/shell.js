// Shell Environment Module
// Provides command execution and environment variable management

class ShellEnvironment {
    constructor() {
        this.env = {
            PATH: '/bin:/usr/bin',
            HOME: '/home/user',
            USER: 'pillbox',
            SHELL: '/bin/pillbox'
        };
        this.aliases = {};
        this.history = [];
        this.historyIndex = 0;
    }

    setEnv(key, value) {
        this.env[key] = value;
        return true;
    }

    getEnv(key) {
        return this.env[key] || null;
    }

    listEnv() {
        return { ...this.env };
    }

    unsetEnv(key) {
        delete this.env[key];
        return true;
    }

    setAlias(name, command) {
        this.aliases[name] = command;
        return true;
    }

    getAlias(name) {
        return this.aliases[name] || null;
    }

    listAliases() {
        return { ...this.aliases };
    }

    resolveAlias(command) {
        const parts = command.trim().split(/\s+/);
        const cmd = parts[0];
        
        if (this.aliases[cmd]) {
            parts[0] = this.aliases[cmd];
            return parts.join(' ');
        }
        
        return command;
    }

    addHistory(command) {
        if (command && command.trim()) {
            this.history.push(command);
            this.historyIndex = this.history.length;
            
            // Limit history size
            if (this.history.length > 1000) {
                this.history.shift();
            }
        }
    }

    getHistory() {
        return [...this.history];
    }

    getPreviousHistory() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            return this.history[this.historyIndex] || '';
        }
        return null;
    }

    getNextHistory() {
        if (this.historyIndex < this.history.length) {
            this.historyIndex++;
            if (this.historyIndex === this.history.length) {
                return '';
            }
            return this.history[this.historyIndex] || '';
        }
        return null;
    }

    expandVariables(str) {
        return str.replace(/\$\{?(\w+)\}?/g, (match, varName) => {
            return this.env[varName] || match;
        });
    }

    parsePath(path) {
        // Resolve relative paths, home directory, etc.
        let resolved = path;
        
        if (resolved.startsWith('~/')) {
            resolved = this.env.HOME + resolved.slice(1);
        }
        
        if (resolved.startsWith('./')) {
            resolved = this.env.PWD + '/' + resolved.slice(2);
        }
        
        // Expand environment variables
        resolved = this.expandVariables(resolved);
        
        // Normalize path (remove .., ., etc.)
        const parts = resolved.split('/').filter(p => p && p !== '.');
        const normalized = [];
        
        for (const part of parts) {
            if (part === '..') {
                normalized.pop();
            } else {
                normalized.push(part);
            }
        }
        
        return '/' + normalized.join('/');
    }

    exec(command, context = {}) {
        const resolved = this.resolveAlias(command);
        const expanded = this.expandVariables(resolved);
        
        return {
            success: true,
            command: expanded,
            output: '',
            context
        };
    }
}

// Export as ES6 module
export default ShellEnvironment;

// Also expose as global for backward compatibility
if (typeof window !== 'undefined') {
    window.Shell = ShellEnvironment;
}
