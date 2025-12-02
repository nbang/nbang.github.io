const GITHUB_API_BASE = 'https://api.github.com';
let currentFileSha = null;
let currentFilePath = null;

// Tab Switching Logic
function openTab(tabName) {
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(content => content.classList.add('hidden'));
    document.getElementById(tabName).classList.remove('hidden');

    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => {
        if (btn.getAttribute('data-tab') === tabName) {
            btn.classList.remove('border-transparent', 'text-gray-500');
            btn.classList.add('border-blue-600', 'text-blue-600');
        } else {
            btn.classList.add('border-transparent', 'text-gray-500');
            btn.classList.remove('border-blue-600', 'text-blue-600');
        }
    });
    localStorage.setItem('activeTab', tabName);
}

// Configuration Management
function getConfig() {
    return {
        token: document.getElementById('github-token').value,
        owner: document.getElementById('github-owner').value,
        repo: document.getElementById('github-repo').value,
        url: document.getElementById('config-url').value,
        baseDir: document.getElementById('config-base-dir').value,
        llmProvider: document.getElementById('llm-provider').value,
        llmModel: document.getElementById('llm-model').value,
        llmApiKey: document.getElementById('llm-api-key').value
    };
}

function saveConfig() {
    const config = getConfig();
    localStorage.setItem('gh_token', config.token);
    localStorage.setItem('gh_owner', config.owner);
    localStorage.setItem('gh_repo', config.repo);
    localStorage.setItem('book_url', config.url);
    localStorage.setItem('book_base_dir', config.baseDir);
    localStorage.setItem('llm_provider', config.llmProvider);
    localStorage.setItem('llm_model', config.llmModel);
    localStorage.setItem('llm_api_key', config.llmApiKey);
}

function loadConfig() {
    document.getElementById('github-token').value = localStorage.getItem('gh_token') || '';
    document.getElementById('github-owner').value = localStorage.getItem('gh_owner') || 'nbang';
    document.getElementById('github-repo').value = localStorage.getItem('gh_repo') || 'my-translator';
    document.getElementById('config-url').value = localStorage.getItem('book_url') || '';
    document.getElementById('config-base-dir').value = localStorage.getItem('book_base_dir') || '';
    document.getElementById('llm-provider').value = localStorage.getItem('llm_provider') || 'google';
    document.getElementById('llm-model').value = localStorage.getItem('llm_model') || 'gemini-2.5-pro';
    document.getElementById('llm-api-key').value = localStorage.getItem('llm_api_key') || '';
    
    const activeTab = localStorage.getItem('activeTab') || 'config';
    openTab(activeTab);
}

document.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('change', saveConfig);
});

document.addEventListener('DOMContentLoaded', loadConfig);

function getHeaders(token) {
    return {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
    };
}

// Helper: Show Toast
function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    const msg = document.getElementById('toast-message');
    msg.textContent = message;

    if (isError) {
        toast.firstElementChild.classList.remove('bg-gray-800');
        toast.firstElementChild.classList.add('bg-red-600');
    } else {
        toast.firstElementChild.classList.remove('bg-red-600');
        toast.firstElementChild.classList.add('bg-gray-800');
    }

    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => { toast.classList.add('translate-y-20', 'opacity-0'); }, 3000);
}

// Trigger Scraper
async function triggerScraper() {
    const config = getConfig();
    if (!config.token || !config.repo || !config.owner) return showToast('Please configure GitHub settings first.', true);

    try {
        const url =
            `${GITHUB_API_BASE}/repos/${config.owner}/${config.repo}/actions/workflows/scraper.yml/dispatches`;
        const body = {
            ref: 'main',
            inputs: {
                book_source_url: config.url,
                book_base_dir: config.baseDir
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: getHeaders(config.token),
            body: JSON.stringify(body)
        });

        if (!response.ok) throw new Error('Failed to trigger scraper');

        showToast('Scraper workflow triggered!');
        checkWorkflowStatus();
    } catch (error) {
        console.error(error);
        showToast('Error: ' + error.message, true);
    }
}

// Trigger Translator
async function triggerTranslator() {
    const config = getConfig();
    if (!config.token || !config.repo || !config.owner) return showToast('Please configure GitHub settings first.', true);

    const batchSize = document.getElementById('batch-size').value;
    const force = document.getElementById('force-translate').checked;

    try {
        const url =
            `${GITHUB_API_BASE}/repos/${config.owner}/${config.repo}/actions/workflows/translator.yml/dispatches`;
        const body = {
            ref: 'main',
            inputs: {
                batch_size: batchSize,
                force: force.toString(),
                book_base_dir: config.baseDir
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: getHeaders(config.token),
            body: JSON.stringify(body)
        });

        if (!response.ok) throw new Error('Failed to trigger translator');

        showToast('Translator workflow triggered!');
        checkWorkflowStatus();
    } catch (error) {
        console.error(error);
        showToast('Error: ' + error.message, true);
    }
}

// Trigger Editor
async function triggerEditor() {
    const config = getConfig();
    if (!config.token || !config.repo || !config.owner) return showToast('Please configure GitHub settings first.', true);
    if (!config.llmApiKey) return showToast('Please provide an LLM API Key in Configuration.', true);

    const limit = document.getElementById('edit-limit').value;
    const force = document.getElementById('force-edit').checked;

    try {
        const url =
            `${GITHUB_API_BASE}/repos/${config.owner}/${config.repo}/actions/workflows/editor.yml/dispatches`;
        const body = {
            ref: 'main',
            inputs: {
                llm_provider: config.llmProvider,
                llm_model: config.llmModel,
                llm_api_key: config.llmApiKey,
                limit: limit,
                force: force.toString(),
                book_base_dir: config.baseDir
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: getHeaders(config.token),
            body: JSON.stringify(body)
        });

        if (!response.ok) throw new Error('Failed to trigger editor');

        showToast('Editor workflow triggered!');
        checkWorkflowStatus();
    } catch (error) {
        console.error(error);
        showToast('Error: ' + error.message, true);
    }
}

// Check Status
async function checkWorkflowStatus() {
    const config = getConfig();
    if (!config.token || !config.repo || !config.owner) return;

    try {
        const url = `${GITHUB_API_BASE}/repos/${config.owner}/${config.repo}/actions/runs?per_page=5`;
        const response = await fetch(url, { headers: getHeaders(config.token) });
        const data = await response.json();

        const list = document.getElementById('workflow-status-list');
        list.innerHTML = '';

        if (data.workflow_runs && data.workflow_runs.length > 0) {
            data.workflow_runs.forEach(run => {
                const statusColor = run.conclusion === 'success' ? 'text-green-600 bg-green-50' :
                    run.conclusion === 'failure' ? 'text-red-600 bg-red-50' :
                        'text-yellow-600 bg-yellow-50';

                const div = document.createElement('div');
                div.className = 'flex justify-between items-center p-3 rounded-lg border border-gray-100 bg-white';
                div.innerHTML = `
        <span class="text-sm font-medium text-gray-700">${run.name} #${run.run_number}</span>
        <span class="px-2 py-1 text-xs font-semibold rounded-full ${statusColor} capitalize">
            ${run.status === 'completed' ? run.conclusion : run.status}
        </span>
        `;
                list.appendChild(div);
            });
        } else {
            list.innerHTML = '<p class="text-sm text-gray-500 italic">No runs found.</p>';
        }
    } catch (error) {
        console.error(error);
        showToast('Error checking status', true);
    }
}

// File Browser
async function loadFileList() {
    const config = getConfig();
    if (!config.token || !config.repo || !config.owner) return showToast('Please configure GitHub settings first.', true);

    const folder = document.getElementById('folder-select').value;
    let baseDir = config.baseDir;
    
    // Construct path based on selection and baseDir
    // If baseDir is empty, we might have issues, but let's assume it's set or we just use the folder
    let path = baseDir;
    
    if (folder) {
        // If a subfolder is selected, append it
        // Ensure we don't have double slashes if baseDir ends with /
        if (path && !path.endsWith('/')) {
            path += '/';
        }
        path += folder;
    }
    
    // If path is empty (no baseDir and root selected), it lists root of repo
    // If path is just baseDir (root selected), it lists baseDir

    try {
        const url = `${GITHUB_API_BASE}/repos/${config.owner}/${config.repo}/contents/${path}`;
        const response = await fetch(url, { headers: getHeaders(config.token) });

        if (!response.ok) throw new Error('Folder not found');

        const files = await response.json();
        const list = document.getElementById('file-list');
        list.innerHTML = '';

        // Sort: Directories first, then files
        files.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'dir' ? -1 : 1;
        });

        files.forEach(file => {
            if (file.type === 'file') {
                const li = document.createElement('li');
                li.className = 'px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-gray-700 transition-colors duration-150 border-b border-gray-100 last:border-0';
                li.textContent = file.name;
                li.onclick = () => {
                    // Highlight active
                    document.querySelectorAll('#file-list li').forEach(el => el.classList.remove('bg-blue-100',
                        'text-blue-700'));
                    li.classList.add('bg-blue-100', 'text-blue-700');
                    loadFileContent(file.path);
                };
                list.appendChild(li);
            }
        });
        
        if (files.length === 0) {
             list.innerHTML = '<li class="px-4 py-8 text-center text-gray-500 text-sm italic">No files found in this folder.</li>';
        }
        
    } catch (error) {
        console.error(error);
        showToast('Error loading files: ' + error.message, true);
        const list = document.getElementById('file-list');
        list.innerHTML = `<li class="px-4 py-8 text-center text-red-500 text-sm italic">Error: ${error.message}</li>`;
    }
}

async function loadFileContent(path) {
    const config = getConfig();
    const editor = document.getElementById('file-content-editor');
    const commitInput = document.getElementById('commit-message');
    const saveBtn = document.getElementById('save-btn');

    // Reset UI
    editor.value = 'Loading...';
    editor.disabled = true;
    commitInput.disabled = true;
    saveBtn.disabled = true;
    saveBtn.classList.add('opacity-50', 'cursor-not-allowed');

    try {
        const url = `${GITHUB_API_BASE}/repos/${config.owner}/${config.repo}/contents/${path}`;
        const response = await fetch(url, { headers: getHeaders(config.token) });
        const data = await response.json();

        // Store SHA and Path
        currentFileSha = data.sha;
        currentFilePath = path;

        // Decode content (UTF-8 safe decode)
        const content = decodeURIComponent(escape(atob(data.content)));
        editor.value = content;

        // Enable UI
        editor.disabled = false;
        commitInput.disabled = false;
        saveBtn.disabled = false;
        saveBtn.classList.remove('opacity-50', 'cursor-not-allowed');

    } catch (error) {
        console.error(error);
        showToast('Error loading file content', true);
        editor.value = 'Error loading content.';
    }
}

async function saveFileContent() {
    const config = getConfig();
    const content = document.getElementById('file-content-editor').value;
    const message = document.getElementById('commit-message').value.trim() || `Update ${currentFilePath}`;

    if (!currentFileSha || !currentFilePath) return showToast('No file loaded', true);

    try {
        const url = `${GITHUB_API_BASE}/repos/${config.owner}/${config.repo}/contents/${currentFilePath}`;

        // Encode content (UTF-8 safe encode)
        const encodedContent = btoa(unescape(encodeURIComponent(content)));

        const body = {
            message: message,
            content: encodedContent,
            sha: currentFileSha
        };

        const response = await fetch(url, {
            method: 'PUT',
            headers: getHeaders(config.token),
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || 'Failed to save file');
        }

        const data = await response.json();
        currentFileSha = data.content.sha; // Update SHA for subsequent saves
        showToast('File saved successfully!');
        document.getElementById('commit-message').value = ''; // Clear message

    } catch (error) {
        console.error(error);
        showToast('Error saving file: ' + error.message, true);
    }
}
