/**
 * Image Tools Shared Libraries Manager
 * Handles loading of external dependencies and common image utility functions.
 */
/* global Cropper */

const IMAGE_LIBS = {
    fabric: "https://cdn.jsdelivr.net/npm/fabric@7.2.0/dist/index.min.js",
    cropperJs:
        "https://cdn.jsdelivr.net/npm/cropperjs@2.1.0/dist/cropper.min.js",
    cropperCss:
        "https://cdn.jsdelivr.net/npm/cropperjs@2.1.0/dist/cropper.min.css",
};

const ImageGlobals = {
    // Utility to load a script dynamically (deduplicates by src)
    loadScript: (src) => {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            const script = document.createElement("script");
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },

    // Utility to load a stylesheet dynamically (deduplicates by href)
    loadStylesheet: (href) => {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`link[href="${href}"]`)) {
                resolve();
                return;
            }
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = href;
            link.onload = resolve;
            link.onerror = reject;
            document.head.appendChild(link);
        });
    },

    // Load Fabric.js for canvas manipulation
    loadFabric: async () => {
        try {
            await ImageGlobals.loadScript(IMAGE_LIBS.fabric);
            console.log("Fabric.js 7.2.0 loaded.");
        } catch (error) {
            console.error("Failed to load Fabric.js:", error);
            alert(
                "Failed to load canvas library. Please check your internet connection.",
            );
        }
    },

    // Load Cropper.js for image cropping (JS + CSS)
    loadCropper: async () => {
        try {
            // Load JS (required) and CSS (best-effort, v2 may bundle styles)
            await ImageGlobals.loadScript(IMAGE_LIBS.cropperJs);
            ImageGlobals.loadStylesheet(IMAGE_LIBS.cropperCss).catch(() => {
                console.warn("Cropper.js CSS failed to load (may be bundled in JS).");
            });
            // Cropper.js v2 CDN exports constructor at Cropper.default
            if (typeof Cropper !== "undefined" && Cropper.default) {
                window.Cropper = Cropper.default;
            }
            console.log("Cropper.js 2.1.0 loaded.");
        } catch (error) {
            console.error("Failed to load Cropper.js:", error);
            alert(
                "Failed to load cropping library. Please check your internet connection.",
            );
        }
    },

    // Format bytes to human readable string
    formatBytes: (bytes, decimals = 2) => {
        if (!+bytes) return "0 Bytes";
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    },
};

window.ImageGlobals = ImageGlobals;
