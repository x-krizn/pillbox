// Commands Module
// Built-in system commands for Pillbox

class Commands {
    constructor(kernel, terminal, editor, shell) {
        this.kernel = kernel;
        this.terminal = terminal;
        this.editor = editor;
        this.shell = shell;
        
        // Command registry
        this.commands = new Map();
        this._registerBuiltins();
    }

    // ====================================================================
    // COMMAND REGISTRATION
    // ====================================================================

    _registerBuiltins() {
        // File operations
        this.register('ls', this.ls.bind(this), 'List user modules');
        this.register('cat', this.cat.bind(this), 'Display file contents');
        this.register('edit', this.edit.bind(this), 'Open file in editor');
        this.register('rm', this.rm.bind(this), 'Remove file');
        this.register('touch', this.touch.bind(this), 'Create empty file');
        this.register('find', this.find.bind(this), 'Search for files');
        this.register('export', this.export.bind(this), 'Export file to download');
        
        // Text processing
        this.register('grep', this.grep.bind(this), 'Search for pattern in input');
        this.register('wc', this.wc.bind(this), 'Count lines, words, characters');
        this.register('head', this.head.bind(this), 'Show first n lines');
        this.register('tail', this.tail.bind(this), 'Show last n lines');
        this.register('echo', this.echo.bind(this), 'Print arguments');
        this.register('sort', this.sort.bind(this), 'Sort lines');
        this.register('uniq', this.uniq.bind(this), 'Remove duplicate lines');
        
        // System commands
        this.register('help', this.help.bind(this), 'Show available commands');
        this.register('load', this.load.bind(this), 'Load module(s) by number');
        this.register('clear', this.clear.bind(this), 'Clear screen');
        this.register('log', this.showLog.bind(this), 'Show system log');
        this.register('reload', this.reload.bind(this), 'Reload application');
        this.register('info', this.info.bind(this), 'Show system info');
        this.register('modules', this.modules.bind(this), 'Show loaded modules');
        
        // Environment
        this.register('env', this.env.bind(this), 'Show/set environment variables');
        this.register('alias', this.alias.bind(this), 'Show/set command aliases');
        this.register('history', this.history.bind(this), 'Show command history');
        this.register('pwd', this.pwd.bind(this), 'Print working directory');
        
        // Network (if network module available)
        this.register('curl', this.curl.bind(this), 'Download URL');
        this.register('wget', this.wget.bind(this), 'Download and save URL');
    }

    register(name, handler, description = '') {
        this.commands.set(name, { handler, description });
    }

    has(name) {
        return this.commands.has(name);
    }

    async execute(commandLine) {
        if (!commandLine || !commandLine.trim()) {
            return;
        }

        // Parse for pipes and redirects
        const { commands, redirect } = this.terminal.parsePipeline(commandLine);
        
        if (commands.length > 1 || redirect) {
            // Execute pipeline
            const result = await this.terminal.executePipeline(
                commands,
                redirect,
                async (cmd) => await this._executeSingle(cmd)
            );
            
            // Handle redirection
            if (result.redirect) {
                const { mode, target } = result.redirect;
                const output = result.output;
                
                if (mode === 'write') {
                    await this.kernel.saveFile(target, output);
                    this.terminal.print(`[REDIRECTED] Output saved to ${target}\n`, 'success');
                } else if (mode === 'append') {
                    const existing = this.kernel.getFile(target) || '';
                    await this.kernel.saveFile(target, existing + output);
                    this.terminal.print(`[APPENDED] Output appended to ${target}\n`, 'success');
                }
            }
        } else {
            // Single command
            await this._executeSingle(commandLine);
        }
    }

    async _executeSingle(commandLine) {
        // Parse command
        const parts = commandLine.trim().split(/\s+/);
        const cmd = parts[0];
        const args = parts.slice(1);

        // Check for alias
        const resolved = this.shell.resolveAlias(commandLine);
        if (resolved !== commandLine) {
            return this.execute(resolved);
        }

        // Execute command
        const command = this.commands.get(cmd);
        if (command) {
            try {
                await command.handler(args);
            } catch (error) {
                this.terminal.error(`Error executing ${cmd}: ${error.message}`);
            }
        } else {
            this.terminal.error(`Command not found: ${cmd}`);
            this.terminal.print('Type "help" for available commands\n');
        }
    }

    // ====================================================================
    // BUILT-IN COMMANDS
    // ====================================================================

    async help(args) {
        this.terminal.print('\nAvailable commands:\n\n', 'info');
        
        const commands = Array.from(this.commands.entries());
        const maxLen = Math.max(...commands.map(([name]) => name.length));
        
        for (const [name, { description }] of commands) {
            const padding = ' '.repeat(maxLen - name.length + 2);
            this.terminal.print(`  ${name}${padding}${description}\n`);
        }
        
        this.terminal.print('\nCore modules: vfs, shell, editor, terminal, kernel\n', 'success');
        this.terminal.print('Use "edit <filename>" to create user modules\n\n', 'info');
    }

    async ls(args) {
        this.terminal.print('\n[USER MODULES]\n', 'info');
        
        const modules = this.kernel.listUserModules().sort();
        
        if (modules.length === 0) {
            this.terminal.print('No user modules found\n', 'warning');
            this.terminal.print('Use "edit <filename>" to create modules\n\n', 'info');
            return;
        }

        for (let i = 0; i < modules.length; i++) {
            const filename = modules[i];
            const content = this.kernel.getFile(filename);
            const verification = this.kernel.verifyModule(filename, content);
            
            const symbol = verification.valid ? '✓' : 'X';
            const className = verification.valid ? 'success' : 'error';
            
            this.terminal.print(`[${i + 1}] ${symbol} ${filename}\n`, className);
            
            if (!verification.valid) {
                for (const error of verification.errors) {
                    this.terminal.print(`    ${error}\n`, 'warning');
                }
            }
        }
        
        this.terminal.print('\n');
    }

    async load(args) {
        if (args.length === 0) {
            this.terminal.error('Usage: load <number> or load <n,n,n>');
            return;
        }

        const modules = this.kernel.listUserModules().sort();
        const indices = args[0].split(',').map(n => parseInt(n.trim()) - 1);

        for (const idx of indices) {
            if (idx < 0 || idx >= modules.length) {
                this.terminal.error(`Invalid module number: ${idx + 1}`);
                continue;
            }

            const filename = modules[idx];
            this.terminal.print(`[LOADING] ${filename}...\n`, 'info');

            try {
                await this.kernel.loadUserModule(filename);
                this.terminal.print(`[SUCCESS] ${filename} loaded\n`, 'success');
            } catch (error) {
                this.terminal.error(`[FAILED] ${filename}: ${error.message}`);
            }
        }
    }

    async cat(args) {
        if (args.length === 0) {
            this.terminal.error('Usage: cat <filename>');
            return;
        }

        const filename = args[0];
        const content = this.kernel.getFile(filename);

        if (!content) {
            this.terminal.error(`File not found: ${filename}`);
            return;
        }

        this.terminal.print(`\n--- ${filename} ---\n`, 'info');
        this.terminal.print(content + '\n');
        this.terminal.print(`--- end ---\n\n`, 'info');
    }

    async edit(args) {
        if (args.length === 0) {
            this.terminal.error('Usage: edit <filename>');
            return;
        }

        const filename = args[0];
        const content = this.kernel.getFile(filename) || '';

        // Trigger editor (handled by UI layer)
        if (window.PillboxUI && window.PillboxUI.openEditor) {
            window.PillboxUI.openEditor(filename, content);
        } else {
            this.terminal.error('Editor not available');
        }
    }

    async rm(args) {
        if (args.length === 0) {
            this.terminal.error('Usage: rm <filename>');
            return;
        }

        const filename = args[0];
        
        if (!this.kernel.getFile(filename)) {
            this.terminal.error(`File not found: ${filename}`);
            return;
        }

        await this.kernel.deleteFile(filename);
        this.terminal.print(`[DELETED] ${filename}\n`, 'success');
    }

    async clear(args) {
        this.terminal.clear();
    }

    async showLog(args) {
        this.terminal.print('\n[SYSTEM LOG]\n', 'info');
        
        const log = this.kernel.getLog();
        
        if (log.length === 0) {
            this.terminal.print('No log entries\n');
        } else {
            for (const entry of log) {
                const time = new Date(entry.timestamp).toLocaleTimeString();
                this.terminal.print(`[${time}] ${entry.message}\n`);
            }
        }
        
        this.terminal.print('\n');
    }

    async reload(args) {
        this.terminal.print('[RELOADING...]\n', 'info');
        setTimeout(() => location.reload(), 500);
    }

    async info(args) {
        const info = this.kernel.getInfo();
        
        this.terminal.print('\n[SYSTEM INFO]\n', 'info');
        this.terminal.print(`Version: ${info.version}\n`);
        this.terminal.print(`Storage: ${info.storage}\n`);
        this.terminal.print(`Core Modules: ${info.coreModules.join(', ')}\n`, 'success');
        this.terminal.print(`User Modules: ${info.userModules.length}\n`);
        this.terminal.print(`Loaded Modules: ${info.loadedModules.length}\n`);
        this.terminal.print('\n');
    }

    async env(args) {
        if (args.length === 0) {
            // Show all environment variables
            const envVars = this.shell.listEnv();
            this.terminal.print('\n[ENVIRONMENT]\n', 'info');
            
            for (const [key, value] of Object.entries(envVars)) {
                this.terminal.print(`${key}=${value}\n`);
            }
            this.terminal.print('\n');
        } else if (args.length === 1) {
            // Show specific variable
            const value = this.shell.getEnv(args[0]);
            if (value !== null) {
                this.terminal.print(`${args[0]}=${value}\n`);
            } else {
                this.terminal.error(`Variable not set: ${args[0]}`);
            }
        } else {
            // Set variable (KEY=VALUE)
            const [key, ...valueParts] = args.join(' ').split('=');
            const value = valueParts.join('=');
            this.shell.setEnv(key.trim(), value.trim());
            this.terminal.print(`${key}=${value}\n`, 'success');
        }
    }

    async alias(args) {
        if (args.length === 0) {
            // Show all aliases
            const aliases = this.shell.listAliases();
            this.terminal.print('\n[ALIASES]\n', 'info');
            
            if (Object.keys(aliases).length === 0) {
                this.terminal.print('No aliases defined\n');
            } else {
                for (const [name, command] of Object.entries(aliases)) {
                    this.terminal.print(`${name}='${command}'\n`);
                }
            }
            this.terminal.print('\n');
        } else {
            // Set alias (name='command')
            const line = args.join(' ');
            const match = line.match(/(\w+)=["']?(.+?)["']?$/);
            
            if (match) {
                const [, name, command] = match;
                this.shell.setAlias(name, command);
                this.terminal.print(`alias ${name}='${command}'\n`, 'success');
            } else {
                this.terminal.error('Usage: alias name="command"');
            }
        }
    }

    async history(args) {
        const history = this.terminal.getHistory();
        
        this.terminal.print('\n[COMMAND HISTORY]\n', 'info');
        
        if (history.length === 0) {
            this.terminal.print('No history\n');
        } else {
            history.forEach((cmd, i) => {
                this.terminal.print(`${(i + 1).toString().padStart(4)} ${cmd}\n`);
            });
        }
        
        this.terminal.print('\n');
    }

    async export(args) {
        if (args.length === 0) {
            this.terminal.error('Usage: export <filename>');
            return;
        }

        const filename = args[0];
        const content = this.kernel.getFile(filename);

        if (!content) {
            this.terminal.error(`File not found: ${filename}`);
            return;
        }

        // Create download
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        this.terminal.print(`[EXPORTED] ${filename}\n`, 'success');
    }

    async modules(args) {
        this.terminal.print('\n[CORE MODULES]\n', 'success');
        const coreModules = this.kernel.listCoreModules();
        coreModules.forEach(mod => {
            this.terminal.print(`  ✓ ${mod}\n`, 'success');
        });

        this.terminal.print('\n[LOADED USER MODULES]\n', 'info');
        const loadedModules = this.kernel.listLoadedModules();
        
        if (loadedModules.length === 0) {
            this.terminal.print('  No modules loaded\n', 'warning');
        } else {
            loadedModules.forEach(mod => {
                this.terminal.print(`  ✓ ${mod}\n`);
            });
        }
        
        this.terminal.print('\n');
    }

    // ====================================================================
    // TEXT PROCESSING COMMANDS
    // ====================================================================

    async grep(args) {
        if (args.length === 0) {
            this.terminal.error('Usage: grep <pattern> [file] or cat file | grep pattern');
            return;
        }

        const pattern = args[0];
        const filename = args[1];
        
        let content = '';
        
        // Get content from file or stdin
        if (filename) {
            content = this.kernel.getFile(filename);
            if (!content) {
                this.terminal.error(`File not found: ${filename}`);
                return;
            }
        } else if (this.terminal.hasStdin()) {
            content = this.terminal.readStdin();
        } else {
            this.terminal.error('No input provided');
            return;
        }

        // Search for pattern
        const lines = content.split('\n');
        const regex = new RegExp(pattern, 'i');
        
        for (const line of lines) {
            if (regex.test(line)) {
                this.terminal.print(line + '\n');
            }
        }
    }

    async wc(args) {
        const filename = args[0];
        let content = '';

        if (filename) {
            content = this.kernel.getFile(filename);
            if (!content) {
                this.terminal.error(`File not found: ${filename}`);
                return;
            }
        } else if (this.terminal.hasStdin()) {
            content = this.terminal.readStdin();
        } else {
            this.terminal.error('Usage: wc <file> or cat file | wc');
            return;
        }

        const lines = content.split('\n').length;
        const words = content.split(/\s+/).filter(w => w.length > 0).length;
        const chars = content.length;

        this.terminal.print(`  ${lines} lines  ${words} words  ${chars} chars\n`);
    }

    async head(args) {
        const n = args[0] && args[0].startsWith('-') ? parseInt(args[0].slice(1)) : 10;
        const filename = args[0] && !args[0].startsWith('-') ? args[0] : args[1];
        
        let content = '';

        if (filename) {
            content = this.kernel.getFile(filename);
            if (!content) {
                this.terminal.error(`File not found: ${filename}`);
                return;
            }
        } else if (this.terminal.hasStdin()) {
            content = this.terminal.readStdin();
        } else {
            this.terminal.error('Usage: head [-n] <file> or cat file | head');
            return;
        }

        const lines = content.split('\n').slice(0, n);
        this.terminal.print(lines.join('\n') + '\n');
    }

    async tail(args) {
        const n = args[0] && args[0].startsWith('-') ? parseInt(args[0].slice(1)) : 10;
        const filename = args[0] && !args[0].startsWith('-') ? args[0] : args[1];
        
        let content = '';

        if (filename) {
            content = this.kernel.getFile(filename);
            if (!content) {
                this.terminal.error(`File not found: ${filename}`);
                return;
            }
        } else if (this.terminal.hasStdin()) {
            content = this.terminal.readStdin();
        } else {
            this.terminal.error('Usage: tail [-n] <file> or cat file | tail');
            return;
        }

        const lines = content.split('\n');
        const lastLines = lines.slice(-n);
        this.terminal.print(lastLines.join('\n') + '\n');
    }

    async echo(args) {
        const text = args.join(' ');
        // Expand environment variables
        const expanded = this.shell.expandVariables(text);
        this.terminal.print(expanded + '\n');
    }

    async sort(args) {
        let content = '';

        if (args.length > 0) {
            content = this.kernel.getFile(args[0]);
            if (!content) {
                this.terminal.error(`File not found: ${args[0]}`);
                return;
            }
        } else if (this.terminal.hasStdin()) {
            content = this.terminal.readStdin();
        } else {
            this.terminal.error('Usage: sort <file> or cat file | sort');
            return;
        }

        const lines = content.split('\n').filter(l => l.trim());
        lines.sort();
        this.terminal.print(lines.join('\n') + '\n');
    }

    async uniq(args) {
        let content = '';

        if (args.length > 0) {
            content = this.kernel.getFile(args[0]);
            if (!content) {
                this.terminal.error(`File not found: ${args[0]}`);
                return;
            }
        } else if (this.terminal.hasStdin()) {
            content = this.terminal.readStdin();
        } else {
            this.terminal.error('Usage: uniq <file> or cat file | uniq');
            return;
        }

        const lines = content.split('\n');
        const unique = [];
        let last = null;

        for (const line of lines) {
            if (line !== last) {
                unique.push(line);
                last = line;
            }
        }

        this.terminal.print(unique.join('\n') + '\n');
    }

    // ====================================================================
    // FILE SYSTEM COMMANDS
    // ====================================================================

    async touch(args) {
        if (args.length === 0) {
            this.terminal.error('Usage: touch <filename>');
            return;
        }

        const filename = args[0];
        
        if (!this.kernel.getFile(filename)) {
            await this.kernel.saveFile(filename, '');
            this.terminal.print(`[CREATED] ${filename}\n`, 'success');
        } else {
            this.terminal.print(`File already exists: ${filename}\n`, 'warning');
        }
    }

    async find(args) {
        const pattern = args[0] || '';
        const modules = this.kernel.listUserModules();
        
        this.terminal.print('\n[SEARCH RESULTS]\n', 'info');
        
        const matches = modules.filter(m => m.includes(pattern));
        
        if (matches.length === 0) {
            this.terminal.print(`No files matching '${pattern}'\n`, 'warning');
        } else {
            matches.forEach(file => {
                this.terminal.print(`  ${file}\n`);
            });
        }
        
        this.terminal.print('\n');
    }

    async pwd(args) {
        const pwd = this.shell.getEnv('PWD') || '/home/user';
        this.terminal.print(pwd + '\n');
    }

    // ====================================================================
    // NETWORK COMMANDS
    // ====================================================================

    async curl(args) {
        if (args.length === 0) {
            this.terminal.error('Usage: curl <url>');
            return;
        }

        const url = args[0];
        
        try {
            this.terminal.print(`[FETCHING] ${url}...\n`, 'info');
            
            const response = await fetch(url);
            const text = await response.text();
            
            this.terminal.print(text + '\n');
        } catch (error) {
            this.terminal.error(`Failed to fetch ${url}: ${error.message}`);
        }
    }

    async wget(args) {
        if (args.length === 0) {
            this.terminal.error('Usage: wget <url> [filename]');
            return;
        }

        const url = args[0];
        const filename = args[1] || url.split('/').pop() || 'download.txt';
        
        try {
            this.terminal.print(`[DOWNLOADING] ${url}...\n`, 'info');
            
            const response = await fetch(url);
            const text = await response.text();
            
            await this.kernel.saveFile(filename, text);
            this.terminal.print(`[SAVED] ${filename} (${text.length} bytes)\n`, 'success');
        } catch (error) {
            this.terminal.error(`Failed to download ${url}: ${error.message}`);
        }
    }
}

// Export as ES6 module
export default Commands;

// Also expose as global for backward compatibility
if (typeof window !== 'undefined') {
    window.Commands = Commands;
}
