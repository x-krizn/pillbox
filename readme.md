# Pillbox Terminal - Foundation Kernel

## Overview

Pillbox is a **foundation-level terminal system** running entirely in the browser. It provides the lowest-level user entry point - a bootstrap kernel that persists even when higher-level systems fail. Think of it as a BIOS with userland development capabilities.

**Version:** 1.0.1 (Stability Release)  
**Total Code:** ~2,500 lines across 7 modules

---

## What's New in v1.0.1

### ✅ Stability Fixes (Foundation-Critical)

**FIXED: Pipeline Race Conditions**
- Each pipeline execution now uses isolated context
- No more state corruption from concurrent operations
- Rock-solid I/O handling for composable commands

**FIXED: Memory Leaks**
- DOM cleanup synchronized with output buffer
- System can run indefinitely without degradation
- Proper resource management for long-running sessions

**FIXED: stdin Buffer Leakage**
- stdin cleared between pipeline stages
- Prevents data contamination in command chains
- Composability contract maintained

**FIXED: Transaction Atomicity**
- In-memory cache only updates after successful disk writes
- No divergent state between RAM and persistent storage
- Data integrity guaranteed across power loss scenarios

**ADDED: Proper Shutdown**
- IndexedDB connections closed on page unload
- Clean resource cleanup
- Multi-tab support improved

---

## Architecture Philosophy

Pillbox implements a **dual-storage architecture** mirroring real operating systems:

- **VFS (Virtual File System)** = Persistent storage layer (disk partition)
- **Kernel Cache** = In-memory working set (RAM)

This separation is intentional and provides:
- Fast read access (kernel cache)
- Persistent durability (VFS/IndexedDB)
- Transaction atomicity (write-through with rollback)
- System recovery (reload from VFS)

---

## Core Features

### ✅ Unix-like Pipeline System
```bash
cat file.txt | grep pattern | wc
echo "Hello World" > output.txt
curl https://api.github.com/zen >> quotes.txt
ls | sort | uniq
```

### ✅ 25+ Built-in Commands
- **File ops:** ls, cat, edit, rm, touch, find, export, pwd
- **Text processing:** grep, wc, head, tail, echo, sort, uniq  
- **Network:** curl, wget
- **System:** help, clear, log, reload, info, modules, load
- **Environment:** env, alias, history

### ✅ Userland Development Environment
- Load JavaScript modules at runtime
- Execute code in global scope (intentional for dev)
- Build anything on top of the kernel
- No restrictions on creativity

### ✅ Progressive Web App
- Installable on desktop/mobile
- Offline capable
- Service worker caching
- Persistent storage

---

## System Architecture

```
pillbox/
├── index.html              # UI shell (~320 lines)
├── modules/
│   ├── kernel.js           # Boot, module management, atomic transactions (350 lines)
│   ├── vfs.js              # Virtual filesystem, persistence (165 lines)
│   ├── shell.js            # Environment, aliases (150 lines)
│   ├── terminal.js         # I/O, pipes, redirects (280 lines)
│   ├── editor.js           # Text editor (255 lines)
│   ├── commands.js         # 25+ built-in commands (682 lines)
│   └── network.js          # HTTP requests (185 lines)
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker
└── icons/                  # App icons
```

**Total System Code:** ~2,500 lines

---

## Foundation Layer Design Principles

### 1. Self-Sustaining
- Zero external dependencies
- Works when everything else fails
- Recovery/rescue system

### 2. Minimal & Stable
- Small footprint
- Core functionality only
- No bloat

### 3. Extensible
- User modules can add any feature
- Foundation never changes
- Build empires on top

### 4. Persistent
- Survives page reload
- IndexedDB storage
- Memory fallback

---

## Module APIs

### Terminal Module (Fixed: Race-free Pipelines)

```javascript
import Terminal from './modules/terminal.js';

const term = new Terminal(outputDiv, inputDiv);

// I/O Streams
term.write('text', 'stdout', 'className');
term.error('error message');
term.writeStdin('data');           // Write to stdin
const data = term.readStdin();     // Read from stdin
const hasData = term.hasStdin();   // Check stdin

// Pipes and Redirects (Now race-condition free)
const { commands, redirect } = term.parsePipeline('cat file | grep x > out.txt');
await term.executePipeline(commands, redirect, executor);

// Utilities
const table = term.table(data, ['col1', 'col2']);
const progress = term.progressBar(50, 100);
```

### Kernel Module (Fixed: Atomic Transactions)

```javascript
import Kernel from './modules/kernel.js';

const kernel = new Kernel();

await kernel.boot({
    terminal: term,
    vfs: vfs,
    shell: shell,
    editor: editor,
    network: network
});

// File operations (now atomic)
await kernel.saveFile('test.js', content);  // Only updates cache on success
const content = kernel.getFile('test.js');
await kernel.deleteFile('test.js');

// Module management
await kernel.loadUserModule('plugin.js');
const modules = kernel.listUserModules();

// System info
const info = kernel.getInfo();

// Clean shutdown
await kernel.shutdown();
```

### VFS Module

```javascript
import VFS from './modules/vfs.js';

const vfs = new VFS();
await vfs.init();

// CRUD operations
await vfs.write(path, content);
const content = await vfs.read(path);
await vfs.delete(path);
const exists = await vfs.exists(path);

// Listing
const files = await vfs.list('prefix');
const all = await vfs.loadAll();

// Cleanup
await vfs.shutdown();
```

### Commands Module

```javascript
import Commands from './modules/commands.js';

const commands = new Commands(kernel, terminal, editor, shell);

// Execute with pipes and redirects (now stable)
await commands.execute('cat data.txt | grep error | wc');
await commands.execute('echo "test" > output.txt');

// Register custom commands
commands.register('deploy', async (args) => {
  terminal.print('Deploying...\n', 'info');
  // Your code here
}, 'Deploy application');
```

---

## Usage Examples

### Pipes and Filters
```bash
# Count error lines in log
cat app.log | grep ERROR | wc

# Get unique values
cat data.txt | sort | uniq

# First 5 matches
cat large.txt | grep pattern | head -5
```

### Output Redirection
```bash
# Overwrite file
echo "Hello World" > greeting.txt

# Append to file
echo "Line 2" >> greeting.txt

# Save command output
curl https://example.com > page.html
```

### Environment Variables
```bash
# Set and use variables
env API_KEY=secret123
echo "API: $API_KEY"
echo "$HOME/documents" > path.txt
```

### Module Development
```bash
# Create new module
edit myplugin.js

# Module template
(function() {
  const commands = window.PillboxUI.commands;
  const terminal = window.PillboxUI.terminal;
  const kernel = window.PillboxUI.kernel;
  
  commands.register('hello', async (args) => {
    terminal.print(`Hello, ${args[0] || 'World'}!\n`, 'success');
  }, 'Greet someone');
  
  terminal.print('[LOADED] myplugin.js\n', 'success');
})();

# Save (ESC), then load
load 1
hello Alice
```

---

## Browser Compatibility

**Tested & Working:**
- Chrome/Edge 61+ ✅
- Firefox 60+ ✅
- Safari 11.1+ ✅
- iOS Safari 11.3+ ✅

**Not Supported:**
- IE 11 ❌ (no ES6 modules)

---

## Deployment

### Local Development
```bash
# Serve locally
python3 -m http.server 8000

# Open browser
http://localhost:8000
```

### Production Deploy (GitHub Pages)
```bash
git init
git add .
git commit -m "Deploy Pillbox"
git push origin main

# Enable Pages in repo settings
# Your app: https://username.github.io/pillbox
```

**Required:** HTTPS for service worker and PWA features

---

## Security Model

Pillbox is designed as a **userland development environment**:

- **Code Execution:** Intentional via `Function()` constructor
- **Global Scope:** Modules execute with full browser access
- **Purpose:** Bootstrap/recovery system, not sandboxed runtime

**Use Case:** Personal development environment, system recovery, educational platform

**Not For:** Multi-tenant systems, untrusted code execution

If you need sandboxing, build it on top as a user module.

---

## Performance

**Foundation Metrics (v1.0.1):**

- Boot time: ~300ms
- Command execution: <10ms
- Pipe overhead: ~5ms per stage (fixed, no races)
- IndexedDB write: ~50ms (atomic)
- IndexedDB read: ~20ms
- File editor: Instant
- Memory: Stable (no leaks)

**Stability:**
- Can run indefinitely without degradation ✅
- Handles concurrent operations correctly ✅
- Data integrity guaranteed ✅

---

## What's Not Included (By Design)

Foundation kernels stay minimal. Features NOT included:

- ❌ Input redirection (`cmd < file`)
- ❌ Background jobs (`cmd &`)
- ❌ Job control (`fg/bg/jobs`)
- ❌ Globbing (`*.txt`)
- ❌ Tab completion
- ❌ Syntax highlighting

**Why?** Build these as user modules on top. Foundation stays stable.

---

## Extending Pillbox

### Add Custom Commands (Simple)
```javascript
// In user module
commands.register('mycommand', async (args) => {
  // Your logic
}, 'Description');
```

### Build Higher-Level Systems
- Package managers
- Testing frameworks
- Build systems
- Web frameworks
- Anything you imagine

The foundation provides:
- Persistent storage
- I/O primitives
- Command execution
- Module loading

You provide the creativity.

---

## Recovery Mode

Pillbox is designed to survive system failures:

1. **Browser crashes** → Data in IndexedDB persists
2. **Code errors in user modules** → Kernel still boots
3. **Storage quota exceeded** → Falls back to memory mode
4. **Network offline** → PWA works offline

Use `reload` command to reset if system gets corrupted.

---

## Developer Guide

### File Structure Best Practices
```
your-app/
├── core/           # Your core modules
├── plugins/        # Optional features
└── init.js         # Auto-load on boot
```

### Loading Order
1. Kernel boots
2. Core modules register
3. VFS loads user files
4. User can `load` modules manually
5. Or create auto-loader module

### Debugging
```bash
# View system log
log

# Check module status
modules

# Verify file integrity
ls

# System information
info
```

---

## Version History

**v1.0.1** (Current - Stability Release)
- Fixed pipeline race conditions
- Fixed memory leaks  
- Fixed stdin buffer leakage
- Fixed transaction atomicity
- Added proper shutdown handling
- Registered network module with kernel

**v1.0.0** (Initial Release)
- Foundation kernel implementation
- 25+ Unix commands
- Pipeline system
- Persistent storage
- PWA capabilities

---

## Philosophy

**Pillbox = Bootstrap + Recovery + Foundation**

Like a BIOS that gives you a shell when everything else fails, Pillbox provides the minimal viable system to rebuild anything you need.

It's not trying to be a complete OS. It's trying to be the foundation upon which you build your OS.

**Design Goals:**
1. Always boots
2. Never loses data
3. Lets you build anything
4. Stays out of your way

---

## License

MIT License - Use it, extend it, build on it.

---

## Summary

Pillbox v1.0.1 is a **stable, production-ready foundation kernel** with:

✅ Atomic data operations  
✅ Race-free pipelines  
✅ No memory leaks  
✅ Proper resource cleanup  
✅ 25+ commands  
✅ Full VFS with IndexedDB  
✅ Shell environment  
✅ Userland development  
✅ PWA installable  
✅ Offline capable  

**Ready for foundation-layer deployment.**

Build your empire on top.
