# Bang's Tools

A collection of utilities and dashboards for data management, translation, AI tasks, and more.

**Live Site:** [https://github.bangndd.qzz.io](https://github.bangndd.qzz.io)

## Available Tools

| Tool | Description | Link |
|------|-------------|------|
| **HCM Merger Data** | View and filter detailed data regarding the merger of administrative units in Ho Chi Minh City. | [Open Dashboard](https://github.bangndd.qzz.io/hcm-admin.html) |
| **Vietnam Admin Data** | Comprehensive dataset of administrative units across all provinces in Vietnam. | [Open Dashboard](https://github.bangndd.qzz.io/vietnam-admin.html) |
| **Translation Workflow** | Manage your book translation pipeline, scrape chapters, translate content, and edit files. | [Open Dashboard](https://github.bangndd.qzz.io/translation.html) |
| **AI In-Browser OCR** | Extract text from images locally using powerful Transformer models directly in your browser. | [Open Tool](https://github.bangndd.qzz.io/ocr.html) |
| **AI Prompts Library** | Browse, search, and customize a collection of useful AI prompts for various tasks. | [Open Library](https://github.bangndd.qzz.io/prompt.html) |

## Project Structure

This repository is organized as follows:

```
nbang.github.io/
├── index.html               # Main landing page listing all tools
├── CNAME                    # Custom domain configuration
│
├── hcm-admin.html           # HCM Merger Data Dashboard UI
├── hcm-admin.js             # Logic for HCM Admin page
├── hcm-data.js              # Data source for HCM Admin
│
├── vietnam-admin.html       # Vietnam Admin Data Dashboard UI
├── vietnam-admin.js         # Logic for Vietnam Admin page
├── vietnam-data.js          # Large dataset for Vietnam Admin
├── vietnam_admin_data.json  # Raw JSON data for Vietnam Admin
│
├── translation.html         # Translation Workflow Tool UI
├── translation.js           # Logic for Translation Workflow
│
├── ocr.html                 # AI In-Browser OCR Tool UI
├── ocr.js                   # Logic using Transformers.js for OCR
│
├── prompt.html              # AI Prompts Library UI
├── prompts.js               # Logic for Prompts Library
├── prompt-data.js           # Prompts data (JS format for CORS)
├── prompts.json             # Source data for prompts
├── dedupe_prompts.py        # Utility script to manage prompts
│
└── ...
```

## Setup & Usage

This is a static site project hosted on GitHub Pages. No build process is required for the main HTML/JS files.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/nbang/nbang.github.io.git
    cd nbang.github.io
    ```

2.  **Run locally:**
    You can use any static file server, for example with Python:
    ```bash
    python -m http.server 8000
    ```
    Then visit `http://localhost:8000` in your browser.
