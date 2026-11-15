/**
 * Flower Finder — search a flower and list the accounts that own it.
 *
 * Data comes from a public Google Sheet laid out as a matrix:
 *   row 1      flower names (first cell empty)
 *   row 2      flower levels
 *   rows 4+    one account per row: name, TRUE/FALSE per flower, then the account level
 *
 * The page stays bound to the sheet: it renders the bundled snapshot (flower-finder-data.csv)
 * first, then pulls the live sheet on load, every 30 seconds while the tab is visible, and
 * whenever the tab regains focus. Refresh the snapshot with:
 *   curl -sL "<SHEET_CSV_URL>" -o flower-finder-data.csv
 */

const SHEET_ID = '1njBGo2sLzM2vopRqqeu_ee7ndUV7XCuUGLzDOKAQTC4';
const SHEET_GID = '1615032156';
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
const SNAPSHOT_URL = 'flower-finder-data.csv';

// ── Parsing ──────────────────────────────────────────────────────────────────

function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quoted) {
            if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
            else if (ch === '"') quoted = false;
            else cell += ch;
        } else if (ch === '"') {
            quoted = true;
        } else if (ch === ',') {
            row.push(cell); cell = '';
        } else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && text[i + 1] === '\n') i++;
            row.push(cell); cell = '';
            rows.push(row); row = [];
        } else {
            cell += ch;
        }
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
}

const isNumber = v => /^\d+$/.test(v);

/** Lowercase and strip Vietnamese accents, keeping one output character per input character. */
function foldChars(s) {
    return [...s.normalize('NFC')].map(ch =>
        ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase() || ch).join('');
}

/** Search key: "mau don" finds "Mẫu Đơn". */
function fold(s) {
    return foldChars(s).replace(/\s+/g, ' ').trim();
}

function buildModel(rows) {
    const header = (rows[0] || []).map(c => c.trim());
    const cols = [];
    header.forEach((name, i) => { if (i > 0 && name) cols.push(i); });
    if (!cols.length) throw new Error('No flower names found in the sheet');

    // The level row is the first row after the header whose flower cells are mostly numbers.
    const levelRow = rows.slice(1).find(r => cols.filter(c => isNumber((r[c] || '').trim())).length > cols.length / 2);

    const flowers = cols.map(c => ({
        name: header[c],
        key: fold(header[c]),
        level: levelRow && isNumber((levelRow[c] || '').trim()) ? Number(levelRow[c]) : null,
        owners: [],
    }));

    const lastFlowerCol = cols[cols.length - 1];
    const accounts = [];
    rows.slice(1).forEach(r => {
        const name = (r[0] || '').trim();
        if (!name || r === levelRow) return;
        if (!cols.some(c => /^(TRUE|FALSE)$/i.test((r[c] || '').trim()))) return;
        const extra = r.slice(lastFlowerCol + 1).map(v => v.trim()).filter(isNumber);
        const account = { name, level: extra.length ? Number(extra[extra.length - 1]) : null, count: 0 };
        cols.forEach((c, i) => {
            if ((r[c] || '').trim().toUpperCase() === 'TRUE') {
                flowers[i].owners.push(account);
                account.count++;
            }
        });
        accounts.push(account);
    });
    if (!accounts.length) throw new Error('No accounts found in the sheet');

    const byName = (a, b) => a.name.localeCompare(b.name, 'vi');
    flowers.sort(byName);
    accounts.sort(byName);
    return { flowers, accounts };
}

// ── State & rendering ────────────────────────────────────────────────────────

const els = {};
const state = { query: '', account: '', level: null, ownedOnly: false };
let model = { flowers: [], accounts: [] };

function escapeHtml(s) {
    return s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/** Wrap the part of `name` that matches the folded query in <mark>. */
function highlight(name, query) {
    const src = name.normalize('NFC');
    const folded = foldChars(src);
    const at = query && folded.length === src.length ? folded.indexOf(query) : -1;
    if (at < 0) return escapeHtml(name);
    const end = at + query.length;
    return `${escapeHtml(src.slice(0, at))}<mark>${escapeHtml(src.slice(at, end))}</mark>${escapeHtml(src.slice(end))}`;
}

function matches(flower, words) {
    if (state.level !== null && flower.level !== state.level) return false;
    if (state.ownedOnly && !flower.owners.length) return false;
    if (state.account && !flower.owners.some(a => a.name === state.account)) return false;
    return words.every(w => flower.key.includes(w));
}

function flowerCard(flower, query) {
    const owners = flower.owners;
    const chips = owners.map(a => {
        const pressed = a.name === state.account;
        const level = a.level === null ? '' : ` <span class="opacity-70">Lv ${a.level}</span>`;
        return `<button type="button" class="chip rounded-full px-2.5 py-1 text-sm transition-colors" data-account="${escapeHtml(a.name)}" aria-pressed="${pressed}" title="Show only flowers ${escapeHtml(a.name)} has">${escapeHtml(a.name)}${level}</button>`;
    }).join('');
    const count = owners.length === 1 ? '1 account' : `${owners.length} accounts`;
    return `
        <article class="rounded-2xl border border-white/50 bg-white/80 p-4 shadow-sm backdrop-blur-xl">
            <div class="flex items-start justify-between gap-2">
                <h2 class="text-lg leading-snug font-semibold text-gray-900">${highlight(flower.name, query)}</h2>
                ${flower.level === null ? '' : `<span class="level-badge shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold">Lv ${flower.level}</span>`}
            </div>
            <p class="mt-0.5 text-sm text-gray-500">${owners.length ? count : 'No account has this flower yet'}</p>
            ${owners.length ? `<div class="mt-3 flex flex-wrap gap-1.5">${chips}</div>` : ''}
        </article>`;
}

function render() {
    const query = fold(state.query);
    const words = query ? query.split(' ') : [];
    const shown = model.flowers.filter(f => matches(f, words));

    els.results.innerHTML = shown.map(f => flowerCard(f, query)).join('');
    els.empty.classList.toggle('hidden', shown.length > 0 || !model.flowers.length);

    const filtered = Boolean(query || state.account || state.level !== null || state.ownedOnly);
    els.reset.classList.toggle('hidden', !filtered);
    const total = model.flowers.length;
    if (!total) {
        els.summary.textContent = '';
    } else if (!filtered) {
        els.summary.textContent = `Showing all ${total} flowers. Tap an account name to see everything that account has.`;
    } else if (state.account && !query && state.level === null) {
        els.summary.textContent = `${state.account} has ${shown.length} of ${total} flowers.`;
    } else if (state.account) {
        els.summary.textContent = `${shown.length} matching flowers that ${state.account} has.`;
    } else {
        els.summary.textContent = `${shown.length} of ${total} flowers match.`;
    }

    els.levels.querySelectorAll('button').forEach(b => {
        b.setAttribute('aria-pressed', String(b.dataset.level === String(state.level ?? '')));
    });
    els.account.value = state.account;
}

function renderControls() {
    els.statFlowers.textContent = model.flowers.length;
    els.statAccounts.textContent = model.accounts.length;

    if (!model.accounts.some(a => a.name === state.account)) state.account = '';
    els.account.innerHTML = '<option value="">Any account</option>' + model.accounts.map(a =>
        `<option value="${escapeHtml(a.name)}">${escapeHtml(a.name)} (${a.count})</option>`).join('');

    const levels = [...new Set(model.flowers.map(f => f.level).filter(l => l !== null))].sort((a, b) => a - b);
    if (!levels.includes(state.level)) state.level = null;
    els.levels.querySelectorAll('button').forEach(b => b.remove());
    els.levels.classList.toggle('hidden', !levels.length);
    [['', 'All'], ...levels.map(l => [String(l), String(l)])].forEach(([value, label]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'pill rounded-full px-3 py-1 text-sm font-medium transition-colors';
        b.dataset.level = value;
        b.textContent = label;
        els.levels.appendChild(b);
    });
}

function setModel(next) {
    model = next;
    renderControls();
    render();
}

// ── Loading ──────────────────────────────────────────────────────────────────

const SYNC_INTERVAL_MS = 30000;
let lastCsv = null;
let liveOk = false;
let syncing = false;

async function fetchText(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
}

/** Re-render only when the CSV text actually changed, so open filters and scroll position are left alone. */
function applyCsv(text) {
    if (text === lastCsv) return;
    setModel(buildModel(parseCsv(text)));
    lastCsv = text;
}

const clock = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Pull the sheet and rebind the page to it. Runs on load, on a timer, and whenever the tab regains focus. */
async function sync() {
    if (syncing || document.hidden) return;
    syncing = true;
    els.refresh.classList.add('fa-spin');
    try {
        applyCsv(await fetchText(SHEET_CSV_URL));
        liveOk = true;
        els.status.textContent = `Live from the sheet, synced ${clock()}`;
    } catch {
        if (liveOk) els.status.textContent = `Sheet unreachable since ${clock()}, showing the last synced data`;
        else if (lastCsv !== null) els.status.textContent = 'Saved copy (could not reach the sheet)';
        else els.status.textContent = 'Could not load the data. Check your connection.';
    } finally {
        syncing = false;
        els.refresh.classList.remove('fa-spin');
    }
}

async function load() {
    try {
        applyCsv(await fetchText(SNAPSHOT_URL));
        els.status.textContent = 'Checking the sheet…';
    } catch {
        // Fall through: the live sheet may still work.
    }
    await sync();
    setInterval(sync, SYNC_INTERVAL_MS);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    window.addEventListener('online', sync);
}

document.addEventListener('DOMContentLoaded', () => {
    Object.assign(els, {
        search: document.getElementById('search'),
        account: document.getElementById('account'),
        levels: document.getElementById('levels'),
        ownedOnly: document.getElementById('owned-only'),
        reset: document.getElementById('reset'),
        summary: document.getElementById('summary'),
        results: document.getElementById('results'),
        empty: document.getElementById('empty'),
        status: document.getElementById('data-status'),
        refresh: document.getElementById('refresh-icon'),
        statFlowers: document.getElementById('stat-flowers'),
        statAccounts: document.getElementById('stat-accounts'),
    });

    els.search.addEventListener('input', () => { state.query = els.search.value; render(); });
    els.account.addEventListener('change', () => { state.account = els.account.value; render(); });
    els.ownedOnly.addEventListener('change', () => { state.ownedOnly = els.ownedOnly.checked; render(); });
    els.levels.addEventListener('click', e => {
        const b = e.target.closest('button');
        if (!b) return;
        state.level = b.dataset.level === '' ? null : Number(b.dataset.level);
        render();
    });
    els.results.addEventListener('click', e => {
        const chip = e.target.closest('[data-account]');
        if (!chip) return;
        state.account = state.account === chip.dataset.account ? '' : chip.dataset.account;
        render();
    });
    els.reset.addEventListener('click', () => {
        Object.assign(state, { query: '', account: '', level: null, ownedOnly: false });
        els.search.value = '';
        els.ownedOnly.checked = false;
        render();
        els.search.focus();
    });
    document.addEventListener('keydown', e => {
        if (e.key === '/' && document.activeElement !== els.search) {
            e.preventDefault();
            els.search.focus();
        }
    });

    document.getElementById('refresh').addEventListener('click', sync);

    load();
});
