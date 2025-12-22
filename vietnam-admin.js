let data = [];
let filteredData = [];
let currentSortKey = 'code';
let currentSortDirection = 'asc';

document.addEventListener('DOMContentLoaded', () => {
    // Use the global variable 'vietnamData' loaded from vietnam-data.js
    if (typeof vietnamData !== 'undefined') {
        processData(vietnamData);
        populateFilters();
        setupEventListeners();
        sortAndRender();
    } else {
        console.error('Error: vietnamData is not defined. Make sure vietnam-data.js is loaded.');
    }
});

/**
 * Flatten the hierarchical data into a single array of ward objects
 */
function processData(rawData) {
    data = [];
    rawData.forEach(province => {
        if (province.wards && Array.isArray(province.wards)) {
            province.wards.forEach(ward => {
                data.push({
                    code: ward.code,
                    name: ward.name,
                    ward_type: ward.ward_type,
                    area: ward.area,
                    population: ward.population,
                    link: ward.link,
                    province_name: province.name,
                    province_code: province.code
                });
            });
        }
    });
    filteredData = [...data];
}

/**
 * Populate filter dropdowns
 */
function populateFilters() {
    const provinceSet = new Set();
    const wardTypeSet = new Set();

    data.forEach(item => {
        if (item.province_name) provinceSet.add(item.province_name);
        if (item.ward_type) wardTypeSet.add(item.ward_type);
    });

    // Sort and populate Province filter
    const sortedProvinces = [...provinceSet].sort((a, b) => a.localeCompare(b, 'vi'));
    const filterProvince = document.getElementById('filterProvince');
    sortedProvinces.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        filterProvince.appendChild(option);
    });

    // Sort and populate Ward Type filter
    const sortedWardTypes = [...wardTypeSet].sort((a, b) => a.localeCompare(b, 'vi'));
    const filterWardType = document.getElementById('filterWardType');
    sortedWardTypes.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        filterWardType.appendChild(option);
    });
}

/**
 * Setup event listeners for filters and sorting
 */
function setupEventListeners() {
    // Filters
    document.getElementById('filterProvince').addEventListener('change', filterTable);
    document.getElementById('filterWardType').addEventListener('change', filterTable);

    // Sorting
    document.getElementById('sortByCode').addEventListener('click', () => setSortKey('code'));
    document.getElementById('sortByName').addEventListener('click', () => setSortKey('name'));
    document.getElementById('sortByWardType').addEventListener('click', () => setSortKey('ward_type'));
    document.getElementById('sortByProvince').addEventListener('click', () => setSortKey('province_name'));
    document.getElementById('sortByArea').addEventListener('click', () => setSortKey('area'));
    document.getElementById('sortByPopulation').addEventListener('click', () => setSortKey('population'));
}

/**
 * Set sort key and direction
 */
function setSortKey(key) {
    if (currentSortKey === key) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortKey = key;
        currentSortDirection = 'asc';
    }
    sortAndRender();
}

/**
 * Update UI sort indicators
 */
function updateSortIndicators() {
    document.querySelectorAll('.sort-indicator').forEach(span => {
        span.textContent = '';
    });

    const indicatorMap = {
        'code': 'sortByCode',
        'name': 'sortByName',
        'ward_type': 'sortByWardType',
        'province_name': 'sortByProvince',
        'area': 'sortByArea',
        'population': 'sortByPopulation'
    };

    const activeThId = indicatorMap[currentSortKey];
    if (activeThId) {
        const thElement = document.getElementById(activeThId);
        const indicator = thElement.querySelector('.sort-indicator');
        if (indicator) {
            indicator.textContent = currentSortDirection === 'asc' ? ' ▲' : ' ▼';
        }
    }
}

/**
 * Sort and render the table
 */
function sortAndRender() {
    const direction = currentSortDirection;
    const key = currentSortKey;

    data.sort((a, b) => {
        let valA = a[key];
        let valB = b[key];

        // Handle numeric values
        if (key === 'area' || key === 'population') {
            valA = parseFloat(valA) || 0;
            valB = parseFloat(valB) || 0;
            return direction === 'asc' ? valA - valB : valB - valA;
        }

        // Handle string values (Vietnamese sort)
        valA = valA || '';
        valB = valB || '';
        return direction === 'asc'
            ? valA.localeCompare(valB, 'vi')
            : valB.localeCompare(valA, 'vi');
    });

    filterTable();
    updateSortIndicators();
}

/**
 * Filter data based on selection
 */
function filterTable() {
    const province = document.getElementById('filterProvince').value;
    const wardType = document.getElementById('filterWardType').value;

    filteredData = data.filter(item => {
        const matchProvince = !province || item.province_name === province;
        const matchWardType = !wardType || item.ward_type === wardType;
        return matchProvince && matchWardType;
    });

    renderTable();
}

/**
 * Render the table rows
 */
function renderTable() {
    const tableBody = document.getElementById('dataTableBody');
    tableBody.innerHTML = '';

    // Optimization: Render only first 200 rows if dataset is huge, or map all.
    // Given 3000+ rows, rendering all might be slow but acceptable for modern browsers.
    // Let's cap at 1000 or paginate? For now, render all but be mindful.
    // Actually, user experience might suffer with 3000 rows.
    // But requirement was "similar to hcm-admin", which renders all.
    // HCM admin likely had fewer rows.
    // Let's implement a simple limit for now or just render all.
    // Rendering 3000 rows is usually 50-100ms. Browsers handle it.

    if (filteredData.length === 0) {
        const row = tableBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 6;
        cell.textContent = 'Không tìm thấy dữ liệu phù hợp.';
        cell.className = 'px-6 py-4 text-center text-gray-500';
    } else {
        // Use documentFragment for performance
        const fragment = document.createDocumentFragment();

        filteredData.forEach(item => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50 transition-colors duration-150';

            const areaText = item.area ? parseFloat(item.area).toLocaleString('vi-VN') : 'N/A';
            const popText = item.population ? parseFloat(item.population).toLocaleString('vi-VN') : 'N/A';

            row.innerHTML = `
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700 font-mono">${item.code}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    <a href="${item.link}" target="_blank" class="text-blue-600 hover:text-blue-800 hover:underline">
                        ${item.name}
                    </a>
                </td>
                <td class="px-6 py-3 whitespace-nowrap text-sm text-gray-700">${item.ward_type}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm text-gray-700">${item.province_name}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm text-gray-700 text-right">${areaText}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm text-gray-700 text-right">${popText}</td>
            `;
            fragment.appendChild(row);
        });
        tableBody.appendChild(fragment);
    }

    document.getElementById('recordCount').textContent = filteredData.length.toLocaleString('vi-VN');
}
