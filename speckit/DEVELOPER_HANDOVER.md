# Developer Handover Documentation

## Project Overview

This project (`nbang.github.io`) is a comprehensive suite of web-based tools and dashboards hosted on GitHub Pages. It is designed as a "Serverless" static site, relying heavily on client-side processing (WASM, Canvas, JS Libraries) and GitHub Actions for backend-like workflows.

**Live URL**: [https://github.bangndd.qzz.io](https://github.bangndd.qzz.io)

## Architecture

-   **Hosting**: GitHub Pages (Static hosting).
-   **Core Tech**: HTML5, Vanilla JavaScript, TailwindCSS (CDM via script tag).
-   **No Build Step**: Files are written as plain HTML/JS. No Webpack/Vite build process is required for deployment.
-   **Linting**: Strict ESLint configuration (`eslint.config.js`) ensures code quality, including HTML formatting and Tailwind class sorting.

---

## Tool Requirements & Technical Approach

### 1. Image Tools (`image_tools/`)
**Goal**: Provide privacy-first, client-side image manipulation.

#### **AI In-Browser OCR (`ocr.html`)**
*   **Requirement**: Extract text from images without server upload. Support multiple models.
*   **Technical Approach**:
    *   **Library**: `@huggingface/transformers` (Transformers.js).
    *   **Execution**: Uses **WebGPU** (if available) or **WASM** for inference.
    *   **Models**: Supports Florence-2, Qwen2-VL, and SmolVLM.
    *   **Caching Strategy**: Implements a custom **IndexedDB Chunked Cache** (`TransformersChunkedCache`) to store large model weights locally, preventing repeated downloads.

#### **Compress Image (`compress.html`)**
*   **Requirement**: Reduce file size of JPG/PNG/WebP.
*   **Library**: `browser-image-compression`.
*   **Approach**: Uses a web worker to process images off the main thread. Adjusts quality and max dimensions based on user input.

#### **Crop Image (`crop.html`)**
*   **Requirement**: Visual cropping with aspect ratio presets.
*   **Library**: `cropperjs`.
*   **Approach**: Wraps the image in a canvas-based editor. Exports result via `canvas.toBlob()`.

#### **Resize Image (`resize.html`)**
*   **Requirement**: Resize dimensions by percentage or pixels.
*   **Approach**: Pure HTML5 Canvas API.
    1.  Image loaded into DOM.
    2.  `canvas.width` / `canvas.height` set to target dimensions.
    3.  `ctx.drawImage(img, ...)` to scale.
    4.  Export using `canvas.toDataURL`.

#### **Converters & Other Utilities**
*   **To/From JPG (`convert_to_jpg.html`, `convert_from_jpg.html`)**:
    *   **Requirement**: Convert between image formats (PNG/GIF/WebP <-> JPG).
    *   **Approach**: Canvas `toDataURL('image/jpeg')` or `toDataURL('image/png')`.
*   **HTML to Image (`html_to_image.html`)**:
    *   **Requirement**: Convert pasted HTML code to an image.
    *   **Library**: `html2canvas`.
    *   **Approach**: Renders the DOM node containing the HTML to a canvas, then exports as JPG.
*   **Rotate (`rotate.html`)**:
    *   **Approach**: Canvas rotation context transformations (`ctx.rotate`).

---

### 2. PDF Tools (`pdf_tools/`)
**Goal**: A complete PDF utility suite running entirely in the browser.

#### **Convert to PDF (`convert_to_pdf.html`)**
*   **Requirement**: "Universal" converter for Office docs and Images.
*   **Approach**: **"Preview & Print"**.
    1.  Render the document to HTML DOM first.
    2.  Use the browser's native Print engine (`window.print`) inside a hidden iframe to generate the PDF.
*   **Libraries**:
    *   **Word**: `mammoth.js` (converts .docx to HTML).
    *   **Excel**: `xlsx` (SheetJS) (renders sheets to HTML tables).
    *   **PowerPoint**: `PPTXjs` (uses D3/jQuery to render slides as HTML).

#### **PDF Manipulation Tools**
These tools utilize `pdf-lib` for direct byte-level manipulation of PDF files.

*   **Merge**: Load multiple PDFs, iterate pages, and copy them into a new document.
*   **Split**: Select page ranges and save as separate documents (zipped via `jszip`).
*   **Rotate**: Update the `Rotation` dictionary entry of specific pages via `page.setRotation()`.
*   **Organize**: Re-order pages by constructing a new document and copying pages in the desired index order.
*   **Watermark**:
    *   **Text**: Draw text overlay with low opacity (`drawText`) and diagonal rotation.
    *   **Image**: Embed PNG/JPG and draw over pages (`drawImage`).
*   **Sign (`sign.html`)**:
    *   **Requirement**: Add signature (Draw, Type, or Image) to PDF.
    *   **Approach**: Convert signature input to Image (Canvas), then embed and draw onto selected PDF page using `pdf-lib`.
*   **Protect (`protect.html`)**:
    *   **Requirement**: Password protect PDF.
    *   **Approach**: `pdfDoc.save({ userPassword: '...' })`.
*   **Unlock (`unlock.html`)**:
    *   **Requirement**: Remove password/Decrypt PDF.
    *   **Approach**: Decrypt by loading with password `PDFDocument.load(..., { password: '...' })`, then save without password.
*   **Repair (`repair.html`)**:
    *   **Requirement**: Fix corrupted cross-reference tables.
    *   **Approach**: Attempt to `load` (with `ignoreEncryption: true` if needed) and `save` the document to force re-serialization.
*   **Scan (`scan.html`)**:
    *   **Requirement**: Scan document via Camera.
    *   **Approach**: Access Camera via `navigator.mediaDevices.getUserMedia`. Capture frames to Canvas, then embed as images into a PDF pages.

---

### 3. Geospatial Tools (`cat2map.html`)
**Goal**: CAD (DXF) to GIS (KML/GeoJSON) conversion with Vietnam Grid (VN-2000) support.

*   **Requirement**: Parse AutoCAD files and reproject coordinates.
*   **Libraries**:
    *   **Map Visualization**: `leaflet`.
    *   **Parsing**: `dxf-parser`.
    *   **Projection**: `proj4` and `proj4leaflet`.
    *   **Export**: `tokml` (GeoJSON to KML).
*   **Technical Approach**:
    1.  Parse DXF entities to extract geometry.
    2.  Apply Affine Transformations (VN-2000 7 parameters) using `proj4`.
    3.  Render on Leaflet map.
    4.  Serialize to GeoJSON/KML for export.

---

### 4. Translation Workflow (`translation.html`)
**Goal**: Manage book translation projects (Scrape -> Translate -> Edit).

*   **Requirement**: Interface to trigger background jobs and edit results.
*   **Architecture**:
    *   **Frontend**: `translation.html` acts as a dashboard.
    *   **Backend**: GitHub Actions.
    *   **Storage**: GitHub Repository (commits files directly).
*   **Workflow**:
    1.  User configures Repo/Token.
    2.  User clicks "Run Scraper" -> Triggers `repository_dispatch` event to GitHub.
    3.  GitHub Action runs, scrapes data, commits to repo.
    4.  Dashboard uses GitHub API (Contents) to browse and edit generated files.
*   **AI Integration**: The backend workflows use Google Gemini or OpenAI API (configured via secrets/inputs) to translate text.

---

### 5. Data Dashboards
**Goal**: Visualize large static datasets without a backend database.

**Pattern**: "Side-car Data File". Data is stored in large JS files that assign a global variable (e.g., `window.data`). The HTML file loads this script and renders the UI.

#### **Vietnam Admin Data (`vietnam-admin.html`)**
*   **Data Source**: `vietnam-data.js` (~1.4MB). Defines `window.vietnamData`.
*   **Requirement**: Searchable, filterable table of all Vietnam administrative units.
*   **Approach**:
    *   Data loaded into memory.
    *   Client-side filtering (by Province, Ward Type).
    *   Client-side sorting and pagination (if needed).

#### **HCM Merger Data (`hcm-admin.html`)**
*   **Data Source**: `hcm-data.js`. Defines `window.hcmData`.
*   **Requirement**: Track status of administrative unit mergers in HCMC.
*   **Approach**: Similiar to Vietnam Admin, but specific to HCMC merger logic.

#### **AI Prompts Library (`prompt.html`)**
*   **Data Source**: `prompt-data.js`. Defines `window.promptData`.
*   **Requirement**: Library of reusable AI prompts with parameter substitution.
*   **Features**:
    *   Search/Filter by Category/User.
    *   "Copy to Clipboard" functionality.
    *   Parameter injection (replacing placeholders in prompt text).

---

### 6. Site Navigation

#### **Main Index (`index.html`)**
*   **Goal**: Central landing page listing **ALL** available tools.
*   **Requirement**:
    *   Must be updated whenever a new tool is added.
    *   Uses a Grid layout of "Cards".
    *   Each card contains: Title, Icon, Description, and "Open Tool" link.
*   **Structure**: Grouped roughly by category (Data, Image, PDF) via visual proximity, though currently a single flat grid.

---

## Data Pipelines

### `ensure_data.py`
*   **Purpose**: Fetches the latest "Free for Dev" resources.
*   **Source**: Parses the raw README from `ripienaar/free-for-dev`.
*   **Output**: Generates `freefordev-data.js` as a global window object.
*   **Run**: Manually or via scheduled Action.

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
*   **Check**: `npm run lint`
*   **Fix**: `npm run lint:fix` (Run this before committing!)
    *   *Note*: This sorts Tailwind classes and formats HTML indentation.

### Local Development
Use any static server:
```bash
python -m http.server 8000
```

### Key Files
*   `eslint.config.js`: Custom linting rules (includes `css-one-line-selectors` custom plugin).
*   `utils/pdf-libs.js`: Shared loader for PDF libraries.
*   `ui-manager.js`: Shared UI helpers for PDF tools.
