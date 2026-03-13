const fileInput = document.getElementById("fileInput");
const uploadView = document.getElementById("uploadView");
const workspaceView = document.getElementById("workspaceView");
const panelContent = document.getElementById("panelContent");
const btnSave = document.getElementById("btnSave");
const downloadLink = document.getElementById("downloadLink");
const btnReset = document.getElementById("btnReset");

const cropperContainer = document.getElementById("cropperContainer");
const cropperImage = document.getElementById("cropperImage");

let canvas;
let originalFile = null;
let currentMode = "filter";
let cropper = null;

// --- Templates ---
const filtersHTML = `
    <h3 class="font-bold text-gray-900 mb-4 flex items-center gap-2"><i class="fa-solid fa-wand-magic-sparkles text-purple-600"></i> Filters</h3>
    <div class="space-y-3">
        <button onclick="applyFilter('grayscale')" class="w-full py-2 px-4 rounded-lg border border-gray-200 bg-white hover:border-purple-500 text-left text-sm font-medium transition-all">Grayscale</button>
        <button onclick="applyFilter('sepia')" class="w-full py-2 px-4 rounded-lg border border-gray-200 bg-white hover:border-purple-500 text-left text-sm font-medium transition-all">Sepia</button>
        <button onclick="applyFilter('invert')" class="w-full py-2 px-4 rounded-lg border border-gray-200 bg-white hover:border-purple-500 text-left text-sm font-medium transition-all">Invert</button>
        <button onclick="applyFilter('none')" class="w-full py-2 px-4 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 text-left text-sm font-medium transition-all">Remove Filters</button>
    </div>
`;

const cropHTML = `
    <h3 class="font-bold text-gray-900 mb-4 flex items-center gap-2"><i class="fa-solid fa-crop-simple text-purple-600"></i> Crop</h3>
    <div class="space-y-4">
            <div class="grid grid-cols-2 gap-2">
            <button onclick="setCropRatio(16/9)" class="py-2 px-3 bg-white border border-gray-200 rounded-lg text-sm hover:border-purple-500 hover:text-purple-600">16:9</button>
            <button onclick="setCropRatio(4/3)" class="py-2 px-3 bg-white border border-gray-200 rounded-lg text-sm hover:border-purple-500 hover:text-purple-600">4:3</button>
            <button onclick="setCropRatio(1)" class="py-2 px-3 bg-white border border-gray-200 rounded-lg text-sm hover:border-purple-500 hover:text-purple-600">1:1</button>
            <button onclick="setCropRatio(NaN)" class="py-2 px-3 bg-white border border-gray-200 rounded-lg text-sm hover:border-purple-500 hover:text-purple-600">Free</button>
        </div>
        <button onclick="applyCrop()" class="w-full py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition-colors shadow-lg shadow-purple-500/30">Apply Crop</button>
        <button onclick="cancelCrop()" class="w-full py-2 border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50">Cancel</button>
    </div>
`;

const rotateHTML = `
    <h3 class="font-bold text-gray-900 mb-4 flex items-center gap-2"><i class="fa-solid fa-rotate-right text-purple-600"></i> Rotate</h3>
        <div class="grid grid-cols-2 gap-3">
        <button onclick="rotateCanvas(-90)" class="py-3 bg-white border border-gray-200 rounded-xl hover:border-purple-500 hover:text-purple-600 flex flex-col items-center justify-center gap-1">
            <i class="fa-solid fa-rotate-left"></i> <span class="text-xs">Left</span>
        </button>
        <button onclick="rotateCanvas(90)" class="py-3 bg-white border border-gray-200 rounded-xl hover:border-purple-500 hover:text-purple-600 flex flex-col items-center justify-center gap-1">
            <i class="fa-solid fa-rotate-right"></i> <span class="text-xs">Right</span>
        </button>
        <button onclick="flipCanvas('X')" class="py-3 bg-white border border-gray-200 rounded-xl hover:border-purple-500 hover:text-purple-600 flex flex-col items-center justify-center gap-1">
            <i class="fa-solid fa-arrows-left-right"></i> <span class="text-xs">Flip H</span>
        </button>
        <button onclick="flipCanvas('Y')" class="py-3 bg-white border border-gray-200 rounded-xl hover:border-purple-500 hover:text-purple-600 flex flex-col items-center justify-center gap-1">
            <i class="fa-solid fa-arrows-up-down"></i> <span class="text-xs">Flip V</span>
        </button>
    </div>
`;

const resizeHTML = `
    <h3 class="font-bold text-gray-900 mb-4 flex items-center gap-2"><i class="fa-solid fa-expand text-purple-600"></i> Resize</h3>
    <div class="space-y-4">
        <div class="flex gap-2">
                <div class="flex-1">
                <label class="text-xs font-semibold text-gray-500 uppercase">Width</label>
                <input type="number" id="resizeWidth" class="w-full p-2 border border-gray-200 rounded text-sm" oninput="onResizeInput('w')">
            </div>
                <div class="flex-1">
                <label class="text-xs font-semibold text-gray-500 uppercase">Height</label>
                <input type="number" id="resizeHeight" class="w-full p-2 border border-gray-200 rounded text-sm" oninput="onResizeInput('h')">
            </div>
        </div>
        <div class="flex items-center gap-2">
            <input type="checkbox" id="resizeLock" checked class="text-purple-600 focus:ring-purple-500 rounded">
            <label for="resizeLock" class="text-sm text-gray-600">Maintain Aspect Ratio</label>
        </div>
            <button onclick="applyResize()" class="w-full py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition-colors shadow-lg shadow-purple-500/30">Apply Resize</button>
    </div>
`;

const drawHTML = `
    <h3 class="font-bold text-gray-900 mb-4 flex items-center gap-2"><i class="fa-solid fa-paintbrush text-purple-600"></i> Drawing</h3>
    <div class="space-y-4">
            <div>
            <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Brush Color</label>
            <input type="color" id="brushColor" value="#9333ea" class="w-full h-10 rounded cursor-pointer" onchange="updateBrush()">
        </div>
            <div>
            <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Brush Size</label>
            <input type="range" id="brushSize" min="1" max="50" value="5" class="w-full accent-purple-600" oninput="updateBrush()">
        </div>
        <div class="flex items-center gap-2 mt-4">
                <input type="checkbox" id="drawingModeToggle" class="w-5 h-5 text-purple-600 rounded focus:ring-purple-500 border-gray-300" onchange="toggleDrawing(this.checked)">
                <label for="drawingModeToggle" class="font-medium text-gray-700">Enable Drawing</label>
        </div>
    </div>
`;

const textHTML = `
    <h3 class="font-bold text-gray-900 mb-4 flex items-center gap-2"><i class="fa-solid fa-font text-purple-600"></i> Add Text</h3>
        <div class="space-y-4">
        <input type="text" id="newTextVal" placeholder="Text Content" class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:border-purple-500 outline-none">
        <button onclick="addNewText()" class="w-full py-2 bg-purple-100 text-purple-600 rounded-lg text-sm font-medium hover:bg-purple-200">Add to Canvas</button>
    </div>
`;

// Init
fileInput.addEventListener("change", initCanvas);
btnReset.addEventListener("click", () => location.reload());
btnSave.addEventListener("click", saveImage);

// Drag Drop (Main)
const dropZone = document.querySelector('label[for="fileInput"]');
dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("border-purple-500", "bg-purple-50/50");
});
dropZone.addEventListener("dragleave", (e) => {
    e.preventDefault();
    dropZone.classList.remove("border-purple-500", "bg-purple-50/50");
});
dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("border-purple-500", "bg-purple-50/50");
    if (e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        initCanvas({ target: fileInput });
    }
});

async function initCanvas(e) {
    const file = e.target.files[0];
    if (!file) return;
    originalFile = file;
    await ImageGlobals.loadFabric();
    await ImageGlobals.loadCropper();

    const reader = new FileReader();
    reader.onload = async (f) => {
        const img = await fabric.FabricImage.fromURL(f.target.result);
        uploadView.classList.add("hidden");
        workspaceView.classList.remove("hidden");

        const container = document.getElementById("canvasContainer");
        const maxWidth = container.clientWidth - 40;
        const maxHeight = window.innerHeight * 0.7;

        let scale = 1;
        if (img.width > maxWidth || img.height > maxHeight) {
            scale = Math.min(maxWidth / img.width, maxHeight / img.height);
        }

        // Create canvas
        if (canvas) canvas.dispose();
        canvas = new fabric.Canvas("canvas");
        canvas.setDimensions({ width: img.width * scale, height: img.height * scale });

        img.scale(scale);
        canvas.backgroundImage = img;
        canvas.requestRenderAll();

        setMode("filter"); // Default mode
    };
    reader.readAsDataURL(file);
}

function setMode(mode) {
    // If we were in crop mode, cancel it silently or warn?
    // Simplest is to just force cancel crop if switching away
    if (currentMode === 'crop' && mode !== 'crop') {
        cancelCrop();
    }

    currentMode = mode;
    // UI Update
    document.querySelectorAll(".tool-btn").forEach((b) => {
        b.classList.remove("text-purple-600", "bg-purple-50", "ring-2", "ring-purple-100");
        b.classList.add("text-gray-500");
    });
    // Highlight active (simple check based on onclick)
    const activeBtn = Array.from(document.querySelectorAll(".tool-btn")).find((b) => b.onclick && b.onclick.toString().includes(mode));
    if (activeBtn) activeBtn.classList.add("text-purple-600", "bg-purple-50", "ring-2", "ring-purple-100");

    // Disable drawing mode on mode switch
    if (canvas) canvas.isDrawingMode = false;

    // Content Update
    if (mode === "filter") panelContent.innerHTML = filtersHTML;
    if (mode === "draw") panelContent.innerHTML = drawHTML;
    if (mode === "text") panelContent.innerHTML = textHTML;
    if (mode === "crop") {
        panelContent.innerHTML = cropHTML;
        startCrop();
    }
    if (mode === "rotate") panelContent.innerHTML = rotateHTML;
    if (mode === "resize") {
        panelContent.innerHTML = resizeHTML;
        // Init input values
        setTimeout(() => {
            document.getElementById('resizeWidth').value = canvas.width;
            document.getElementById('resizeHeight').value = canvas.height;
        }, 0);
    }
}

// --- Logic ---
function applyFilter(type) {
    const img = canvas.backgroundImage;
    if (!img) return;
    img.filters = []; // clear

    if (type === "grayscale") img.filters.push(new fabric.filters.Grayscale());
    if (type === "sepia") img.filters.push(new fabric.filters.Sepia());
    if (type === "invert") img.filters.push(new fabric.filters.Invert());

    img.applyFilters();
    canvas.renderAll();
}

function toggleDrawing(enable) {
    canvas.isDrawingMode = enable;
    if (enable) updateBrush();
}

function updateBrush() {
    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
    canvas.freeDrawingBrush.color = document.getElementById("brushColor").value;
    canvas.freeDrawingBrush.width = parseInt(document.getElementById("brushSize").value);
}

function addNewText() {
    const val = document.getElementById("newTextVal").value || "Text";
    const text = new fabric.IText(val, {
        left: canvas.width / 2,
        top: canvas.height / 2,
        originX: "center",
        originY: "center",
        fontSize: 30,
        fill: "#000000",
    });
    canvas.add(text);
    canvas.setActiveObject(text);
}

function deleteActive() {
    const active = canvas.getActiveObject();
    if (active) canvas.remove(active);
}

// --- Cropper Logic ---
function startCrop() {
    // 1. Convert canvas to image
    const dataURL = canvas.toDataURL({ multiplier: 1, quality: 1, format: 'png' });
    cropperImage.src = dataURL;

    // 2. Show container, hide canvas (visually)
    cropperContainer.classList.remove("hidden");

    // 3. Init Cropper
    if (cropper) cropper.destroy();
    cropper = new Cropper(cropperImage, {
        viewMode: 1,
        dragMode: 'move',
        autoCropArea: 1,
        background: false
    });
}

function setCropRatio(ratio) {
    if (cropper) cropper.setAspectRatio(ratio);
}

function cancelCrop() {
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
    cropperContainer.classList.add("hidden");
    // Switch back to filter or another default mode
    if (currentMode === 'crop') setMode('filter');
}

async function applyCrop() {
    if (!cropper) return;
    const croppedCanvas = cropper.getCroppedCanvas();
    const croppedDataURL = croppedCanvas.toDataURL('image/png');

    // Load into fabric
    const img = await fabric.FabricImage.fromURL(croppedDataURL);
    // Clear current canvas
    canvas.clear();

    // Resize canvas
    canvas.setDimensions({ width: img.width, height: img.height });

    // Set new background
    canvas.backgroundImage = img;
    canvas.requestRenderAll();

    // Cleanup
    cancelCrop(); // This also switches mode back
    setMode('filter');
}

// --- Rotation Logic ---
function rotateCanvas(angle) {
    const img = canvas.backgroundImage;
    if (!img) return;

    const currentAngle = img.angle;
    const newAngle = (currentAngle + angle) % 360;

    // Simplified: fully rotate the background image, recreate canvas dimensions
    // Problem: Fabric canvas doesn't auto-resize for rotated background.
    // Solution: We export the current state to DataURL, rotate via an intermediate step or just Rotate the object and resize canvas.

    // Better approach for "Image Editor" rotation:
    // 1. Rotate the background image object.
    // 2. Calculate new bounding box.
    // 3. Resize canvas to bounding box.
    // 4. Center image.

    img.rotate(newAngle).setCoords();

    // Logic to calculate new dimensions to fit the rotated image
    const rad = fabric.util.degreesToRadians(newAngle);
    const w = img.width * img.scaleX;
    const h = img.height * img.scaleY;
    // Standard bounding box rotation formula
    const newW = Math.abs(Math.sin(rad) * h) + Math.abs(Math.cos(rad) * w);
    const newH = Math.abs(Math.sin(rad) * w) + Math.abs(Math.cos(rad) * h);

    canvas.setDimensions({ width: newW, height: newH });

    img.left = newW / 2;
    img.top = newH / 2;
    img.originX = 'center';
    img.originY = 'center';

    canvas.renderAll();
}

function flipCanvas(axis) {
    const img = canvas.backgroundImage;
    if (!img) return;

    if (axis === 'X') img.set('flipX', !img.flipX);
    if (axis === 'Y') img.set('flipY', !img.flipY);

    canvas.renderAll();
}

// --- Resize Logic ---
function onResizeInput(dim) {
    const lock = document.getElementById("resizeLock").checked;
    const wInput = document.getElementById("resizeWidth");
    const hInput = document.getElementById("resizeHeight");

    // CurrentAspectRatio
    const aspect = canvas.width / canvas.height;

    if (dim === 'w' && lock) {
        hInput.value = Math.round(wInput.value / aspect);
    } else if (dim === 'h' && lock) {
        wInput.value = Math.round(hInput.value * aspect);
    }
}

function applyResize() {
    const w = parseInt(document.getElementById("resizeWidth").value);
    const h = parseInt(document.getElementById("resizeHeight").value);

    if (!w || !h) return;

    // Simple scaling:
    // 1. Export to dataURL
    // 2. Load as image with new size? 
    // OR just Resize Canvas and zoom/scale everything?
    // "Resizing the image" usually means changing resolution.

    // Best approach:
    // Scale the background Image to match new dimensions
    // Scale all objects? (Maybe complex)
    // Let's assume user just wants to resize the "Image" (background).

    const bg = canvas.backgroundImage;
    if (bg) {
        bg.scaleToWidth(w);
        bg.scaleToHeight(h);
    }

    canvas.setDimensions({ width: w, height: h });

    // NOTE: This doesn't scale added text/blobs. To do that, we'd need to group everything or scale them too.
    // For a simple "Image Editor", scaling the background is primary.
    // If user added text, it might get misplaced.
    // Ideally: canvas.setZoom() or similar.

    canvas.renderAll();
    setMode('filter'); // Exit resize
}

function saveImage() {
    btnSave.disabled = true;
    btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

    // IMPORTANT: If we are in crop mode, we should probably apply or cancel crop first? 
    // But 'Save' is on the sidebar... which is hidden in crop mode (replaced by crop controls).
    // So we are safe.

    const bg = canvas.backgroundImage;
    // We want to export at ORIGINAL size or Canvas size?
    // current fabric implementation: canvas.toDataURL defaults to canvas size.
    // If we zoomed in/out during initCanvas, we might want to respect that multiplier.
    // But currently initCanvas scales the image to fit screen. 
    // We should probably export at high quality.

    // Let's us try to export at 1.0 of current canvas size, enable multiplier if needed.
    // The original code calculated multiplier based on scaleX.

    let multiplier = 1;
    if (bg) {
        // Try to restore original resolution if possible?
        // Or just trust the canvas size (which might be resized by user).
        multiplier = 1 / bg.scaleX;
        // Wait, if we resized, scaleX might be 1 (if we used scaleToWidth). 
        // If we used `img.scale(scale)` in init, scaleX is < 1. 
        // So `1/scaleX` restores original size.
    }

    const dataURL = canvas.toDataURL({
        format: "jpeg",
        quality: 0.9,
        multiplier: multiplier,
    });

    downloadLink.href = dataURL;
    downloadLink.download = `edited_${originalFile.name}`;

    btnSave.classList.add("hidden");
    downloadLink.classList.remove("hidden");
    btnSave.disabled = false;
    btnSave.innerHTML = 'Save Image <i class="fa-solid fa-floppy-disk"></i>';
}
