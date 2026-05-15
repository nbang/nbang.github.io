# Superpowers Methodology for `nbang.github.io`

This document defines how to build, maintain, and extend the `nbang.github.io` project architecture using the [Superpowers](https://github.com/obra/superpowers) methodology. All AI coding agents interacting with this repository MUST adhere to these workflows.

---

## 🏛️ Project Architecture Overview

Before applying Superpowers, agents must internalize the project's architectural constraints:
1. **Serverless & Client-Side First**: All logic runs in the browser (WASM, Web Workers, Canvas). No backend logic.
2. **Privacy First**: User data (images, PDFs) never leaves the local device unless explicitly uploading to an allowed API.
3. **No Build Step**: Plain HTML, Vanilla JavaScript, and TailwindCSS via CDN only. No bundlers (Webpack/Vite).
4. **Side-Car Data**: Data dashboards rely on static `.json` or `.js` files loaded at runtime, not databases.

---

## 🦸‍♂️ Applying Superpower Skills to the Architecture

### 1. 🧠 Brainstorming (`brainstorming`)
**Trigger**: When requested to build a new tool or feature.
- Refine rough ideas by asking questions before writing any code.
- Ensure the design aligns with the **No Build Step** and **Client-Side First** constraints.
- *Example*: If asked for a tool to manipulate PDFs, brainstorm how to achieve it using client-side `pdf-lib` or `pdf.js` rather than a server-side API. Present the design in digestable sections for user validation.

### 2. 🌲 Workspaces (`using-git-worktrees`)
**Trigger**: After design approval, before writing code.
- Create an isolated workspace on a new branch.
- Verify a clean baseline: static server starts (`python -m http.server 8000`), linter passes (`npm run lint`), and smoke tests pass (`npm test`).

### 3. 📝 Planning (`writing-plans`)
**Trigger**: With an approved design in a clean workspace.
- Break the work down into bite-sized, 2-5 minute tasks.
- Specify exact file paths (e.g., `image_tools/new_feature.html`, `pdf_tools/utils/...`).
- Ensure the plan relies *only* on vanilla web technologies.
- Include explicit verification steps for each task.

### 4. 🔴🟢 Test-Driven Development (`test-driven-development`)
**Trigger**: During implementation.
- **Strict RED-GREEN-REFACTOR**: This is mandatory.
- **Smoke tests** (`tests/smoke.test.mjs`) run via `npm test` using Puppeteer. They verify every page in `tools-manifest.json` loads with HTTP 200, a non-empty `<title>`, a heading, and no uncaught JS errors.
- For new tools: add the entry to `tools-manifest.json` first so the smoke test discovers it, then implement the HTML/JS until `npm test` passes.
- For logic-heavy utilities (e.g., coordinate conversions, calendar algorithms): write inline assertions or a small standalone test script before implementing.
- Delete any code written before the tests.

### 5. 🤖 Execution (`subagent-driven-development` & `executing-plans`)
**Trigger**: With a completed plan.
- Dispatch subagents for each bite-sized task.
- Conduct a two-stage review for every task: 
  1. **Spec Compliance**: Does it work entirely client-side?
  2. **Code Quality**: Are there unnecessary abstractions? (Adhere to YAGNI and DRY).
- Run `npm run lint:fix` to ensure Tailwind classes are sorted and formatting is strictly maintained.

### 6. 🔍 Review & Verification (`requesting-code-review`, `verification-before-completion`)
**Trigger**: Between tasks or before finalizing.
- Review code against the architectural plan.
- Verify the implementation. *Evidence over claims.* If a WebGPU OCR model was implemented, verify that it actually loads and processes locally without network errors.
- Report issues by severity; block progress on critical architectural violations (e.g., accidentally introducing a Node.js dependency).

### 7. 🐛 Systematic Debugging (`systematic-debugging`)
**Trigger**: When encountering an issue.
- Use a 4-phase root cause process.
- Trace the root cause, usually involving browser console errors, CORS issues (when fetching local data files), or WASM loading failures.
- Employ defense-in-depth and ensure the bug is actually fixed before proceeding.

### 8. 🏁 Finishing up (`finishing-a-development-branch`)
**Trigger**: When all tasks are completed and verified.
- Verify lint and smoke tests pass:
  ```bash
  npm run lint
  npm test
  ```
- Confirm that any new tool is registered in `tools-manifest.json` and appears on the index page.
- Present options to the user (merge / PR / discard).
- Clean up the git worktree and return to the main branch.

---

## 🎯 Core Philosophy Reminders
- **Systematic over ad-hoc**: Follow the plan. Don't guess.
- **Complexity reduction**: The "No Build Step" rule is our primary complexity reducer. Keep it simple.
- **Evidence over claims**: Manually or programmatically verify that features work in a standard browser environment.
