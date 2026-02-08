// Terminal Module
// Handles TTY I/O, display buffering, and user interaction

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
        
        // Pipe/redirect state
        this.pipeChain = [];
        this.redirectTarget = null;
        this.redirectMode = null; // '>', '>>'
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
        
        // Limit scrollback
        if (this.stdout.length > this.scrollback) {
            this.stdout.shift();
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

    async executePipeline(commands, redirect, executor) {
        let input = '';
        
        for (let i = 0; i < commands.length; i++) {
            const cmd = commands[i];
            const isLast = i === commands.length - 1;
            
            // Set stdin if this is not the first command
            if (i > 0) {
                this.writeStdin(input);
            }
            
            // Capture output
            const originalWrite = this.write.bind(this);
            let output = '';
            
            this.write = (text, stream, className) => {
                if (stream === 'stdout' && !isLast) {
                    output += text;
                } else {
                    originalWrite(text, stream, className);
                }
            };
            
            // Execute command
            await executor(cmd);
            
            // Restore write
            this.write = originalWrite;
            
            // Use output as input for next command
            input = output;
            
            // Clear stdin buffer
            this.stdinBuffer = '';
        }
        
        // Handle redirection
        if (redirect && redirect.target) {
            if (redirect.type === '>') {
                // Overwrite
                return { output: input, redirect: { mode: 'write', target: redirect.target } };
            } else if (redirect.type === '>>') {
                // Append
                return { output: input, redirect: { mode: 'append', target: redirect.target } };
            }
        }
        
        return { output: input, redirect: null };
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
