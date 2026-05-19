document.addEventListener('DOMContentLoaded', async () => {
    let metadata = { gpus: [], models: [] };
    let currentMode = 'inference'; // 'inference', 'lora', 'training'

    // DOM Elements
    const elements = {
        gpuSelect: document.getElementById('gpu-select'),
        modelSelect: document.getElementById('model-select'),
        modeBtns: document.querySelectorAll('.mode-btn'),
        params: document.getElementById('model-params'),
        quantization: document.getElementById('quantization'),
        contextLength: document.getElementById('context-length'),
        batchSize: document.getElementById('batch-size'),
        loraSettings: document.getElementById('lora-settings'),
        loraRank: document.getElementById('lora-rank'),
        loraAlpha: document.getElementById('lora-alpha'),
        
        infoLayers: document.getElementById('info-layers'),
        infoHidden: document.getElementById('info-hidden'),
        infoHeads: document.getElementById('info-heads'),
        infoKvHeads: document.getElementById('info-kv-heads'),

        totalVram: document.getElementById('total-vram'),
        gpuLimit: document.getElementById('gpu-vram-limit'),
        statusBadge: document.getElementById('status-badge'),
        
        valWeights: document.getElementById('val-weights'),
        valKv: document.getElementById('val-kv'),
        valOpt: document.getElementById('val-opt'),
        valAct: document.getElementById('val-act'),
        valGrad: document.getElementById('val-grad'),
        valOverhead: document.getElementById('val-overhead'),
        
        cardOpt: document.getElementById('card-opt'),
        cardAct: document.getElementById('card-act'),
        cardGrad: document.getElementById('card-grad'),

        barWeights: document.getElementById('bar-weights'),
        barKv: document.getElementById('bar-kv'),
        barOpt: document.getElementById('bar-opt'),
        barAct: document.getElementById('bar-act'),
        barGrad: document.getElementById('bar-grad'),
        barOverhead: document.getElementById('bar-overhead'),

        simSpeed: document.getElementById('sim-speed'),
        simHwName: document.getElementById('sim-hw-name'),
        simHwBw: document.getElementById('sim-hw-bw'),
    };

    // Load data
    try {
        const res = await fetch('vram-data.json');
        metadata = await res.json();
        initUI();
    } catch (e) {
        console.error("Failed to load vram-data.json", e);
    }

    function initUI() {
        // Populate GPUs
        elements.gpuSelect.innerHTML = metadata.gpus.map(g => 
            `<option value="${g.id}">${g.name} (${g.vram}GB)</option>`
        ).join('');
        
        // Populate Models
        elements.modelSelect.innerHTML = metadata.models.map(m => 
            `<option value="${m.id}" ${m.id === 'llama3_8b' ? 'selected' : ''}>${m.name}</option>`
        ).join('');

        // Event Listeners
        const inputs = [
            elements.gpuSelect, elements.modelSelect, elements.params, elements.quantization,
            elements.contextLength, elements.batchSize, elements.loraRank, elements.loraAlpha
        ];
        inputs.forEach(el => el.addEventListener('input', updateCalc));

        elements.modelSelect.addEventListener('change', (e) => {
            const m = metadata.models.find(x => x.id === e.target.value);
            if (m && m.id !== 'custom') {
                elements.params.value = m.parameters;
                elements.infoLayers.textContent = m.layers;
                elements.infoHidden.textContent = m.hidden_size;
                elements.infoHeads.textContent = m.heads;
                elements.infoKvHeads.textContent = m.kv_heads;
            }
            updateCalc();
        });

        elements.modeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                setMode(e.target.dataset.mode);
            });
        });

        // Trigger initial model select to populate fields
        elements.modelSelect.dispatchEvent(new Event('change'));
    }

    function setMode(mode) {
        currentMode = mode;
        elements.modeBtns.forEach(btn => {
            if (btn.dataset.mode === mode) {
                btn.className = "mode-btn flex-1 py-1.5 px-3 rounded-lg text-sm font-medium bg-white text-indigo-600 shadow-sm transition-all";
            } else {
                btn.className = "mode-btn flex-1 py-1.5 px-3 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 transition-all";
            }
        });

        elements.loraSettings.classList.toggle('hidden', mode !== 'lora');
        elements.cardOpt.classList.toggle('hidden', mode === 'inference');
        elements.cardAct.classList.toggle('hidden', mode === 'inference');
        elements.cardGrad.classList.toggle('hidden', mode === 'inference');

        updateCalc();
    }

    function updateCalc() {
        // Read Inputs
        const gpu = metadata.gpus.find(g => g.id === elements.gpuSelect.value) || metadata.gpus[0];
        const paramsB = parseFloat(elements.params.value) || 0;
        const quantBits = parseFloat(elements.quantization.value) || 16;
        const contextLen = parseFloat(elements.contextLength.value) || 0;
        const batchSize = parseFloat(elements.batchSize.value) || 1;
        
        let layers = parseInt(elements.infoLayers.textContent);
        let hidden = parseInt(elements.infoHidden.textContent);
        let heads = parseInt(elements.infoHeads.textContent);
        let kvHeads = parseInt(elements.infoKvHeads.textContent);

        // If custom is selected but values changed, estimate them roughly based on params
        if (elements.modelSelect.value === 'custom') {
            // Rough estimation for LLaMA-like architecture
            layers = Math.max(32, Math.floor(paramsB * 4)); 
            hidden = Math.max(4096, Math.floor(paramsB * 512));
            heads = Math.max(32, Math.floor(paramsB * 4));
            kvHeads = heads; // Assume no GQA by default for custom
            
            elements.infoLayers.textContent = layers;
            elements.infoHidden.textContent = hidden;
            elements.infoHeads.textContent = heads;
            elements.infoKvHeads.textContent = kvHeads;
        }

        const headDim = hidden / heads;

        // --- CALCULATIONS (in GB) ---
        // 1. Model Weights: Params * bytes/param
        const bytesPerParam = quantBits / 8;
        const weightsGB = paramsB * bytesPerParam;

        // 2. KV Cache
        // Bytes per token = 2 (K,V) * layers * kv_heads * head_dim * 2 bytes (FP16)
        const bytesPerToken = 2 * layers * kvHeads * headDim * 2;
        const tokens = contextLen * batchSize;
        const kvGB = (tokens * bytesPerToken) / (1024 ** 3);

        // 3. Training specific calculations
        let optGB = 0;
        let gradGB = 0;
        let actGB = 0;

        if (currentMode !== 'inference') {
            let trainableParamsB = paramsB;
            if (currentMode === 'lora') {
                const r = parseFloat(elements.loraRank.value) || 16;
                // Rough estimate of LoRA params: fraction of model based on rank/hidden
                const fraction = (r / hidden) * 2; 
                trainableParamsB = paramsB * fraction;
            }

            // Optimizer: Adam uses 8 bytes per trainable param
            optGB = trainableParamsB * 8;
            
            // Gradients: 4 bytes per trainable param
            gradGB = trainableParamsB * 4;

            // Activations: batch * seq * hidden * layers * 34 bytes (approx without grad checkpointing)
            actGB = (batchSize * contextLen * hidden * layers * 34) / (1024 ** 3);
        }

        const overheadGB = 0.6; // standard CUDA overhead

        const totalGB = weightsGB + kvGB + optGB + gradGB + actGB + overheadGB;

        // --- UPDATE UI ---
        elements.valWeights.textContent = weightsGB.toFixed(2);
        elements.valKv.textContent = kvGB.toFixed(2);
        elements.valOpt.textContent = optGB.toFixed(2);
        elements.valAct.textContent = actGB.toFixed(2);
        elements.valGrad.textContent = gradGB.toFixed(2);
        elements.valOverhead.textContent = overheadGB.toFixed(2);

        elements.totalVram.textContent = totalGB.toFixed(2);
        elements.gpuLimit.textContent = gpu.vram;

        // Status Badge
        if (totalGB > gpu.vram) {
            elements.statusBadge.className = "px-4 py-1.5 rounded-full text-sm font-bold bg-red-100 text-red-700 flex items-center gap-2";
            elements.statusBadge.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Exceeds GPU Memory';
            elements.totalVram.classList.replace('text-indigo-600', 'text-red-600');
        } else {
            elements.statusBadge.className = "px-4 py-1.5 rounded-full text-sm font-bold bg-green-100 text-green-700 flex items-center gap-2";
            elements.statusBadge.innerHTML = '<i class="fa-solid fa-check-circle"></i> Fits in GPU';
            elements.totalVram.classList.replace('text-red-600', 'text-indigo-600');
        }

        // Progress Bars
        const cap = Math.max(totalGB, gpu.vram);
        elements.barWeights.style.width = `${(weightsGB / cap) * 100}%`;
        elements.barKv.style.width = `${(kvGB / cap) * 100}%`;
        elements.barOpt.style.width = `${(optGB / cap) * 100}%`;
        elements.barAct.style.width = `${(actGB / cap) * 100}%`;
        elements.barGrad.style.width = `${(gradGB / cap) * 100}%`;
        elements.barOverhead.style.width = `${(overheadGB / cap) * 100}%`;

        // Hide empty bars
        [elements.barWeights, elements.barKv, elements.barOpt, elements.barAct, elements.barGrad, elements.barOverhead].forEach(b => {
            b.style.display = parseFloat(b.style.width) < 0.1 ? 'none' : 'block';
        });

        // Speed Simulation (Tokens / sec)
        elements.simHwName.textContent = gpu.name;
        elements.simHwBw.textContent = gpu.bandwidth;
        // generation speed is heavily memory bandwidth bound
        const memRequiredPerTokenGB = weightsGB + kvGB;
        let tps = 0;
        if (currentMode === 'inference' && memRequiredPerTokenGB > 0) {
            // Rough approximation: batch size scales throughput but reduces single stream tps slightly. 
            // We just show a simple max theoretical memory-bound token generation rate for BS=1.
            tps = gpu.bandwidth / memRequiredPerTokenGB;
        }
        
        if (currentMode !== 'inference') {
            elements.simSpeed.textContent = "N/A";
            elements.simSpeed.nextElementSibling.textContent = "for training";
        } else {
            elements.simSpeed.textContent = Math.round(tps);
            elements.simSpeed.nextElementSibling.textContent = "tokens/s";
        }
    }
});
