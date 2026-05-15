/**
 * PDF Tools UI Manager
 * Delegates to the shared UIManager in /js/utils/common.js.
 * Kept as a separate file so existing PDF tool pages don't need HTML changes.
 */

const UIManager = {
    setupDropZone: (dropZoneId, fileInputId, onFileSelect) =>
        window.BangUtils.UIManager.setupDropZone(dropZoneId, fileInputId, onFileSelect, 'red'),

    showLoading: (message = 'Processing...') =>
        window.BangUtils.UIManager.showLoading(message, 'red'),

    hideLoading: () => window.BangUtils.UIManager.hideLoading(),

    showToast: (message, type = 'info') =>
        window.BangUtils.UIManager.showToast(message, type),

    renderFilePreview: (files, container) =>
        window.BangUtils.UIManager.renderFilePreview(files, container, 'fa-solid fa-file-pdf', 'text-red-500'),
};

window.UIManager = UIManager;
