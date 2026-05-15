/**
 * Image Tools Shared Libraries Manager
 * Thin wrapper around /js/utils/common.js — loads CDN dependencies for image manipulation.
 */

const IMAGE_LIBS = {
    fabric:     'https://cdn.jsdelivr.net/npm/fabric@7.2.0/dist/index.min.js',
    cropperJs:  'https://cdn.jsdelivr.net/npm/cropperjs@2.1.0/dist/cropper.min.js',
    cropperCss: 'https://cdn.jsdelivr.net/npm/cropperjs@2.1.0/dist/cropper.min.css',
};

const ImageGlobals = {
    loadScript:     (src)  => window.BangUtils.loadScript(src),
    loadStylesheet: (href) => window.BangUtils.loadStylesheet(href),

    loadFabric: async () => {
        try {
            await ImageGlobals.loadScript(IMAGE_LIBS.fabric);
        } catch (error) {
            console.error('Failed to load Fabric.js:', error);
            alert('Failed to load canvas library. Please check your internet connection.');
        }
    },

    loadCropper: async () => {
        try {
            await ImageGlobals.loadScript(IMAGE_LIBS.cropperJs);
            // CSS load is best-effort; v2 may bundle styles
            ImageGlobals.loadStylesheet(IMAGE_LIBS.cropperCss).catch(() => {
                console.warn('Cropper.js CSS failed to load (may be bundled in JS).');
            });
            // Cropper.js v2 CDN exports constructor at Cropper.default
            if (typeof Cropper !== 'undefined' && Cropper.default) {
                window.Cropper = Cropper.default;
            }
        } catch (error) {
            console.error('Failed to load Cropper.js:', error);
            alert('Failed to load cropping library. Please check your internet connection.');
        }
    },

    formatBytes: (bytes, decimals = 2) => window.BangUtils.formatBytes(bytes, decimals),
};

window.ImageGlobals = ImageGlobals;
