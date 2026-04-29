# OpenSpec Methodology for `nbang.github.io`

This document defines how to propose, design, and implement changes in the `nbang.github.io` repository using the [OpenSpec](https://github.com/Fission-AI/OpenSpec) methodology. It maps the fluid, iterative OpenSpec workflow to our strict architectural constraints.

---

## 🏛️ Core Architectural Constraints

Every OpenSpec artifact must adhere to these project rules:

1. **Serverless & Client-Side First**: All processing (AI, image manipulation, PDF editing) must run locally in the browser via WASM, Web Workers, or Canvas APIs.
2. **Privacy First**: User files (images, documents) must never be uploaded to external servers unless it is explicitly an API integration tool.
3. **No Build Step**: The project uses pure HTML, Vanilla JavaScript, and TailwindCSS (via CDN). No bundlers like Webpack or Vite are permitted.
4. **Side-Car Data**: Data-heavy dashboards must rely on static `.json` or `.js` data files loaded at runtime, not a backend database.
5. **Strict Code Quality**: All HTML and JS must be linted and formatted using the custom `eslint.config.js` (via `npm run lint:fix`).

---

## 🔄 The OpenSpec Workflow

When an AI assistant or human developer starts a new feature (e.g., via `/opsx:propose`), the change will be managed in an isolated folder under `openspec/changes/<change-name>/`.

### 1. Proposal (`proposal.md`)
- **Purpose**: Defines why the feature is needed and what is changing at a high level.
- **Architecture Check**: The proposal must explicitly state how it plans to fulfill the requirement without adding a backend or a build step.
- *Example*: "Proposing an AI OCR tool. We will use Transformers.js via CDN running WebGPU to maintain privacy and the no-build rule."

### 2. Requirements & Scenarios (`specs/`)
- **Purpose**: Outlines user flows and exact functionality.
- **Data Handling**: Scenarios must clearly describe how user files are kept local (e.g., "User drags and drops PDF -> File is loaded into memory via FileReader -> Processed by pdf-lib").

### 3. Technical Approach (`design.md`)
- **Purpose**: Specifies the libraries, logic, and UI structure.
- **Library Selection**: Must specify CDN links for external dependencies.
- **Component Design**: Since there are no React/Vue components, the design must describe the Vanilla JS DOM manipulation strategy or Canvas rendering approach.
- **Optimization**: For large models (e.g., HuggingFace models), design a caching mechanism using the browser's Cache API or IndexedDB.

### 4. Implementation Checklist (`tasks.md`)
- **Purpose**: A granular checklist for the AI or developer to implement the design.
- **Execution Flow**: 
  1. Add/update the UI in the target `.html` file using Tailwind CSS classes.
  2. Implement the logic in the target `.js` file.
  3. Ensure the tool is linked in the main `index.html` hub.
- **Quality Assurance**: The final task must always be running `npm run lint:fix` and manually verifying the tool on a local static server (`python -m http.server 8000`).

### 5. Archiving
- Once all tasks in `tasks.md` are marked complete and the feature works successfully in the browser, the folder is moved to `openspec/changes/archive/<date>-<change-name>/`.
- This keeps the working directory clean while retaining a historical record of architectural decisions.
