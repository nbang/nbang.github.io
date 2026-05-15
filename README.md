# Bang's Tools

A collection of utilities and dashboards for data management, translation, AI tasks, and more.

**Live Site:** [https://nbang.github.io](https://nbang.github.io)

> [!NOTE]
> **For Developers:** We follow Spec-Driven Development (SDD) principles. You can explore our methodology mappings in the `specs/` directory:
> - [SpecKit Methodology](specs/speckit.md)
> - [Superpowers Methodology](specs/superpower.md)
> - [OpenSpec Methodology](specs/openspec.md)


## Available Tools

| Category | Tool | Description | Link |
|----------|------|-------------|------|
| **Image** | Image Tools | A suite of image manipulation tools: Compress, Resize, convert, and more. | [Open Tools](https://github.bangndd.qzz.io/image_tools/index.html) |
| **PDF** | PDF Tools | Merge, split, compress, convert, rotate, unlock and watermark PDFs. | [Open Tools](https://github.bangndd.qzz.io/pdf_tools/index.html) |
| **AI** | AI Prompts Library | Browse, search, and customize a collection of useful AI prompts for various tasks. | [Open Library](https://github.bangndd.qzz.io/prompt.html) |
| **Utility** | Cat-2-Map (GIS) | Convert AutoCAD DXF files to Map (KML, GeoJSON) with VN-2000 coordinate support. | [Open Tool](https://github.bangndd.qzz.io/cat2map.html) |
| **Utility** | Lunar Converter | Convert between Solar and Vietnamese Lunar dates with calendar view. | [Open Tool](https://github.bangndd.qzz.io/calendar-converter.html) |
| **Utility** | Translation Workflow | Manage your book translation pipeline, scrape chapters, translate content, and edit files. | [Open Dashboard](https://github.bangndd.qzz.io/translation.html) |
| **Utility** | Markdown Viewer | Render Markdown files with Mermaid diagrams support and export to PNG. | [Open Tool](https://github.bangndd.qzz.io/md_viewer.html) |
| **Data** | Free For Dev | A curated list of software (SaaS, PaaS, IaaS) with free tiers for developers. | [Open Resources](https://github.bangndd.qzz.io/freefordev.html) |
| **Data** | HCM Merger Data | View and filter detailed data regarding the merger of administrative units in Ho Chi Minh City. | [Open Dashboard](https://github.bangndd.qzz.io/hcm-admin.html) |
| **Data** | Vietnam Admin Data | Comprehensive dataset of administrative units across all provinces in Vietnam. | [Open Dashboard](https://github.bangndd.qzz.io/vietnam-admin.html) |
| **Guide** | Stremio Guide | The ultimate guide to setting up Stremio for seamless movie & TV streaming. | [Read Guide](https://github.bangndd.qzz.io/stremio-guide.html) |
| **Guide** | Aniyomi Guide | The complete guide to setting up Aniyomi for your manga and anime needs. | [Read Guide](https://github.bangndd.qzz.io/aniyomi-guide.html) |

## Project Structure

```
nbang.github.io/
├── index.html                   # Landing page — cards rendered from tools-manifest.json
├── tools-manifest.json          # Registry of all tools (title, url, category, icon, etc.)
├── CNAME                        # Custom domain configuration
├── specs/                       # Methodology docs (SpecKit, Superpowers, OpenSpec)
│
├── js/utils/                    # Shared JavaScript utilities
│   ├── common.js                # loadScript, loadStylesheet, formatBytes, UIManager
│   └── nav.js                   # Sticky nav bar + dark mode toggle (inject into any tool page)
│
├── templates/
│   └── tool-template.html       # Canonical scaffold for new tools — copy this to start
│
├── tests/
│   └── smoke.test.mjs           # Puppeteer smoke tests (npm test)
│
├── .github/workflows/
│   └── ci.yml                   # CI: lint + smoke tests on push/PR
│
├── image_tools/                 # Image manipulation tools
│   ├── index.html               # Image tools hub
│   ├── ocr.html                 # AI in-browser OCR
│   ├── editor.html              # Photo editor
│   ├── image_process.html       # Compress / resize / convert
│   └── utils/
│       └── image-libs.js        # CDN loader for Fabric.js, Cropper.js (delegates to common.js)
│
├── pdf_tools/                   # PDF manipulation tools
│   ├── index.html               # PDF tools hub
│   ├── merge.html               # Merge PDFs
│   ├── split.html               # Split PDFs
│   └── utils/
│       ├── pdf-libs.js          # CDN loader for pdf-lib, PDF.js (delegates to common.js)
│       └── ui-manager.js        # PDF-specific UIManager wrapper (delegates to common.js)
│
├── hcm-admin.html               # HCM Merger Data dashboard
├── vietnam-admin.html           # Vietnam Admin Data dashboard
├── translation.html             # Translation Workflow tool
├── prompt.html                  # AI Prompts Library
├── md_viewer.html               # Markdown Viewer
├── cat2map.html                 # AutoCAD DXF → KML/GeoJSON converter
├── calendar-converter.html      # Lunar ↔ Solar calendar converter
├── freefordev.html              # Free-for-dev resources browser
├── stremio-guide.html           # Stremio setup guide
└── aniyomi-guide.html           # Aniyomi setup guide
```

## Setup & Usage

This is a static site project hosted on GitHub Pages. No build process is required.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/nbang/nbang.github.io.git
   cd nbang.github.io
   ```

2. **Install dependencies** (required for linting and testing):
   ```bash
   npm install
   ```

3. **Run locally:**
   ```bash
   python -m http.server 8000
   ```
   Then visit `http://localhost:8000` in your browser.

## Development

### Adding a New Tool

1. Copy `templates/tool-template.html` to the right location and fill in the TODOs.
2. Add one entry to `tools-manifest.json` — the index page renders cards automatically:
   ```json
   {
     "id": "my-tool",
     "title": "My Tool",
     "description": "What it does.",
     "url": "my-tool.html",
     "category": "utility",
     "color": "indigo",
     "icon": "fa-solid fa-wand-magic-sparkles",
     "cta": "Open Tool"
   }
   ```
3. Optionally add an entry to `sitemap.xml`.
4. Run `npm run lint:fix` and `npm test` before committing.

Valid categories: `data` | `utility` | `ai` | `image` | `pdf` | `guide`

### Shared Utilities

| File | Purpose |
|------|---------|
| `js/utils/common.js` | `loadScript`, `loadStylesheet`, `formatBytes`, `UIManager` (toast, spinner, drop zone) — available as `window.BangUtils` |
| `js/utils/nav.js` | Injects a sticky nav bar + dark mode toggle. Configure via `data-nav-back` / `data-nav-accent` on `<body>` |
| `pdf_tools/utils/pdf-libs.js` | PDF CDN library loader (wraps `common.js`) |
| `pdf_tools/utils/ui-manager.js` | PDF-specific `UIManager` wrapper (accent color: red) |
| `image_tools/utils/image-libs.js` | Image CDN library loader (wraps `common.js`) |

### Linting & Formatting

```bash
npm run lint        # Check for issues
npm run lint:fix    # Auto-fix indentation, Tailwind class order, CSS selectors
```

Auto-fix handles: JS/HTML indentation, Tailwind class ordering, collapsing multi-line CSS selectors in `<style>` tags.

### Testing

```bash
npm test
```

Runs Puppeteer smoke tests (`tests/smoke.test.mjs`) that:
- Load every tool URL listed in `tools-manifest.json` via a local static server
- Assert HTTP 200, non-empty `<title>`, at least one heading
- Fail on any uncaught JavaScript errors

CI runs `lint` + `test` on every push and pull request (see `.github/workflows/ci.yml`).
