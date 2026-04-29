# Developer Handover Documentation (Spec-Driven)

Welcome to the `nbang.github.io` project. This document has been structured using the **Spec-Driven Development (SDD)** methodology (via [spec-kit](https://github.com/github/spec-kit)), separating our core principles, feature specifications, and technical implementation plans.

---

## 📜 Project Constitution

These are the immutable principles governing development in this repository:

1. **Serverless & Client-Side First**: The project relies entirely on client-side processing (WASM, Canvas, JS Libraries) and GitHub Actions. There is no active backend server.
2. **Privacy First**: All data processing (like OCR, image compression, or PDF manipulation) must happen locally in the browser to ensure user data never leaves their device unless explicitly stated (e.g., GitHub Actions workflows).
3. **No Build Step**: Files must be written as plain HTML, CSS, and Vanilla JavaScript. We do not use Webpack, Vite, or other bundlers for deployment. TailwindCSS is used via CDN.
4. **Strict Code Quality**: We enforce a strict ESLint configuration (`eslint.config.js`). All code must be formatted and Tailwind classes sorted via `npm run lint:fix` before any commit.
5. **Side-Car Data Files**: For large datasets, we use static JS data files that define global variables (e.g., `window.data`) loaded by HTML files, avoiding backend databases.

---

## 🎯 Specifications (The "What")

### 1. Central Hub & Navigation
- **Goal**: A central landing page (`index.html`) listing ALL available tools.
- **Requirements**: Must use a grid layout of cards (Title, Icon, Description, "Open Tool"). Must be updated whenever a new tool is added. Tool categories have their own sub-hubs (e.g., `image_tools/index.html`, `pdf_tools/index.html`).

### 2. Image Tools
- **AI In-Browser OCR**: Extract text from images accurately.
- **Image Processor**: Convert formats (JPG/PNG/GIF/WebP) and compress file sizes.
- **Photo Editor**: Crop, rotate, resize, filter, and annotate images.
- **Watermarks**: Add text/image watermarks or remove AI watermarks.
- **Generators**: Create memes from templates or convert HTML snippets to images.

### 3. PDF Tools
- **Converters**: Convert Office documents (Word, Excel, PPT) and images into PDFs. Convert PDFs to JPG or Word.
- **Manipulators**: Merge, split, compress, rotate, organize, and repair corrupted PDFs.
- **Annotations**: Add page numbers, text/image watermarks, signatures, and freehand edits.
- **Security**: Protect PDFs with passwords or unlock them.
- **AI Integration**: Scan documents via camera, perform OCR, and summarize PDF content.

### 4. Specialized Dashboards & Utilities
- **Markdown Viewer**: View and render Markdown files, including Mermaid diagrams, with image export capabilities.
- **Geospatial Tools (CAD to GIS)**: Parse AutoCAD (DXF) files, reproject coordinates (VN-2000), and export to KML/GeoJSON.
- **Translation Workflow**: Manage book translation projects (Scrape -> Translate -> Edit) via a dashboard.
- **Lunar Calendar**: Convert between Gregorian (Solar) and Vietnamese Lunar calendars accurately.
- **Data Dashboards**: View, search, and filter large datasets (Vietnam/HCM Admin Data, AI Prompts, Free-for-Dev resources).

---

## 🛠️ Implementation Plan (The "How")

### Architecture & Tech Stack
- **Hosting**: GitHub Pages
- **Core Tech**: HTML5, Vanilla JavaScript, TailwindCSS (CDN)
- **AI Models**: Transformers.js (v4+) leveraging WebGPU (primary) and WASM (fallback). Models include Florence-2, SmolVLM, Granite Docling, Qwen2.5, and Llama-3.2.

### Component Implementation Details

#### Image Tools
- **Processing**: `browser-image-compression` via Web Workers.
- **Editing**: `fabric.js` for canvas rendering/filters; `cropperjs` for advanced cropping.
- **HTML to Image**: `snapdom` for rendering DOM to JPG.
- **Shared Utilities**: `image_tools/utils/image-libs.js` dynamically loads required libraries.

#### PDF Tools
- **Core Manipulation**: `pdf-lib` for byte-level manipulation (Merge, Split, Watermark, Sign, Protect).
- **Rendering & Conversion**: `pdf.js` for rendering to Canvas.
- **Office Conversion**: "Preview & Print" approach. `mammoth.js` (Word), `xlsx` (Excel), `PPTXjs` (PowerPoint) render to HTML, then printed to PDF via hidden iframe.
- **Shared Utilities**: `pdf_tools/utils/pdf-libs.js` and `ui-manager.js`.

#### Specialized Tools
- **Markdown Viewer**: Uses `marked` (parsing), `mermaid.js` (diagrams), and `snapdom` (export).
- **Geospatial**: `dxf-parser` (parsing), `proj4` & `proj4leaflet` (projection), `leaflet` (map UI), `tokml` (export).
- **Translation Dashboard**: Frontend UI triggers GitHub Actions via `repository_dispatch`. Actions run scrapers/AI translation and commit results back to the repo. Frontend uses GitHub API to view/edit.
- **Lunar Calendar**: Pure JS logic (`lunar-algo.js` adapted from Ho Ngoc Duc) with no external dependencies.
- **Data Dashboards**: Python script (`ensure_data.py`) fetches external data and writes it as a static JS object to be consumed by the frontend logic.

---

## ✅ Task Execution & Handover

When adding new tools or updating existing ones, follow this checklist:

1. **Setup**:
   ```bash
   git clone https://github.com/nbang/nbang.github.io.git
   cd nbang.github.io
   npm install # Installs ESLint dependencies
   ```
2. **Development**:
   - Start a local server: `python -m http.server 8000`
   - Implement according to the **Constitution** (no build steps, keep logic client-side).
3. **Testing**: Test in browser. Ensure WebGPU/WASM models load correctly.
4. **Quality Assurance**:
   - Run `npm run lint:fix` to automatically format files and sort Tailwind classes.
   - Verify that your new tool has been added to `index.html` and any relevant sub-hubs.
5. **Commit & Deploy**: Push to the `main` branch. GitHub Pages will deploy automatically.

### Key Shared Files
- `eslint.config.js`: Custom linting rules (includes `css-one-line-selectors`).
- `pdf_tools/utils/pdf-libs.js` & `ui-manager.js`: PDF shared logic.
- `image_tools/utils/image-libs.js` & `editor.js`: Image shared logic.
