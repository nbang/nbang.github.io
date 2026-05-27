/**
 * Shared utilities for all Bang's Tools pages.
 * Consolidates duplicated helpers from pdf-libs.js and image-libs.js.
 */

// ─── Script / Stylesheet loader ──────────────────────────────────────────────

function loadScript(src, type = 'text/javascript') {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        if (type !== 'text/javascript') {
            script.type = type;
        }
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

function loadStylesheet(href) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`link[href="${href}"]`)) {
            resolve();
            return;
        }
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.onload = resolve;
        link.onerror = reject;
        document.head.appendChild(link);
    });
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// ─── UI Manager ───────────────────────────────────────────────────────────────

const UIManager = {
    // Wires up click-to-browse, drag-and-drop, and file input change on a drop zone.
    // accentColor: Tailwind color name (e.g. 'red', 'pink') — controls drag-over highlight.
    setupDropZone(dropZoneId, fileInputId, onFileSelect, accentColor = 'indigo') {
        const dropZone = document.getElementById(dropZoneId);
        const fileInput = document.getElementById(fileInputId);
        if (!dropZone || !fileInput) return;

        dropZone.addEventListener('click', e => {
            if (e.target.tagName !== 'BUTTON' && !e.target.closest('button')) {
                fileInput.click();
            }
        });

        const button = dropZone.querySelector('button');
        if (button) {
            button.addEventListener('click', e => {
                e.stopPropagation();
                fileInput.click();
            });
        }

        dropZone.addEventListener('dragover', e => {
            e.preventDefault();
            dropZone.classList.add(`border-${accentColor}-500`, `bg-${accentColor}-50/50`);
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove(`border-${accentColor}-500`, `bg-${accentColor}-50/50`);
        });

        dropZone.addEventListener('drop', e => {
            e.preventDefault();
            dropZone.classList.remove(`border-${accentColor}-500`, `bg-${accentColor}-50/50`);
            if (e.dataTransfer.files.length) onFileSelect(e.dataTransfer.files);
        });

        fileInput.addEventListener('change', () => {
            if (fileInput.files.length) onFileSelect(fileInput.files);
        });
    },

    // Full-screen loading spinner. Re-uses the same element on repeat calls.
    showLoading(message = 'Processing...', accentColor = 'indigo') {
        let loader = document.getElementById('tool-loader');
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'tool-loader';
            loader.className = 'fixed inset-0 z-50 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center';
            loader.innerHTML = `
                <div class="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-${accentColor}-600 mb-4"></div>
                <p class="text-xl font-semibold text-gray-700" id="tool-loader-text">${message}</p>
            `;
            document.body.appendChild(loader);
        } else {
            document.getElementById('tool-loader-text').textContent = message;
            loader.classList.remove('hidden');
        }
    },

    hideLoading() {
        const loader = document.getElementById('tool-loader');
        if (loader) loader.classList.add('hidden');
    },

    // Toast notification (success | error | info | warning)
    showToast(message, type = 'info') {
        const colors = {
            success: 'bg-green-600',
            error:   'bg-red-600',
            warning: 'bg-amber-500',
            info:    'bg-blue-600',
        };
        const toast = document.createElement('div');
        toast.className = `fixed bottom-5 left-1/2 -translate-x-1/2 ${colors[type] ?? colors.info} text-white px-6 py-3 rounded-full shadow-lg z-50 transition-all duration-300 translate-y-20 opacity-0`;
        toast.textContent = message;
        document.body.appendChild(toast);

        requestAnimationFrame(() => toast.classList.remove('translate-y-20', 'opacity-0'));
        setTimeout(() => {
            toast.classList.add('translate-y-20', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    // Renders a list of file pills below a drop zone.
    // iconClass: FA icon class (e.g. 'fa-solid fa-file-pdf'), iconColor: Tailwind text color class.
    renderFilePreview(files, container, iconClass = 'fa-solid fa-file', iconColor = 'text-indigo-500') {
        container.innerHTML = '';
        Array.from(files).forEach(file => {
            const item = document.createElement('div');
            item.className = 'bg-white p-3 rounded-lg shadow border border-gray-100 flex items-center justify-between mb-2';
            item.innerHTML = `
                <div class="flex items-center">
                    <i class="${iconClass} ${iconColor} mr-3 text-xl"></i>
                    <div>
                        <p class="text-sm font-medium text-gray-700 truncate max-w-[200px]">${file.name}</p>
                        <p class="text-xs text-gray-400">${formatBytes(file.size)}</p>
                    </div>
                </div>
            `;
            container.appendChild(item);
        });
    },
};

// ─── Caching and Fetching ────────────────────────────────────────────────────

/**
 * Fetches JSON with automatic Cache API support and update-awareness.
 * Immediately returns cached data if available, then runs a background check (HEAD or conditional GET)
 * to verify if the server's version has changed. If changed, updates cache and triggers callback.
 * 
 * @param {string} url - The URL of the JSON file to fetch.
 * @param {object} options - Options object
 * @param {string} options.cacheName - Name of the Cache container (defaults to 'bang-tools-data-v1')
 * @param {function} options.onUpdate - Callback invoked when a newer version is fetched and parsed.
 * @returns {Promise<any>} The cached or newly fetched data.
 */
async function fetchJSONWithCache(url, options = {}) {
    const cacheName = options.cacheName || 'bang-tools-data-v1';
    
    try {
        const cache = await caches.open(cacheName);
        const cachedResponse = await cache.match(url);
        
        let cachedData = null;
        if (cachedResponse) {
            try {
                // Parse cloned cached response so the response body stream is preserved in cache
                cachedData = await cachedResponse.clone().json();
            } catch (e) {
                console.warn(`[Cache] Failed parsing cached JSON for ${url}, clearing cache entry`, e);
                await cache.delete(url);
            }
        }

        // Trigger a background checking function that runs after returning cached data
        const checkBackgroundUpdate = async () => {
            try {
                // If there's no cached response, we need to fetch the file anyway
                if (!cachedResponse) {
                    const freshRes = await fetch(url, { cache: 'no-cache' });
                    if (freshRes.ok) {
                        await cache.put(url, freshRes.clone());
                        const freshData = await freshRes.json();
                        if (options.onUpdate) options.onUpdate(freshData);
                    }
                    return;
                }

                // If cached response exists, do a quick validation
                // We use a HEAD request first to save bandwidth
                let needsUpdate = false;
                let etagServer = null;
                let lmServer = null;
                
                try {
                    const headRes = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
                    if (headRes.ok) {
                        etagServer = headRes.headers.get('etag');
                        lmServer = headRes.headers.get('last-modified');
                        
                        const etagCached = cachedResponse.headers.get('etag');
                        const lmCached = cachedResponse.headers.get('last-modified');
                        
                        if (etagServer && etagCached && etagServer !== etagCached) {
                            needsUpdate = true;
                        } else if (lmServer && lmCached && lmServer !== lmCached) {
                            needsUpdate = true;
                        } else if (!etagServer && !lmServer) {
                            // Fallback if no validation headers found in HEAD response: 
                            // check Content-Length as a basic heuristic
                            const lenServer = headRes.headers.get('content-length');
                            const lenCached = cachedResponse.headers.get('content-length');
                            if (lenServer && lenCached && lenServer !== lenCached) {
                                needsUpdate = true;
                            }
                        }
                    } else {
                        // If HEAD failed or is not 200 OK, re-fetch
                        needsUpdate = true;
                    }
                } catch (headErr) {
                    console.warn(`[Cache] HEAD request failed for ${url}, falling back to GET check`, headErr);
                    needsUpdate = true;
                }

                if (needsUpdate) {
                    console.log(`[Cache] Update detected for ${url}. Fetching fresh copy...`);
                    const freshRes = await fetch(url, { cache: 'no-cache' });
                    if (freshRes.ok) {
                        await cache.put(url, freshRes.clone());
                        const freshData = await freshRes.json();
                        if (options.onUpdate) {
                            options.onUpdate(freshData);
                        }
                    }
                } else {
                    console.log(`[Cache] ${url} is up to date.`);
                }
            } catch (err) {
                console.warn(`[Cache] Background update check failed for ${url}:`, err);
            }
        };

        if (cachedData) {
            // Return cached data immediately, check for updates asynchronously
            setTimeout(checkBackgroundUpdate, 100);
            return cachedData;
        } else {
            // Cache miss: Fetch synchronously
            const response = await fetch(url, { cache: 'no-cache' });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            await cache.put(url, response.clone());
            const data = await response.json();
            return data;
        }
    } catch (error) {
        console.warn(`[Cache] Cache system failed, falling back to network-only for ${url}`, error);
        const res = await fetch(url);
        return await res.json();
    }
}

// ─── Exports (global) ────────────────────────────────────────────────────────

window.BangUtils = { loadScript, loadStylesheet, formatBytes, UIManager, fetchJSONWithCache };
