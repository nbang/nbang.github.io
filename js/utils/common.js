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

// ─── Exports (global) ────────────────────────────────────────────────────────

window.BangUtils = { loadScript, loadStylesheet, formatBytes, UIManager };
