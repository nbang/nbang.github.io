/**
 * PDF Tools Shared Libraries Manager
 * Thin wrapper around /js/utils/common.js — loads CDN dependencies for PDF manipulation.
 */

const PDF_LIBS = {
    pdfLib:     'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
    download:   'https://cdnjs.cloudflare.com/ajax/libs/downloadjs/1.4.8/download.min.js',
    jszip:      'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
    fileSaver:  'https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js',
    pdfjsMain:  'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.5.207/build/pdf.min.mjs',
    pdfjsWorker:'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.5.207/build/pdf.worker.min.mjs',
};

const PDFGlobals = {
    // Delegates to shared loader in common.js
    loadScript: (src) => window.BangUtils.loadScript(src),

    loadStandardLib: async () => {
        try {
            await Promise.all([
                PDFGlobals.loadScript(PDF_LIBS.pdfLib),
                PDFGlobals.loadScript(PDF_LIBS.download),
                PDFGlobals.loadScript(PDF_LIBS.fileSaver),
            ]);
        } catch (error) {
            console.error('Failed to load PDF libraries:', error);
            alert('Failed to load necessary libraries. Please check your internet connection.');
        }
    },

    loadZipLib: async () => {
        try {
            await PDFGlobals.loadScript(PDF_LIBS.jszip);
        } catch (error) {
            console.error('Failed to load JSZip:', error);
        }
    },

    // Load PDF.js v5.x as ES module
    loadPdfJsLib: async () => {
        if (window.pdfjsLib) return;
        try {
            const pdfjs = await import(PDF_LIBS.pdfjsMain);
            window.pdfjsLib = pdfjs;
            pdfjs.GlobalWorkerOptions.workerSrc = PDF_LIBS.pdfjsWorker;
        } catch (error) {
            console.error('Failed to load PDF.js:', error);
            alert('Failed to load PDF extraction libraries.');
        }
    },

    formatBytes: (bytes, decimals = 2) => window.BangUtils.formatBytes(bytes, decimals),
};

window.PDFGlobals = PDFGlobals;
