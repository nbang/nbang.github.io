import { EditorView, lineNumbers, highlightActiveLine, keymap } from 'https://esm.sh/@codemirror/view@6';
import { EditorState } from 'https://esm.sh/@codemirror/state@6';
import { defaultKeymap, history, historyKeymap, indentWithTab } from 'https://esm.sh/@codemirror/commands@6';
import { syntaxHighlighting, defaultHighlightStyle, foldGutter, foldKeymap } from 'https://esm.sh/@codemirror/language@6';
import { xml } from 'https://esm.sh/@codemirror/lang-xml@6';

// ─── State ───────────────────────────────────────────────────────────────────
const S = {
  svgEl:      null,
  filename:   'untitled.svg',
  tool:       'select',
  zoom:       1,
  panX:       0,
  panY:       0,
  selectedEl: null,
  undoStack:  [],
  redoStack:  [],
  drawing:    null,
  dragging:   null,
  resizing:   null,
  panning:    null,
  pngScale:   2,
};

// ─── DOM refs ────────────────────────────────────────────────────────────────
const $upload    = document.getElementById('upload-view');
const $workspace = document.getElementById('workspace-view');
const $wrapper   = document.getElementById('svg-wrapper');
const $canvas    = document.getElementById('canvas-container');
const $overlay   = document.getElementById('overlay-svg');
const $noSel     = document.getElementById('no-sel');
const $selProps  = document.getElementById('sel-props');
const $layList   = document.getElementById('layers-list');
const $layCount  = document.getElementById('layers-count');
const $fileBadge = document.getElementById('file-badge');
const $elemCount = document.getElementById('elem-count');
const $zoomSlider= document.getElementById('zoom-slider');
const $zoomLabel = document.getElementById('zoom-label');
const $codeError = document.getElementById('code-error');
const NS = 'http://www.w3.org/2000/svg';

// ─── CodeMirror ───────────────────────────────────────────────────────────────
let cm = null;
let cmSyncTimer = null;

// All imports are @6 packages — they share the same @codemirror/state peer dep
// and are deduplicated correctly by the browser module cache.
const editorSetup = [
  lineNumbers(),
  highlightActiveLine(),
  history(),
  foldGutter(),
  syntaxHighlighting(defaultHighlightStyle),
  keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap, indentWithTab]),
];

function initCM(content) {
  if (cm) cm.destroy();
  cm = new EditorView({
    state: EditorState.create({
      doc: content,
      extensions: [
        editorSetup,
        xml(),
        EditorView.theme({
          '&': { background: '#fafafa' },
          '.cm-content': { padding: '8px 0' },
          '.cm-line': { padding: '0 12px' },
          '.cm-activeLineGutter': { background: '#fff7ed' },
          '.cm-activeLine': { background: '#fff7ed40' },
        }),
      ],
    }),
    parent: document.getElementById('cm-host'),
  });
}

function setCMContent(str) {
  if (!cm) return;
  cm.dispatch({ changes: { from: 0, to: cm.state.doc.length, insert: str } });
}

function scheduleCMSync() {
  clearTimeout(cmSyncTimer);
  cmSyncTimer = setTimeout(() => {
    if (S.svgEl) setCMContent(fmtXML(new XMLSerializer().serializeToString(S.svgEl)));
  }, 400);
}

// ─── Load SVG ─────────────────────────────────────────────────────────────────
function loadSVG(text, name) {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (doc.querySelector('parsererror')) {
    showToast('Invalid SVG file', 'error'); return;
  }
  const svg = doc.querySelector('svg');
  if (!svg) { showToast('No <svg> element found', 'error'); return; }

  $wrapper.innerHTML = '';
  $wrapper.appendChild(svg);
  S.svgEl      = svg;
  S.filename   = name || 'untitled.svg';
  S.selectedEl = null;
  S.undoStack  = [];
  S.redoStack  = [];
  collapsedEls  = new WeakSet();
  layerElements = [];

  // Ensure explicit dimensions so PNG export knows the size
  if (!svg.getAttribute('width') && !svg.getAttribute('height')) {
    const vb = svg.getAttribute('viewBox');
    if (vb) {
      const parts = vb.trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4) {
        svg.setAttribute('width',  parts[2]);
        svg.setAttribute('height', parts[3]);
      }
    }
  }

  $upload.classList.add('hidden');
  $workspace.classList.remove('hidden');
  $fileBadge.textContent = S.filename;
  refreshElemCount();
  refreshLayers();
  saveSnap();
  updateUndoBtns();

  initCM(fmtXML(new XMLSerializer().serializeToString(svg)));
  setTimeout(fitToView, 60);
}

// ─── Transform / Zoom / Pan ───────────────────────────────────────────────────
function applyTransform() {
  $wrapper.style.transform = `translate(${S.panX}px,${S.panY}px) scale(${S.zoom})`;
  $zoomSlider.value = Math.round(S.zoom * 100);
  $zoomLabel.textContent = Math.round(S.zoom * 100) + '%';
  refreshOverlay();
}

window.setZoom = z => { S.zoom = Math.max(0.08, Math.min(4, z)); applyTransform(); };
window.zoomBy  = d => setZoom(S.zoom + d);

window.fitToView = function() {
  if (!S.svgEl) return;
  const cr  = $canvas.getBoundingClientRect();
  const w   = parseFloat(S.svgEl.getAttribute('width')  || S.svgEl.viewBox?.baseVal?.width  || 400);
  const h   = parseFloat(S.svgEl.getAttribute('height') || S.svgEl.viewBox?.baseVal?.height || 300);
  const pad = 40;
  S.zoom = Math.min((cr.width - pad * 2) / w, (cr.height - pad * 2) / h, 4);
  S.panX = (cr.width  - w * S.zoom) / 2;
  S.panY = (cr.height - h * S.zoom) / 2;
  applyTransform();
};

// Wheel zoom toward cursor
$canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const d    = e.deltaY > 0 ? -0.08 : 0.08;
  const cr   = $canvas.getBoundingClientRect();
  const mx   = e.clientX - cr.left;
  const my   = e.clientY - cr.top;
  const prev = S.zoom;
  S.zoom = Math.max(0.08, Math.min(4, S.zoom + d));
  S.panX = mx - (mx - S.panX) * (S.zoom / prev);
  S.panY = my - (my - S.panY) * (S.zoom / prev);
  applyTransform();
}, { passive: false });

// Alt+drag or middle-mouse pan
$canvas.addEventListener('mousedown', e => {
  if (e.button === 1 || (e.button === 0 && e.altKey)) {
    e.preventDefault();
    S.panning = { sx: e.clientX, sy: e.clientY, ox: S.panX, oy: S.panY };
  }
});

// ─── Canvas mouse events ──────────────────────────────────────────────────────
$canvas.addEventListener('mousedown', onCanvasDown);
window.addEventListener('mousemove', onMouseMove);
window.addEventListener('mouseup',   onMouseUp);

function clientToSVG(cx, cy) {
  const r = $wrapper.getBoundingClientRect();
  return { x: (cx - r.left) / S.zoom, y: (cy - r.top) / S.zoom };
}

function onCanvasDown(e) {
  if (S.panning || e.button !== 0) return;
  const p = clientToSVG(e.clientX, e.clientY);

  if (S.tool === 'select') {
    const el = pickElement(e.target);
    if (el) {
      selectEl(el);
      S.dragging = {
        el,
        sx: p.x, sy: p.y,
        ox:  parseAttr(el, 'x')  ?? parseAttr(el, 'cx') ?? 0,
        oy:  parseAttr(el, 'y')  ?? parseAttr(el, 'cy') ?? 0,
        ox1: parseAttr(el, 'x1') ?? 0, oy1: parseAttr(el, 'y1') ?? 0,
        ox2: parseAttr(el, 'x2') ?? 0, oy2: parseAttr(el, 'y2') ?? 0,
        origTx: parseAttr(el, '_tx') ?? 0,
        origTy: parseAttr(el, '_ty') ?? 0,
        origTransform: el.getAttribute('transform') || '',
      };
    } else {
      selectEl(null);
    }
  } else {
    beginDraw(e, p);
  }
}

function onMouseMove(e) {
  if (S.panning) {
    S.panX = S.panning.ox + (e.clientX - S.panning.sx);
    S.panY = S.panning.oy + (e.clientY - S.panning.sy);
    applyTransform(); return;
  }
  const p = clientToSVG(e.clientX, e.clientY);
  if (S.dragging)  { applyMove(S.dragging, p.x - S.dragging.sx, p.y - S.dragging.sy); refreshOverlay(); scheduleCMSync(); }
  else if (S.drawing)  { updateDraw(p); }
  else if (S.resizing) { applyResize(p); }
}

function onMouseUp(e) {
  if (S.panning && (e.button === 1 || e.button === 0)) { S.panning = null; return; }
  if (S.dragging)  { saveSnap(); S.dragging = null; }
  if (S.drawing)   { endDraw(); }
  if (S.resizing)  { saveSnap(); S.resizing = null; }
}

function pickElement(target) {
  if (!target || !S.svgEl) return null;
  if (target === S.svgEl || target === $canvas || target === $wrapper) return null;
  if (target instanceof SVGElement && S.svgEl.contains(target)) return target;
  return null;
}

// ─── Move ─────────────────────────────────────────────────────────────────────
function applyMove(d, dx, dy) {
  const el  = d.el;
  const tag = el.tagName.toLowerCase();
  if (tag === 'line') {
    el.setAttribute('x1', f(d.ox1 + dx)); el.setAttribute('y1', f(d.oy1 + dy));
    el.setAttribute('x2', f(d.ox2 + dx)); el.setAttribute('y2', f(d.oy2 + dy));
  } else if (tag === 'circle' || tag === 'ellipse') {
    el.setAttribute('cx', f(d.ox + dx)); el.setAttribute('cy', f(d.oy + dy));
  } else if (['rect','text','image','use','foreignobject'].includes(tag)) {
    el.setAttribute('x', f(d.ox + dx)); el.setAttribute('y', f(d.oy + dy));
  } else {
    // path, polygon, polyline, g — use transform translate
    const base = d.origTransform.replace(/translate\([^)]+\)/g, '').trim();
    const tx = d.origTx + dx, ty = d.origTy + dy;
    el.setAttribute('transform', `${base} translate(${f(tx)},${f(ty)})`.trim());
  }
  refreshProps();
}

// ─── Overlay (selection + handles) ───────────────────────────────────────────
function selectEl(el) {
  S.selectedEl = el;
  refreshOverlay();
  refreshProps();
  // Expand any collapsed ancestor groups so the element is visible in the layers panel
  if (el) {
    let parent = el.parentNode;
    while (parent && parent !== S.svgEl) {
      if (collapsedEls.has(parent)) collapsedEls.delete(parent);
      parent = parent.parentNode;
    }
  }
  refreshLayers(); // always re-render — inline attr editor is part of the tree
}

function refreshOverlay() {
  $overlay.innerHTML = '';
  if (!S.selectedEl) return;
  const cr = $canvas.getBoundingClientRect();
  const er = S.selectedEl.getBoundingClientRect();
  const l  = er.left - cr.left;
  const t  = er.top  - cr.top;
  const w  = er.width;
  const h  = er.height;

  // Dashed selection border
  const border = mkSVG('rect');
  setAttrs(border, { x: l-1, y: t-1, width: w+2, height: h+2,
    fill: 'none', stroke: '#f97316', 'stroke-width': '1.5', 'stroke-dasharray': '5 3' });
  $overlay.appendChild(border);

  // 8 resize handles
  [
    { id:'nw', x: l,     y: t,     cur:'nwse-resize' },
    { id:'n',  x: l+w/2, y: t,     cur:'ns-resize'   },
    { id:'ne', x: l+w,   y: t,     cur:'nesw-resize'  },
    { id:'e',  x: l+w,   y: t+h/2, cur:'ew-resize'   },
    { id:'se', x: l+w,   y: t+h,   cur:'nwse-resize'  },
    { id:'s',  x: l+w/2, y: t+h,   cur:'ns-resize'   },
    { id:'sw', x: l,     y: t+h,   cur:'nesw-resize'  },
    { id:'w',  x: l,     y: t+h/2, cur:'ew-resize'   },
  ].forEach(h => {
    const r = mkSVG('rect');
    setAttrs(r, { x: h.x-5, y: h.y-5, width: 10, height: 10, rx: 2,
      fill: 'white', stroke: '#f97316', 'stroke-width': '1.5' });
    r.style.cursor        = h.cur;
    r.style.pointerEvents = 'all';
    r.dataset.handle      = h.id;
    r.addEventListener('mousedown', ev => startResize(ev, h.id));
    $overlay.appendChild(r);
  });

  // Rotate stem + handle
  const stem = mkSVG('line');
  setAttrs(stem, { x1: l+w/2, y1: t, x2: l+w/2, y2: t-20, stroke: '#f97316', 'stroke-width': '1.5' });
  $overlay.appendChild(stem);

  const rot = mkSVG('circle');
  setAttrs(rot, { cx: l+w/2, cy: t-26, r: 6, fill: 'white', stroke: '#f97316', 'stroke-width': '1.5' });
  rot.style.cursor        = 'crosshair';
  rot.style.pointerEvents = 'all';
  rot.addEventListener('mousedown', startRotate);
  $overlay.appendChild(rot);
}

// ─── Resize ───────────────────────────────────────────────────────────────────
function startResize(e, handle) {
  e.preventDefault(); e.stopPropagation();
  if (!S.selectedEl) return;
  const bb = S.selectedEl.getBBox();
  S.resizing = { handle, el: S.selectedEl, oBBox: { ...bb }, sp: clientToSVG(e.clientX, e.clientY) };
}

function applyResize(p) {
  const { handle, oBBox: o, sp, el } = S.resizing;
  const dx = p.x - sp.x, dy = p.y - sp.y;
  const tag = el.tagName.toLowerCase();
  let { x, y, width: w, height: h } = o;

  if (handle.includes('e')) w = Math.max(1, w + dx);
  if (handle.includes('w')) { x += dx; w = Math.max(1, w - dx); }
  if (handle.includes('s')) h = Math.max(1, h + dy);
  if (handle.includes('n')) { y += dy; h = Math.max(1, h - dy); }

  if (tag === 'rect') {
    setAttrs(el, { x: f(x), y: f(y), width: f(w), height: f(h) });
  } else if (tag === 'circle') {
    const r = Math.max(1, Math.min(w, h) / 2);
    setAttrs(el, { cx: f(x+r), cy: f(y+r), r: f(r) });
  } else if (tag === 'ellipse') {
    setAttrs(el, { cx: f(x+w/2), cy: f(y+h/2), rx: f(w/2), ry: f(h/2) });
  } else if (['image','use','foreignobject'].includes(tag)) {
    setAttrs(el, { x: f(x), y: f(y), width: f(w), height: f(h) });
  }
  refreshOverlay(); refreshProps();
}

// ─── Rotate ───────────────────────────────────────────────────────────────────
function startRotate(e) {
  e.preventDefault(); e.stopPropagation();
  if (!S.selectedEl) return;
  const bb  = S.selectedEl.getBBox();
  const cx  = bb.x + bb.width / 2;
  const cy  = bb.y + bb.height / 2;
  const el  = S.selectedEl;
  const origT = el.getAttribute('transform') || '';

  const move = ev => {
    const p     = clientToSVG(ev.clientX, ev.clientY);
    const angle = Math.atan2(p.y - cy, p.x - cx) * 180 / Math.PI + 90;
    const base  = origT.replace(/rotate\([^)]+\)/g, '').trim();
    el.setAttribute('transform', `${base} rotate(${f(angle)},${f(cx)},${f(cy)})`.trim());
    refreshOverlay();
  };
  const up = () => {
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup',   up);
    saveSnap(); scheduleCMSync();
  };
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup',   up);
}

// ─── Drawing tools ────────────────────────────────────────────────────────────
function beginDraw(e, p) {
  const { tool } = S;
  let el;
  if (tool === 'rect') {
    el = mkSVG('rect');
    setAttrs(el, { x: p.x, y: p.y, width: 1, height: 1, fill: '#f97316', stroke: 'none' });
  } else if (tool === 'circle') {
    el = mkSVG('circle');
    setAttrs(el, { cx: p.x, cy: p.y, r: 1, fill: '#f97316', stroke: 'none' });
  } else if (tool === 'line') {
    el = mkSVG('line');
    setAttrs(el, { x1: p.x, y1: p.y, x2: p.x, y2: p.y, stroke: '#1e293b', 'stroke-width': 2 });
  } else if (tool === 'text') {
    const txt = prompt('Enter text:');
    if (!txt) return;
    el = mkSVG('text');
    setAttrs(el, { x: p.x, y: p.y, fill: '#1e293b', 'font-size': 16, 'font-family': 'sans-serif' });
    el.textContent = txt;
    S.svgEl.appendChild(el);
    saveSnap(); selectEl(el); refreshLayers(); setTool('select'); scheduleCMSync();
    return;
  }
  S.svgEl.appendChild(el);
  S.drawing = { tool, sx: p.x, sy: p.y, el };
}

function updateDraw(p) {
  const { tool, sx, sy, el } = S.drawing;
  const dx = p.x - sx, dy = p.y - sy;
  if (tool === 'rect') {
    setAttrs(el, { x: Math.min(p.x, sx), y: Math.min(p.y, sy), width: Math.abs(dx), height: Math.abs(dy) });
  } else if (tool === 'circle') {
    el.setAttribute('r', f(Math.sqrt(dx*dx + dy*dy)));
  } else if (tool === 'line') {
    setAttrs(el, { x2: p.x, y2: p.y });
  }
}

function endDraw() {
  const { el } = S.drawing;
  const tooSmall =
    (el.tagName === 'rect'   && (parseAttr(el,'width')  < 2 || parseAttr(el,'height') < 2)) ||
    (el.tagName === 'circle' && parseAttr(el,'r') < 2) ||
    (el.tagName === 'line'   && Math.abs(parseAttr(el,'x2') - parseAttr(el,'x1')) < 2 &&
                                Math.abs(parseAttr(el,'y2') - parseAttr(el,'y1')) < 2);
  if (tooSmall) { el.remove(); } else { saveSnap(); selectEl(el); refreshLayers(); scheduleCMSync(); }
  S.drawing = null;
  setTool('select');
}

// ─── Properties panel ─────────────────────────────────────────────────────────
function refreshProps() {
  if (!S.selectedEl) {
    $noSel.classList.remove('hidden');
    $selProps.classList.add('hidden');
    return;
  }
  $noSel.classList.add('hidden');
  $selProps.classList.remove('hidden');
  renderProps(S.selectedEl);
}

function renderProps(el) {
  const tag    = el.tagName.toLowerCase();
  const ga     = a => el.getAttribute(a) ?? '';
  const gn     = a => parseFloat(ga(a)) || 0;
  const col    = a => { const v = ga(a); return (!v || v==='none') ? '#000000' : (v.startsWith('rgb') ? rgb2hex(v) : (v.startsWith('#') ? v : '#000000')); };
  const isNone = a => !ga(a) || ga(a) === 'none';

  let html = '';

  html += `<div class="flex items-center gap-2">
    <span class="text-xs font-mono bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">&lt;${tag}&gt;</span>
    ${ga('id') ? `<span class="text-xs text-gray-400">#${ga('id')}</span>` : ''}
  </div>`;

  if (tag !== 'line') {
    html += prow('Fill', `<div class="flex items-center gap-2">
      <div class="rounded border border-gray-200 overflow-hidden ${isNone('fill') ? 'opacity-40' : ''}">
        <input type="color" value="${col('fill')}" onchange="doSetProp('fill',this.value)" />
      </div>
      <label class="flex items-center gap-1 text-xs text-gray-500 cursor-pointer select-none">
        <input type="checkbox" ${isNone('fill') ? '' : 'checked'} onchange="doToggleNone('fill',this.checked)" class="accent-orange-500" /> Enable
      </label>
    </div>`);
  }

  html += prow('Stroke', `<div class="flex items-center gap-2">
    <div class="rounded border border-gray-200 overflow-hidden ${isNone('stroke') ? 'opacity-40' : ''}">
      <input type="color" value="${col('stroke')}" onchange="doSetProp('stroke',this.value)" />
    </div>
    <label class="flex items-center gap-1 text-xs text-gray-500 cursor-pointer select-none">
      <input type="checkbox" ${isNone('stroke') ? '' : 'checked'} onchange="doToggleNone('stroke',this.checked)" class="accent-orange-500" /> Enable
    </label>
  </div>`);

  if (!isNone('stroke') || tag === 'line') {
    html += prow('Stroke W', `<input class="prop-input" type="number" value="${gn('stroke-width') || 1}" min="0" step="0.5"
      onchange="doSetProp('stroke-width',this.value)" />`);
  }

  const opac = parseFloat(ga('opacity') || '1');
  html += prow('Opacity', `<div class="flex items-center gap-2">
    <input type="range" min="0" max="1" step="0.01" value="${opac}"
      oninput="doSetProp('opacity',this.value);this.nextElementSibling.textContent=Math.round(this.value*100)+'%'"
      class="flex-1 accent-orange-500" />
    <span class="text-xs text-gray-400 w-8 text-right">${Math.round(opac*100)}%</span>
  </div>`);

  if (tag === 'rect') {
    html += pair('X','x','Y','y',el) + pair('W','width','H','height',el) + pair('Rx','rx','Ry','ry',el);
  } else if (tag === 'circle') {
    html += pair('Cx','cx','Cy','cy',el) + prow('Radius', nin('r', gn('r')));
  } else if (tag === 'ellipse') {
    html += pair('Cx','cx','Cy','cy',el) + pair('Rx','rx','Ry','ry',el);
  } else if (tag === 'line') {
    html += pair('X1','x1','Y1','y1',el) + pair('X2','x2','Y2','y2',el);
  } else if (tag === 'text') {
    html += pair('X','x','Y','y',el);
    html += prow('Content', `<input class="prop-input" type="text"
      value="${el.textContent.replace(/"/g,'&quot;')}"
      onchange="doSetTextContent(this.value)" />`);
    html += prow('Font size', nin('font-size', gn('font-size') || 16));
    html += prow('Font family', `<select class="prop-input" onchange="doSetProp('font-family',this.value)">
      ${['sans-serif','serif','monospace','Arial','Georgia','Courier New','Verdana'].map(f =>
        `<option value="${f}"${ga('font-family')===f?' selected':''}>${f}</option>`).join('')}
    </select>`);
    html += prow('Text anchor', `<select class="prop-input" onchange="doSetProp('text-anchor',this.value)">
      ${['start','middle','end'].map(a =>
        `<option value="${a}"${(ga('text-anchor')||'start')===a?' selected':''}>${a}</option>`).join('')}
    </select>`);
  } else if (['image','use'].includes(tag)) {
    html += pair('X','x','Y','y',el) + pair('W','width','H','height',el);
  }

  if (ga('transform')) {
    html += prow('Transform', `<span class="text-xs font-mono text-gray-400 break-all">${ga('transform').slice(0,60)}</span>`);
  }

  html += `<button onclick="doDeleteSelected()"
    class="w-full mt-1 py-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5">
    <i class="fa-regular fa-trash-can"></i> Delete Element
  </button>`;

  $selProps.innerHTML = html;
}

function prow(label, content) {
  return `<div><div class="prop-label">${label}</div>${content}</div>`;
}

function pair(l1, a1, l2, a2, el) {
  const v1 = parseFloat(el.getAttribute(a1) || 0);
  const v2 = parseFloat(el.getAttribute(a2) || 0);
  return `<div class="grid grid-cols-2 gap-2">
    <div><div class="prop-label">${l1}</div>${nin(a1, v1)}</div>
    <div><div class="prop-label">${l2}</div>${nin(a2, v2)}</div>
  </div>`;
}

function nin(attr, val) {
  return `<input class="prop-input" type="number" value="${parseFloat(val)||0}" step="1"
    onchange="doSetAttr('${attr}',this.value)" />`;
}

// ─── Prop actions ─────────────────────────────────────────────────────────────
window.doSetProp = (attr, val) => {
  if (!S.selectedEl) return;
  S.selectedEl.setAttribute(attr, val);
  refreshOverlay(); scheduleCMSync(); saveSnap();
};

window.doSetAttr = (attr, val) => {
  if (!S.selectedEl) return;
  S.selectedEl.setAttribute(attr, val);
  refreshOverlay(); scheduleCMSync();
};

window.doToggleNone = (attr, checked) => {
  if (!S.selectedEl) return;
  S.selectedEl.setAttribute(attr, checked ? '#000000' : 'none');
  refreshProps(); scheduleCMSync(); saveSnap();
};

window.doSetTextContent = val => {
  if (!S.selectedEl) return;
  S.selectedEl.textContent = val;
  scheduleCMSync();
};

window.doDeleteSelected = () => {
  if (!S.selectedEl) return;
  S.selectedEl.remove();
  S.selectedEl = null;
  refreshOverlay(); refreshProps(); refreshLayers(); refreshElemCount(); saveSnap(); scheduleCMSync();
};

// ─── Layers ───────────────────────────────────────────────────────────────────
let layerElements = [];
let collapsedEls  = new WeakSet();
let dragFrom      = null;

function refreshLayers() {
  if (!S.svgEl) return;
  layerElements = [];
  const total = S.svgEl.querySelectorAll('*').length;
  $layCount.textContent = total + ' element' + (total !== 1 ? 's' : '');
  refreshElemCount();

  const rows = [];

  function renderNode(el, depth) {
    const li        = layerElements.length;
    layerElements.push(el);
    const tag       = el.tagName.toLowerCase();
    const id        = el.getAttribute('id') ? `#${el.getAttribute('id')}` : '';
    const hasKids   = el.children.length > 0;
    const isGroup   = hasKids;
    const collapsed = collapsedEls.has(el);
    const indent    = 8 + depth * 14;
    const txt       = !isGroup ? (el.textContent?.trim().slice(0, 16) || '') : '';
    const draggable = depth === 0;
    const isSel     = el === S.selectedEl;

    rows.push(
      `<div class="layer-item flex items-center gap-1 text-xs" data-li="${li}"
        style="padding:4px 6px 4px ${indent}px"
        onclick="doSelectLayer(${li})"
        ${draggable ? `draggable="true" ondragstart="layDragStart(event,${li})" ondragover="event.preventDefault()" ondrop="layDrop(event,${li})"` : ''}>
        <span class="shrink-0 w-3 flex items-center justify-center">${
          isGroup
            ? `<i class="fa-solid ${collapsed ? 'fa-chevron-right' : 'fa-chevron-down'} text-[8px] text-gray-400 hover:text-orange-500 cursor-pointer"
                onclick="event.stopPropagation();doToggleLayerNode(${li})"></i>`
            : ''
        }</span>
        <i class="${layIcon(tag)} text-gray-400 w-3 text-center text-[10px] shrink-0"></i>
        <span class="font-mono text-gray-500 shrink-0">&lt;${htmlEsc(tag)}&gt;</span>
        ${id  ? `<span class="text-orange-400 font-mono text-[10px] truncate">${htmlEsc(id)}</span>` : ''}
        ${txt ? `<span class="text-gray-400 text-[10px] truncate">${htmlEsc(txt)}</span>` : ''}
      </div>`
    );

    // Inline attribute editor — rendered right after the selected element row
    if (isSel) rows.push(renderInlineAttrs(el, depth));

    if (isGroup && !collapsed) {
      [...el.children].reverse().forEach(child => renderNode(child, depth + 1));
    }
  }

  [...S.svgEl.children].reverse().forEach(el => renderNode(el, 0));
  $layList.innerHTML = rows.join('');
  refreshLayersHighlight();
}

// ─── Inline attribute editor (rendered as part of the layers tree) ────────────
function renderInlineAttrs(el, depth) {
  const attrs  = [...el.attributes];
  const indent = 8 + (depth + 1) * 14; // one level deeper than the element row

  const attrRows = attrs.map(attr => {
    const n = htmlEsc(attr.name);
    const v = htmlEsc(attr.value);
    return `<div class="flex items-center gap-1 min-w-0">
      <span class="font-mono text-orange-500 shrink-0 truncate text-[10px]"
        style="width:72px;min-width:72px" title="${n}">${n}</span>
      <input type="text" class="attr-val-input flex-1 min-w-0 px-1.5 py-0.5 text-[11px] font-mono
        border border-gray-200 bg-white rounded-md
        focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200/60"
        data-attr="${n}" value="${v}" />
      <button class="attr-del-btn shrink-0 w-5 h-5 flex items-center justify-center
        rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
        data-attr="${n}" title="Remove attribute">
        <i class="fa-solid fa-xmark text-[9px] pointer-events-none"></i>
      </button>
    </div>`;
  }).join('');

  return `<div class="attr-editor" style="padding:0 6px 6px ${indent}px" onclick="event.stopPropagation()">
    <div class="bg-white border border-orange-100 rounded-lg p-2 space-y-1.5 shadow-sm">
      ${attrRows || '<div class="text-[10px] text-gray-400 italic py-0.5 px-1">No attributes</div>'}
      <div class="flex items-center gap-1 pt-1.5 border-t border-gray-100">
        <input id="new-attr-name" type="text" placeholder="name"
          class="flex-1 min-w-0 px-1.5 py-0.5 text-[10px] font-mono border border-dashed border-gray-300
          bg-gray-50/80 rounded-md focus:outline-none focus:border-orange-400 w-0" />
        <span class="text-gray-300 text-[10px] shrink-0 select-none">=</span>
        <input id="new-attr-val" type="text" placeholder="value"
          class="flex-1 min-w-0 px-1.5 py-0.5 text-[10px] font-mono border border-dashed border-gray-300
          bg-gray-50/80 rounded-md focus:outline-none focus:border-orange-400 w-0" />
        <button onclick="doAddAttr()"
          class="shrink-0 px-2 h-5 bg-orange-400 hover:bg-orange-500 text-white rounded-md
          text-[10px] font-bold flex items-center justify-center transition-colors leading-none">+</button>
      </div>
    </div>
  </div>`;
}

// Delegated events for the inline attr editor (change, delete, add, keyboard)
$layList.addEventListener('change', e => {
  const input = e.target.closest('.attr-val-input');
  if (!input || !S.selectedEl) return;
  S.selectedEl.setAttribute(input.dataset.attr, input.value);
  refreshOverlay(); saveSnap(); scheduleCMSync();
  // Do NOT call refreshLayers() — would destroy the focused input
});

$layList.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (e.target.closest('.attr-val-input')) { e.target.blur(); return; } // triggers change
  if (e.target.id === 'new-attr-name')     { document.getElementById('new-attr-val')?.focus(); return; }
  if (e.target.id === 'new-attr-val')      { doAddAttr(); return; }
});

$layList.addEventListener('click', e => {
  const btn = e.target.closest('.attr-del-btn');
  if (!btn || !S.selectedEl) return;
  e.stopPropagation();
  S.selectedEl.removeAttribute(btn.dataset.attr);
  refreshLayers(); refreshOverlay(); saveSnap(); scheduleCMSync();
});

window.doAddAttr = () => {
  if (!S.selectedEl) return;
  const nameInput = document.getElementById('new-attr-name');
  const valInput  = document.getElementById('new-attr-val');
  const name = nameInput?.value.trim();
  if (!name) { nameInput?.focus(); showToast('Attribute name is required', 'error'); return; }
  S.selectedEl.setAttribute(name, valInput?.value ?? '');
  nameInput.value = ''; if (valInput) valInput.value = '';
  refreshLayers(); refreshOverlay(); saveSnap(); scheduleCMSync();
};

function layIcon(tag) {
  return ({
    rect: 'fa-regular fa-square', circle: 'fa-regular fa-circle', ellipse: 'fa-regular fa-circle',
    line: 'fa-solid fa-minus', text: 'fa-solid fa-t', path: 'fa-solid fa-bezier-curve',
    g: 'fa-solid fa-layer-group', image: 'fa-regular fa-image',
    polygon: 'fa-solid fa-draw-polygon', polyline: 'fa-solid fa-draw-polygon',
    defs: 'fa-solid fa-box-archive', symbol: 'fa-solid fa-shapes',
    clippath: 'fa-solid fa-crop-simple', mask: 'fa-solid fa-masks-theater',
    lineargradient: 'fa-solid fa-swatchbook', radialgradient: 'fa-solid fa-swatchbook',
    pattern: 'fa-solid fa-border-all', filter: 'fa-solid fa-filter',
  }[tag] || 'fa-solid fa-code');
}

function refreshLayersHighlight() {
  document.querySelectorAll('.layer-item').forEach(el => el.classList.remove('selected'));
  if (!S.selectedEl) return;
  const li = layerElements.indexOf(S.selectedEl);
  if (li < 0) return;
  document.querySelector(`.layer-item[data-li="${li}"]`)?.classList.add('selected');
}

window.doSelectLayer = li => {
  const el = layerElements[li];
  if (el) selectEl(el);
};

window.doToggleLayerNode = li => {
  const el = layerElements[li];
  if (!el) return;
  if (collapsedEls.has(el)) collapsedEls.delete(el);
  else collapsedEls.add(el);
  refreshLayers();
};

window.layDragStart = (e, li) => { dragFrom = li; };
window.layDrop = (e, toLi) => {
  e.preventDefault();
  if (dragFrom === null || dragFrom === toLi) { dragFrom = null; return; }
  const fromEl = layerElements[dragFrom];
  const toEl   = layerElements[toLi];
  if (!fromEl || !toEl) { dragFrom = null; return; }
  // Only reorder direct SVG children — nested reordering not supported via drag
  if (fromEl.parentNode !== S.svgEl || toEl.parentNode !== S.svgEl) { dragFrom = null; return; }
  const kids    = [...S.svgEl.children];
  const fromIdx = kids.indexOf(fromEl);
  const toIdx   = kids.indexOf(toEl);
  if (fromIdx < toIdx) S.svgEl.insertBefore(fromEl, toEl.nextSibling);
  else                 S.svgEl.insertBefore(fromEl, toEl);
  dragFrom = null;
  refreshLayers(); saveSnap(); scheduleCMSync();
};

// ─── Undo / Redo ──────────────────────────────────────────────────────────────
function saveSnap() {
  if (!S.svgEl) return;
  S.undoStack.push(new XMLSerializer().serializeToString(S.svgEl));
  if (S.undoStack.length > 60) S.undoStack.shift();
  S.redoStack = [];
  updateUndoBtns();
}

function restoreSnap(xml) {
  const doc = new DOMParser().parseFromString(xml, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) return;
  $wrapper.innerHTML = ''; $wrapper.appendChild(svg);
  S.svgEl = svg; S.selectedEl = null;
  collapsedEls  = new WeakSet();
  layerElements = [];
  refreshOverlay(); refreshProps(); refreshLayers(); refreshElemCount(); scheduleCMSync();
}

window.undo = () => {
  if (S.undoStack.length < 2) return;
  S.redoStack.push(S.undoStack.pop());
  restoreSnap(S.undoStack[S.undoStack.length - 1]);
  updateUndoBtns();
};

window.redo = () => {
  if (!S.redoStack.length) return;
  const snap = S.redoStack.pop();
  S.undoStack.push(snap);
  restoreSnap(snap);
  updateUndoBtns();
};

function updateUndoBtns() {
  const u = document.getElementById('btn-undo');
  const r = document.getElementById('btn-redo');
  u.disabled = S.undoStack.length < 2; u.style.opacity = u.disabled ? '0.3' : '1';
  r.disabled = !S.redoStack.length;    r.style.opacity = r.disabled ? '0.3' : '1';
}

// ─── Code editor ──────────────────────────────────────────────────────────────
window.doApplyCode = () => {
  if (!cm) return;
  const code = cm.state.doc.toString();
  const doc  = new DOMParser().parseFromString(code, 'image/svg+xml');
  const err  = doc.querySelector('parsererror');
  if (err) {
    $codeError.textContent = '⚠ ' + err.textContent.slice(0, 200);
    $codeError.classList.remove('hidden'); return;
  }
  $codeError.classList.add('hidden');
  const svg = doc.querySelector('svg');
  if (!svg) return;
  $wrapper.innerHTML = ''; $wrapper.appendChild(svg);
  S.svgEl = svg; S.selectedEl = null;
  refreshOverlay(); refreshProps(); refreshLayers(); refreshElemCount(); saveSnap();
};

window.doFormatCode = () => {
  if (!cm) return;
  setCMContent(fmtXML(cm.state.doc.toString()));
};

window.toggleCodePanel = () => {
  const body = document.getElementById('code-panel');
  const chev = document.getElementById('code-chevron');
  body.classList.toggle('hidden');
  chev.style.transform = body.classList.contains('hidden') ? '' : 'rotate(180deg)';
};

// ─── Clean SVG ────────────────────────────────────────────────────────────────
window.doCleanSVG = () => {
  if (!S.svgEl) return;

  const report = [];

  // Helper: walk all descendant elements
  function walkAll(root, fn) {
    fn(root);
    [...root.children].forEach(c => walkAll(c, fn));
  }

  // 1. Remove editor-specific elements (metadata, sodipodi:*, inkscape:*, etc.)
  const editorEls = [];
  walkAll(S.svgEl, el => {
    const tag = el.tagName;
    // Any element in a non-SVG/non-xlink namespace or named 'metadata'
    if (tag === 'metadata' || tag.includes(':')) editorEls.push(el);
  });
  if (editorEls.length) {
    editorEls.forEach(el => el.remove());
    report.push(`Removed ${editorEls.length} editor element${editorEls.length > 1 ? 's' : ''} (metadata, sodipodi:*, inkscape:*)`);
  }

  // 2. Remove editor-namespaced attributes from all elements
  // (inkscape:*, sodipodi:*, dc:*, cc:*, rdf:*, adobe:*)
  const EDITOR_PREFIXES = ['inkscape', 'sodipodi', 'dc', 'cc', 'rdf', 'adobe', 'illustrator'];
  let attrCount = 0;
  walkAll(S.svgEl, el => {
    [...el.attributes].forEach(attr => {
      const name = attr.name.toLowerCase();
      if (EDITOR_PREFIXES.some(p => name.startsWith(p + ':'))) {
        el.removeAttribute(attr.name);
        attrCount++;
      }
    });
  });
  if (attrCount) report.push(`Removed ${attrCount} editor attribute${attrCount > 1 ? 's' : ''}`);

  // 3. Remove unused namespace declarations from root <svg>
  //    Collect all prefixes actually used by elements and attributes after the above removals
  const usedPrefixes = new Set();
  walkAll(S.svgEl, el => {
    if (el.prefix) usedPrefixes.add(el.prefix);
    [...el.attributes].forEach(attr => {
      if (attr.prefix && attr.prefix !== 'xmlns') usedPrefixes.add(attr.prefix);
    });
  });
  let nsCount = 0;
  [...S.svgEl.attributes].forEach(attr => {
    if (attr.name.startsWith('xmlns:')) {
      const prefix = attr.name.slice(6);
      if (!usedPrefixes.has(prefix)) {
        S.svgEl.removeAttribute(attr.name);
        nsCount++;
      }
    }
  });
  if (nsCount) report.push(`Removed ${nsCount} unused namespace declaration${nsCount > 1 ? 's' : ''}`);

  // 4. Remove XML comments
  function removeComments(node) {
    let count = 0;
    [...node.childNodes].forEach(child => {
      if (child.nodeType === Node.COMMENT_NODE) { child.remove(); count++; }
      else if (child.childNodes.length)         { count += removeComments(child); }
    });
    return count;
  }
  const commentCount = removeComments(S.svgEl);
  if (commentCount) report.push(`Removed ${commentCount} XML comment${commentCount > 1 ? 's' : ''}`);

  // 5. Remove empty <defs> blocks
  let emptyDefs = 0;
  S.svgEl.querySelectorAll('defs').forEach(d => {
    if (d.children.length === 0) { d.remove(); emptyDefs++; }
  });
  if (emptyDefs) report.push(`Removed ${emptyDefs} empty <defs>`);

  // 6. Remove empty <g> groups (repeat until stable — nested empties)
  let emptyGroups = 0;
  let changed = true;
  while (changed) {
    changed = false;
    S.svgEl.querySelectorAll('g').forEach(g => {
      if (g.children.length === 0) { g.remove(); emptyGroups++; changed = true; }
    });
  }
  if (emptyGroups) report.push(`Removed ${emptyGroups} empty <g> group${emptyGroups > 1 ? 's' : ''}`);

  // 7. Remove elements explicitly hidden via presentation attributes
  const hiddenEls = [
    ...S.svgEl.querySelectorAll('[display="none"]'),
    ...S.svgEl.querySelectorAll('[visibility="hidden"]'),
  ];
  // Deduplicate (element could match both)
  const hiddenSet = new Set(hiddenEls);
  hiddenSet.forEach(el => el.remove());
  if (hiddenSet.size) report.push(`Removed ${hiddenSet.size} hidden element${hiddenSet.size > 1 ? 's' : ''} (display:none / visibility:hidden)`);

  // 8. Remove zero-dimension shapes (rect with 0 area, circle/ellipse with 0 radius)
  let zeroCount = 0;
  S.svgEl.querySelectorAll('rect').forEach(el => {
    if (parseFloat(el.getAttribute('width') || '1') <= 0 ||
        parseFloat(el.getAttribute('height') || '1') <= 0) { el.remove(); zeroCount++; }
  });
  S.svgEl.querySelectorAll('circle').forEach(el => {
    if (parseFloat(el.getAttribute('r') || '1') <= 0) { el.remove(); zeroCount++; }
  });
  S.svgEl.querySelectorAll('ellipse').forEach(el => {
    if (parseFloat(el.getAttribute('rx') || el.getAttribute('r') || '1') <= 0 ||
        parseFloat(el.getAttribute('ry') || el.getAttribute('r') || '1') <= 0) { el.remove(); zeroCount++; }
  });
  if (zeroCount) report.push(`Removed ${zeroCount} zero-dimension shape${zeroCount > 1 ? 's' : ''}`);

  // 9. Strip redundant xmlns="..." on child elements (serializer adds them sometimes)
  let redundantXmlns = 0;
  S.svgEl.querySelectorAll('*').forEach(el => {
    if (el.hasAttribute('xmlns')) { el.removeAttribute('xmlns'); redundantXmlns++; }
  });
  if (redundantXmlns) report.push(`Removed ${redundantXmlns} redundant xmlns declaration${redundantXmlns > 1 ? 's' : ''} on child elements`);

  if (report.length === 0) {
    showToast('SVG is already clean ✓');
    return;
  }

  S.selectedEl = null;
  refreshOverlay(); refreshProps(); refreshLayers(); refreshElemCount();
  saveSnap(); scheduleCMSync();
  showCleanReport(report);
};

function showCleanReport(items) {
  document.getElementById('clean-report-list').innerHTML = items.map(item =>
    `<li class="flex items-start gap-2 text-sm text-gray-600">
      <i class="fa-solid fa-check text-orange-400 text-xs mt-0.5 w-3 shrink-0"></i>
      <span>${item}</span>
    </li>`
  ).join('');
  document.getElementById('clean-modal').classList.remove('hidden');
}

window.closeCleanModal = () => document.getElementById('clean-modal').classList.add('hidden');

// ─── Tool selection ────────────────────────────────────────────────────────────
window.setTool = function setTool(tool) {
  S.tool = tool;
  document.querySelectorAll('.tool-btn[id^="tool-"]').forEach(b => b.classList.remove('active'));
  document.getElementById(`tool-${tool}`)?.classList.add('active');
  $canvas.style.cursor = tool === 'select' ? 'default' : 'crosshair';
};

// ─── Panel tabs ────────────────────────────────────────────────────────────────
window.showTab = name => {
  document.getElementById('panel-properties').classList.toggle('hidden', name !== 'properties');
  document.getElementById('panel-layers').classList.toggle('hidden',     name !== 'layers');
  const on  = 'flex-1 py-2.5 text-xs font-semibold text-orange-600 border-b-2 border-orange-500';
  const off = 'flex-1 py-2.5 text-xs font-semibold text-gray-400 border-b-2 border-transparent hover:text-gray-600 transition-colors';
  document.getElementById('tab-properties').className = name === 'properties' ? on : off;
  document.getElementById('tab-layers').className     = name === 'layers'     ? on : off;
  // Re-render layers tree when switching to it — keeps inline attr editor in sync
  if (name === 'layers') refreshLayers();
};

// ─── Export ───────────────────────────────────────────────────────────────────
window.doExportSVG = () => {
  if (!S.svgEl) return;
  const src  = new XMLSerializer().serializeToString(S.svgEl);
  dl(URL.createObjectURL(new Blob([src], { type: 'image/svg+xml' })), S.filename.replace(/\.svg$/i,'') + '.svg');
  toggleExportMenu();
};

window.showPNGModal = () => {
  document.getElementById('png-modal').classList.remove('hidden');
  toggleExportMenu();
};

window.closePNGModal = () => document.getElementById('png-modal').classList.add('hidden');

window.setPNGScale = scale => {
  S.pngScale = scale;
  document.querySelectorAll('.scale-btn').forEach(b => {
    const active = parseInt(b.dataset.scale) === scale;
    b.className = `scale-btn flex-1 py-2 rounded-lg border text-sm transition-colors ${active ? 'bg-orange-50 border-orange-300 text-orange-700 font-semibold' : 'text-gray-600 hover:bg-orange-50'}`;
  });
};

window.doExportPNG = () => {
  if (!S.svgEl) return;
  const src = new XMLSerializer().serializeToString(S.svgEl);
  const url = URL.createObjectURL(new Blob([src], { type: 'image/svg+xml;charset=utf-8' }));
  const img = new Image();
  const w   = parseFloat(S.svgEl.getAttribute('width')  || '400');
  const h   = parseFloat(S.svgEl.getAttribute('height') || '300');
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width  = w * S.pngScale;
    c.height = h * S.pngScale;
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    c.toBlob(blob => { dl(URL.createObjectURL(blob), S.filename.replace(/\.svg$/i,'') + '.png'); URL.revokeObjectURL(url); }, 'image/png');
  };
  img.src = url;
  closePNGModal();
};

window.doCopyCode = () => {
  if (!S.svgEl) return;
  navigator.clipboard.writeText(fmtXML(new XMLSerializer().serializeToString(S.svgEl)))
    .then(() => showToast('SVG code copied!'));
  toggleExportMenu();
};

window.toggleExportMenu = () => document.getElementById('export-menu').classList.toggle('hidden');
document.addEventListener('click', e => {
  if (!document.getElementById('export-wrap').contains(e.target))
    document.getElementById('export-menu').classList.add('hidden');
});

// ─── File handling ─────────────────────────────────────────────────────────────
window.togglePasteArea = () => document.getElementById('paste-area').classList.toggle('hidden');

window.loadFromPaste = () => {
  const v = document.getElementById('paste-input').value.trim();
  if (v) loadSVG(v, 'pasted.svg');
};

window.closeFile = () => {
  $workspace.classList.add('hidden');
  $upload.classList.remove('hidden');
  S.svgEl = null; S.selectedEl = null;
  $wrapper.innerHTML = '';
};

const dropZone = document.getElementById('drop-zone');
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('border-orange-400','bg-orange-50/40'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('border-orange-400','bg-orange-50/40'));
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('border-orange-400','bg-orange-50/40');
  if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]);
});
document.getElementById('file-input').addEventListener('change', e => { if (e.target.files[0]) readFile(e.target.files[0]); });

function readFile(file) {
  const r = new FileReader();
  r.onload = ev => loadSVG(ev.target.result, file.name);
  r.readAsText(file);
}

// ─── Keyboard shortcuts ────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (document.activeElement?.closest('.cm-editor')) return;
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); return; }
  if (e.key === 'v' || e.key === 'V') setTool('select');
  if (e.key === 'r' || e.key === 'R') setTool('rect');
  if (e.key === 'c' || e.key === 'C') setTool('circle');
  if (e.key === 'l' || e.key === 'L') setTool('line');
  if (e.key === 't' || e.key === 'T') setTool('text');
  if (e.key === 'Delete' || e.key === 'Backspace') doDeleteSelected();
  if (e.key === 'Escape') { selectEl(null); setTool('select'); }
});

// Ctrl+Enter in CodeMirror applies changes to canvas
document.getElementById('cm-host').addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); doApplyCode(); }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function htmlEsc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function mkSVG(tag) { return document.createElementNS(NS, tag); }

function setAttrs(el, attrs) {
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
}

function parseAttr(el, attr) {
  const v = el.getAttribute(attr);
  return v !== null ? parseFloat(v) : null;
}

function f(n) { return parseFloat(n.toFixed(2)); }

function rgb2hex(rgb) {
  const m = rgb.match(/\d+/g);
  if (!m) return '#000000';
  return '#' + m.slice(0,3).map(n => parseInt(n).toString(16).padStart(2,'0')).join('');
}

function fmtXML(xml) {
  let depth = 0;
  return xml
    .replace(/></g, '>\n<')
    .split('\n')
    .map(line => {
      line = line.trim();
      if (!line) return '';
      if (line.startsWith('</')) depth = Math.max(0, depth - 1);
      const out = '  '.repeat(depth) + line;
      if (line.startsWith('<') && !line.startsWith('</') && !line.endsWith('/>') &&
          !line.startsWith('<?') && !line.startsWith('<!--')) depth++;
      return out;
    })
    .filter(Boolean)
    .join('\n');
}

function dl(href, name) {
  const a = document.createElement('a');
  a.href = href; a.download = name; a.click();
}

function showToast(msg, type = 'success') {
  if (window.BangUtils?.UIManager?.showToast) { BangUtils.UIManager.showToast(msg); return; }
  const t = document.createElement('div');
  t.className = `fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl shadow-lg text-sm font-medium text-white z-50 transition-opacity ${type === 'error' ? 'bg-red-500' : 'bg-orange-500'}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 2200);
}

function refreshElemCount() {
  if (!S.svgEl) { $elemCount.textContent = ''; return; }
  const n = S.svgEl.querySelectorAll('*').length;
  $elemCount.textContent = n + ' element' + (n !== 1 ? 's' : '');
}
