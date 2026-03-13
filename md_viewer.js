/* global marked, mermaid, snapdom */
// Initialize Mermaid
mermaid.initialize({ startOnLoad: false, theme: 'default' });

const markdownInput = document.getElementById('markdownInput');
const previewContent = document.getElementById('previewContent');
const fileInput = document.getElementById('fileInput');
const urlInput = document.getElementById('urlInput');
const loadUrlBtn = document.getElementById('loadUrlBtn');
const clearBtn = document.getElementById('clearBtn');
const exportBtn = document.getElementById('exportBtn');

// Default Content
const defaultMarkdown = `# Welcome to Markdown Viewer

This is a simple, privacy-friendly tool to view rendered Markdown and export it as an image.

## Features
- **Live Preview**: Type on the left, see changes on the right.
- **Mermaid Support**: Render diagrams directly.
- **Export to PNG**: Download your rendered markdown as an image.
- **Local Processing**: Your data never leaves your browser.

## Code Example
\`\`\`javascript
console.log('Hello, World!');
\`\`\`

## Mermaid Diagram Example
\`\`\`mermaid
graph LR
    A[Start] --> B{Is it working?}
    B -- Yes --> C[Great!]
    B -- No --> D[Debug]
    D --> B
\`\`\`
`;

// Render Markdown with Mermaid
const render = async () => {
    const rawMarkdown = markdownInput.value;

    // Configure marked to use highlight.js or similar if needed, but for now simple rendering
    // We need to process mermaid blocks separately or let mermaid handle them

    // Custom renderer or pre-processing for mermaid could be done here
    // But simplest way:
    // 1. Marked renders text.
    // 2. We look for <pre><code class="language-mermaid">...</code></pre> and replacing with <div class="mermaid">...</div>

    let html = marked.parse(rawMarkdown);
    previewContent.innerHTML = html;

    // Post-process for Mermaid
    // Marked renders \`\`\`mermaid as <pre><code class="language-mermaid">
    const mermaidBlocks = previewContent.querySelectorAll('pre code.language-mermaid');

    for (const block of mermaidBlocks) {
        const parentPre = block.parentElement;
        const div = document.createElement('div');
        div.className = 'mermaid';
        div.textContent = block.textContent;
        // Replace the <pre> with the <div>
        parentPre.replaceWith(div);
    }

    // Run mermaid
    try {
        await mermaid.run({
            nodes: previewContent.querySelectorAll('.mermaid')
        });
    } catch (e) {
        console.error('Mermaid error:', e);
    }
};

// Event Listeners
markdownInput.value = defaultMarkdown;
render();

markdownInput.addEventListener('input', () => {
    render();
});

// File Input
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        markdownInput.value = e.target.result;
        render();
    };
    reader.readAsText(file);
    reader.readAsText(file);
});

// Load from URL
const loadFromUrl = async () => {
    const url = urlInput.value.trim();
    if (!url) return;

    const originalBtnHTML = loadUrlBtn.innerHTML;
    loadUrlBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    loadUrlBtn.disabled = true;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const text = await response.text();
        markdownInput.value = text;
        render();
        urlInput.value = ''; // Clear input on success
    } catch (error) {
        console.error('Fetch failed:', error);
        alert('Failed to load URL. Note that the server must support CORS (Cross-Origin Resource Sharing).');
    } finally {
        loadUrlBtn.innerHTML = originalBtnHTML;
        loadUrlBtn.disabled = false;
    }
}

loadUrlBtn.addEventListener('click', loadFromUrl);
urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loadFromUrl();
});

// Clear
clearBtn.addEventListener('click', () => {
    markdownInput.value = '';
    render();
    markdownInput.focus();
});

// Export PNG
exportBtn.addEventListener('click', async () => {
    // Show loading state if wanted, but html2canvas is usually fast for simple pages
    const originalBtnText = exportBtn.innerHTML;
    exportBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Generating...';

    try {
        // We capture the #previewContent div. 
        // Note: If the content is very tall, we might want to capture the scrollable area fully.
        // html2canvas captures the element's full height even if scrolled.

        // Add some padding/background for the image
        previewContent.style.backgroundColor = '#ffffff';

        const img = await snapdom.toPng(previewContent, {
            dpr: 2, // HiDPI
            backgroundColor: '#ffffff' // Ensure white background
        });

        const image = img.src;
        const link = document.createElement('a');
        link.download = `markdown-export-${Date.now()}.png`;
        link.href = image;
        link.click();
    } catch (error) {
        console.error('Export failed:', error);
        alert('Failed to export image. See console for details.');
    } finally {
        exportBtn.innerHTML = originalBtnText;
        previewContent.style.backgroundColor = ''; // Reset
    }
});
