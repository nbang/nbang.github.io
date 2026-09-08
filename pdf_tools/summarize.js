
import { pipeline, env, LogLevel } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4';

// Configuration
env.allowLocalModels = false;
env.useBrowserCache = true;
env.logLevel = LogLevel.WARNING;

// Element Refs
const els = {
    modelSelect: document.getElementById('model-select'),
    lengthSelect: document.getElementById('length-select'),
    fileInput: document.getElementById('file-input'),
    dropZone: document.getElementById('drop-zone'),
    uploadContent: document.querySelector('.upload-content'),
    fileInfo: document.getElementById('file-info'),
    uploadedFilename: document.getElementById('uploaded-filename'),
    uploadedFilesize: document.getElementById('uploaded-filesize'),
    removeFileBtn: document.getElementById('remove-file-btn'),
    actionSection: document.getElementById('action-section'),
    summarizeBtn: document.getElementById('summarize-btn'),
    progressContainer: document.getElementById('progress-container'),
    progressBar: document.getElementById('progress-bar'),
    status: document.getElementById('status-text'),
    result: document.getElementById('result-text'),
    copyBtn: document.getElementById('copy-btn'),
    downloadBtn: document.getElementById('download-btn'),
    clearCacheBtn: document.getElementById('clear-cache-btn'),
    webgpuBadge: document.getElementById('webgpu-badge'),
};

// Models
const MODEL_CONFIGS = {
    'Xenova/distilbart-cnn-6-6':                       { task: 'summarization',   dtype: 'quantized', device: 'wasm'   },
    'onnx-community/LFM2.5-350M-ONNX':                 { task: 'text-generation', dtype: 'q4',        device: 'webgpu' },
    'HuggingFaceTB/SmolLM2-360M-Instruct':             { task: 'text-generation', dtype: 'q4f16',     device: 'webgpu' },
    'onnx-community/Falcon-H1-Tiny-90M-Instruct-ONNX': { task: 'text-generation', dtype: 'q4f16',     device: 'webgpu' },
    'onnx-community/Bonsai-1.7B-ONNX':                 { task: 'text-generation', dtype: 'q1',        device: 'webgpu' },
    'Xenova/LaMini-Flan-T5-248M':                      { task: 'summarization',   dtype: 'q4f16',     device: 'wasm'   },
};

const DEFAULT_MODEL_CONFIG = { task: 'summarization', dtype: 'quantized', device: 'wasm' };

// Summary length presets (new tokens generated per summary)
const LENGTH_PRESETS = {
    short:  { max: 100, min: 20 },
    medium: { max: 200, min: 50 },
    long:   { max: 500, min: 150 },
};

let state = {
    currentModelId: 'Xenova/distilbart-cnn-6-6', // Default matches select
    summarizer: null,
    isProcessing: false,
    pdfText: '',
};

// ── Chunked Caching Logic (shared concept with the OCR tool) ──────────────────

const DB_NAME = 'TransformersChunkedCache';
const DB_VERSION = 1;
const STORE_NAME = 'models';
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function storeInChunks(url, blob) {
    const db = await openDB();
    const totalSize = blob.size;
    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);

    const meta = { url, totalSize, totalChunks, mimeType: blob.type, timestamp: Date.now() };

    await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(meta, url);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });

    for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, totalSize);
        const chunk = blob.slice(start, end);
        await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(chunk, `${url}_chunk_${i}`);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }
    console.log(`Stored ${url} in ${totalChunks} chunks`);
}

async function retrieveFromChunks(url) {
    const db = await openDB();
    const meta = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(url);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });

    if (!meta) return null;

    const chunks = [];
    for (let i = 0; i < meta.totalChunks; i++) {
        const chunk = await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).get(`${url}_chunk_${i}`);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        if (!chunk) return null;
        chunks.push(chunk);
    }
    return new Blob(chunks, { type: meta.mimeType });
}

// Override fetch so model weights are served from IndexedDB on repeat visits
const originalFetch = window.fetch;
window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.includes('cdn.jsdelivr.net') || (!url.includes('huggingface') && !url.includes('.onnx') && !url.includes('.bin') && !url.includes('model.safetensors'))) {
        return originalFetch(input, init);
    }
    try {
        const cachedBlob = await retrieveFromChunks(url);
        if (cachedBlob) {
            console.log(`[Cache Hit] Serving ${url} from IDB`);
            return new Response(cachedBlob);
        }
    } catch (e) {
        console.warn('Cache retrieval failed, fetching network:', e);
    }
    const response = await originalFetch(input, init);
    if (response.ok) {
        const clone = response.clone();
        clone.blob().then(blob => storeInChunks(url, blob).catch(err => console.error('Cache write failed:', err)));
    }
    return response;
};

// ── UI Helpers ────────────────────────────────────────────────────────────────

function setStatus(text, percent) {
    els.status.textContent = text;
    if (percent !== undefined) els.progressBar.style.width = `${percent}%`;
}

function resetUI() {
    els.uploadContent.classList.remove('hidden');
    els.fileInfo.classList.add('hidden');
    els.fileInfo.classList.remove('flex');
    els.actionSection.classList.add('hidden');
    els.result.value = '';
    els.progressContainer.classList.add('hidden');
    els.progressBar.style.width = '0%';
    els.status.textContent = 'Ready to summarize';
}

async function checkWebGPU() {
    const badge = els.webgpuBadge;
    if (!badge) return false;

    badge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500';
    badge.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin text-xs"></i> Checking WebGPU...';
    badge.classList.remove('hidden');

    if (!navigator.gpu) {
        badge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200';
        badge.innerHTML = '<i class="fa-solid fa-microchip text-xs"></i> WebGPU unavailable — CPU/WASM only';
        return false;
    }

    try {
        const adapter = await navigator.gpu.requestAdapter();
        if (adapter) {
            badge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200';
            badge.innerHTML = '<i class="fa-solid fa-bolt text-xs"></i> WebGPU available';
            return true;
        }
    } catch (e) {
        console.warn('WebGPU adapter request failed:', e);
    }

    badge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200';
    badge.innerHTML = '<i class="fa-solid fa-microchip text-xs"></i> WebGPU unavailable — CPU/WASM only';
    return false;
}

// ── Model loading ─────────────────────────────────────────────────────────────

const shortName = f => f
    ? f.split('/').pop()
        .replace(/[_-]?(q4f16|q4|fp16|fp32|int8|quantized)(\.(onnx_data|onnx|bin))?$/i, '')
        .replace(/\.(onnx_data|onnx|bin)$/i, '')
    : '';

async function initModel() {
    if (state.summarizer && state.summarizer.modelName === state.currentModelId) return state.summarizer;

    const cfg = MODEL_CONFIGS[state.currentModelId] || DEFAULT_MODEL_CONFIG;
    const device = cfg.device === 'webgpu' && navigator.gpu ? 'webgpu' : 'wasm';

    setStatus(`Loading model ${state.currentModelId.split('/')[1]}...`, 35);
    els.progressBar.classList.add('pulse');

    const progressCallback = (data) => {
        const name = shortName(data.file);
        if (data.status === 'initiate') {
            setStatus(name ? `Preparing ${name}…` : 'Preparing…', 36);
        } else if (data.status === 'download') {
            setStatus(name ? `Downloading ${name}…` : 'Downloading…', 37);
        } else if (data.status === 'progress') {
            const pct = 35 + (data.progress * 55);
            setStatus(name ? `Downloading ${name} (${Math.round(data.progress)}%)` : `Downloading… (${Math.round(data.progress)}%)`, pct);
        } else if (data.status === 'done') {
            setStatus(name ? `Loaded ${name}` : 'Loaded', 90);
        }
    };

    state.summarizer = await pipeline(cfg.task, state.currentModelId, {
        device,
        dtype: cfg.dtype,
        progress_callback: progressCallback,
    });
    state.summarizer.modelName = state.currentModelId;

    els.progressBar.classList.remove('pulse');
    return state.summarizer;
}

// ── PDF text extraction ───────────────────────────────────────────────────────

async function extractTextFromPDF(file) {
    setStatus('Extracting text from PDF...', 10);
    els.progressContainer.classList.remove('hidden');

    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        let fullText = '';
        const numPages = pdf.numPages;

        for (let i = 1; i <= numPages; i++) {
            setStatus(`Extracting page ${i} of ${numPages}...`, 10 + Math.round((i / numPages) * 20));
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            fullText += textContent.items.map(item => item.str).join(' ') + ' ';
        }

        state.pdfText = fullText.replace(/\s+/g, ' ').trim();
        console.log(`Extracted ${state.pdfText.length} chars`);
        setStatus(`Ready to summarize (${numPages} pages, ~${Math.round(state.pdfText.length / 4)} tokens)`, 30);

        if (state.pdfText.length === 0) {
            alert('No text found in PDF. It might be a scanned image.');
            els.status.textContent = 'Error: Scanned PDF detected (no text). Use OCR tool instead.';
            els.actionSection.classList.add('hidden');
        }
    } catch (error) {
        console.error(error);
        els.status.textContent = 'Error reading PDF: ' + error.message;
    }
}

// ── Summarization ─────────────────────────────────────────────────────────────

async function summarizeChat(text, lengthSetting, maxNewTokens) {
    const messages = [
        { role: 'system', content: 'You are a helpful assistant that summarizes text concisely.' },
        { role: 'user', content: `Summarize the following text in a ${lengthSetting} paragraph:\n\n${text}` },
    ];
    // v4 pipeline natively handles message arrays for text-generation
    const output = await state.summarizer(messages, { max_new_tokens: maxNewTokens, do_sample: false });
    return output[0].generated_text.at(-1).content;
}

async function summarizeSeq2Seq(text, maxNewTokens, minNewTokens) {
    const output = await state.summarizer(text, { max_new_tokens: maxNewTokens, min_new_tokens: minNewTokens });
    return output[0].summary_text;
}

async function runSummarization() {
    if (!state.pdfText || state.isProcessing) return;
    state.isProcessing = true;
    els.summarizeBtn.disabled = true;
    els.result.value = '';

    const lengthSetting = els.lengthSelect.value;
    const { max: maxNewTokens, min: minNewTokens } = LENGTH_PRESETS[lengthSetting] || LENGTH_PRESETS.medium;

    const cfg = MODEL_CONFIGS[state.currentModelId] || DEFAULT_MODEL_CONFIG;
    const isChatModel = cfg.task === 'text-generation';

    try {
        await initModel();

        setStatus('Generating summary...', 90);
        els.progressBar.classList.add('pulse');

        // Chat models can often handle more context, but let's be safe
        const MAX_CHARS = isChatModel ? 12000 : 4000;
        const truncated = state.pdfText.length > MAX_CHARS;
        const textToProcess = truncated ? state.pdfText.substring(0, MAX_CHARS) : state.pdfText;

        let summary = isChatModel
            ? await summarizeChat(textToProcess, lengthSetting, maxNewTokens)
            : await summarizeSeq2Seq(textToProcess, maxNewTokens, minNewTokens);

        if (truncated) {
            summary += `\n\n(Note: The document was too long, so this summary is based on the first ~${Math.round(MAX_CHARS / 4)} words.)`;
        }

        els.result.value = summary;
        setStatus('Done!', 100);
    } catch (error) {
        console.error(error);
        els.status.textContent = 'Error: ' + error.message;
        els.result.value = 'An error occurred during summarization. Please check console.';
    } finally {
        state.isProcessing = false;
        els.summarizeBtn.disabled = false;
        els.progressBar.classList.remove('pulse');
    }
}

// ── File handling ─────────────────────────────────────────────────────────────

async function handleFile(file) {
    if (!file) return;
    if (file.type !== 'application/pdf') {
        alert('Please upload a PDF file.');
        return;
    }

    els.uploadContent.classList.add('hidden');
    els.fileInfo.classList.remove('hidden');
    els.fileInfo.classList.add('flex');
    els.uploadedFilename.textContent = file.name;
    els.uploadedFilesize.textContent = window.PDFGlobals.formatBytes(file.size);

    els.actionSection.classList.remove('hidden');
    els.result.value = '';

    await extractTextFromPDF(file);
}

// Event Listeners
els.modelSelect.addEventListener('change', (e) => {
    state.currentModelId = e.target.value;
    state.summarizer = null; // Reset pipeline to force reload
    setStatus(`Model switched to ${e.target.options[e.target.selectedIndex].text.split('(')[0]}`);
});

els.summarizeBtn.addEventListener('click', runSummarization);

// Drag & Drop / File Input
els.dropZone.addEventListener('click', (e) => {
    if (!e.target.closest('button')) els.fileInput.click();
});

els.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    els.dropZone.querySelector('.upload-area')?.classList.add('border-red-500', 'bg-red-50');
});

els.dropZone.addEventListener('dragleave', () => {
    els.dropZone.querySelector('.upload-area')?.classList.remove('border-red-500', 'bg-red-50');
});

els.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    els.dropZone.querySelector('.upload-area')?.classList.remove('border-red-500', 'bg-red-50');
    handleFile(e.dataTransfer.files[0]);
});

els.fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));

els.removeFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    els.fileInput.value = '';
    state.pdfText = '';
    resetUI();
});

els.copyBtn.addEventListener('click', () => {
    if (!els.result.value) return;
    navigator.clipboard.writeText(els.result.value);
    const originalHTML = els.copyBtn.innerHTML;
    els.copyBtn.innerHTML = '<i class="fa-solid fa-check text-green-500 text-lg"></i>';
    setTimeout(() => els.copyBtn.innerHTML = originalHTML, 2000);
});

els.downloadBtn.addEventListener('click', () => {
    if (!els.result.value) return;
    const blob = new Blob([els.result.value], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: 'summary.txt' });
    a.click();
    URL.revokeObjectURL(url);
});

els.clearCacheBtn.addEventListener('click', async () => {
    if (!confirm('Clear AI model cache? You will need to download models again.')) return;
    try {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
        alert('Cache cleared. Reloading...');
        location.reload();
    } catch (e) { alert('Error clearing cache: ' + e.message); }
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
    try {
        state.currentModelId = els.modelSelect.value;
        checkWebGPU();
        await waitForServiceWorker();
        await window.PDFGlobals.loadPdfJsLib();
        console.log('Summarizer Initialized');
    } catch (error) {
        console.error('Initialization error:', error);
        els.status.textContent = 'Error initializing libraries.';
    }
});
