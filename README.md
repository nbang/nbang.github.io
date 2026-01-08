# Bang's Tools

A collection of utilities and dashboards for data management, translation, AI tasks, and more.

**Live Site:** [https://github.bangndd.qzz.io](https://github.bangndd.qzz.io)

> [!NOTE]
> **For Developers:** Please refer to [DEVELOPER_HANDOVER.md](speckit/DEVELOPER_HANDOVER.md) for architecture details and handover instructions.


## Available Tools


| Tool | Description | Link |
|------|-------------|------|
| **Image Tools** | A suite of image manipulation tools: Compress, Resize, convert, and more. | [Open Tools](https://github.bangndd.qzz.io/image_tools/index.html) |
| **PDF Tools** | Merge, split, compress, convert, rotate, unlock and watermark PDFs. | [Open Tools](https://github.bangndd.qzz.io/pdf_tools/index.html) |
| **AI In-Browser OCR** | Extract text from images locally using powerful Transformer models directly in your browser. | [Open Tool](https://github.bangndd.qzz.io/image_tools/ocr.html) |
| **Cat-2-Map (GIS)** | Convert AutoCAD DXF files to Map (KML, GeoJSON) with VN-2000 coordinate support. | [Open Tool](https://github.bangndd.qzz.io/cat2map.html) |
| **Free For Dev** | A curated list of software (SaaS, PaaS, IaaS) with free tiers for developers. | [Open Resources](https://github.bangndd.qzz.io/freefordev.html) |
| **AI Prompts Library** | Browse, search, and customize a collection of useful AI prompts for various tasks. | [Open Library](https://github.bangndd.qzz.io/prompt.html) |
| **Translation Workflow** | Manage your book translation pipeline, scrape chapters, translate content, and edit files. | [Open Dashboard](https://github.bangndd.qzz.io/translation.html) |
| **HCM Merger Data** | View and filter detailed data regarding the merger of administrative units in Ho Chi Minh City. | [Open Dashboard](https://github.bangndd.qzz.io/hcm-admin.html) |
| **Vietnam Admin Data** | Comprehensive dataset of administrative units across all provinces in Vietnam. | [Open Dashboard](https://github.bangndd.qzz.io/vietnam-admin.html) |

## Project Structure

This repository is organized as follows:

```
nbang.github.io/
├── index.html               # Main landing page listing all tools
├── CNAME                    # Custom domain configuration
│
├── image_tools/             # Image manipulation tools
│   ├── index.html           # Image tools landing page
│   ├── compress.html        # Compress images
│   ├── resize.html          # Resize images
│   ├── ocr.html             # OCR tool
│   └── ...
│
├── pdf_tools/               # PDF manipulation tools
│   ├── index.html           # PDF tools landing page
│   ├── convert_to_pdf.html  # Unified PDF converter
│   ├── compress.html        # Compress PDF
│   ├── merge.html           # Merge PDFs
│   └── ...
│
├── hcm-admin.html           # HCM Merger Data Dashboard UI
├── vietnam-admin.html       # Vietnam Admin Data Dashboard UI
├── translation.html         # Translation Workflow Tool UI
├── prompt.html              # AI Prompts Library UI
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

## Development

### Setup

Install dependencies to enable linting:

```bash
npm install
```

### Linting & Formatting

This project uses **ESLint** for code quality and consistent formatting (including HTML and Tailwind CSS).

- **Check for issues:**
  ```bash
  npm run lint
  ```

- **Auto-fix issues:**
  ```bash
  npm run lint:fix
  ```

  _This will automatically format JS, HTML, and CSS (within HTML files), including:_
  - _Standardizing indentation_
  - _Ordering Tailwind classes_
  - _Collapsing multi-line CSS selectors in `<style>` tags_
