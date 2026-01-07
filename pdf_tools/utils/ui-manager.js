/**
 * UI Manager for PDF Tools
 * Handles Drag & Drop, Loading States, and Notifications
 */

const UIManager = {
    // Initialize standard file drop zone
    setupDropZone: (dropZoneId, fileInputId, onFileSelect) => {
        const dropZone = document.getElementById(dropZoneId);
        const fileInput = document.getElementById(fileInputId);

        if (!dropZone || !fileInput) return;

        // Click to browse
        dropZone.addEventListener('click', (e) => {
            // Prevent triggering if clicking a button inside
            if (e.target.tagName !== 'BUTTON' && !e.target.closest('button')) {
                fileInput.click();
            }
        });

        const button = dropZone.querySelector('button');
        if (button) {
            button.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent double trigger
                fileInput.click();
            });
        }

        // Drag events
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('border-red-500', 'bg-red-50/50');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('border-red-500', 'bg-red-50/50');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-red-500', 'bg-red-50/50');

            if (e.dataTransfer.files.length) {
                onFileSelect(e.dataTransfer.files);
            }
        });

        // File input change
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length) {
                onFileSelect(fileInput.files);
            }
        });
    },

    // Show a full screen loading spinner
    showLoading: (message = 'Processing...') => {
        let loader = document.getElementById('pdf-tool-loader');
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'pdf-tool-loader';
            loader.className = 'fixed inset-0 z-50 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center';
            loader.innerHTML = `
                <div class="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-red-600 mb-4"></div>
                <p class="text-xl font-semibold text-gray-700" id="pdf-loader-text">${message}</p>
            `;
            document.body.appendChild(loader);
        } else {
            document.getElementById('pdf-loader-text').textContent = message;
            loader.classList.remove('hidden');
        }
    },

    hideLoading: () => {
        const loader = document.getElementById('pdf-tool-loader');
        if (loader) loader.classList.add('hidden');
    },

    // Show a toast notification
    showToast: (message, type = 'info') => {
        const colors = {
            success: 'bg-green-600',
            error: 'bg-red-600',
            info: 'bg-blue-600'
        };
        const color = colors[type] || colors.info;

        const toast = document.createElement('div');
        toast.className = `fixed bottom-5 left-1/2 transform -translate-x-1/2 ${color} text-white px-6 py-3 rounded-full shadow-lg z-50 transition-all duration-300 translate-y-20 opacity-0`;
        toast.textContent = message;

        document.body.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.classList.remove('translate-y-20', 'opacity-0');
        });

        // Remove after 3s
        setTimeout(() => {
            toast.classList.add('translate-y-20', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    // Helper to render a preview of selected files
    renderFilePreview: (files, container) => {
        container.innerHTML = '';
        Array.from(files).forEach(file => {
            const item = document.createElement('div');
            item.className = 'bg-white p-3 rounded-lg shadow border border-gray-100 flex items-center justify-between mb-2';
            item.innerHTML = `
                <div class="flex items-center">
                    <i class="fa-solid fa-file-pdf text-red-500 mr-3 text-xl"></i>
                    <div>
                        <p class="text-sm font-medium text-gray-700 truncate max-w-[200px]">${file.name}</p>
                        <p class="text-xs text-gray-400">${window.PDFGlobals.formatBytes(file.size)}</p>
                    </div>
                </div>
            `;
            container.appendChild(item);
        });
    }
};

window.UIManager = UIManager;
