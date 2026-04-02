# Developer Handover Documentation

## Project Overview

This project (`nbang.github.io`) is a comprehensive suite of web-based tools and dashboards hosted on GitHub Pages. It is designed as a "Serverless" static site, relying heavily on client-side processing (WASM, Canvas, JS Libraries) and GitHub Actions for backend-like workflows.

**Live URL**: [https://github.bangndd.qzz.io](https://github.bangndd.qzz.io)

## Architecture

- **Hosting**: GitHub Pages (Static hosting).
- **Core Tech**: HTML5, Vanilla JavaScript, TailwindCSS (CDM via script tag).
- **No Build Step**: Files are written as plain HTML/JS. No Webpack/Vite build process is required for deployment.
- **Linting**: Strict ESLint configuration (`eslint.config.js`) ensures code quality, including HTML formatting and Tailwind class sorting.

---

## Site Navigation

### Main Index (`index.html`)

- **Goal**: Central landing page listing **ALL** available tools.
- **Requirement**:
  - Must be updated whenever a new tool is added.
  - Uses a Grid layout of "Cards".
  - Each card contains: Title, Icon, Description, and "Open Tool" link.

### Tool Hub Pages

Each tool category has its own hub/index page:

- **`image_tools/index.html`**: Hub for all image manipulation tools.
- **`pdf_tools/index.html`**: Hub for all PDF utility tools.

---

## Tool Requirements & Technical Approach

### 1. Image Tools (`image_tools/`)

**Goal**: Provide privacy-first, client-side image manipulation.

**Hub Page**: `image_tools/index.html` - Entry point linking to all image tools.

#### **AI In-Browser OCR (`ocr.html`)**

- **Requirement**: Extract text from images without server upload using state-of-the-art models.
- **Technical Approach**:
  - **Library**: `@huggingface/transformers` (Transformers.js v3+).
  - **Execution**: Prioritizes **WebGPU** for high performance, falls back to **WASM** (CPU).
  - **Models**:
    - **Florence-2-base-ft** (Microsoft): Fast, accurate general OCR.
    - **SmolVLM-256M-Instruct** (HuggingFace): Lightweight Vision-Language Model for complex text/reasoning.
    - **Granite Docling** (IBM): 258M optimized model for document understanding.
  - **Layout**: Responsive 2-column "Side-by-Side" design (Input Image vs Extracted Result).
  - **Caching Strategy**: Standard browser Cache API + Transformers.js internal caching.

#### **Image Processor (`image_process.html`)**

- **Requirement**: Unified interface to convert formats (JPG/PNG/GIF/WebP) and compress image file sizes.
- **Library**: `browser-image-compression`.
- **Approach**: Uses an off-screen Canvas for format conversion, resizing, and transparent background filling. Passes the resulting blob to `browser-image-compression` running in a web worker to optimize file sizes dynamically.

#### **Photo Editor (`editor.html`, `editor.js`)**

- **Requirement**: Unified interface for cropping, rotating, resizing, filtering, and annotating images.
- **Libraries**:
  - `fabric.js` (Canvas manipulation, filters, drawing, rotation, resizing).
  - `cropperjs` (Advanced cropping).
- **Approach**:
  - **Main Canvas**: Uses Fabric.js for core rendering, filters, drawing, and resizing (scaling background image).
  - **Cropping**: Temporarily switches to a `cropperjs` view (img element) for cropping actions, then applies result back to Fabric canvas.
  - **Rotation**: Rotates the Fabric canvas/image.
- **Shared Library**: `editor.js` contains reusable image editing utilities.

#### **Image Watermark (`watermark.html`)**

- **Requirement**: Add text or image watermarks to images.
- **Approach**: Uses Canvas API to overlay text or image with configurable position, opacity, and typography.

#### **Remove Watermark (`remove_watermark.html`)**

- **Requirement**: Remove Gemini AI watermarks from images.
- **Approach**: Client-side inpainting using AI models for watermark removal.

#### **Meme Generator (`meme.html`)**

- **Requirement**: Create memes from templates or custom images.
- **Approach**: Simple UI for adding top/bottom text to images with classic meme styling.

#### **HTML to Image (`html_to_image.html`)**

- **Requirement**: Convert pasted HTML code to an image.
- **Library**: `snapdom`.
- **Approach**: Renders the DOM node containing the HTML to a high-quality JPG image using snapDOM.

#### **Shared Libraries**

- **`image_tools/utils/image-libs.js`**: Shared loader for image processing libraries.

---

### 2. Markdown Viewer (`md_viewer.html`, `md_viewer.js`)

**Goal**: View and render Markdown files locally with diagram support.

- **Requirement**: Render Markdown text, Mermaid diagrams, and export to image.
- **Technical Approach**:
  - **Markdown**: `marked` library for parsing.
  - **Diagrams**: `mermaid.js`. Code blocks marked with `mermaid` are replaced with rendered SVGs.
  - **Export**: `snapdom` captures the preview element as a PNG image.
  - **URL Loading**: `fetch` API to load raw Markdown content from external URLs (CORS dependent).
  - **Styling**: GitHub-like typography using customized Tailwind CSS classes (`.prose`).

---

### 3. PDF Tools (`pdf_tools/`)

**Goal**: A complete PDF utility suite running entirely in the browser.

**Hub Page**: `pdf_tools/index.html` - Entry point linking to all PDF tools.

#### **Convert to PDF (`convert_to_pdf.html`)**

- **Requirement**: "Universal" converter for Office docs and Images.
- **Approach**: **"Preview & Print"**.
  1. Render the document to HTML DOM first.
  2. Use the browser's native Print engine (`window.print`) inside a hidden iframe to generate the PDF.
- **Libraries**:
  - **Word**: `mammoth.js` (converts .docx to HTML).
  - **Excel**: `xlsx` (SheetJS) (renders sheets to HTML tables).
  - **PowerPoint**: `PPTXjs` (uses D3/jQuery to render slides as HTML).

#### **PDF Manipulation Tools**

These tools utilize `pdf-lib` for direct byte-level manipulation of PDF files.

##### **Merge (`merge.html`)**
- Load multiple PDFs, iterate pages, and copy them into a new document.

##### **Split (`split.html`)**
- Select page ranges and save as separate documents (zipped via `jszip`).

##### **Compress (`compress.html`)**
- Reduce PDF file size while optimizing for maximal quality using `pdf-lib` and compression strategies.

##### **Rotate (`rotate.html`)**
- Update the `Rotation` dictionary entry of specific pages via `page.setRotation()`.

##### **Organize (`organize.html`)**
- Re-order pages by constructing a new document and copying pages in the desired index order.

##### **Page Numbers (`page_numbers.html`)**
- Add page numbers to PDFs with configurable position, dimensions, and typography.

##### **Edit (`edit.html`)**
- Add text, images, shapes, or freehand annotations to a PDF document using Fabric.js integration with pdf-lib.

##### **Watermark (`watermark.html`)**
- **Text**: Draw text overlay with low opacity (`drawText`) and diagonal rotation.
- **Image**: Embed PNG/JPG and draw over pages (`drawImage`).

##### **Sign (`sign.html`)**
- **Requirement**: Add signature (Draw, Type, or Image) to PDF.
- **Approach**: Convert signature input to Image (Canvas), then embed and draw onto selected PDF page using `pdf-lib`.

##### **Protect (`protect.html`)**
- **Requirement**: Password protect PDF.
- **Approach**: `pdfDoc.save({ userPassword: '...' })`.

##### **Unlock (`unlock.html`)**
- **Requirement**: Remove password/Decrypt PDF.
- **Approach**: Decrypt by loading with password `PDFDocument.load(..., { password: '...' })`, then save without password.

##### **Repair (`repair.html`)**
- **Requirement**: Fix corrupted cross-reference tables.
- **Approach**: Attempt to `load` (with `ignoreEncryption: true` if needed) and `save` the document to force re-serialization.

##### **Scan (`scan.html`)**
- **Requirement**: Scan document via Camera.
- **Approach**: Access Camera via `navigator.mediaDevices.getUserMedia`. Capture frames to Canvas, then embed as images into a PDF pages.

##### **Summarize (`summarize.html`)**
- **Requirement**: Client-side AI summarization of PDF content.
- **Approach**:
  1. Extract text using `pdf.js`.
  2. Summarize using `@huggingface/transformers`.
- **Models**:
  - **Standard (WASM)**: `Xenova/distilbart-cnn-6-6` (Encoder-Decoder, CPU friendly).
  - **Next-Gen (WebGPU)**: `onnx-community/Qwen2.5-0.5B-Instruct` and `Llama-3.2-1B-Instruct` (Quantized Chat Models).
- **Optimization**: Implements **Chunked Caching** (IndexedDB) for large weights. Supports WebGPU for accelerated inference.

##### **OCR PDF (`ocr.html`)**
- **Requirement**: Convert scanned PDFs to editable documents.
- **Approach**: Uses `@huggingface/transformers` for OCR on PDF pages/images.

##### **PDF to JPG (`pdf_to_jpg.html`)**
- **Requirement**: Convert PDF pages to JPG images.
- **Approach**: Render PDF pages to Canvas using `pdf.js`, then export as JPEG images.

##### **PDF to Word (`pdf_to_word.html`)**
- **Requirement**: Convert PDF to editable Word documents.
- **Approach**: Extract text and basic formatting from PDF, reconstruct as DOCX structure.

#### **Shared Libraries**

- **`pdf_tools/utils/pdf-libs.js`**: Shared loader for PDF libraries.
- **`pdf_tools/utils/ui-manager.js`**: Shared UI helpers for PDF tools.

---

### 4. Geospatial Tools (`cat2map.html`, `cat2map.js`, `lunar-algo.js`)

**Goal**: CAD (DXF) to GIS (KML/GeoJSON) conversion with Vietnam Grid (VN-2000) support.

- **Requirement**: Parse AutoCAD files and reproject coordinates.
- **Libraries**:
  - **Map Visualization**: `leaflet`.
  - **Parsing**: `dxf-parser`.
  - **Projection**: `proj4` and `proj4leaflet`.
  - **Export**: `tokml` (GeoJSON to KML).
- **Technical Approach**:
  1. Parse DXF entities to extract geometry.
  2. Apply Affine Transformations (VN-2000 7 parameters) using `proj4`.
  3. Render on Leaflet map.
  4. Serialize to GeoJSON/KML for export.

---

### 5. Translation Workflow (`translation.html`, `translation.js`)

**Goal**: Manage book translation projects (Scrape -> Translate -> Edit).

- **Requirement**: Interface to trigger background jobs and edit results.
- **Architecture**:
  - **Frontend**: `translation.html` acts as a dashboard.
  - **Backend**: GitHub Actions.
  - **Storage**: GitHub Repository (commits files directly).
- **Workflow**:
  1. User configures Repo/Token.
  2. User clicks "Run Scraper" -> Triggers `repository_dispatch` event to GitHub.
  3. GitHub Action runs, scrapes data, commits to repo.
  4. Dashboard uses GitHub API (Contents) to browse and edit generated files.
- **AI Integration**: The backend workflows use Google Gemini or OpenAI API (configured via secrets/inputs) to translate text.

---

### 6. Lunar Calendar Tool (`calendar-converter.html`, `lunar-algo.js`)

**Goal**: Convert between Gregorian (Solar) and Vietnamese Lunar calendars.

- **Requirement**: Accurate conversion using the standard Vietnamese algorithm (Ho Ngoc Duc).
- **Key Features**:
  - **Dual Converter**: Solar <-> Lunar.
  - **Calendar Widget**: Month view with lunar dates.
  - **Leap Month Support**: Handles Vietnamese leap months correctly.
- **Technical Approach**:
  - **Algorithm**: `lunar-algo.js` (Adapted from Ho Ngoc Duc, 2006).
  - **Implementation**: Pure JS calculation exposed via `SolarLunarConverter` global object. No external dependencies.

---

### 7. Data Dashboards

**Goal**: Visualize large static datasets without a backend database.

**Pattern**: "Side-car Data File". Data is stored in large JS files that assign a global variable (e.g., `window.data`). The HTML file loads this script and renders the UI.

#### **Vietnam Admin Data (`vietnam-admin.html`, `vietnam-admin.js`)**

- **Data Source**: `vietnam-data.json` (~1.4MB). Fetched dynamically.
- **Requirement**: Searchable, filterable table of all Vietnam administrative units.
- **Approach**:
  - Data loaded into memory.
  - Client-side filtering (by Province, Ward Type).
  - Client-side sorting and pagination (if needed).

#### **HCM Merger Data (`hcm-admin.html`, `hcm-admin.js`)**

- **Data Source**: `hcm-data.json`. Fetched dynamically.
- **Requirement**: Track status of administrative unit mergers in HCMC.
- **Approach**: Similar to Vietnam Admin, but specific to HCMC merger logic.

#### **AI Prompts Library (`prompt.html`, `prompts.js`)**

- **Data Source**: `prompt-data.js`. Defines `window.promptData`.
- **Requirement**: Library of reusable AI prompts with parameter substitution.
- **Features**:
  - Search/Filter by Category/User.
  - "Copy to Clipboard" functionality.
  - Parameter injection (replacing placeholders in prompt text).

#### **Free For Dev (`freefordev.html`, `freefordev.js`)**

- **Data Source**: `freefordev-data.json`. Fetched dynamically.
- **Requirement**: Curated list of free software tiers for developers.
- **Approach**: Client-side search and filtering of categorized resources.

---

### 8. Streaming Guides

#### **Stremio Guide (`stremio-guide.html`)**

- **Goal**: Guide for setting up Stremio for movie & TV streaming.
- **Content**: Comprehensive setup instructions, addons, and tips.

#### **Aniyomi Guide (`aniyomi-guide.html`)**

- **Goal**: Guide for setting up Aniyomi for manga and anime.
- **Content**: Comprehensive setup instructions, extensions, and tips.

---

## Data Pipelines

### `ensure_data.py`

- **Purpose**: Fetches the latest "Free for Dev" resources.
- **Source**: Parses the raw README from `ripienaar/free-for-dev`.
- **Output**: Generates `freefordev-data.js` as a global window object.
- **Run**: Manually or via scheduled Action.

---

## Development & Handover

### Setup

```bash
git clone https://github.com/nbang/nbang.github.io.git
cd nbang.github.io
npm install # Install ESLint dependencies
```

### Code Quality

The project enforces strict formatting.

- **Check**: `npm run lint`
- **Fix**: `npm run lint:fix` (Run this before committing!)
- *Note*: This sorts Tailwind classes and formats HTML indentation.

### Local Development

Use any static server:

```bash
python -m http.server 8000
```

### Key Files

- `eslint.config.js`: Custom linting rules (includes `css-one-line-selectors` custom plugin).
- `pdf_tools/utils/pdf-libs.js`: Shared loader for PDF libraries.
- `pdf_tools/utils/ui-manager.js`: Shared UI helpers for PDF tools.
- `image_tools/utils/image-libs.js`: Shared loader for image libraries.
- `image_tools/editor.js`: Shared editor utilities.

---

## Directory Structure Summary

```
nbang.github.io/
├── index.html                      # Main landing page
├── speckit/
│   └── DEVELOPER_HANDOVER.md      # This documentation
├── image_tools/
│   ├── index.html                  # Hub page for image tools
│   ├── ocr.html                   # AI OCR for images
│   ├── image_process.html         # Compress, resize, convert
│   ├── editor.html                # Photo editor
│   ├── editor.js                  # Editor shared utilities
│   ├── watermark.html             # Add watermark to images
│   ├── remove_watermark.html       # Remove AI watermarks
│   ├── meme.html                  # Meme generator
│   ├── html_to_image.html         # HTML to image conversion
│   └── utils/
│       └── image-libs.js          # Shared image library loader
├── pdf_tools/
│   ├── index.html                  # Hub page for PDF tools
│   ├── merge.html                  # Combine PDFs
│   ├── split.html                  # Split PDF pages
│   ├── compress.html               # Reduce PDF size
│   ├── convert_to_pdf.html         # Office/Image to PDF
│   ├── pdf_to_jpg.html             # PDF to JPG conversion
│   ├── pdf_to_word.html            # PDF to DOCX conversion
│   ├── rotate.html                 # Rotate PDF pages
│   ├── page_numbers.html           # Add page numbers
│   ├── watermark.html              # Add watermark to PDF
│   ├── edit.html                   # Edit PDF content
│   ├── unlock.html                 # Remove PDF password
│   ├── protect.html                # Add PDF password
│   ├── sign.html                   # Sign PDF
│   ├── organize.html               # Reorder PDF pages
│   ├── repair.html                 # Fix corrupted PDF
│   ├── scan.html                   # Camera to PDF
│   ├── summarize.html              # AI PDF summarization
│   ├── ocr.html                    # OCR for PDF
│   └── utils/
│       ├── pdf-libs.js             # Shared PDF library loader
│       └── ui-manager.js           # Shared UI helpers
├── md_viewer.html                  # Markdown viewer
├── md_viewer.js                   # Viewer logic
├── cat2map.html                   # DXF to GIS converter
├── cat2map.js                     # Converter logic
├── calendar-converter.html        # Lunar calendar converter
├── lunar-algo.js                  # Calendar conversion algorithm
├── translation.html               # Translation workflow dashboard
├── translation.js                 # Dashboard logic
├── vietnam-admin.html             # Vietnam admin data dashboard
├── vietnam-admin.js              # Dashboard logic
├── hcm-admin.html                # HCM merger data dashboard
├── hcm-admin.js                  # Dashboard logic
├── prompt.html                    # AI prompts library
├── prompts.js                    # Prompts data
├── freefordev.html               # Free-for-dev resources
├── freefordev.js                 # Resources data
├── stremio-guide.html            # Stremio setup guide
├── aniyomi-guide.html            # Aniyomi setup guide
├── eslint.config.js               # ESLint configuration
├── package.json                   # NPM dependencies
└── ensure_data.py                # Data pipeline script
```
