/**
 * Smoke tests — verify every tool page loads without errors.
 *
 * Usage:
 *   npm test
 *
 * What it checks per page:
 *   - HTTP 200 from the static server
 *   - No uncaught JS errors during page load
 *   - Page has a non-empty <title>
 *   - Page has at least one <h1> or <h2>
 */

import puppeteer from 'puppeteer';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const PORT = 8787;

// ── MIME types for static file server ────────────────────────────────────────
const MIME = {
    '.html': 'text/html',
    '.js':   'application/javascript',
    '.mjs':  'application/javascript',
    '.json': 'application/json',
    '.css':  'text/css',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
    '.woff2':'font/woff2',
    '.woff': 'font/woff',
};

// ── Lightweight static file server ───────────────────────────────────────────
function startServer() {
    const server = createServer((req, res) => {
        const urlPath = req.url.split('?')[0];
        const filePath = join(ROOT, urlPath === '/' ? 'index.html' : urlPath);

        if (!existsSync(filePath)) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }

        const ext = extname(filePath);
        const contentType = MIME[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(readFileSync(filePath));
    });

    return new Promise(resolve => server.listen(PORT, () => resolve(server)));
}

// ── Pages to test ─────────────────────────────────────────────────────────────
// Built from tools-manifest.json plus the two category index pages.
function getPagesToTest() {
    const manifest = JSON.parse(readFileSync(join(ROOT, 'tools-manifest.json'), 'utf8'));
    const pages = [
        { id: 'home', url: '/' },
        { id: 'pdf-tools-index', url: '/pdf_tools/index.html' },
        { id: 'image-tools-index', url: '/image_tools/index.html' },
        ...manifest.map(t => ({ id: t.id, url: `/${t.url}` })),
    ];
    // Deduplicate by URL
    return [...new Map(pages.map(p => [p.url, p])).values()];
}

// ── Test runner ───────────────────────────────────────────────────────────────
async function runSmokeTests() {
    const server = await startServer();
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const base = `http://localhost:${PORT}`;

    let passed = 0;
    let failed = 0;
    const failures = [];

    const pages = getPagesToTest();
    console.log(`\nRunning smoke tests on ${pages.length} pages...\n`);

    for (const { id, url } of pages) {
        const page = await browser.newPage();
        const jsErrors = [];

        page.on('pageerror', err => jsErrors.push(err.message));
        page.on('console', msg => {
            if (msg.type() === 'error') jsErrors.push(`[console.error] ${msg.text()}`);
        });

        try {
            const response = await page.goto(`${base}${url}`, {
                waitUntil: 'domcontentloaded',
                timeout: 15000,
            });

            const status = response?.status();
            const title = await page.title();
            const hasHeading = await page.$('h1, h2').then(el => el !== null);

            const problems = [];
            if (status !== 200)      problems.push(`HTTP ${status}`);
            if (!title?.trim())      problems.push('empty <title>');
            if (!hasHeading)         problems.push('no <h1> or <h2>');

            // Filter out expected third-party / CDN noise
            const realErrors = jsErrors.filter(e =>
                !e.includes('googletagmanager') &&
                !e.includes('adsbygoogle') &&
                !e.includes('Failed to load resource') &&
                !e.includes('net::ERR_INTERNET_DISCONNECTED')
            );
            if (realErrors.length) problems.push(`JS error: ${realErrors[0]}`);

            if (problems.length === 0) {
                console.log(`  ✓  ${id.padEnd(30)} ${url}`);
                passed++;
            } else {
                const msg = problems.join(', ');
                console.log(`  ✗  ${id.padEnd(30)} ${url}  →  ${msg}`);
                failures.push({ id, url, msg });
                failed++;
            }
        } catch (err) {
            console.log(`  ✗  ${id.padEnd(30)} ${url}  →  ${err.message}`);
            failures.push({ id, url, msg: err.message });
            failed++;
        } finally {
            await page.close();
        }
    }

    await browser.close();
    server.close();

    console.log(`\n──────────────────────────────────────`);
    console.log(`Results: ${passed} passed, ${failed} failed`);
    if (failures.length) {
        console.log('\nFailed pages:');
        failures.forEach(f => console.log(`  ${f.id}: ${f.msg}`));
        process.exit(1);
    } else {
        console.log('All pages OK.');
    }
}

runSmokeTests().catch(err => {
    console.error('Test runner crashed:', err);
    process.exit(1);
});
