
// DOM Elements
const searchInput = document.getElementById('search-input');
const userFilter = document.getElementById('user-filter');
const categoryFilter = document.getElementById('category-filter');
const promptsGrid = document.getElementById('prompts-grid');
const modal = document.getElementById('editor-modal');
const modalBackdrop = document.getElementById('modal-backdrop');
const modalPanel = document.getElementById('modal-panel');
const closeModalBtn = document.getElementById('close-modal-btn');
const modalTitle = document.getElementById('modal-title');
const modalCategory = document.getElementById('modal-category');
const parametersContainer = document.getElementById('parameters-container');
const promptPreview = document.getElementById('prompt-preview');
const copyPromptBtn = document.getElementById('copy-prompt-btn');


let promptsData = [];
let currentPrompt = null;

// Fetch Data
// Use Global Data
function loadPrompts() {
    if (typeof PROMPTS_DATA !== 'undefined') {
        promptsData = PROMPTS_DATA;
        populateCategories();
        populateUsers();
        renderPrompts(promptsData);
    } else {
        console.error('PROMPTS_DATA not found. Check prompt-data.js loading.');
        promptsGrid.innerHTML = '<p class="col-span-full text-center text-red-500">Failed to load prompts data.</p>';
    }
}

// Populate Categories
// Populate Categories
function populateCategories() {
    const selectedUser = userFilter.value;
    const currentCategory = categoryFilter.value;

    // Filter categories based on selected user
    const availablePrompts = selectedUser
        ? promptsData.filter(p => p.User === selectedUser)
        : promptsData;

    const categories = [...new Set(availablePrompts.map(p => p.Category))].sort();

    // Clear existing options except "All Categories"
    categoryFilter.innerHTML = '<option value="">All Categories</option>';

    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categoryFilter.appendChild(option);
    });

    // Restore selection if valid, otherwise reset
    if (categories.includes(currentCategory)) {
        categoryFilter.value = currentCategory;
    } else {
        categoryFilter.value = '';
    }
}

// Populate Users
function populateUsers() {
    const users = [...new Set(promptsData.map(p => p.User).filter(Boolean))].sort((a, b) => {
        if (a === 'Everyone') return 1;
        if (b === 'Everyone') return -1;
        return a.localeCompare(b);
    });
    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user;
        option.textContent = user;
        userFilter.appendChild(option);
    });
}

// Render Grid
function renderPrompts(prompts) {
    promptsGrid.innerHTML = '';

    if (prompts.length === 0) {
        promptsGrid.innerHTML = '<p class="col-span-full text-center text-gray-500 py-10">No prompts found matching your criteria.</p>';
        return;
    }

    prompts.forEach((prompt, index) => {
        const card = document.createElement('div');
        card.className = 'group bg-white/80 backdrop-blur-xl rounded-2xl shadow-sm hover:shadow-xl border border-white/50 transition-all duration-300 transform hover:-translate-y-1 overflow-hidden p-6 cursor-pointer flex flex-col h-full animate-[fadeIn_0.5s_ease-out]';
        card.onclick = () => openEditor(prompt);

        const categoryColor = getCategoryColor(prompt.Category);

        card.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <span class="px-3 py-1 text-xs font-semibold rounded-full ${categoryColor}">
                    ${prompt.Category}
                </span>
                ${prompt.Type === 'IMAGE' ? '<span class="px-2 py-1 text-xs font-bold bg-purple-100 text-purple-700 rounded border border-purple-200">IMAGE</span>' : ''}
            </div>
            <h3 class="text-xl font-bold text-gray-900 group-hover:text-sky-600 transition-colors mb-3 line-clamp-2">
                ${prompt.Title}
            </h3>
            <p class="text-gray-500 text-sm line-clamp-3 mb-4 flex-grow font-mono bg-gray-50 p-2 rounded border border-gray-100">
                ${prompt.Prompt.substring(0, 150)}${prompt.Prompt.length > 150 ? '...' : ''}
            </p>
            <div class="flex items-center text-sky-600 text-sm font-medium mt-auto pt-4 border-t border-gray-100">
                <span>Use Prompt</span>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
            </div>
        `;
        promptsGrid.appendChild(card);
    });
}

function getCategoryColor(category) {
    const colors = {
        'Code Generation': 'bg-blue-100 text-blue-700',
        'Code Refactoring': 'bg-purple-100 text-purple-700',
        'Code Review': 'bg-amber-100 text-amber-700',
        'Documentation': 'bg-green-100 text-green-700',
        'Product Service Promotion': 'bg-pink-100 text-pink-700',
        'For Customer Success': 'bg-teal-100 text-teal-700',
        'For Engineers': 'bg-indigo-100 text-indigo-700',
        'For Any Role': 'bg-gray-100 text-gray-700'
    };
    return colors[category] || 'bg-gray-100 text-gray-700';
}

// Filter Logic
// Filter Logic
function filterPrompts() {
    const searchTerm = searchInput.value.toLowerCase();
    const selectedCategory = categoryFilter.value;
    const selectedUser = userFilter.value;

    const filtered = promptsData.filter(prompt => {
        const matchesSearch = prompt.Title.toLowerCase().includes(searchTerm) ||
            prompt.Prompt.toLowerCase().includes(searchTerm);
        const matchesCategory = selectedCategory ? prompt.Category === selectedCategory : true;
        const matchesUser = selectedUser ? prompt.User === selectedUser : true;
        return matchesSearch && matchesCategory && matchesUser;
    });

    renderPrompts(filtered);
}

// Editor Modal Flow
function openEditor(prompt) {
    currentPrompt = prompt;
    modalTitle.textContent = prompt.Title;
    modalCategory.textContent = prompt.Category;
    parametersContainer.innerHTML = '';

    // Extract parameters from {{param}} logic
    // We can use the 'Parameters' array from JSON, or regex scan the prompt text to be sure.
    // Using the Parameters array is safer if it exists, but let's double check with regex to ensure order/completeness
    // Actually, prompt.Parameters is reliable per the structure.

    if (prompt.Parameters && prompt.Parameters.length > 0) {
        prompt.Parameters.forEach(param => {
            const wrapper = document.createElement('div');

            const label = document.createElement('label');
            label.className = 'block text-xs font-medium text-gray-700 mb-1';
            label.textContent = formatParamLabel(param);

            const type = param.toLowerCase().includes('code') || param.toLowerCase().includes('list') || param.toLowerCase().includes('text') ? 'textarea' : 'input';

            let input;
            if (type === 'textarea') {
                input = document.createElement('textarea');
                input.rows = 3;
                input.className = 'w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm transition-shadow resize-y custom-scrollbar';
            } else {
                input = document.createElement('input');
                input.type = 'text';
                input.className = 'w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm transition-shadow';
            }

            input.dataset.param = param;
            input.placeholder = `Enter ${formatParamLabel(param)}...`;
            input.addEventListener('input', updatePreview);

            wrapper.appendChild(label);
            wrapper.appendChild(input);
            parametersContainer.appendChild(wrapper);
        });
    } else {
        parametersContainer.innerHTML = '<p class="text-sm text-gray-500 italic">No parameters to configure.</p>';
    }

    updatePreview();



    // Show Modal
    modal.classList.remove('hidden');
    // Small delay for transition
    setTimeout(() => {
        modalBackdrop.classList.remove('opacity-0');
        modalPanel.classList.remove('opacity-0', 'translate-y-4', 'sm:translate-y-0', 'sm:scale-95');
        modalPanel.classList.add('opacity-100', 'translate-y-0', 'sm:scale-100');
    }, 10);
}

function closeEditor() {
    modalBackdrop.classList.remove('opacity-100');
    modalPanel.classList.remove('opacity-100', 'translate-y-0', 'sm:scale-100');
    modalPanel.classList.add('opacity-0', 'translate-y-4', 'sm:translate-y-0', 'sm:scale-95');

    setTimeout(() => {
        modal.classList.add('hidden');
        currentPrompt = null;
    }, 300);
}

function updatePreview() {
    if (!currentPrompt) return;

    let text = currentPrompt.Prompt;
    const inputs = parametersContainer.querySelectorAll('input, textarea');

    inputs.forEach(input => {
        const param = input.dataset.param;
        const value = input.value || `{{${param}}}`; // Keep placeholder if empty
        // Global replace for that param
        const regex = new RegExp(`{{${param}}}`, 'g');
        text = text.replace(regex, value);
    });

    promptPreview.value = text;
}

function formatParamLabel(param) {
    // snake_case to Title Case
    return param.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

// Event Listeners
searchInput.addEventListener('input', filterPrompts);
categoryFilter.addEventListener('change', filterPrompts);
userFilter.addEventListener('change', () => {
    populateCategories();
    filterPrompts();
});
closeModalBtn.addEventListener('click', closeEditor);
modalBackdrop.addEventListener('click', closeEditor);

copyPromptBtn.addEventListener('click', () => {
    promptPreview.select();
    navigator.clipboard.writeText(promptPreview.value).then(() => {
        const originalText = copyPromptBtn.innerHTML;
        copyPromptBtn.innerHTML = `<span class="text-green-600 font-bold">Copied!</span>`;
        setTimeout(() => {
            copyPromptBtn.innerHTML = originalText;
        }, 2000);
    });
});

// Init
loadPrompts();
