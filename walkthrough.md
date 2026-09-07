# Walkthrough: Vietnam Public Corps Feature (Optimized)

I have successfully updated and renamed the Vietnam Public Corporations feature to follow a cleaner and unified `public-corp` naming standard. Additionally, both pages have been heavily optimized for maximum client-side performance, speed, and efficiency.

Here is a summary of the system and files:

---

## 1. Unified Dataset & Automation
* **Structured Data**: [`public-corp-data.json`](file:///Users/bangndd/work/nbang.github.io/public-corp-data.json)
  * Rich corporate metadata and financial details (Market Cap, Revenue, Profit, Margin, EPS, P/E, ROE, etc.) for top public corporations.
* **Monthly Scraper Script**: [`scripts/crawl_vn_corps.js`](file:///Users/bangndd/work/nbang.github.io/scripts/crawl_vn_corps.js)
  * Node.js fetch script targeting the dn.aizia.info API, standardizing data, and saving it cleanly to the output file.
* **GitHub Actions Workflow**: [`.github/workflows/update_public_corp_data.yml`](file:///Users/bangndd/work/nbang.github.io/.github/workflows/update_public_corp_data.yml)
  * Runs automatically at `00:00` on the 1st of every month to scrape the latest data and commit it back to the `master` branch.

---

## 2. Frontend Listing & Deferred Rendering (Dashboard)
* **HTML**: [`public-corp.html`](file:///Users/bangndd/work/nbang.github.io/public-corp.html) (formerly `vietnam-public.html`)
  * Displays the search bar, filter selections, table headers, and an elegant **"Xem thêm (Load More)"** button.
* **JS Logic**: [`public-corp.js`](file:///Users/bangndd/work/nbang.github.io/public-corp.js) (formerly `vietnam-public.js`)
  * **100-Item Pagination**: Instead of rendering 3000+ rows at once (which locks the browser's main thread and freezes the page), it slices and renders only the first **100 items** initially.
  * **Incremental Appending**: Clicking "Xem thêm" instantly renders another 100 items using an optimized `DocumentFragment` for zero reflow/repaint lag.
  * **Search & Filters Auto-reset**: Searching or sorting instantly resets the viewport back to the top 100 results for an ultra-responsive search response.

---

## 3. Enterprise Detail Page
* **HTML**: [`public-corp-detail.html`](file:///Users/bangndd/work/nbang.github.io/public-corp-detail.html) (formerly `vietnam-public-detail.html`)
  * A premium, responsive details dashboard displaying general overview, financials, listing structure, leadership, contacts, and quick PDF print features.
* **JS Logic**: [`public-corp-detail.js`](file:///Users/bangndd/work/nbang.github.io/public-corp-detail.js) (formerly `vietnam-public-detail.js`)
  * Intercepts the URL `code` parameter, loads the Cached/Server dataset, and populates the details.

---

## 4. Performance Optimizations (Caching & Live Checks)
Both JS files (`public-corp.js` and `public-corp-detail.js`) leverage our global caching utility inside [js/utils/common.js](file:///Users/bangndd/work/nbang.github.io/js/utils/common.js):
* **0ms Load Speed**: Checks the browser's Cache API first. If present, it loads the 2.5MB database **instantly** (0ms network cost).
* **Asynchronous Server Updates Check**: Fires a background **HTTP `HEAD` request** to check the server's `ETag` or `Last-Modified` header. 
* **Dynamic Reload**: If the dataset has been updated on the server, it seamlessly re-fetches the database, updates the local cache, and dynamically repopulates/re-renders the UI without requiring a hard browser refresh!

---

## 5. Manifest Registration
* **File**: [`tools-manifest.json`](file:///Users/bangndd/work/nbang.github.io/tools-manifest.json#L152)
  * Manifest registered under `public-corp` ID mapping `public-corp.html` so the landing page `index.html` renders it dynamically.
