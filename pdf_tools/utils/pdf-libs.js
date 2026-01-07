/**
 * PDF Tools Shared Libraries Manager
 * Handles loading of external dependencies and common PDF utility functions.
 */

const PDF_LIBS = {
    pdfLib: 'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
    download: 'https://cdnjs.cloudflare.com/ajax/libs/downloadjs/1.4.8/download.min.js',
    jszip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
    fileSaver: 'https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js'
};

const PDFGlobals = {
    // Utility to load a script dynamically
    loadScript: (src) => {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },

    // Load essential libraries for PDF manipulation
    loadStandardLib: async () => {
        try {
            await Promise.all([
                PDFGlobals.loadScript(PDF_LIBS.pdfLib),
                PDFGlobals.loadScript(PDF_LIBS.download),
                PDFGlobals.loadScript(PDF_LIBS.fileSaver)
            ]);
            console.log('Standard PDF libraries loaded.');
        } catch (error) {
            console.error('Failed to load PDF libraries:', error);
            alert('Failed to load necessary libraries. Please check your internet connection.');
        }
    },

    // Load libraries for ZIP functionality (Splitting/Batch)
    loadZipLib: async () => {
        try {
            await PDFGlobals.loadScript(PDF_LIBS.jszip);
        } catch (error) {
            console.error('Failed to load JSZip:', error);
        }
    },

    // Format bytes to human readable string
    formatBytes: (bytes, decimals = 2) => {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    }
};

window.PDFGlobals = PDFGlobals;
