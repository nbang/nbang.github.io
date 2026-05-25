/**
 * Cat-2-Map Application Logic
 * 
 * Features:
 * - VN-2000 Coordinate System Support
 * - DXF Parsing & Rendering
 * - GeoJSON/KML Export
 */

// --- Constants & Data ---

// List of Vietnamese provinces and their central meridians (VN-2000)
// Updated to reflect the 34 provincial-level units after the 2025 administrative
// merger (effective June 12, 2025, per National Assembly Resolution – 15th session).
// CMs are estimated from constituent province geographic centers; await official
// MONRE/TT-BTNMT update for final authoritative zone assignments.
const PROVINCE_MERIDIANS = [
    // 6 Centrally Governed Cities
    { name: "Hà Nội", cm: 105 },                    // unchanged
    { name: "Hải Phòng", cm: 105.75 },              // + Hải Dương
    { name: "Đà Nẵng", cm: 107.75 },                // + Quảng Nam
    { name: "Huế", cm: 107 },                        // formerly Thừa Thiên Huế, unchanged
    { name: "TP. Hồ Chí Minh", cm: 106.5 },         // + Bình Dương + Bà Rịa - Vũng Tàu
    { name: "Cần Thơ", cm: 105 },                    // + Hậu Giang + Sóc Trăng
    // 28 Provinces
    { name: "Cao Bằng", cm: 105.5 },                // unchanged
    { name: "Lạng Sơn", cm: 107.25 },               // unchanged
    { name: "Quảng Ninh", cm: 107.75 },             // unchanged
    { name: "Lai Châu", cm: 103 },                   // unchanged
    { name: "Điện Biên", cm: 103 },                  // unchanged
    { name: "Sơn La", cm: 104 },                     // unchanged
    { name: "Tuyên Quang", cm: 105 },                // + Hà Giang
    { name: "Lào Cai", cm: 104.75 },                 // + Yên Bái
    { name: "Thái Nguyên", cm: 106.25 },             // + Bắc Kạn
    { name: "Phú Thọ", cm: 105.5 },                  // + Vĩnh Phúc + Hòa Bình
    { name: "Bắc Ninh", cm: 106.5 },                 // + Bắc Giang
    { name: "Hưng Yên", cm: 105.5 },                 // + Thái Bình
    { name: "Thanh Hóa", cm: 105 },                  // unchanged
    { name: "Nghệ An", cm: 104.75 },                 // unchanged
    { name: "Hà Tĩnh", cm: 105.5 },                  // unchanged
    { name: "Ninh Bình", cm: 105 },                  // + Hà Nam + Nam Định
    { name: "Quảng Trị", cm: 106.25 },               // + Quảng Bình
    { name: "Quảng Ngãi", cm: 108 },                 // + Kon Tum
    { name: "Gia Lai", cm: 108.25 },                 // + Bình Định
    { name: "Đắk Lắk", cm: 108.5 },                 // + Phú Yên
    { name: "Khánh Hòa", cm: 108.25 },              // + Ninh Thuận
    { name: "Lâm Đồng", cm: 108.25 },               // + Bình Thuận + Đắk Nông
    { name: "Đồng Nai", cm: 107 },                   // + Bình Phước
    { name: "Tây Ninh", cm: 105.75 },                // + Long An
    { name: "An Giang", cm: 104.5 },                 // + Kiên Giang
    { name: "Đồng Tháp", cm: 105.5 },               // + Tiền Giang
    { name: "Vĩnh Long", cm: 105.75 },               // + Bến Tre + Trà Vinh
    { name: "Cà Mau", cm: 104.75 },                  // + Bạc Liêu
].sort((a, b) => a.name.localeCompare(b.name));

// --- State Management ---
const AppState = {
    geoJsonData: null,
    layers: new Map(), // name -> L.layerGroup
    map: null
};

// --- Initialization ---

function initMap() {
    // Basic Leaflet Map with Google Hybrid look-alike (using Esri or similar free satellite provider)
    // Note: Google Tiles require API Key or specific URL patterns. Using Esri Satellite as a reliable alternative.

    const map = L.map('map', {
        zoomControl: false,
        attributionControl: false
    }).setView([16.0, 106.0], 6); // Center of Vietnam

    // Add Base Layers
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
    }).addTo(map);

    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19
    });

    // Layer Control
    L.control.layers({
        "OpenStreetMap": osm,
        "Satellite": satellite
    }, null, { position: 'bottomright' }).addTo(map);

    // Zoom Control Bottom Left
    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    // Scale
    L.control.scale().addTo(map);

    AppState.map = map;
    log("Map initialized.");
}

function initUI() {
    // Populate Province Select
    const select = document.getElementById('provinceSelect');
    PROVINCE_MERIDIANS.forEach(p => {
        const option = document.createElement('option');
        option.value = p.cm;
        option.textContent = `${p.name} (CM ${p.cm})`;
        if (p.name === "TP. Hồ Chí Minh") option.selected = true; // Default
        select.appendChild(option);
    });

    // File Input Listener
    document.getElementById('fileInput').addEventListener('change', handleFileUpload);

    // UI Event Listeners for Export
    document.getElementById('btnExportGeoJSON').addEventListener('click', downloadGeoJSON);
    document.getElementById('btnExportKML').addEventListener('click', downloadKML);

    // Toolbar
    document.getElementById('toolFit').addEventListener('click', fitToData);
}

// --- Logic ---

function getProjString(cm) {
    // VN-2000 Zone 3 degree definition (standard for local CAD)
    // +proj=tmerc +lat_0=0 +lon_0=[CM] +k=0.9999 +x_0=500000 +y_0=0 +ellps=WGS84 +towgs84=-191.90441429,-39.30318279,-111.45032835,-0.00928836,0.01975479,-0.00427372,0.252906278 +units=m +no_defs
    // Note: The towgs84 params are approximate standard parameters for VN2000 in PROJ4 format.
    return `+proj=tmerc +lat_0=0 +lon_0=${cm} +k=0.9999 +x_0=500000 +y_0=0 +ellps=WGS84 +towgs84=-191.90441429,-39.30318279,-111.45032835,-0.00928836,0.01975479,-0.00427372,0.252906278 +units=m +no_defs`;
}

function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Reset
    clearLayers();
    log(`Reading file: ${file.name}...`);
    document.body.classList.add('loading');

    const reader = new FileReader();
    reader.onload = (event) => {
        const text = event.target.result;
        try {
            const parser = new DxfParser();
            const dxf = parser.parseSync(text);
            log(`DXF parsed. Entities: ${dxf.entities.length}`);
            processDxf(dxf);
        } catch (err) {
            log(`Error parsing DXF: ${err.message}`, 'error');
        } finally {
            document.body.classList.remove('loading');
            // clear input
            e.target.value = '';
        }
    };
    reader.onerror = () => log("Reading file failed", 'error');
    reader.readAsText(file);
}

function processDxf(dxf) {
    // 1. Setup Projection
    const cm = parseFloat(document.getElementById('provinceSelect').value);
    const swapXY = document.getElementById('swapXY').checked;
    const fromProj = getProjString(cm);

    log(`Processing with CM ${cm}, SwapXY: ${swapXY}`);

    const geoJsonFeatures = [];
    const layers = {};

    dxf.entities.forEach(entity => {
        // We focus on basic geometries: LINE, LWPOLYLINE, POLYLINE, CIRCLE, POINT
        // TEXT/MTEXT could be added as points with properties?

        let geometry = null;

        // Extract vertices based on type
        // This is a naive implementation; real CAD conversion is complex with blocks etc.
        if (entity.type === 'LINE') {
            const p1 = convertPoint(entity.vertices[0], fromProj, swapXY);
            const p2 = convertPoint(entity.vertices[1], fromProj, swapXY);
            geometry = { type: 'LineString', coordinates: [p1, p2] };
        }
        else if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
            const coords = entity.vertices.map(v => convertPoint(v, fromProj, swapXY));
            if (entity.shape) { // Closed polygon?
                coords.push(coords[0]); // Ensure loop
                geometry = { type: 'Polygon', coordinates: [coords] };
            } else {
                geometry = { type: 'LineString', coordinates: coords };
            }
        }
        else if (entity.type === 'CIRCLE') {
            // Convert center
            const center = convertPoint(entity.center, fromProj, swapXY);
            // Circle in GeoJSON is a Point with radius property (Leaflet can handle it specially, but standard GeoJSON is Point)
            // Or we approximate as polygon
            geometry = { type: 'Point', coordinates: center };
        }
        else if (entity.type === 'POINT') {
            if (entity.position) {
                const p = convertPoint(entity.position, fromProj, swapXY);
                geometry = { type: 'Point', coordinates: p };
            }
        }

        if (geometry) {
            const feature = {
                type: 'Feature',
                properties: {
                    layer: entity.layer || '0',
                    color: entity.color,
                    handle: entity.handle
                },
                geometry: geometry
            };
            geoJsonFeatures.push(feature);

            // Group by layer
            if (!layers[feature.properties.layer]) layers[feature.properties.layer] = [];
            layers[feature.properties.layer].push(feature);
        }
    });

    log(`Converted ${geoJsonFeatures.length} valid features.`);

    // Update State
    AppState.geoJsonData = { type: 'FeatureCollection', features: geoJsonFeatures };

    // Render
    renderToMap(layers);

    // Update Stats
    document.getElementById('featureCount').textContent = geoJsonFeatures.length;
    document.getElementById('projName').textContent = `VN2000 WGS84 (CM ${cm})`;

    // Enable Exports
    document.getElementById('btnExportGeoJSON').disabled = false;
    document.getElementById('btnExportKML').disabled = false;
}

function convertPoint(v, fromProj, swapXY) {
    // VN2000 CAD coords usually: X = North (Vertical), Y = East (Horizontal) ???
    // Actually in Math: X = East, Y = North.
    // In many CAD survey files in VN, they follow the mathematical Axes: X is Easting, Y is Northing.
    // However, sometimes they are swapped (X=North, Y=East) to follow formatting standards.
    // Standard Proj4 expects [x, y].

    let x = v.x;
    let y = v.y;

    if (swapXY) {
        // User indicates the Input CAD has Swapped axes relative to standard [Easting, Northing]
        // Usually this means Input X is actually Northing, Input Y is Easting.
        // Proj4 conversion needs [Easting, Northing].
        const temp = x;
        x = y;
        y = temp;
    }

    return proj4(fromProj, 'EPSG:4326', [x, y]);
}

function renderToMap(layerMap) {
    const map = AppState.map;
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
    let colorIdx = 0;

    const layerListEl = document.getElementById('layerList');
    layerListEl.innerHTML = '';

    // Show layer section
    document.getElementById('layerSection').style.display = 'block';

    Object.keys(layerMap).forEach(layerName => {
        const features = layerMap[layerName];
        const color = colors[colorIdx % colors.length];

        const geoJsonLayer = L.geoJSON(features, {
            style: { color: color, weight: 2 },
            pointToLayer: (feature, latlng) => {
                return L.circleMarker(latlng, { radius: 4, color: color, fillColor: color, fillOpacity: 0.5 });
            }
        }).addTo(map);

        AppState.layers.set(layerName, geoJsonLayer);

        // Add to UI
        const div = document.createElement('div');
        div.className = 'layer-item';
        div.innerHTML = `
            <input type="checkbox" checked onchange="toggleLayer('${layerName}')">
            <div class="layer-color" style="background:${color}"></div>
            <span>${layerName} (${features.length})</span>
        `;
        layerListEl.appendChild(div);

        colorIdx++;
    });

    fitToData();
}

function toggleLayer(name) {
    if (AppState.layers.has(name)) {
        const layer = AppState.layers.get(name);
        if (AppState.map.hasLayer(layer)) {
            AppState.map.removeLayer(layer);
        } else {
            AppState.map.addLayer(layer);
        }
    }
}

function clearLayers() {
    AppState.layers.forEach(l => AppState.map.removeLayer(l));
    AppState.layers.clear();
    AppState.geoJsonData = null;
    document.getElementById('layerList').innerHTML = '';
    document.getElementById('featureCount').textContent = '0';
    document.getElementById('btnExportGeoJSON').disabled = true;
    document.getElementById('btnExportKML').disabled = true;
}

function fitToData() {
    if (AppState.layers.size === 0) return;
    const group = L.featureGroup(Array.from(AppState.layers.values()));
    AppState.map.fitBounds(group.getBounds());
}

// --- Utils ---

function log(msg, type = 'info') {
    const el = document.getElementById('logContainer');
    const div = document.createElement('div');
    div.className = `log-entry ${type}`;
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    el.prepend(div);
}

function downloadGeoJSON() {
    if (!AppState.geoJsonData) return;
    const blob = new Blob([JSON.stringify(AppState.geoJsonData)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "export.geojson";
    a.click();
    log("Downloaded GeoJSON");
}

function downloadKML() {
    if (!AppState.geoJsonData) return;
    // tokml is a global from the library
    try {
        const kml = tokml(AppState.geoJsonData);
        const blob = new Blob([kml], { type: "application/vnd.google-earth.kml+xml" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "export.kml";
        a.click();
        log("Downloaded KML");
    } catch (e) {
        log("KML Export failed: " + e.message, 'error');
    }
}

// --- Boot ---
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initUI();
    log("App initialized.");
});

// Global scope for HTML access
window.toggleLayer = toggleLayer;
