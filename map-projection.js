/**
 * Mercator vs Equal Earth — country size comparison.
 *
 * Reads the side-car dataset built by scripts/build_map_projection_data.py, which
 * carries each country's true (spherical) area alongside the area it appears to
 * cover on a Mercator map. Equal Earth is an equal-area projection, so "size on
 * the new map" is just the true area — the interesting number is the ratio.
 *
 * Colour roles come from CSS custom properties on `.viz`, so the dark-mode swap
 * happens in CSS and nothing here needs to re-render on theme change.
 */

const DATA_URL = 'map-projection-data.json';

// Sequential ramp: one hue, light -> dark, six classes. The bins are chosen so
// the first holds "barely distorted" and the last holds the polar outliers.
const INFLATION_BINS = [
    { max: 1.2, token: 'var(--seq-1)', label: '×1.0 – 1.2' },
    { max: 1.5, token: 'var(--seq-2)', label: '1.2 – 1.5' },
    { max: 2.0, token: 'var(--seq-3)', label: '1.5 – 2' },
    { max: 3.0, token: 'var(--seq-4)', label: '2 – 3' },
    { max: 5.0, token: 'var(--seq-5)', label: '3 – 5' },
    { max: Infinity, token: 'var(--seq-6)', label: '5 and up' },
];

const NO_DATA_TOKEN = 'var(--no-data)';

const state = {
    countries: [],
    byIso: new Map(),
    meta: {},
    selected: null,
    search: '',
    continent: 'all',
    sortKey: 'factor',
    sortDir: 'desc',
    showAll: false,
};

const TABLE_PAGE_SIZE = 25;

// ─── Formatting ──────────────────────────────────────────────────────────────

function fmtArea(km2) {
    if (km2 === null || km2 === undefined) return '—';
    if (km2 >= 1e6) return `${(km2 / 1e6).toFixed(2)}M km²`;
    if (km2 >= 1e4) return `${Math.round(km2 / 1e3).toLocaleString('en-US')}k km²`;
    return `${Math.round(km2).toLocaleString('en-US')} km²`;
}

function fmtFull(km2) {
    if (km2 === null || km2 === undefined) return '—';
    return Math.round(km2).toLocaleString('en-US');
}

function fmtFactor(factor) {
    if (!factor) return '—';
    return `×${factor < 10 ? factor.toFixed(2) : factor.toFixed(1)}`;
}

function fmtRatio(ratio) {
    if (!isFinite(ratio)) return '—';
    return ratio < 10 ? ratio.toFixed(2) : ratio.toFixed(1);
}

function binFor(factor) {
    if (!factor) return null;
    return INFLATION_BINS.find(b => factor < b.max) || INFLATION_BINS[INFLATION_BINS.length - 1];
}

function fillFor(country) {
    const bin = binFor(country.factor);
    return bin ? bin.token : NO_DATA_TOKEN;
}

// ─── Derived data ────────────────────────────────────────────────────────────

function prepare(payload) {
    state.meta = payload;
    state.countries = payload.countries.map(c => ({
        ...c,
        // Antarctica reaches the pole, where Mercator is unbounded, so it has no
        // ratio at all rather than a misleadingly large one.
        factor: c.mercator_km2 ? c.mercator_km2 / c.true_km2 : null,
        feature: { type: 'Feature', properties: { iso: c.iso }, geometry: c.geometry },
    }));

    state.countries.forEach(c => state.byIso.set(c.iso, c));

    // Distortion rank, most inflated first, over countries that have a ratio.
    const ranked = state.countries
        .filter(c => c.factor)
        .sort((a, b) => b.factor - a.factor);
    ranked.forEach((c, i) => {
        c.rank = i + 1;
    });
    state.rankedCount = ranked.length;
}

function matchesFilter(country) {
    if (state.continent !== 'all' && country.continent !== state.continent) return false;
    if (!state.search) return true;
    const q = state.search.toLowerCase();
    return (
        (country.name || '').toLowerCase().includes(q) ||
        (country.name_long || '').toLowerCase().includes(q) ||
        (country.iso || '').toLowerCase().includes(q)
    );
}

// ─── Maps ────────────────────────────────────────────────────────────────────

const MAP_PAD = 8;

// Mercator runs to infinity at the poles, so a world map has to be trimmed
// somewhere. 84°N keeps every scrap of northern Greenland and Ellesmere; 72°S
// keeps the top of Antarctica visible as an "off scale" band without letting it
// swallow the map, which is what the untrimmed projection does.
const MERCATOR_NORTH = 84;
const MERCATOR_SOUTH = -72;

/** Mercator fitted to a latitude window rather than the whole (infinite) sphere. */
function trimmedMercator(width, height) {
    const yOf = lat => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
    const yNorth = yOf(MERCATOR_NORTH);
    const ySouth = yOf(MERCATOR_SOUTH);
    const scale = Math.min(
        (width - 2 * MAP_PAD) / (2 * Math.PI),
        (height - 2 * MAP_PAD) / (yNorth - ySouth),
    );
    const originY = height / 2 + (scale * (yNorth + ySouth)) / 2;

    const projection = d3
        .geoMercator()
        .scale(scale)
        .translate([width / 2, originY])
        .clipExtent([
            [width / 2 - scale * Math.PI, originY - scale * yNorth],
            [width / 2 + scale * Math.PI, originY - scale * ySouth],
        ]);
    projection.isPrefitted = true;
    return projection;
}

function drawMap(svgId, projection) {
    const svg = document.getElementById(svgId);
    const viewBox = svg.getAttribute('viewBox').split(' ').map(Number);
    const width = viewBox[2];
    const height = viewBox[3];

    // A pre-fitted projection carries its own extent; only fit the rest.
    if (!projection.isPrefitted) {
        projection.fitExtent(
            [[MAP_PAD, MAP_PAD], [width - MAP_PAD, height - MAP_PAD]],
            { type: 'Sphere' },
        );
    }
    const path = d3.geoPath(projection);

    const parts = [];
    parts.push(`<path class="sphere-outline" d="${path({ type: 'Sphere' }) || ''}" />`);
    parts.push(`<path class="graticule" d="${path(d3.geoGraticule10()) || ''}" />`);

    for (const country of state.countries) {
        const d = path(country.feature);
        if (!d) continue;
        parts.push(
            `<path class="country" data-iso="${country.iso}" d="${d}" style="fill: ${fillFor(country)}"></path>`,
        );
    }

    svg.innerHTML = parts.join('');
    wireMapEvents(svg);
}

function wireMapEvents(svg) {
    const tooltip = document.getElementById('tooltip');

    svg.addEventListener('mousemove', event => {
        const target = event.target.closest('.country');
        if (!target) {
            tooltip.classList.add('hidden');
            return;
        }
        const country = state.byIso.get(target.dataset.iso);
        if (!country) return;

        tooltip.innerHTML = `
            <div class="font-semibold mb-1">${country.name}</div>
            <div class="tabnum">True: ${fmtArea(country.true_km2)}</div>
            <div class="tabnum">On Mercator: ${country.off_scale ? 'off scale' : fmtArea(country.mercator_km2)}</div>
            <div class="tabnum mt-1 text-sky-300">${country.factor ? `${fmtFactor(country.factor)} inflated` : 'no honest ratio'}</div>
        `;
        tooltip.classList.remove('hidden');
        // Flip the tooltip near the right/bottom edges so it never leaves the viewport.
        const rect = tooltip.getBoundingClientRect();
        const x = event.clientX + 14;
        const y = event.clientY + 14;
        tooltip.style.left = `${Math.min(x, window.innerWidth - rect.width - 8)}px`;
        tooltip.style.top = `${Math.min(y, window.innerHeight - rect.height - 8)}px`;
    });

    svg.addEventListener('mouseleave', () => {
        document.getElementById('tooltip').classList.add('hidden');
    });

    svg.addEventListener('click', event => {
        const target = event.target.closest('.country');
        if (target) select(target.dataset.iso);
    });
}

function paintMaps() {
    const anyFilter = state.search !== '' || state.continent !== 'all';
    document.querySelectorAll('.country').forEach(el => {
        const country = state.byIso.get(el.dataset.iso);
        const dim = anyFilter && country && !matchesFilter(country);
        el.classList.toggle('is-dimmed', dim);
        el.classList.toggle('is-selected', country === state.selected);
    });
}

// ─── Legend ──────────────────────────────────────────────────────────────────

function renderLegend() {
    const swatches = INFLATION_BINS.map(
        bin => `
        <div class="flex items-center gap-2 text-xs font-medium text-gray-600">
            <span class="inline-block h-3 w-5 rounded-sm" style="background: ${bin.token}"></span>
            <span class="tabnum">${bin.label}</span>
        </div>`,
    );
    swatches.push(`
        <div class="flex items-center gap-2 text-xs font-medium text-gray-600">
            <span class="inline-block h-3 w-5 rounded-sm" style="background: ${NO_DATA_TOKEN}"></span>
            <span>off scale</span>
        </div>`);
    document.getElementById('scale-legend').innerHTML = swatches.join('');
}

// ─── Selected-country detail ─────────────────────────────────────────────────

function select(iso) {
    const country = state.byIso.get(iso);
    if (!country) return;
    state.selected = country;
    renderDetail();
    paintMaps();
}

function renderDetail() {
    const c = state.selected;
    if (!c) return;

    document.getElementById('detail-title').textContent = c.name;
    document.getElementById('detail-true').textContent = fmtArea(c.true_km2);
    document.getElementById('detail-apparent').textContent = c.off_scale ? 'off scale' : fmtArea(c.mercator_km2);
    document.getElementById('detail-factor').textContent = c.factor ? fmtFactor(c.factor) : '—';

    const rankEl = document.getElementById('detail-rank');
    rankEl.textContent = c.factor
        ? `${c.rank} most inflated of ${state.rankedCount}`
        : 'reaches the pole — no ratio';

    const headline = document.getElementById('detail-headline');
    if (!c.factor) {
        headline.innerHTML = `<strong>${c.name}</strong> touches the pole, where Mercator stretches without limit — the old map cannot give it a finite size at all.`;
    } else if (c.factor < 1.05) {
        headline.innerHTML = `<strong>${c.name}</strong> sits near the equator, so the old map already had it about right — Equal Earth barely changes it.`;
    } else {
        const pct = Math.round((c.factor - 1) * 100);
        headline.innerHTML = `On the old map <strong>${c.name}</strong> is drawn <strong>${fmtRatio(c.factor)}×</strong> its real size — about <strong>${pct}% too big</strong>. Equal Earth shrinks it back.`;
    }

    drawShrinkPreview(c);
}

/**
 * Draws the country twice at one common real-world scale: its Mercator footprint
 * as an outline, and its Equal Earth footprint as a fill. The ratio of the two
 * enclosed areas is exactly the inflation factor.
 */
function drawShrinkPreview(country) {
    const svg = document.getElementById('shrink-preview');
    const [, , width, height] = svg.getAttribute('viewBox').split(' ').map(Number);
    const box = [[16, 16], [width - 16, height - 16]];

    const projMercator = d3.geoMercator().fitExtent(box, country.feature);
    const pathMercator = d3.geoPath(projMercator);
    const mercatorPx = pathMercator.area(country.feature);

    const parts = [
        `<path d="${pathMercator(country.feature)}" fill="none" stroke="var(--series-mercator)"
            stroke-width="1.5" stroke-dasharray="4 3" />`,
    ];

    if (country.factor && mercatorPx > 0) {
        const projEqual = d3.geoEqualEarth().fitExtent(box, country.feature);
        const pathEqual = d3.geoPath(projEqual);
        const equalPx = pathEqual.area(country.feature);

        if (equalPx > 0) {
            // Put the Equal Earth shape on the Mercator drawing's scale: same
            // pixels-per-square-kilometre, so the two outlines are comparable.
            const pxPerKm2 = mercatorPx / country.mercator_km2;
            const scale = Math.sqrt((country.true_km2 * pxPerKm2) / equalPx);
            const bounds = pathEqual.bounds(country.feature);
            const cx = (bounds[0][0] + bounds[1][0]) / 2;
            const cy = (bounds[0][1] + bounds[1][1]) / 2;
            const tx = width / 2 - cx;
            const ty = height / 2 - cy;

            parts.push(`
                <g transform="translate(${width / 2} ${height / 2}) scale(${scale}) translate(${-width / 2} ${-height / 2})">
                    <g transform="translate(${tx} ${ty})">
                        <path d="${pathEqual(country.feature)}" fill="var(--series-equalearth)"
                            stroke="var(--surface)" stroke-width="${1 / scale}" />
                    </g>
                </g>`);
        }
    }

    svg.innerHTML = parts.join('');
}

// ─── Head-to-head ────────────────────────────────────────────────────────────

function renderCompare() {
    const a = state.byIso.get(document.getElementById('compare-a').value);
    const b = state.byIso.get(document.getElementById('compare-b').value);
    const verdict = document.getElementById('compare-verdict');
    const bars = document.getElementById('compare-bars');
    if (!a || !b) return;

    const rows = [
        { country: a, value: a.mercator_km2, series: 'mercator', projection: 'Mercator' },
        { country: b, value: b.mercator_km2, series: 'mercator', projection: 'Mercator' },
        { country: a, value: a.true_km2, series: 'equalearth', projection: 'Equal Earth' },
        { country: b, value: b.true_km2, series: 'equalearth', projection: 'Equal Earth' },
    ];
    const max = Math.max(...rows.map(r => r.value || 0));

    // One shared scale across all four bars, so Mercator's inflation is visible
    // as extra length rather than hidden by a per-group rescale.
    let html = '';
    let lastProjection = null;
    for (const row of rows) {
        if (row.projection !== lastProjection) {
            html += `<div class="pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">${row.projection}</div>`;
            lastProjection = row.projection;
        }
        const pct = row.value ? Math.max((row.value / max) * 100, 0.6) : 0;
        html += `
            <div class="flex items-center gap-3">
                <div class="w-28 shrink-0 truncate text-xs text-gray-600" title="${row.country.name}">${row.country.name}</div>
                <div class="h-4 flex-grow">
                    ${row.value
                        ? `<div class="h-4 rounded-r-[4px]" style="width: ${pct}%; background: var(--series-${row.series})"></div>`
                        : '<div class="text-xs italic text-gray-400">off scale</div>'}
                </div>
                <div class="tabnum w-24 shrink-0 text-right text-xs font-medium text-gray-700">${fmtArea(row.value)}</div>
            </div>`;
    }
    bars.innerHTML = html;

    if (!a.mercator_km2 || !b.mercator_km2) {
        verdict.innerHTML = `One of these reaches the pole, where Mercator has no finite size — so only the true areas can be compared:
            <strong>${a.name}</strong> ${fmtArea(a.true_km2)} against <strong>${b.name}</strong> ${fmtArea(b.true_km2)}.`;
        return;
    }

    const oldRatio = a.mercator_km2 / b.mercator_km2;
    const newRatio = a.true_km2 / b.true_km2;
    const shift = oldRatio / newRatio;
    verdict.innerHTML = `
        On the old map <strong>${a.name}</strong> looks <strong>${fmtRatio(oldRatio)}×</strong> the size of
        <strong>${b.name}</strong>. On the new map it is <strong>${fmtRatio(newRatio)}×</strong> —
        Mercator overstated the gap by a factor of <strong>${fmtRatio(shift)}</strong>.`;
}

// ─── Table view ──────────────────────────────────────────────────────────────

function renderTable() {
    const body = document.getElementById('table-body');
    const empty = document.getElementById('table-empty');

    const rows = state.countries.filter(matchesFilter).sort((x, y) => {
        const dir = state.sortDir === 'asc' ? 1 : -1;
        const key = state.sortKey;
        if (key === 'name' || key === 'continent') {
            return dir * String(x[key] || '').localeCompare(String(y[key] || ''));
        }
        // Countries with no ratio always sort to the bottom.
        const xv = x[key];
        const yv = y[key];
        if (xv === null || xv === undefined) return 1;
        if (yv === null || yv === undefined) return -1;
        return dir * (xv - yv);
    });

    empty.classList.toggle('hidden', rows.length > 0);

    const visible = state.showAll ? rows : rows.slice(0, TABLE_PAGE_SIZE);
    const more = document.getElementById('table-more');
    more.classList.toggle('hidden', rows.length <= TABLE_PAGE_SIZE);
    more.textContent = state.showAll
        ? `Show first ${TABLE_PAGE_SIZE} only`
        : `Show all ${rows.length} countries`;

    body.innerHTML = visible
        .map(c => {
            const isSelected = c === state.selected;
            return `
            <tr data-iso="${c.iso}" tabindex="0" aria-label="${c.name}"
                class="row-pick cursor-pointer transition-colors hover:bg-sky-50/60 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-500 ${isSelected ? 'is-picked' : ''}">
                <td class="px-4 py-2.5 font-medium text-gray-800">
                    <span class="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle" style="background: ${fillFor(c)}"></span>${c.name}
                </td>
                <td class="px-4 py-2.5 text-gray-500">${c.continent || '—'}</td>
                <td class="tabnum px-4 py-2.5 text-right text-gray-700">${fmtFull(c.true_km2)}</td>
                <td class="tabnum px-4 py-2.5 text-right text-gray-700">${c.off_scale ? '<span class="italic text-gray-400">off scale</span>' : fmtFull(c.mercator_km2)}</td>
                <td class="tabnum px-4 py-2.5 text-right font-semibold text-gray-900">${c.factor ? fmtFactor(c.factor) : '—'}</td>
            </tr>`;
        })
        .join('');

    body.querySelectorAll('tr').forEach(tr => {
        tr.addEventListener('click', () => select(tr.dataset.iso));
        tr.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                select(tr.dataset.iso);
            }
        });
    });

    renderSortIndicators();
}

function renderSortIndicators() {
    document.querySelectorAll('th[data-sort]').forEach(th => {
        const isActive = th.dataset.sort === state.sortKey;
        const arrow = state.sortDir === 'asc' ? '\u2191' : '\u2193';
        th.querySelector('.sort-arrow').textContent = isActive ? arrow : '';
        th.setAttribute('aria-sort', isActive ? (state.sortDir === 'asc' ? 'ascending' : 'descending') : 'none');
    });
}

// ─── Headline figures ────────────────────────────────────────────────────────

function renderHeroes() {
    const africa = state.countries.filter(c => c.continent === 'Africa');
    const africaTrue = africa.reduce((sum, c) => sum + c.true_km2, 0);
    const africaMercator = africa.reduce((sum, c) => sum + (c.mercator_km2 || 0), 0);
    const greenland = state.byIso.get('GRL');

    if (greenland) {
        document.getElementById('hero-greenland').textContent = `${fmtRatio(greenland.mercator_km2 / africaMercator)}× Africa`;
        document.getElementById('hero-greenland-true').textContent = `${fmtRatio(greenland.true_km2 / africaTrue)}×`;
    }

    const worst = state.countries.filter(c => c.factor).sort((a, b) => b.factor - a.factor)[0];
    if (worst) {
        document.getElementById('hero-worst').textContent = worst.name;
        document.getElementById('hero-worst-detail').textContent =
            `${fmtFactor(worst.factor)} — drawn as ${fmtArea(worst.mercator_km2)} instead of ${fmtArea(worst.true_km2)}`;
    }

    // Share of drawn land, Antarctica excluded since Mercator gives it no figure.
    const scaled = state.countries.filter(c => c.mercator_km2);
    const totalTrue = scaled.reduce((sum, c) => sum + c.true_km2, 0);
    const totalMercator = scaled.reduce((sum, c) => sum + c.mercator_km2, 0);
    const trueShare = (africaTrue / totalTrue) * 100;
    const mercatorShare = (africaMercator / totalMercator) * 100;
    document.getElementById('hero-africa').textContent = `${trueShare.toFixed(1)}%`;
    document.getElementById('hero-africa-detail').textContent =
        `but only ${mercatorShare.toFixed(1)}% of the ink on a Mercator map`;

    document.getElementById('hero-count').textContent = state.rankedCount;
}

// ─── Controls ────────────────────────────────────────────────────────────────

function populateControls() {
    const continents = [...new Set(state.countries.map(c => c.continent).filter(Boolean))].sort();
    const continentSelect = document.getElementById('continent-select');
    continentSelect.innerHTML =
        '<option value="all">All continents</option>' +
        continents.map(c => `<option value="${c}">${c}</option>`).join('');

    const byName = [...state.countries].sort((a, b) => a.name.localeCompare(b.name));
    const options = byName.map(c => `<option value="${c.iso}">${c.name}</option>`).join('');
    document.getElementById('compare-a').innerHTML = options;
    document.getElementById('compare-b').innerHTML = options;

    // Greenland against DR Congo: near-identical true areas, wildly different on
    // Mercator, which is the whole story in one pair.
    document.getElementById('compare-a').value = state.byIso.has('GRL') ? 'GRL' : byName[0].iso;
    document.getElementById('compare-b').value = state.byIso.has('COD') ? 'COD' : byName[1].iso;
}

function wireControls() {
    const search = document.getElementById('search-input');
    search.addEventListener('input', () => {
        state.search = search.value.trim();
        paintMaps();
        renderTable();
    });

    document.getElementById('continent-select').addEventListener('change', event => {
        state.continent = event.target.value;
        paintMaps();
        renderTable();
    });

    document.getElementById('reset-btn').addEventListener('click', () => {
        state.search = '';
        state.continent = 'all';
        search.value = '';
        document.getElementById('continent-select').value = 'all';
        paintMaps();
        renderTable();
    });

    document.getElementById('table-more').addEventListener('click', () => {
        state.showAll = !state.showAll;
        renderTable();
    });

    document.getElementById('compare-a').addEventListener('change', renderCompare);
    document.getElementById('compare-b').addEventListener('change', renderCompare);

    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const key = th.dataset.sort;
            if (state.sortKey === key) {
                state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
            } else {
                state.sortKey = key;
                state.sortDir = key === 'name' || key === 'continent' ? 'asc' : 'desc';
            }
            renderTable();
        });
    });
}

// ─── Boot ────────────────────────────────────────────────────────────────────

async function init() {
    try {
        const payload = await window.BangUtils.fetchJSONWithCache(DATA_URL, {
            cacheName: 'bang-map-projection-v1',
        });
        prepare(payload);

        renderLegend();
        populateControls();
        wireControls();

        const mercatorSvg = document.getElementById('map-mercator');
        const [, , mapWidth, mapHeight] = mercatorSvg.getAttribute('viewBox').split(' ').map(Number);
        drawMap('map-mercator', trimmedMercator(mapWidth, mapHeight));
        drawMap('map-equalearth', d3.geoEqualEarth());

        renderHeroes();
        renderCompare();
        renderTable();
        select(state.byIso.has('GRL') ? 'GRL' : state.countries[0].iso);

        document.getElementById('method-size').textContent =
            `${state.countries.length}-country`;
    } catch (error) {
        console.error('Failed to load projection data', error);
        window.BangUtils.UIManager.showToast('Could not load map data.', 'error');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
