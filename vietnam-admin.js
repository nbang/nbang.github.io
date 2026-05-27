let data = [];
let filteredData = [];
let currentSortKey = 'code';
let currentSortDirection = 'asc';
let itemsToShow = 100;

document.addEventListener('DOMContentLoaded', () => {
    // Setup Load More button listener
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            itemsToShow += 100;
            renderTable();
        });
    }

    // Fetch and cache vietnam-data.json, auto-updating in background
    window.BangUtils.fetchJSONWithCache('vietnam-data.json', {
        onUpdate: (updatedData) => {
            console.log('[Cache] vietnam-data.json updated on server. Reloading data dynamically...');
            processData(updatedData);
            filterTable();
        }
    })
    .then(jsonData => {
        processData(jsonData);
        populateFilters();
        setupEventListeners();
        sortAndRender();
    })
    .catch(error => {
        console.error('Error fetching vietnam-data.json:', error);
    });
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
    itemsToShow = 100;
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

    itemsToShow = 100;
    renderTable();
}

/**
 * Render the table rows
 */
function renderTable() {
    const tableBody = document.getElementById('dataTableBody');
    tableBody.innerHTML = '';

    if (filteredData.length === 0) {
        const row = tableBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 6;
        cell.textContent = 'Không tìm thấy dữ liệu phù hợp.';
        cell.className = 'px-6 py-4 text-center text-gray-500';
        const container = document.getElementById('loadMoreContainer');
        if (container) container.classList.add('hidden');
    } else {
        // Use documentFragment for performance
        const fragment = document.createDocumentFragment();

        // Render only visible slice
        const visibleData = filteredData.slice(0, itemsToShow);

        visibleData.forEach(item => {
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

        // Show/hide Load More button
        const container = document.getElementById('loadMoreContainer');
        if (container) {
            if (filteredData.length > itemsToShow) {
                container.classList.remove('hidden');
            } else {
                container.classList.add('hidden');
            }
        }
    }

    document.getElementById('recordCount').textContent = filteredData.length.toLocaleString('vi-VN');
}
