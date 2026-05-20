
import { AutoModel, AutoProcessor, AutoTokenizer, RawImage, env, AutoModelForVision2Seq, AutoModelForImageTextToText, LogLevel } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4';

// Configuration
env.allowLocalModels = false;
env.useBrowserCache = true;
env.logLevel = LogLevel.WARNING;

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
    progressBar: document.getElementById('progress-bar'),
    loadingTitle: document.getElementById('loading-title'),
    loadingMessage: document.getElementById('loading-message'),
    webgpuBadge: document.getElementById('webgpu-badge'),
};

// Models
const MODELS = {
    tesseract: 'tesseract',
    florence2: 'onnx-community/Florence-2-base-ft',
    smolvlm: 'HuggingFaceTB/SmolVLM-256M-Instruct',
    granite: 'onnx-community/granite-docling-258M-ONNX',
    lfm2vl: 'onnx-community/LFM2-VL-450M-ONNX',
};

const MODEL_DESCS = {
    tesseract: "Classic WASM OCR — fast, reliable, supports 11 languages.",
    florence2: "Florence-2 Base · ~198 MB via WebGPU. Best for structured document OCR.",
    smolvlm: "SmolVLM 256M · ~189 MB via WebGPU. Compact vision-language model.",
    granite: "Granite Docling 258M · ~264 MB via WebGPU. Optimized for document understanding.",
    lfm2vl: "LFM2-VL 450M (LiquidAI) · ~548 MB via WebGPU. Hybrid Mamba+attention VLM, 32K context.",
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
        els.progressBar.style.width = "0%";
    }
}

function updateProgress(pct) {
    els.progressOverlay.style.width = pct + "%";
    els.progressBar.style.width = pct + "%";
}

async function checkWebGPU() {
    const badge = els.webgpuBadge;
    if (!badge) return false;

    badge.className = 'mt-2 ml-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500';
    badge.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin text-xs"></i> Checking WebGPU...';
    badge.classList.remove('hidden');

    if (!navigator.gpu) {
        badge.className = 'mt-2 ml-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200';
        badge.innerHTML = '<i class="fa-solid fa-microchip text-xs"></i> WebGPU unavailable — CPU/WASM only';
        return false;
    }

    try {
        const adapter = await navigator.gpu.requestAdapter();
        if (adapter) {
            badge.className = 'mt-2 ml-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200';
            badge.innerHTML = '<i class="fa-solid fa-bolt text-xs"></i> WebGPU available';
            return true;
        }
    } catch (e) {
        console.warn('WebGPU adapter request failed:', e);
    }

    badge.className = 'mt-2 ml-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200';
    badge.innerHTML = '<i class="fa-solid fa-microchip text-xs"></i> WebGPU unavailable — CPU/WASM only';
    return false;
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
            granite: 'Granite Docling',
            lfm2vl: 'LFM2-VL',
        };

        if (state.currentModelId !== 'tesseract') {
            showLoading(true, `Loading ${modelNameMap[state.currentModelId]}`, "Downloading models... (this happens once)");
            updateProgress(0);
        }

        const options = {
            device,
            dtype: 'q4f16',
        };

        const selectedModelId = MODELS[state.currentModelId];
        console.log(`Initializing model ${selectedModelId} with options:`, options);

        // Load Processor & Tokenizer (Skip for Tesseract; lfm2vl tokenizer is inside processor)
        if (state.currentModelId !== 'tesseract') {
            if (!state.processor) {
                showLoading(true, "Loading Processor", "Preparing inputs...");
                state.processor = await AutoProcessor.from_pretrained(selectedModelId);
            }
            if (!state.tokenizer && state.currentModelId !== 'lfm2vl') {
                showLoading(true, "Loading Tokenizer", "Preparing text handler...");
                state.tokenizer = await AutoTokenizer.from_pretrained(selectedModelId);
            }
        }

        // Load Model
        const shortName = f => f
            ? f.split('/').pop()
                .replace(/[_-]?(q4f16|q4|fp16|fp32|int8|quantized)(\.(onnx_data|onnx|bin))?$/i, '')
                .replace(/\.(onnx_data|onnx|bin)$/i, '')
            : '';

        const fileProgress = {};
        const fileSizes = {};

        const calcOverall = () => {
            const files = Object.keys(fileProgress);
            if (!files.length) return 0;
            let totalBytes = 0, loadedBytes = 0;
            for (const f of files) {
                const size = fileSizes[f] || 1;
                totalBytes += size;
                loadedBytes += size * (fileProgress[f] / 100);
            }
            return totalBytes > 0 ? (loadedBytes / totalBytes) * 100 : 0;
        };

        const progressCallback = (data) => {
            const name = shortName(data.file);
            if (data.status === 'initiate') {
                fileProgress[data.file] = 0;
                if (name) els.loadingMessage.textContent = `Preparing ${name}…`;
            } else if (data.status === 'progress') {
                fileProgress[data.file] = data.progress || 0;
                if (data.total) fileSizes[data.file] = data.total;
                updateProgress(calcOverall().toFixed(1));
                if (name) els.loadingMessage.textContent = `Downloading ${name}…`;
            } else if (data.status === 'done') {
                fileProgress[data.file] = 100;
                updateProgress(calcOverall().toFixed(1));
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

        if (state.currentModelId === 'lfm2vl') {
            state.model = await AutoModelForImageTextToText.from_pretrained(selectedModelId, {
                device,
                dtype: { vision_encoder: 'fp16', embed_tokens: 'fp16', decoder_model_merged: 'q4f16' },
                progress_callback: progressCallback,
            });
        } else if (state.currentModelId === 'smolvlm' || state.currentModelId === 'granite') {
            state.model = await AutoModelForVision2Seq.from_pretrained(selectedModelId, {
                ...options,
                progress_callback: progressCallback
            });
        } else {
            // Florence-2: q4f16 export has an ONNX subgraph graph bug; fp16 is clean
            state.model = await AutoModel.from_pretrained(selectedModelId, {
                device,
                dtype: 'fp16',
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

// ── Per-model OCR handlers ────────────────────────────────────────────────────
// Each function receives a RawImage (or the original URL for Tesseract) and
// returns the extracted text string. They rely on the shared `state` object.

async function ocrTesseract(imageUrl) {
    const result = await state.tesseractWorker.recognize(imageUrl);
    return result.data.text;
}

async function ocrSmolVLM(image) {
    const messages = [{
        role: 'user',
        content: [{ type: 'image' }, { type: 'text', text: 'Extract all text from this image exactly as written, preserving all diacritical marks and special characters.' }],
    }];
    const applyTemplate = state.processor.apply_chat_template ?? state.tokenizer.apply_chat_template;
    if (!applyTemplate) throw new Error('No apply_chat_template found');
    const textInputs = applyTemplate.call(state.processor.apply_chat_template ? state.processor : state.tokenizer, messages, { render_bos_token: false });
    const inputs = await state.processor(textInputs, [image]);
    const outputs = await state.model.generate({ ...inputs, max_new_tokens: 1024, do_sample: false, repetition_penalty: 1.1 });
    const full = state.tokenizer.decode(outputs[0], { skip_special_tokens: true });
    const prompt = state.tokenizer.decode(inputs.input_ids[0], { skip_special_tokens: true });
    return full.replace(prompt, '').replace(/^A:\s*/, '').trim();
}

async function ocrGranite(image) {
    // Encoder-decoder seq2seq — processor expects (text, [images]) order
    const inputs = await state.processor('Convert this document to text, preserving all diacritical marks and special characters.', [image]);
    const outputs = await state.model.generate({ ...inputs, max_new_tokens: 1024, do_sample: false, repetition_penalty: 1.3 });
    const full = state.tokenizer.decode(outputs[0], { skip_special_tokens: true });
    const prompt = state.tokenizer.decode(inputs.input_ids[0], { skip_special_tokens: true });
    return full.replace(prompt, '').trim();
}

async function ocrLFM2VL(image) {
    const messages = [
        { role: 'system', content: 'You are a helpful multimodal assistant.' },
        { role: 'user', content: [{ type: 'image' }, { type: 'text', text: 'Extract all text from this image exactly as written, preserving all diacritical marks, special characters, and line breaks. Output only the extracted text.' }] },
    ];
    const chatPrompt = state.processor.apply_chat_template(messages, { add_generation_prompt: true });
    const inputs = await state.processor(chatPrompt, [image]);
    const outputs = await state.model.generate({ ...inputs, max_new_tokens: 1024, do_sample: false });
    const full = state.processor.tokenizer.decode(outputs[0], { skip_special_tokens: true });
    const prompt = state.processor.tokenizer.decode(inputs.input_ids[0], { skip_special_tokens: true });
    return full.replace(prompt, '').trim();
}

async function ocrFlorence2(image) {
    const inputs = await state.processor(image, '<OCR>');
    const outputs = await state.model.generate({ ...inputs, max_new_tokens: 1024, do_sample: false, repetition_penalty: 1.1 });
    return state.tokenizer.batch_decode(outputs, { skip_special_tokens: false })[0]
        .replaceAll('<s>', '').replaceAll('</s>', '').replace('<OCR>', '').trim();
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

const OCR_HANDLERS = {
    tesseract: (imageUrl) => ocrTesseract(imageUrl),
    smolvlm:   (_, image) => ocrSmolVLM(image),
    granite:   (_, image) => ocrGranite(image),
    lfm2vl:    (_, image) => ocrLFM2VL(image),
    florence2: (_, image) => ocrFlorence2(image),
};

async function performOCR(imageUrl) {
    const isReady = state.currentModelId === 'tesseract'
        ? !!state.tesseractWorker
        : state.model && state.processor && (state.tokenizer || state.currentModelId === 'lfm2vl');
    if (!isReady) { alert('Model not ready!'); return; }

    state.isProcessing = true;
    showLoading(true, 'Processing Image', 'Extracting text...');
    els.result.value = '';
    updateProgress(0);

    try {
        const image = state.currentModelId !== 'tesseract' ? await RawImage.fromURL(imageUrl) : null;
        const handler = OCR_HANDLERS[state.currentModelId];
        els.result.value = await handler(imageUrl, image);
        showLoading(false);
        setStatus(`<i class="fa-solid fa-check text-green-500"></i> Completed (${state.currentDevice.toUpperCase()})`, true);
    } catch (error) {
        console.error('OCR Error:', error);
        showLoading(false);
        if (error instanceof DOMException) {
            // WebGPU device lost — reset and reload
            Object.assign(state, { model: null, processor: null, tokenizer: null, currentDevice: null });
            els.fileInput.disabled = true;
            setStatus(`<i class="fa-solid fa-rotate-right text-amber-500"></i> GPU context lost, reloading model…`);
            await initModel();
        } else {
            setStatus(`<i class="fa-solid fa-triangle-exclamation text-red-500"></i> Processing Error`);
            els.result.value = `Error: ${error.message}`;
        }
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
    if (!confirm("This will delete all cached models. Are you sure?")) return;
    try {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
        alert("Cache cleared. Reloading...");
        location.reload();
    } catch (e) { alert("Error clearing cache: " + e.message); }
});

// Wait for Service Worker to control the page before loading models,
// so the first download is also cached.
async function waitForServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
        await navigator.serviceWorker.register('/sw.js');
        if (!navigator.serviceWorker.controller) {
            await Promise.race([
                new Promise(r => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true })),
                new Promise(r => setTimeout(r, 3000)),
            ]);
        }
    } catch (e) {
        console.warn('Service Worker registration failed:', e);
    }
}

// Initialize on load
window.addEventListener('load', async () => {
    state.currentModelId = els.modelSelect.value;
    els.modelDesc.textContent = MODEL_DESCS[state.currentModelId] || "";
    initLanguageSelect();
    checkWebGPU();
    await waitForServiceWorker();
    initModel('webgpu');
});
