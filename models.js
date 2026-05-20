let modelsData = [];
let activeProviders = new Set();
let activeLicenses = new Set();
let searchQuery = '';

// ── Dark mode ─────────────────────────────────────────────────────────
function isDark() {
    return document.documentElement.classList.contains('dark');
}

function updateDarkIcon() {
    const btn = document.getElementById('dark-mode-btn');
    if (!btn) return;
    btn.innerHTML = isDark()
        ? '<i class="fa-solid fa-sun text-amber-400"></i>'
        : '<i class="fa-solid fa-moon text-gray-500"></i>';
}

document.getElementById('dark-mode-btn')?.addEventListener('click', () => {
    const nowDark = !isDark();
    document.documentElement.classList.toggle('dark', nowDark);
    localStorage.setItem('bang-dark-mode', String(nowDark));
    updateDarkIcon();
});

updateDarkIcon();

// ── Data Loading & Rendering ──────────────────────────────────────────
async function loadModels() {
    try {
        const response = await fetch('models-data.json');
        modelsData = await response.json();
        
        // Initialize dynamic filters
        initProviderFilters();
        
        // Initial render
        renderModels();
    } catch (error) {
        console.error("Failed to load models data:", error);
        document.getElementById('modelsList').innerHTML = 
            '<tr><td colspan="5" class="p-8 text-center text-red-500">Failed to load data. Please refresh.</td></tr>';
    }
}

function initProviderFilters() {
    const providers = [...new Set(modelsData.map(m => m.provider))].sort();
    const container = document.getElementById('providerFilters');
    
    container.innerHTML = providers.map(provider => `
        <label class="flex items-center gap-2 cursor-pointer group">
            <input type="checkbox" value="${provider}" class="provider-checkbox rounded border-gray-300 text-teal-600 focus:ring-teal-500 bg-white" />
            <span class="text-gray-600 group-hover:text-gray-900">${provider}</span>
        </label>
    `).join('');

    // Attach events
    document.querySelectorAll('.provider-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            if (e.target.checked) activeProviders.add(e.target.value);
            else activeProviders.delete(e.target.value);
            renderModels();
        });
    });
}

// Attach events for license filters
document.querySelectorAll('.license-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
        const isTrue = e.target.value === 'true';
        if (e.target.checked) activeLicenses.add(isTrue);
        else activeLicenses.delete(isTrue);
        renderModels();
    });
});

// Attach event for search
document.getElementById('searchInput').addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    renderModels();
});

// Clear filters
document.getElementById('clearFiltersBtn').addEventListener('click', () => {
    searchQuery = '';
    document.getElementById('searchInput').value = '';
    
    activeProviders.clear();
    document.querySelectorAll('.provider-checkbox').forEach(cb => cb.checked = false);
    
    activeLicenses.clear();
    document.querySelectorAll('.license-checkbox').forEach(cb => cb.checked = false);
    
    renderModels();
});

function renderModels() {
    const listContainer = document.getElementById('modelsList');
    const noResults = document.getElementById('noResults');
    const countLabel = document.getElementById('modelCount');

    const filtered = modelsData.filter(m => {
        // Search filter
        const matchesSearch = !searchQuery || 
            m.name.toLowerCase().includes(searchQuery) || 
            m.provider.toLowerCase().includes(searchQuery) ||
            m.description.toLowerCase().includes(searchQuery);

        // Provider filter
        const matchesProvider = activeProviders.size === 0 || activeProviders.has(m.provider);

        // License filter
        const matchesLicense = activeLicenses.size === 0 || activeLicenses.has(m.open_source);

        return matchesSearch && matchesProvider && matchesLicense;
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = '';
        noResults.classList.remove('hidden');
        countLabel.textContent = `Showing 0 models`;
        return;
    }

    noResults.classList.add('hidden');
    countLabel.textContent = `Showing ${filtered.length} model${filtered.length > 1 ? 's' : ''}`;

    listContainer.innerHTML = filtered.map((m) => {
        const badgeColor = m.open_source ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200';
        const licenseText = m.open_source ? 'Open Weights' : 'Proprietary';
        const loraIcon = m.lora ? '<i class="fa-solid fa-check text-green-500"></i>' : '<i class="fa-solid fa-xmark text-gray-300"></i>';
        
        return `
            <tr class="group hover:bg-teal-50/30 transition-colors">
                <td class="p-4 align-top">
                    <a href="${m.url}" target="_blank" class="block">
                        <div class="font-bold text-gray-900 group-hover:text-teal-600 transition-colors text-base">${m.name}</div>
                        <div class="text-xs text-gray-500 mt-1">${m.provider}</div>
                        <div class="text-sm text-gray-600 mt-2 line-clamp-2">${m.description}</div>
                        <div class="flex flex-wrap gap-1 mt-2">
                            ${m.capabilities.map(c => `<span class="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs border border-gray-200">${c}</span>`).join('')}
                        </div>
                    </a>
                </td>
                <td class="p-4 align-top">
                    <div class="inline-flex items-center px-2.5 py-1 rounded-md bg-white border border-gray-200 text-sm font-medium text-gray-700 shadow-sm">
                        ${m.parameters}
                    </div>
                </td>
                <td class="p-4 align-top">
                    <div class="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                        <i class="fa-solid fa-bolt text-amber-400"></i>
                        ${m.inference_capacity}
                    </div>
                </td>
                <td class="p-4 align-top text-center sm:text-left">
                    <div class="flex items-center gap-2">
                        ${loraIcon}
                        <span class="text-sm text-gray-600 hidden sm:inline">${m.lora ? 'Supported' : 'No'}</span>
                    </div>
                </td>
                <td class="p-4 align-top text-right">
                    <span class="inline-block px-2.5 py-1 rounded-full text-xs font-semibold border ${badgeColor}">
                        ${licenseText}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

// Initialize
loadModels();
