let rawData = [];
let filteredData = [];
let currentSortKey = 'revenue';
let currentSortDirection = 'desc';
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

    // Load and cache dataset, auto-updating in background if json changes on server
    window.BangUtils.fetchJSONWithCache('public-corp-data.json', {
        onUpdate: (updatedData) => {
            console.log('[Cache] public-corp-data.json updated on server. Reloading data dynamically...');
            rawData = updatedData;
            filterTable();
        }
    })
    .then(jsonData => {
        rawData = jsonData;
        filteredData = [...rawData];
        populateFilters();
        setupEventListeners();
        sortAndRender();
    })
    .catch(error => {
        console.error('Error fetching data:', error);
        document.getElementById('dataTableBody').innerHTML = `
            <tr><td colspan="6" class="py-12 text-center text-red-500">Error loading data. The JSON file might not be generated yet.</td></tr>
        `;
    });
});

function populateFilters() {
    const exchangeSet = new Set();
    const sectorSet = new Set();

    rawData.forEach(item => {
        if (item.exchange) exchangeSet.add(item.exchange);
        if (item.sector) sectorSet.add(item.sector);
    });

    const filterExchange = document.getElementById('filterExchange');
    [...exchangeSet].sort().forEach(val => {
        const option = document.createElement('option');
        option.value = val;
        option.textContent = val;
        filterExchange.appendChild(option);
    });

    const filterSector = document.getElementById('filterSector');
    [...sectorSet].sort().forEach(val => {
        const option = document.createElement('option');
        option.value = val;
        option.textContent = val;
        filterSector.appendChild(option);
    });
}

function setupEventListeners() {
    document.getElementById('searchInput').addEventListener('input', debounce(filterTable, 300));
    document.getElementById('filterExchange').addEventListener('change', filterTable);
    document.getElementById('filterSector').addEventListener('change', filterTable);

    document.getElementById('sortCode').addEventListener('click', () => setSort('code'));
    document.getElementById('sortName').addEventListener('click', () => setSort('name'));
    document.getElementById('sortExchange').addEventListener('click', () => setSort('exchange'));
    document.getElementById('sortSector').addEventListener('click', () => setSort('sector'));
    document.getElementById('sortRevenue').addEventListener('click', () => setSort('revenue'));
    document.getElementById('sortProfit').addEventListener('click', () => setSort('netProfit'));
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function setSort(key) {
    if (currentSortKey === key) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortKey = key;
        currentSortDirection = (key === 'revenue' || key === 'netProfit') ? 'desc' : 'asc';
    }
    itemsToShow = 100;
    sortAndRender();
}

function parseNumber(val) {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    return parseFloat(val.toString().replace(/,/g, '').replace(/\./g, '')) || 0;
}

function formatVND(value) {
    if (value === null || value === undefined || value === '-' || value === '') return '-';
    const num = Number(value);
    if (isNaN(num)) return value;
    if (num === 0) return '0';
    
    const isNegative = num < 0;
    const absValue = Math.abs(num);
    
    if (absValue >= 1e9) {
        return `${isNegative ? '-' : ''}${(absValue / 1e9).toLocaleString('vi-VN', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        })} tỷ`;
    } else if (absValue >= 1e6) {
        return `${isNegative ? '-' : ''}${(absValue / 1e6).toLocaleString('vi-VN', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        })} triệu`;
    } else {
        return `${isNegative ? '-' : ''}${absValue.toLocaleString('vi-VN')}`;
    }
}

function sortAndRender() {
    const dir = currentSortDirection;
    const key = currentSortKey;

    filteredData.sort((a, b) => {
        let valA = a[key] || 0;
        let valB = b[key] || 0;

        if (key === 'revenue' || key === 'netProfit') {
            valA = parseNumber(valA);
            valB = parseNumber(valB);
            return dir === 'asc' ? valA - valB : valB - valA;
        }

        return dir === 'asc' 
            ? valA.toString().localeCompare(valB.toString(), 'vi') 
            : valB.toString().localeCompare(valA.toString(), 'vi');
    });

    updateSortIndicators();
    renderTable();
}

function updateSortIndicators() {
    document.querySelectorAll('.sort-indicator').forEach(el => el.textContent = '');
    const map = {
        'code': 'sortCode',
        'name': 'sortName',
        'exchange': 'sortExchange',
        'sector': 'sortSector',
        'revenue': 'sortRevenue',
        'netProfit': 'sortProfit'
    };
    
    const th = document.getElementById(map[currentSortKey]);
    if (th) {
        const ind = th.querySelector('.sort-indicator');
        if (ind) ind.textContent = currentSortDirection === 'asc' ? ' ▲' : ' ▼';
    }
}

function filterTable() {
    const q = document.getElementById('searchInput').value.toLowerCase();
    const exc = document.getElementById('filterExchange').value;
    const sec = document.getElementById('filterSector').value;

    filteredData = rawData.filter(item => {
        const matchQ = !q || (item.code || '').toLowerCase().includes(q) || (item.name || '').toLowerCase().includes(q);
        const matchExc = !exc || item.exchange === exc;
        const matchSec = !sec || item.sector === sec;
        return matchQ && matchExc && matchSec;
    });

    // Re-apply sort
    const dir = currentSortDirection;
    const key = currentSortKey;
    filteredData.sort((a, b) => {
        let valA = a[key] || 0;
        let valB = b[key] || 0;
        if (key === 'revenue' || key === 'netProfit') {
            valA = parseNumber(valA);
            valB = parseNumber(valB);
            return dir === 'asc' ? valA - valB : valB - valA;
        }
        return dir === 'asc' 
            ? valA.toString().localeCompare(valB.toString(), 'vi') 
            : valB.toString().localeCompare(valA.toString(), 'vi');
    });

    itemsToShow = 100;
    renderTable();
}

function renderTable() {
    const tbody = document.getElementById('dataTableBody');
    tbody.innerHTML = '';
    
    document.getElementById('recordCount').textContent = filteredData.length.toLocaleString();

    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-gray-500">No records found.</td></tr>`;
        const container = document.getElementById('loadMoreContainer');
        if (container) container.classList.add('hidden');
        return;
    }

    const fragment = document.createDocumentFragment();
    
    // Slice to only render the visible chunk
    const visibleData = filteredData.slice(0, itemsToShow);
    
    visibleData.forEach(item => {
        const tr = document.createElement('tr');
        
        const profit = parseNumber(item.netProfit);
        let bgClass = 'hover:bg-gray-50 transition-colors cursor-pointer';
        if (profit > 0) bgClass += ' bg-green-50/10';
        else if (profit < 0) bgClass += ' bg-red-50/20';

        tr.className = bgClass;
        
        tr.innerHTML = `
            <td class="py-3 px-6 font-mono text-emerald-700 font-semibold">
                <a href="public-corp-detail.html?code=${item.code || ''}" class="hover:underline text-emerald-600 hover:text-emerald-800 transition-colors">${item.code || '-'}</a>
            </td>
            <td class="py-3 px-6">
                <a href="public-corp-detail.html?code=${item.code || ''}" class="text-gray-900 hover:text-emerald-700 transition-colors font-medium block truncate max-w-[250px]" title="${item.name}">${item.name || '-'}</a>
            </td>
            <td class="py-3 px-6"><span class="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">${item.exchange || '-'}</span></td>
            <td class="py-3 px-6 text-gray-600 truncate max-w-[150px]" title="${item.sector}">${item.sector || '-'}</td>
            <td class="py-3 px-6 text-right font-medium">${formatVND(item.revenue)}</td>
            <td class="py-3 px-6 text-right font-medium ${profit < 0 ? 'text-red-600' : 'text-gray-800'}">${formatVND(item.netProfit)}</td>
        `;
        
        // Also allow clicking anywhere on the row to navigate, except if clicking an actual link/button
        tr.addEventListener('click', (e) => {
            if (e.target.tagName !== 'A') {
                window.location.href = `public-corp-detail.html?code=${item.code || ''}`;
            }
        });

        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);

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
