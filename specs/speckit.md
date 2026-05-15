# Developer Handover Documentation (Spec-Driven)

Welcome to the `nbang.github.io` project. This document has been structured using the **Spec-Driven Development (SDD)** methodology (via [spec-kit](https://github.com/github/spec-kit)), separating our core principles, feature specifications, and technical implementation plans.

---

## 📜 Project Constitution

These are the immutable principles governing development in this repository:

1. **Serverless & Client-Side First**: The project relies entirely on client-side processing (WASM, Canvas, JS Libraries) and GitHub Actions. There is no active backend server.
2. **Privacy First**: All data processing (like OCR, image compression, or PDF manipulation) must happen locally in the browser to ensure user data never leaves their device unless explicitly stated (e.g., GitHub Actions workflows).
3. **No Build Step**: Files must be written as plain HTML, CSS, and Vanilla JavaScript. We do not use Webpack, Vite, or other bundlers for deployment. TailwindCSS is used via CDN.
4. **Strict Code Quality**: We enforce a strict ESLint configuration (`eslint.config.js`). All code must be formatted and Tailwind classes sorted via `npm run lint:fix` before any commit.
5. **Side-Car Data Files**: For large datasets, we use static JSON files loaded by HTML files at runtime, avoiding backend databases.
6. **Data-Driven Index**: The landing page (`index.html`) renders all tool cards dynamically from `tools-manifest.json`. New tools must be registered there — not hard-coded into the HTML.

---

## 🎯 Specifications (The "What")

### 1. Central Hub & Navigation
- **Goal**: A central landing page (`index.html`) listing ALL available tools with search and category filtering.
- **Requirements**:
  - Cards are rendered at runtime from `tools-manifest.json` (id, title, description, url, category, color, icon, cta).
  - Search bar filters cards by title and description.
  - Category tabs filter by: `data` | `utility` | `ai` | `image` | `pdf` | `guide`.
  - Dark mode toggle persisted to `localStorage`.
  - **To add a new tool**: add one entry to `tools-manifest.json` only — no HTML edits needed.
  - Tool category sub-hubs (`image_tools/index.html`, `pdf_tools/index.html`) have their own landing pages.

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
- **Translation Workflow**: Manage book translation projects (Scrape → Translate → Edit) via a dashboard.
- **Lunar Calendar**: Convert between Gregorian (Solar) and Vietnamese Lunar calendars accurately.
- **Data Dashboards**: View, search, and filter large datasets (Vietnam/HCM Admin Data, AI Prompts, Free-for-Dev resources).
- **Guides**: Step-by-step setup guides for external tools (Stremio, Aniyomi).

---

## 🛠️ Implementation Plan (The "How")

### Architecture & Tech Stack
- **Hosting**: GitHub Pages (static files, no server)
- **Core Tech**: HTML5, Vanilla JavaScript, TailwindCSS (CDN v4 browser runtime)
- **AI Models**: Transformers.js (v4+) leveraging WebGPU (primary) and WASM (fallback). Models include Florence-2, SmolVLM, Granite Docling, Qwen2.5, and Llama-3.2.
- **CI**: GitHub Actions (`.github/workflows/ci.yml`) — lint + smoke tests on every push/PR.

### Shared Utilities

All shared logic lives in `js/utils/` and is loaded before tool-specific scripts:

| File | Exported as | Purpose |
|------|-------------|---------|
| `js/utils/common.js` | `window.BangUtils` | `loadScript`, `loadStylesheet`, `formatBytes`, `UIManager` (drop zone, spinner, toast) |
| `js/utils/nav.js` | auto-injected | Sticky nav bar + dark mode toggle. Configure via `data-nav-*` attributes on `<body>`. |

Tool-specific wrappers delegate to `common.js`:
- `pdf_tools/utils/pdf-libs.js` — PDF CDN loader (pdf-lib, PDF.js)
- `pdf_tools/utils/ui-manager.js` — PDF UIManager with red accent
- `image_tools/utils/image-libs.js` — Image CDN loader (Fabric.js, Cropper.js)

### Component Implementation Details

#### Image Tools
- **Processing**: `browser-image-compression` via Web Workers.
- **Editing**: `fabric.js` for canvas rendering/filters; `cropperjs` for advanced cropping.
- **HTML to Image**: `snapdom` for rendering DOM to JPG.
- **Shared Utilities**: `image_tools/utils/image-libs.js` dynamically loads required libraries (delegates to `js/utils/common.js`).

#### PDF Tools
- **Core Manipulation**: `pdf-lib` for byte-level manipulation (Merge, Split, Watermark, Sign, Protect).
- **Rendering & Conversion**: `pdf.js` for rendering to Canvas.
- **Office Conversion**: "Preview & Print" approach. `mammoth.js` (Word), `xlsx` (Excel), `PPTXjs` (PowerPoint) render to HTML, then printed to PDF via hidden iframe.
- **Shared Utilities**: `pdf_tools/utils/pdf-libs.js` and `ui-manager.js` (both delegate to `js/utils/common.js`).

#### Specialized Tools
- **Markdown Viewer**: Uses `marked` (parsing), `mermaid.js` (diagrams), and `snapdom` (export).
- **Geospatial**: `dxf-parser` (parsing), `proj4` & `proj4leaflet` (projection), `leaflet` (map UI), `tokml` (export).
- **Translation Dashboard**: Frontend UI triggers GitHub Actions via `repository_dispatch`. Actions run scrapers/AI translation and commit results back to the repo. Frontend uses GitHub API to view/edit.
- **Lunar Calendar**: Pure JS logic (`lunar-algo.js` adapted from Ho Ngoc Duc) with no external dependencies.
- **Data Dashboards**: Python script (`ensure_data.py`) fetches external data and writes it as a static JSON file consumed by the frontend.

---

## ✅ Task Execution & Handover

When adding new tools or updating existing ones, follow this checklist:

1. **Setup**:
   ```bash
   git clone https://github.com/nbang/nbang.github.io.git
   cd nbang.github.io
   npm install
   ```

2. **Create the tool**:
   - Copy `templates/tool-template.html` to the right location.
   - Fill in all `<!-- TODO -->` markers.
   - Load `js/utils/common.js` first, then `js/utils/nav.js`, then any tool-specific utils.

3. **Register the tool**:
   - Add one entry to `tools-manifest.json` (id, title, description, url, category, color, icon, cta).
   - Optionally add a `<url>` entry to `sitemap.xml`.
   - Do **not** manually edit `index.html` — cards are generated from the manifest.

4. **Development**:
   - Start a local server: `python -m http.server 8000`
   - Implement according to the **Constitution** (no build steps, keep logic client-side).

5. **Quality Assurance**:
   ```bash
   npm run lint:fix   # Auto-format and sort Tailwind classes
   npm test           # Smoke-test all tool pages via Puppeteer
   ```

6. **Commit & Deploy**: Push to `master`. GitHub Pages deploys automatically; CI runs lint + tests.

### Key Shared Files

| File | Purpose |
|------|---------|
| `tools-manifest.json` | Registry of all tools — source of truth for the index page |
| `js/utils/common.js` | Shared utilities for all pages (`window.BangUtils`) |
| `js/utils/nav.js` | Universal nav bar + dark mode (inject into any tool page) |
| `templates/tool-template.html` | Starting scaffold for new tools |
| `tests/smoke.test.mjs` | Puppeteer smoke suite (runs via `npm test`) |
| `.github/workflows/ci.yml` | CI pipeline: lint + smoke tests |
| `eslint.config.js` | Custom linting rules (includes `css-one-line-selectors`) |
| `pdf_tools/utils/pdf-libs.js` | PDF CDN loader (wraps `common.js`) |
| `pdf_tools/utils/ui-manager.js` | PDF UIManager with red accent |
| `image_tools/utils/image-libs.js` | Image CDN loader (wraps `common.js`) |
