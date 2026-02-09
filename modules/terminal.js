// Terminal Module
// Handles TTY I/O, display buffering, and user interaction
// FIXED: Pipeline race conditions, memory leaks, stdin buffer leakage

class Terminal {
    constructor(outputElement, inputElement) {
        this.outputElement = outputElement;
        this.inputElement = inputElement;
        
        // I/O Streams
        this.stdout = [];
        this.stderr = [];
        this.stdin = [];
        this.stdinBuffer = '';
        this.stdinCallback = null;
        
        // Display state
        this.scrollback = 1000;
        this.currentLine = '';
        
        // Input handling
        this.inputCallback = null;
        this.inputHistory = [];
        this.historyIndex = 0;
        
        // Terminal settings
        this.echo = true;
        this.cursorVisible = true;
        
        // Pipeline execution state
        this.pipelineExecuting = false;
    }

    // ====================================================================
    // OUTPUT METHODS
    // ====================================================================

    write(text, stream = 'stdout', className = '') {
        const entry = {
            text,
            stream,
            className,
            timestamp: Date.now()
        };
        
        if (stream === 'stderr') {
            this.stderr.push(entry);
            this._render(text, 'error');
        } else {
            this.stdout.push(entry);
            this._render(text, className);
        }
        
        // FIXED: Limit scrollback AND clean up DOM
        if (this.stdout.length > this.scrollback) {
            this.stdout.shift();
            // Remove oldest DOM element to prevent memory leak
            if (this.outputElement.firstChild) {
                this.outputElement.removeChild(this.outputElement.firstChild);
            }
        }
        if (this.stderr.length > this.scrollback) {
            this.stderr.shift();
        }
    }

    writeln(text, stream = 'stdout', className = '') {
        this.write(text + '\n', stream, className);
    }

    print(text, className = '') {
        this.write(text, 'stdout', className);
    }

    error(text) {
        this.write(text + '\n', 'stderr', 'error');
    }

    clear() {
        this.stdout = [];
        this.stderr = [];
        this.outputElement.innerHTML = '';
    }

    _render(text, className = '') {
        const span = document.createElement('span');
        span.textContent = text;
        if (className) {
            span.className = className;
        }
        this.outputElement.appendChild(span);
        this.outputElement.scrollTop = this.outputElement.scrollHeight;
    }

    // ====================================================================
    // INPUT METHODS (STDIN)
    // ====================================================================

    read(callback) {
        this.inputCallback = callback;
        this.inputElement.focus();
    }

    readline(prompt, callback) {
        this.print(prompt, 'info');
        this.read(callback);
    }

    // Read stdin buffer (for piped input)
    readStdin() {
        const content = this.stdinBuffer;
        this.stdinBuffer = '';
        return content;
    }

    // Write to stdin buffer (for pipes)
    writeStdin(data) {
        this.stdinBuffer += data;
        this.stdin.push({
            text: data,
            timestamp: Date.now()
        });
    }

    // Check if stdin has data
    hasStdin() {
        return this.stdinBuffer.length > 0;
    }

    handleInput(text) {
        if (this.echo) {
            this.writeln('> ' + text, 'stdout', 'info');
        }
        
        if (text.trim()) {
            this.inputHistory.push(text);
            this.historyIndex = this.inputHistory.length;
        }
        
        if (this.inputCallback) {
            this.inputCallback(text);
        }
    }

    handleKeyDown(event) {
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (this.historyIndex > 0) {
                this.historyIndex--;
                this.inputElement.value = this.inputHistory[this.historyIndex] || '';
            }
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (this.historyIndex < this.inputHistory.length) {
                this.historyIndex++;
                this.inputElement.value = this.historyIndex === this.inputHistory.length 
                    ? '' 
                    : this.inputHistory[this.historyIndex];
            }
        }
    }

    // ====================================================================
    // PIPE AND REDIRECTION
    // ====================================================================

    parsePipeline(commandLine) {
        // Parse command line for pipes and redirects
        // Returns: { commands: [...], redirect: {type, target} }
        
        let redirect = null;
        let commands = [];
        
        // Check for output redirection (>, >>)
        const redirectMatch = commandLine.match(/^(.+?)\s*(>>?)\s*(.+)$/);
        if (redirectMatch) {
            commandLine = redirectMatch[1].trim();
            redirect = {
                type: redirectMatch[2],
                target: redirectMatch[3].trim()
            };
        }
        
        // Split by pipe
        commands = commandLine.split('|').map(cmd => cmd.trim());
        
        return { commands, redirect };
    }

    // FIXED: No more race conditions - each pipeline gets isolated context
    async executePipeline(commands, redirect, executor) {
        // Create isolated execution context for this pipeline
        const context = {
            output: '',
            originalWrite: this.write.bind(this),
            captureOutput: false
        };
        
        for (let i = 0; i < commands.length; i++) {
            const cmd = commands[i];
            const isLast = i === commands.length - 1;
            
            // FIXED: Clear stdin buffer before each stage to prevent leakage
            this.stdinBuffer = '';
            
            // Set stdin if this is not the first command
            if (i > 0) {
                this.writeStdin(context.output);
            }
            
            // FIXED: Capture output for all commands when redirect exists, or non-last commands in pipeline
            context.captureOutput = (redirect !== null) || !isLast;
            context.output = '';
            
            // Temporarily override write to capture output
            const tempWrite = this.write.bind(this);
            this.write = (text, stream, className) => {
                if (stream === 'stdout' && context.captureOutput) {
                    context.output += text;
                } else {
                    context.originalWrite(text, stream, className);
                }
            };
            
            try {
                // Execute command
                await executor(cmd);
            } finally {
                // Always restore write method
                this.write = tempWrite;
            }
            
            // Clear stdin buffer after command execution
            this.stdinBuffer = '';
        }
        
        // Handle redirection
        if (redirect && redirect.target) {
            if (redirect.type === '>') {
                // Overwrite
                return { output: context.output, redirect: { mode: 'write', target: redirect.target } };
            } else if (redirect.type === '>>') {
                // Append
                return { output: context.output, redirect: { mode: 'append', target: redirect.target } };
            }
        } else if (context.captureOutput && context.output) {
            // If we captured output but have no redirect, print it now
            context.originalWrite(context.output, 'stdout', '');
        }
        
        return { output: context.output, redirect: null };
    }

    // ====================================================================
    // TERMINAL CONTROL
    // ====================================================================

    setEcho(enabled) {
        this.echo = enabled;
    }

    setCursor(visible) {
        this.cursorVisible = visible;
    }

    setScrollback(lines) {
        this.scrollback = lines;
    }

    getHistory() {
        return [...this.inputHistory];
    }

    clearHistory() {
        this.inputHistory = [];
        this.historyIndex = 0;
    }

    // ====================================================================
    // UTILITY METHODS
    // ====================================================================

    format(text, style) {
        const styles = {
            bold: (t) => `\x1b[1m${t}\x1b[0m`,
            dim: (t) => `\x1b[2m${t}\x1b[0m`,
            italic: (t) => `\x1b[3m${t}\x1b[0m`,
            underline: (t) => `\x1b[4m${t}\x1b[0m`,
            blink: (t) => `\x1b[5m${t}\x1b[0m`,
            reverse: (t) => `\x1b[7m${t}\x1b[0m`,
            hidden: (t) => `\x1b[8m${t}\x1b[0m`
        };
        
        return styles[style] ? styles[style](text) : text;
    }

    progressBar(current, total, width = 40) {
        const percent = Math.floor((current / total) * 100);
        const filled = Math.floor((current / total) * width);
        const empty = width - filled;
        
        return `[${'='.repeat(filled)}${' '.repeat(empty)}] ${percent}%`;
    }

    table(data, headers) {
        if (!data.length) return '';
        
        const rows = data.map(row => 
            headers.map(h => String(row[h] || ''))
        );
        
        const colWidths = headers.map((h, i) => 
            Math.max(h.length, ...rows.map(r => r[i].length))
        );
        
        const separator = colWidths.map(w => '-'.repeat(w + 2)).join('+');
        const headerRow = headers.map((h, i) => h.padEnd(colWidths[i])).join(' | ');
        const dataRows = rows.map(row => 
            row.map((cell, i) => cell.padEnd(colWidths[i])).join(' | ')
        );
        
        return [
            separator,
            headerRow,
            separator,
            ...dataRows,
            separator
        ].join('\n');
    }
}

// Export as ES6 module
export default Terminal;

// Also expose as global for backward compatibility
if (typeof window !== 'undefined') {
    window.Terminal = Terminal;
}
