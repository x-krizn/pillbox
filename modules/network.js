// Network Module
// HTTP requests and network utilities

class NetworkModule {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 60000; // 1 minute
    }

    // ====================================================================
    // HTTP METHODS
    // ====================================================================

    async fetch(url, options = {}) {
        const {
            method = 'GET',
            headers = {},
            body = null,
            cache = false,
            timeout = 30000
        } = options;

        // Check cache
        if (cache && method === 'GET') {
            const cached = this._getCache(url);
            if (cached) {
                return cached;
            }
        }

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                method,
                headers,
                body,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            const result = {
                ok: response.ok,
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                url: response.url,
                text: async () => await response.text(),
                json: async () => await response.json(),
                blob: async () => await response.blob(),
                arrayBuffer: async () => await response.arrayBuffer()
            };

            // Cache if requested
            if (cache && method === 'GET' && response.ok) {
                this._setCache(url, result);
            }

            return result;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error(`Request timeout after ${timeout}ms`);
            }
            throw error;
        }
    }

    async get(url, options = {}) {
        return this.fetch(url, { ...options, method: 'GET' });
    }

    async post(url, data, options = {}) {
        return this.fetch(url, {
            ...options,
            method: 'POST',
            body: JSON.stringify(data),
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
    }

    async put(url, data, options = {}) {
        return this.fetch(url, {
            ...options,
            method: 'PUT',
            body: JSON.stringify(data),
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
    }

    async delete(url, options = {}) {
        return this.fetch(url, { ...options, method: 'DELETE' });
    }

    // ====================================================================
    // UTILITIES
    // ====================================================================

    async download(url, filename) {
        const response = await this.get(url);
        const blob = await response.blob();
        
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename || url.split('/').pop();
        a.click();
        URL.revokeObjectURL(blobUrl);
        
        return { success: true, filename: a.download };
    }

    parseUrl(url) {
        try {
            const parsed = new URL(url);
            return {
                protocol: parsed.protocol,
                hostname: parsed.hostname,
                port: parsed.port,
                pathname: parsed.pathname,
                search: parsed.search,
                hash: parsed.hash,
                params: Object.fromEntries(parsed.searchParams.entries())
            };
        } catch (error) {
            return null;
        }
    }

    buildUrl(base, params = {}) {
        const url = new URL(base);
        for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, value);
        }
        return url.toString();
    }

    // ====================================================================
    // CACHE MANAGEMENT
    // ====================================================================

    _getCache(url) {
        const cached = this.cache.get(url);
        if (!cached) return null;
        
        if (Date.now() - cached.timestamp > this.cacheTimeout) {
            this.cache.delete(url);
            return null;
        }
        
        return cached.data;
    }

    _setCache(url, data) {
        this.cache.set(url, {
            data,
            timestamp: Date.now()
        });
    }

    clearCache() {
        this.cache.clear();
    }

    setCacheTimeout(ms) {
        this.cacheTimeout = ms;
    }
}

// Export as ES6 module
export default NetworkModule;

// Also expose as global for backward compatibility
if (typeof window !== 'undefined') {
    window.NetworkModule = NetworkModule;
}
