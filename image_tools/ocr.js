
import { AutoModel, AutoProcessor, AutoTokenizer, RawImage, env, AutoModelForVision2Seq } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers';

// Configuration
env.allowLocalModels = false;
env.useBrowserCache = true;

// Suppress expected ONNX Runtime warnings
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

console.warn = function (...args) {
    const message = args.join(' ');
    if (message.includes('VerifyEachNodeIsAssignedToAnEp') ||
        message.includes('session_state.cc')) {
        return;
    }
    originalConsoleWarn.apply(console, args);
};

console.error = function (...args) {
    const message = args.join(' ');
    if (message.includes('VerifyEachNodeIsAssignedToAnEp') ||
        message.includes('session_state.cc') ||
        message.includes('[W:onnxruntime')) {
        return;
    }
    originalConsoleError.apply(console, args);
};

// Element Refs
const els = {
    modelSelect: document.getElementById('model-select'),
    languageSelect: document.getElementById('language-select'),
    languageContainer: document.getElementById('language-container'),
    copyBtn: document.getElementById('copy-btn'),
    modelDesc: document.getElementById('model-desc'),
    clearCacheBtn: document.getElementById('clear-cache-btn'),
    dropZone: document.getElementById('drop-zone'),
    fileInput: document.getElementById('file-input'),
    preview: document.getElementById('image-preview'),
    result: document.getElementById('result-text'),
    status: document.getElementById('status-text'),
    loadingOverlay: document.getElementById('loading-overlay'),
    progressOverlay: document.getElementById('progress-bar-overlay'),
    loadingTitle: document.getElementById('loading-title'),
    loadingMessage: document.getElementById('loading-message')
};

// Models
const MODELS = {
    tesseract: 'tesseract',
    florence2: 'onnx-community/Florence-2-base-ft',
    smolvlm: 'HuggingFaceTB/SmolVLM-256M-Instruct',
    granite: 'ibm-granite/granite-docling-258M-WebGPU',
};

const MODEL_DESCS = {
    tesseract: "Tesseract.js. Classic and reliable OCR running in WASM.",
    florence2: "Standard powerful OCR model. Good for general text.",
    smolvlm: "Small Vision Language Model. Excellent for complex reasoning and structure.",
    granite: "IBM Granite Docling (258M). Optimized for document understanding."
};

// Tesseract Languages
const TESS_LANGS = [
    { code: 'eng', name: 'English' },
    { code: 'vie', name: 'Vietnamese' },
    { code: 'chi_sim', name: 'Chinese (Simplified)' },
    { code: 'jpn', name: 'Japanese' },
    { code: 'kor', name: 'Korean' },
    { code: 'fra', name: 'French' },
    { code: 'deu', name: 'German' },
    { code: 'spa', name: 'Spanish' },
    { code: 'rus', name: 'Russian' },
    { code: 'hin', name: 'Hindi' },
    { code: 'ara', name: 'Arabic' }
];

let state = {
    currentModelId: 'tesseract', // Default matches select
    model: null,
    processor: null,
    tokenizer: null,
    currentDevice: null,
    isProcessing: false,
    tesseractWorker: null,
    currentLang: 'eng'
};

// UI Helpers
function setStatus(message, isReady = false) {
    els.status.innerHTML = message;
    els.status.classList.remove('hidden');
    if (isReady) {
        // can style if needed
    }
}

function showLoading(show, title = "Loading...", message = "") {
    if (show) {
        els.loadingOverlay.classList.remove('hidden');
        els.loadingTitle.textContent = title;
        els.loadingMessage.textContent = message;
    } else {
        els.loadingOverlay.classList.add('hidden');
    }
}

function updateProgress(pct) {
    els.progressOverlay.style.width = pct + "%";
}

// Populate Languages
function initLanguageSelect() {
    els.languageSelect.innerHTML = '';
    TESS_LANGS.forEach(lang => {
        const option = document.createElement('option');
        option.value = lang.code;
        option.textContent = lang.name;
        if (lang.code === 'eng') option.selected = true;
        els.languageSelect.appendChild(option);
    });
}

// Init Model
async function initModel(device = 'webgpu') {
    try {
        if (state.model) {
            // In a real app we might dispose, but JS GC handles it somewhat
        }

        // Clean up previous tesseract worker if exists and language changed
        if (state.tesseractWorker && state.currentModelId === 'tesseract') {
            // For simplicity, we'll terminate and re-create if it exists to ensure language switch
            await state.tesseractWorker.terminate();
            state.tesseractWorker = null;
        }

        state.model = null;
        state.processor = null;
        state.tokenizer = null;
        els.fileInput.disabled = true;

        // Toggle Language Dropdown
        if (state.currentModelId === 'tesseract') {
            els.languageContainer.classList.remove('hidden');
        } else {
            els.languageContainer.classList.add('hidden');
        }

        const modelNameMap = {
            smolvlm: 'SmolVLM',
            florence2: 'Florence-2',
            granite: 'Granite Docling'
        };

        if (state.currentModelId !== 'tesseract') {
            showLoading(true, `Loading ${modelNameMap[state.currentModelId]}`, "Downloading models... (this happens once)");
            updateProgress(0);
        }

        // Config
        const dtypeConfig = {
            embed_tokens: 'fp32',
            vision_encoder: 'fp32',
            encoder_model: 'q4',
            decoder_model_merged: 'q4',
        };

        const options = {
            device: device,
            dtype: dtypeConfig,
        };

        const selectedModelId = MODELS[state.currentModelId];
        console.log(`Initializing model ${selectedModelId} with options:`, options);

        // Load Processor & Tokenizer (Skip for Tesseract)
        if (state.currentModelId !== 'tesseract') {
            if (!state.processor) {
                showLoading(true, "Loading Processor", "Preparing inputs...");
                state.processor = await AutoProcessor.from_pretrained(selectedModelId);
            }
            if (!state.tokenizer) {
                showLoading(true, "Loading Tokenizer", "Preparing text handler...");
                state.tokenizer = await AutoTokenizer.from_pretrained(selectedModelId);
            }
        }

        // Load Model
        const progressCallback = (data) => {
            if (data.status === 'progress') {
                const percent = data.progress ? data.progress.toFixed(1) : 0;
                updateProgress(percent);
                if (data.file) {
                    els.loadingMessage.textContent = `Downloading ${data.file} (${percent}%)`;
                }
            } else if (data.status === 'initiate') {
                updateProgress(0);
                els.loadingMessage.textContent = `Initiating ${data.file}...`;
            }
        };


        if (state.currentModelId === 'tesseract') {
            if (!window.Tesseract) {
                throw new Error("Tesseract.js not loaded");
            }

            const lang = els.languageSelect.value || 'eng';
            showLoading(true, `Initializing Tesseract (${lang})`, "Loading WASM worker...");
            updateProgress(0);

            state.tesseractWorker = await Tesseract.createWorker(lang, 1, {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        updateProgress((m.progress * 100).toFixed(1));
                        els.loadingMessage.textContent = `Recognizing... ${Math.round(m.progress * 100)}%`;
                    }
                }
            });

            state.currentDevice = 'wasm';
            showLoading(false);
            setStatus(`<i class="fa-solid fa-check text-green-500"></i> Ready (WASM)`, true);
            els.fileInput.disabled = false;
            return true;
        }

        showLoading(true, "Loading Model Weights", "This is the heavy part...");

        if (state.currentModelId === 'smolvlm' || state.currentModelId === 'granite') {
            state.model = await AutoModelForVision2Seq.from_pretrained(selectedModelId, {
                ...options,
                progress_callback: progressCallback
            });
        } else {
            // Florence-2
            state.model = await AutoModel.from_pretrained(selectedModelId, {
                ...options,
                progress_callback: progressCallback
            });
        }

        state.currentDevice = device;
        showLoading(false);
        setStatus(`<i class="fa-solid fa-check text-green-500"></i> Ready (${device.toUpperCase()})`, true);
        els.fileInput.disabled = false;

        return true;

    } catch (error) {
        const errorMessage = error.message || String(error);
        console.error("Init Error:", error);

        if (device === 'webgpu' && (errorMessage.includes('No available adapters') || errorMessage.includes('WebGPU'))) {
            console.warn('WebGPU not available, switching to WASM...');
            showLoading(true, "WebGPU Failed", "Switching to CPU/WASM fallback...");
            return await initModel('wasm');
        }

        showLoading(false);
        setStatus(`<i class="fa-solid fa-triangle-exclamation text-red-500"></i> Error: ${errorMessage}`);
        els.result.value = `Error initializing model: ${errorMessage}`;
        return false;
    }
}

// OCR Logic
async function performOCR(imageUrl) {
    if (state.currentModelId === 'tesseract') {
        if (!state.tesseractWorker) {
            alert("Tesseract not ready!");
            return;
        }
    } else if (!state.model || !state.processor || !state.tokenizer) {
        alert("Model not ready!");
        return;
    }

    state.isProcessing = true;
    showLoading(true, "Processing Image", "Extracting text...");
    els.result.value = "";
    updateProgress(0); // Indeterminate or just show spinner

    try {
        const image = await RawImage.fromURL(imageUrl);
        let generatedText = '';

        if (state.currentModelId === 'tesseract') {
            if (!state.tesseractWorker) throw new Error("Worker not ready");
            const result = await state.tesseractWorker.recognize(imageUrl);
            generatedText = result.data.text;
        } else if (state.currentModelId === 'smolvlm' || state.currentModelId === 'granite') {
            // Vision Language Model Logic (SmolVLM & Granite)
            let messages = [];

            if (state.currentModelId === 'smolvlm') {
                messages = [
                    {
                        role: "user",
                        content: [
                            { type: "image" },
                            { type: "text", text: "Extract all text from this image." }
                        ]
                    }
                ];
            } else {
                // Granite
                messages = [
                    {
                        role: "user",
                        content: [
                            { type: "image" },
                            { type: "text", text: "What is written in this image?" }
                        ]
                    }
                ];
            }

            let text_inputs;
            if (state.processor.apply_chat_template) {
                text_inputs = state.processor.apply_chat_template(messages, { render_bos_token: false });
            } else if (state.tokenizer.apply_chat_template) {
                text_inputs = state.tokenizer.apply_chat_template(messages, { render_bos_token: false });
            } else {
                throw new Error('No apply_chat_template found');
            }

            const inputs = await state.processor(text_inputs, [image]);

            const outputs = await state.model.generate({
                ...inputs,
                max_new_tokens: 1024,
                do_sample: false,
            });

            // Decode
            const generatedFullText = state.tokenizer.decode(outputs[0], { skip_special_tokens: true });

            if (state.currentModelId === 'smolvlm') {
                // SmolVLM Logic
                const promptText = state.tokenizer.decode(inputs.input_ids[0], { skip_special_tokens: true });
                generatedText = generatedFullText.replace(promptText, '').replace(/^A:\s*/, '').trim();
            } else {
                // Granite Logic
                const promptText = state.tokenizer.decode(inputs.input_ids[0], { skip_special_tokens: true });
                generatedText = generatedFullText.replace(promptText, '').trim();
            }

        } else {
            // Florence-2 Logic
            const prompt = '<OCR>';
            const inputs = await state.processor(image, prompt);

            const outputs = await state.model.generate({
                ...inputs,
                max_new_tokens: 1024,
                do_sample: false,
            });

            generatedText = state.tokenizer.batch_decode(outputs, { skip_special_tokens: false })[0];
            const promptStr = '<OCR>';
            generatedText = generatedText.replaceAll('<s>', '').replaceAll('</s>', '').replaceAll(promptStr, '').trim();
        }

        els.result.value = generatedText;
        showLoading(false);
        setStatus(`<i class="fa-solid fa-check text-green-500"></i> Completed (${state.currentDevice.toUpperCase()})`, true);

    } catch (error) {
        console.error('OCR Error:', error);
        showLoading(false);
        setStatus(`<i class="fa-solid fa-triangle-exclamation text-red-500"></i> Processing Error`);
        els.result.value = `Error: ${error.message}`;
    } finally {
        state.isProcessing = false;
    }
}

// Event Listeners
els.modelSelect.addEventListener('change', async (e) => {
    state.currentModelId = e.target.value;
    els.modelDesc.textContent = MODEL_DESCS[state.currentModelId] || "";

    // Clean UI
    els.result.value = "";
    els.preview.classList.add('hidden');
    els.preview.src = "";
    document.querySelector('.upload-content').classList.remove('opacity-0');
    setStatus("Switching models...", false);

    await initModel('webgpu');
});

els.languageSelect.addEventListener('change', async () => {
    // Reload model (Tesseract only) with new language
    if (state.currentModelId === 'tesseract') {
        setStatus(`Switching language to ${els.languageSelect.options[els.languageSelect.selectedIndex].text}...`, false);
        await initModel();
    }
});

// Drag & Drop / File Input
els.dropZone.addEventListener('click', () => {
    if (!els.fileInput.disabled) els.fileInput.click();
});

els.dropZone.addEventListener('dragover', (e) => { e.preventDefault(); els.dropZone.classList.add('border-sky-400', 'bg-sky-50'); });
els.dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); els.dropZone.classList.remove('border-sky-400', 'bg-sky-50'); });

els.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    els.dropZone.classList.remove('border-sky-400', 'bg-sky-50');
    if (!els.fileInput.disabled) handleFile(e.dataTransfer.files[0]);
});

els.fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));

function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        els.preview.src = e.target.result;
        els.preview.classList.remove('hidden');
        document.querySelector('.upload-content').classList.add('opacity-0');
        performOCR(e.target.result);
    };
    reader.readAsDataURL(file);
}

els.copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(els.result.value);
    els.copyBtn.innerHTML = '<i class="fa-solid fa-check text-green-500"></i>';
    setTimeout(() => els.copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>', 2000);
});

els.clearCacheBtn.addEventListener('click', async () => {
    if (confirm("This will delete all downloaded models. Are you sure?")) {
        try {
            const cacheKeys = await caches.keys();
            for (const key of cacheKeys) {
                if (key.includes('transformers')) await caches.delete(key);
            }
            alert("Cache cleared. Reloading...");
            location.reload();
        } catch (e) { alert("Error clearing cache: " + e.message); }
    }
});

// Initialize on load
window.addEventListener('load', () => {
    // Set initial model from select
    state.currentModelId = els.modelSelect.value;
    els.modelDesc.textContent = MODEL_DESCS[state.currentModelId] || "";
    initLanguageSelect();
    initModel('webgpu');
});
