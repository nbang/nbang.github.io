/**
 * Flower Finder — search a flower and list the accounts that own it.
 *
 * Data comes from a public Google Sheet laid out as a matrix:
 *   row 1      flower names (first cell empty)
 *   row 2      contest points per flower ("Điểm Thi hội"), kept in the `level` fields below
 *   rows 4+    one account per row: name, TRUE/FALSE per flower, then that account's best flower points
 *
 * There is no bundled copy of the data: the page reads the live sheet on load, every 30 seconds
 * while the tab is visible, and whenever the tab regains focus. Background updates are applied
 * in place (see renderCards and keepScrollPosition) so they don't disturb someone mid-use. The sheet must stay shared as
 * "Anyone with the link can view", or the page cannot load anything.
 */

const SHEET_ID = '1W7iGsHbr7eeqvhdPvQ4prgpGgOkLuCNkV1lZUBwPUIE';
const SHEET_GID = '1615032156'; // the "Danh Sách Mới" tab, which holds the ownership matrix
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

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

/** Inner markup of one result card; also the cache key that decides whether the card repaints. */
function cardHtml(flower, query) {
    const owners = flower.owners;
    const chips = owners.map(a => {
        const pressed = a.name === state.account;
        const level = a.level === null ? '' : ` <span class="opacity-70">best ${a.level}</span>`;
        return `<button type="button" class="chip rounded-full px-2.5 py-1 text-sm transition-colors" data-account="${escapeHtml(a.name)}" aria-pressed="${pressed}" title="${a.level === null ? '' : `Best flower: ${a.level} points. `}Show only flowers ${escapeHtml(a.name)} has">${escapeHtml(a.name)}${level}</button>`;
    }).join('');
    const count = owners.length === 1 ? '1 account' : `${owners.length} accounts`;
    return `
        <div class="flex items-start justify-between gap-2">
            <h2 class="text-lg leading-snug font-semibold text-gray-900">${highlight(flower.name, query)}</h2>
            ${flower.level === null ? '' : `<span class="level-badge shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold">${flower.level} pts</span>`}
        </div>
        <p class="mt-0.5 text-sm text-gray-500">${owners.length ? count : 'No account has this flower yet'}</p>
        ${owners.length ? `<div class="mt-3 flex flex-wrap gap-1.5">${chips}</div>` : ''}`;
}

/** Write text only when it differs, so the live region doesn't re-announce and nothing repaints for no reason. */
function setText(el, text) {
    if (el.textContent !== text) el.textContent = text;
}

const cards = new Map(); // flower name -> { el, html }

/**
 * Update the result grid in place. A card whose content didn't change keeps its DOM node, so
 * focus, hover and text selection survive a refresh, and only the cards that changed repaint.
 */
function renderCards(shown, query) {
    const active = document.activeElement;
    const focusedChip = els.results.contains(active) && active.dataset.account !== undefined
        ? { flower: active.closest('article').dataset.name, account: active.dataset.account }
        : null;

    let prev = null;
    for (const flower of shown) {
        let card = cards.get(flower.name);
        if (!card) {
            const el = document.createElement('article');
            el.className = 'rounded-2xl border border-white/50 bg-white/80 p-4 shadow-sm backdrop-blur-xl';
            el.dataset.name = flower.name;
            card = { el, html: '' };
            cards.set(flower.name, card);
        }
        const html = cardHtml(flower, query);
        if (card.html !== html) {
            card.el.innerHTML = html;
            card.html = html;
        }
        const slot = prev ? prev.nextElementSibling : els.results.firstElementChild;
        if (slot !== card.el) els.results.insertBefore(card.el, slot);
        prev = card.el;
    }
    let extra = prev ? prev.nextElementSibling : els.results.firstElementChild;
    while (extra) {
        const next = extra.nextElementSibling;
        extra.remove();
        extra = next;
    }

    // A repainted or moved card drops keyboard focus; put it back on the same account chip.
    if (focusedChip && document.activeElement !== active) {
        const card = cards.get(focusedChip.flower)?.el;
        const chip = card?.isConnected
            ? [...card.querySelectorAll('[data-account]')].find(c => c.dataset.account === focusedChip.account)
            : null;
        chip?.focus({ preventScroll: true });
    }
}

function render() {
    const query = fold(state.query);
    const words = query ? query.split(' ') : [];
    const shown = model.flowers.filter(f => matches(f, words));

    renderCards(shown, query);
    els.empty.classList.toggle('hidden', shown.length > 0 || !model.flowers.length);

    const filtered = Boolean(query || state.account || state.level !== null || state.ownedOnly);
    els.reset.classList.toggle('hidden', !filtered);
    const total = model.flowers.length;
    let summary;
    if (!total) {
        summary = '';
    } else if (!filtered) {
        summary = `Showing all ${total} flowers. Tap an account name to see everything that account has.`;
    } else if (state.account && !query && state.level === null) {
        summary = `${state.account} has ${shown.length} of ${total} flowers.`;
    } else if (state.account) {
        summary = `${shown.length} matching flowers that ${state.account} has.`;
    } else {
        summary = `${shown.length} of ${total} flowers match.`;
    }
    setText(els.summary, summary);

    els.levels.querySelectorAll('button').forEach(b => {
        b.setAttribute('aria-pressed', String(b.dataset.level === String(state.level ?? '')));
    });
    if (els.account.value !== state.account) els.account.value = state.account;
}

let accountOptionsKey = '';
let levelsKey = '';

function renderAccountOptions() {
    const key = JSON.stringify(model.accounts.map(a => [a.name, a.count]));
    if (key === accountOptionsKey) return;
    // Replacing the options of an open <select> closes it under the user; wait until they leave it.
    if (document.activeElement === els.account) return;
    accountOptionsKey = key;
    els.account.innerHTML = '<option value="">Any account</option>' + model.accounts.map(a =>
        `<option value="${escapeHtml(a.name)}">${escapeHtml(a.name)} (${a.count})</option>`).join('');
    els.account.value = state.account;
}

function renderLevelPills() {
    const levels = [...new Set(model.flowers.map(f => f.level).filter(l => l !== null))].sort((a, b) => a - b);
    if (!levels.includes(state.level)) state.level = null;
    const key = levels.join(',');
    if (key === levelsKey) return;
    levelsKey = key;

    const focused = els.levels.contains(document.activeElement) ? document.activeElement.dataset.level : undefined;
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
    if (focused !== undefined) {
        [...els.levels.querySelectorAll('button')].find(b => b.dataset.level === focused)?.focus({ preventScroll: true });
    }
}

function setModel(next) {
    model = next;
    const names = new Set(model.flowers.map(f => f.name));
    for (const name of cards.keys()) if (!names.has(name)) cards.delete(name);

    setText(els.statFlowers, String(model.flowers.length));
    setText(els.statAccounts, String(model.accounts.length));
    if (!model.accounts.some(a => a.name === state.account)) state.account = '';
    renderAccountOptions();
    renderLevelPills();
    render();
}

/**
 * Run `update`, then scroll so the cards the user is looking at stay exactly where they were,
 * even if cards above them grew, shrank or disappeared. The browser's own scroll anchoring is
 * turned off in the page CSS so the two don't fight, and Safari doesn't have it anyway.
 */
function keepScrollPosition(update) {
    const visible = [...els.results.children]
        .map(el => ({ el, top: el.getBoundingClientRect().top }))
        .filter(({ el, top }) => top < window.innerHeight && top + el.offsetHeight > 0);
    update();
    if (window.scrollY <= 0) return;
    const anchor = visible.find(({ el }) => el.isConnected);
    if (!anchor) return;
    const delta = anchor.el.getBoundingClientRect().top - anchor.top;
    if (delta) window.scrollBy(0, delta);
}

// ── Loading ──────────────────────────────────────────────────────────────────

const SYNC_INTERVAL_MS = 30000;
const RETURN_SYNC_GAP_MS = 5000; // tab focus and visibility both fire on return; sync once
const SETTLE_MS = 400; // how long after a scroll or press before background changes are applied
let lastCsv = null;
let pendingCsv = null;
let liveOk = false;
let lastOkAt = '';
let syncing = false;
let lastSyncAt = 0;
let pointerDown = false;
let lastScrollAt = -Infinity;
let flushTimer = 0;

async function fetchText(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
}

/** Rebind the page to new sheet data. Does nothing when the sheet hasn't changed. */
function applyCsv(text) {
    if (text === lastCsv) return;
    const next = buildModel(parseCsv(text));
    lastCsv = text;
    keepScrollPosition(() => setModel(next));
}

/** True while the user is pressing or scrolling: moving content now could shift what they're about to tap. */
const userBusy = () => pointerDown || performance.now() - lastScrollAt < SETTLE_MS;

/** Apply background data once the user is idle. Only the newest pending version is kept. */
function flushPending() {
    clearTimeout(flushTimer);
    if (pendingCsv === null) return;
    if (userBusy()) {
        flushTimer = setTimeout(flushPending, SETTLE_MS);
        return;
    }
    const text = pendingCsv;
    pendingCsv = null;
    try {
        applyCsv(text);
    } catch {
        // Unreadable layout: keep showing the last good data.
    }
}

const clock = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function setStatus(text) {
    keepScrollPosition(() => setText(els.status, text));
}

/**
 * Pull the sheet and rebind the page to it. Background syncs run quietly: no spinner, and changes
 * wait until the user stops scrolling or pressing. A manual sync spins the icon and applies at once.
 */
async function sync({ manual = false } = {}) {
    if (syncing || (document.hidden && !manual)) return;
    syncing = true;
    lastSyncAt = performance.now();
    if (manual) els.refresh.classList.add('fa-spin');
    try {
        const text = await fetchText(SHEET_CSV_URL);
        if (manual || lastCsv === null) {
            pendingCsv = null;
            applyCsv(text);
        } else if (text !== lastCsv) {
            pendingCsv = text;
            flushPending();
        }
        liveOk = true;
        lastOkAt = clock();
        setStatus(`Live from the sheet, synced ${lastOkAt}`);
    } catch {
        setStatus(liveOk
            ? `Sheet unreachable, data from ${lastOkAt}`
            : 'Could not reach the sheet. Retrying every 30 seconds.');
    } finally {
        syncing = false;
        els.refresh.classList.remove('fa-spin');
    }
}

function syncOnReturn() {
    if (!document.hidden && performance.now() - lastSyncAt > RETURN_SYNC_GAP_MS) sync();
}

async function load() {
    await sync();
    setInterval(sync, SYNC_INTERVAL_MS);
    document.addEventListener('visibilitychange', syncOnReturn);
    window.addEventListener('focus', syncOnReturn);
    window.addEventListener('online', () => sync());

    window.addEventListener('pointerdown', () => { pointerDown = true; }, { capture: true, passive: true });
    const release = () => {
        pointerDown = false;
        flushPending();
    };
    window.addEventListener('pointerup', release, { capture: true, passive: true });
    window.addEventListener('pointercancel', release, { capture: true, passive: true });
    window.addEventListener('scroll', () => { lastScrollAt = performance.now(); }, { passive: true });
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

    document.getElementById('refresh').addEventListener('click', () => sync({ manual: true }));
    // Account options are left alone while the dropdown has focus; catch up once it closes.
    els.account.addEventListener('blur', renderAccountOptions);

    load();
});
