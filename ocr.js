import { pipeline, env, Florence2ForConditionalGeneration, AutoModel, AutoProcessor, AutoTokenizer, RawImage } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';

// Configuration
env.allowLocalModels = false;
env.useBrowserCache = true;

// Model Configuration
const MODEL_CONFIG = {
    'onnx-community/Florence-2-base-ft': { dtype: 'fp16' }, // explicit fp16 for consistency
    'onnx-community/Qwen2-VL-2B-Instruct': { dtype: 'q4', device: 'webgpu' }, // Prefer WebGPU for these
    'HuggingFaceTB/SmolVLM-Instruct': { dtype: 'q4', device: 'webgpu' },
    'Xenova/moondream2': { dtype: 'q4' } // Usually q8 or q4 available
};

// State
let ocrPipeline = null;
let ocrModel = null;
let ocrProcessor = null;
let ocrTokenizer = null;

let currentModel = 'onnx-community/Florence-2-base-ft';
let isProcessing = false;

// DOM Elements
const modelSelect = document.getElementById('model-select');
const taskWrapper = document.getElementById('task-wrapper');
const taskSelect = document.getElementById('task-select');
const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');
const imagePreview = document.getElementById('image-preview');
const uploadContent = document.querySelector('.upload-content');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const statusText = document.getElementById('status-text');
const resultText = document.getElementById('result-text');
const copyBtn = document.getElementById('copy-btn');

// Initialize
async function init() {
    setupEventListeners();
    console.log("OCR System Initialized. Caching enabled:", env.useBrowserCache);
}


function setupEventListeners() {
    // Clear Cache
    const clearCacheBtn = document.getElementById('clear-cache-btn');
    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to delete all downloaded models? This will require re-downloading them next time.')) {
                try {
                    const keys = await caches.keys();
                    let deleted = 0;
                    for (const key of keys) {
                        if (key === 'transformers-cache' || key.includes('transformers')) {
                            await caches.delete(key);
                            deleted++;
                        }
                    }
                    alert(`Cache cleared! (${deleted} caches deleted). Please refresh the page.`);
                    location.reload();
                } catch (err) {
                    console.error(err);
                    alert('Error clearing cache: ' + err.message);
                }
            }
        });
    }

    // Model Selection
    modelSelect.addEventListener('change', (e) => {
        currentModel = e.target.value;
        ocrPipeline = null;
        ocrModel = null;
        ocrProcessor = null;
        ocrTokenizer = null;

        statusText.textContent = `Model switched to ${e.target.options[e.target.selectedIndex].text}`;

        // Show/Hide prompt selector for Florence-2
        if (currentModel.includes('Florence-2')) {
            taskWrapper.classList.remove('hidden');
        } else {
            taskWrapper.classList.add('hidden');
        }

        // Re-process if image is loaded
        if (imagePreview.src && !imagePreview.classList.contains('hidden')) {
            // Clear existing text immediately
            resultText.value = '';
            runOCR(imagePreview.src);
        }
    });

    // Re-process on task change (for Florence-2)
    taskSelect.addEventListener('change', () => {
        if (currentModel.includes('Florence-2') && imagePreview.src && !imagePreview.classList.contains('hidden')) {
            resultText.value = '';
            runOCR(imagePreview.src);
        }
    });

    // File Input
    fileInput.addEventListener('change', handleFileSelect);

    // Drag & Drop
    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    // Copy Button
    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(resultText.value);
        const originalIcon = copyBtn.innerHTML;
        copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        setTimeout(() => {
            copyBtn.innerHTML = originalIcon;
        }, 2000);
    });
}

function handleFileSelect(e) {
    if (e.target.files.length) {
        handleFile(e.target.files[0]);
    }
}

function handleFile(file) {
    if (!file.type.startsWith('image/')) {
        alert('Please upload an image file.');
        return;
    }

    // Show Preview
    const reader = new FileReader();
    reader.onload = (e) => {
        imagePreview.src = e.target.result;
        imagePreview.classList.remove('hidden');
        uploadContent.classList.add('hidden');

        // Run OCR
        runOCR(e.target.result);
    };
    reader.readAsDataURL(file);
}

async function loadModel() {
    progressContainer.classList.remove('hidden');

    const config = MODEL_CONFIG[currentModel] || { dtype: 'fp16' }; // Fallback

    const device = await getDevice();
    console.log(`Using device: ${device}`);

    let currentDtype = config.dtype;
    if (device === 'wasm' && currentDtype === 'fp16') {
        console.log("WASM device detected, falling back to fp32 from fp16");
        currentDtype = 'fp32';
    }

    const loadOptions = {
        dtype: currentDtype,
        device: device,
        progress_callback: (data) => {
            if (data.status === 'progress') {
                const progress = Math.round(data.progress * 100);
                if (data.file) updateStatus(`Downloading ${data.file}...`, progress);
            }
        }
    };

    try {
        if (currentModel.includes('Florence-2') || currentModel.includes('Qwen2-VL') || currentModel.includes('moondream') || currentModel.includes('SmolVLM')) {
            if (!ocrModel) {
                if (currentModel.includes('Florence-2')) {
                    ocrModel = await Florence2ForConditionalGeneration.from_pretrained(currentModel, loadOptions);
                } else {
                    ocrModel = await AutoModel.from_pretrained(currentModel, loadOptions);
                }
                ocrProcessor = await AutoProcessor.from_pretrained(currentModel);
                // Initialize tokenizer if needed, though AutoProcessor usually handles it for VLMs
                ocrTokenizer = await AutoTokenizer.from_pretrained(currentModel);
            }

            // Show task wrapper only for Florence-2 as others might not use it the same way or use default prompt
            if (currentModel.includes('Florence-2')) {
                taskWrapper.classList.remove('hidden');
            } else {
                taskWrapper.classList.add('hidden');
            }

            updateStatus(`${currentModel.split('/')[1]} Loaded`, 100);
            return { type: 'vlm', model: ocrModel, processor: ocrProcessor, tokenizer: ocrTokenizer };

        } else {
            // Standard pipeline for legacy models (if any)
            if (!ocrPipeline) {
                ocrPipeline = await pipeline('image-to-text', currentModel, loadOptions);
            }
            updateStatus('Model Loaded', 100);
            return { type: 'pipeline', pipe: ocrPipeline };
        }
    } catch (error) {
        console.error("LOAD_MODEL_ERROR:", error.message, error.stack);
        updateStatus('Error loading model: ' + error.message, 0);
        throw error;
    }
}

async function runOCR(imageUrl) {
    if (isProcessing) return;
    isProcessing = true;
    resultText.value = '';

    updateStatus('Recognizing text...', 100);
    progressBar.style.width = '100%';
    progressBar.classList.add('pulse');

    try {
        const loaded = await loadModel();

        if (loaded.type === 'vlm') {
            const { model, processor, tokenizer } = loaded;
            let prompt = "";
            let inputs;

            const image = await RawImage.fromURL(imageUrl);

            if (currentModel.includes('Florence-2')) {
                prompt = taskSelect.value;
                inputs = await processor(image, prompt);
            } else if (currentModel.includes('Qwen2-VL') || currentModel.includes('SmolVLM')) {
                // Qwen2-VL and SmolVLM-Instruct default prompt
                prompt = "Read the text in the image.";
                const messages = [
                    {
                        role: "user", content: [
                            { type: "image", image: image },
                            { type: "text", text: prompt }
                        ]
                    }
                ];
                const text = processor.apply_chat_template(messages);
                inputs = await processor(image, text);
            } else if (currentModel.includes('moondream')) {
                // Moondream prompt
                prompt = "Read the text in the image.";
                inputs = await processor(image, prompt);
            }

            const outputs = await model.generate({
                ...inputs,
                max_new_tokens: 1024,
                do_sample: false,
            });

            const generatedText = tokenizer.batch_decode(outputs, { skip_special_tokens: false })[0];

            // Post-process
            let finalText = generatedText;

            if (currentModel.includes('Florence-2')) {
                finalText = finalText.replace(/<\/?s>/g, '').replace(prompt, '').trim();
            } else {
                // Basic cleanup for others, might need model specific tuning
                // Qwen/Moondream might output full chat structure, need to check
                // For now, doing simple special token cleanup
                finalText = finalText.replace(/<\|.*?\|>/g, '').trim(); // Remove Qwen special tokens
            }

            resultText.value = finalText;

        } else {
            // Standard Pipeline for legacy
            const args = { max_new_tokens: 256, do_sample: false };
            const result = await loaded.pipe(imageUrl, args);

            if (result && result[0] && result[0].generated_text) {
                resultText.value = result[0].generated_text;
            } else {
                resultText.value = 'No text detected.';
            }
        }

        updateStatus('Done', 100);

    } catch (error) {
        console.error(error);
        resultText.value = 'Error: ' + error.message;
        updateStatus('Error occurred', 0);
    } finally {
        isProcessing = false;
        setTimeout(() => progressBar.classList.remove('pulse'), 500);
    }
}

async function getDevice() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('device')) return params.get('device');

    if (!navigator.gpu) return 'wasm';
    try {
        const adapter = await navigator.gpu.requestAdapter();
        return adapter ? 'webgpu' : 'wasm';
    } catch (e) {
        return 'wasm';
    }
}

function updateStatus(text, percent) {
    statusText.textContent = text;
    if (percent !== undefined) {
        progressBar.style.width = `${percent}%`;
    }
}

// Start
init();
