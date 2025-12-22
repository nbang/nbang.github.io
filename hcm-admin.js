let data = [];
let filteredData = [];
let currentSortKey = 'Code';
let currentSortDirection = 'asc';

document.addEventListener('DOMContentLoaded', () => {
    // Use the global variable 'hcmData' loaded from data.js
    if (typeof hcmData !== 'undefined') {
        data = hcmData;
        filteredData = [...data];
        populateFilters();
        setupEventListeners();
        sortAndRender();
    } else {
        console.error('Error: hcmData is not defined. Make sure data.js is loaded.');
    }
});

/**
 * Lấy các giá trị duy nhất từ dữ liệu để điền vào bộ lọc
 */
function populateFilters() {
    const loaiDonViSet = new Set();
    const donViCuSet = new Set();
    const tinhTPSet = new Set();

    data.forEach(item => {
        loaiDonViSet.add(item.LoaiDonVi);
        // Tách các giá trị "Đơn Vị Cũ" nếu có dấu phẩy
        item.DonViCu.split(',').forEach(dv => donViCuSet.add(dv.trim()));
        tinhTPSet.add(item.TinhTPCu);
    });

    // Chuyển Set thành mảng đã sắp xếp
    const sortedLoaiDonVi = [...loaiDonViSet].sort((a, b) => a.localeCompare(b, 'vi'));
    const sortedDonViCu = [...donViCuSet].sort((a, b) => a.localeCompare(b, 'vi'));
    const sortedTinhTP = [...tinhTPSet].sort((a, b) => a.localeCompare(b, 'vi'));

    // Điền vào các thẻ <select>
    const filterLoaiDonVi = document.getElementById('filterLoaiDonVi');
    sortedLoaiDonVi.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        filterLoaiDonVi.appendChild(option);
    });

    const filterDonViCu = document.getElementById('filterDonViCu');
    sortedDonViCu.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        filterDonViCu.appendChild(option);
    });

    const filterTinhTP = document.getElementById('filterTinhTP');
    sortedTinhTP.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        filterTinhTP.appendChild(option);
    });
}

/**
 * Thêm các trình nghe sự kiện cho bộ lọc và sắp xếp
 */
function setupEventListeners() {
    // Bộ lọc
    document.getElementById('filterLoaiDonVi').addEventListener('change', filterTable);
    document.getElementById('filterDonViCu').addEventListener('change', filterTable);
    document.getElementById('filterTinhTP').addEventListener('change', filterTable);

    // Sắp xếp
    document.getElementById('sortByCode').addEventListener('click', () => setSortKey('Code'));
    document.getElementById('sortByName').addEventListener('click', () => setSortKey('XaPhuongMoi'));
    document.getElementById('sortByLoaiDonVi').addEventListener('click', () => setSortKey('LoaiDonVi'));
    document.getElementById('sortByArea').addEventListener('click', () => setSortKey('Size'));
}

/**
 * Đặt khóa và hướng sắp xếp mới
 */
function setSortKey(key) {
    if (currentSortKey === key) {
        // Đảo ngược hướng nếu nhấp vào cùng một cột
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        // Đặt khóa mới, mặc định là 'asc'
        currentSortKey = key;
        currentSortDirection = 'asc';
    }
    sortAndRender();
}

/**
 * Cập nhật giao diện các chỉ báo sắp xếp
 */
function updateSortIndicators() {
    // Xóa tất cả chỉ báo
    document.querySelectorAll('.sort-indicator').forEach(span => {
        span.textContent = '';
    });

    const indicatorMap = {
        'Code': 'sortByCode',
        'XaPhuongMoi': 'sortByName',
        'LoaiDonVi': 'sortByLoaiDonVi',
        'Size': 'sortByArea'
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
 * Sắp xếp dữ liệu và render lại bảng
 */
function sortAndRender() {
    const direction = currentSortDirection;
    const key = currentSortKey;

    // Sắp xếp mảng 'data'
    data.sort((a, b) => {
        let valA, valB;

        if (key === 'XaPhuongMoi') {
            valA = a.XaPhuongMoi || '';
            valB = b.XaPhuongMoi || '';
            // Sử dụng 'vi' cho tiếng Việt
            return direction === 'asc'
                ? valA.localeCompare(valB, 'vi')
                : valB.localeCompare(valA, 'vi');

        } else if (key === 'LoaiDonVi') {
            valA = a.LoaiDonVi || '';
            valB = b.LoaiDonVi || '';
            // Sử dụng 'vi' cho tiếng Việt
            return direction === 'asc'
                ? valA.localeCompare(valB, 'vi')
                : valB.localeCompare(valA, 'vi');

        } else if (key === 'Size') {
            // Coi N/A hoặc null là 0
            valA = parseFloat(a.DienTich) || 0; // Đã sửa từ 'Size' thành 'DienTich'
            valB = parseFloat(b.DienTich) || 0; // Đã sửa từ 'Size' thành 'DienTich'
            return direction === 'asc'
                ? valA - valB
                : valB - valA;

        } else if (key === 'Code') {
            // Sắp xếp theo mã (string)
            valA = a.Code || '';
            valB = b.Code || '';
            return direction === 'asc'
                ? valA.localeCompare(valB)
                : valB.localeCompare(valA);
        }
        return 0;
    });

    // Sau khi sắp xếp, áp dụng bộ lọc và render lại
    filterTable();
    // Cập nhật chỉ báo UI
    updateSortIndicators();
}


/**
 * Lọc dữ liệu dựa trên các lựa chọn
 */
function filterTable() {
    const loaiDonVi = document.getElementById('filterLoaiDonVi').value;
    const donViCu = document.getElementById('filterDonViCu').value;
    const tinhTP = document.getElementById('filterTinhTP').value;

    filteredData = data.filter(item => {
        const matchLoaiDonVi = !loaiDonVi || item.LoaiDonVi === loaiDonVi;
        // Kiểm tra xem giá trị 'donViCu' có tồn tại trong chuỗi 'item.DonViCu' hay không
        const matchDonViCu = !donViCu || item.DonViCu.includes(donViCu);
        const matchTinhTP = !tinhTP || item.TinhTPCu === tinhTP;

        return matchLoaiDonVi && matchDonViCu && matchTinhTP;
    });

    renderTable();
}

/**
 * Hiển thị dữ liệu đã lọc (và sắp xếp) ra bảng
 */
function renderTable() {
    const tableBody = document.getElementById('dataTableBody');
    tableBody.innerHTML = ''; // Xóa nội dung cũ

    if (filteredData.length === 0) {
        const row = tableBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 7; // Số lượng cột
        cell.textContent = 'Không tìm thấy dữ liệu phù hợp.';
        cell.className = 'px-6 py-4 text-center text-gray-500';
    } else {
        filteredData.forEach(item => {
            const row = tableBody.insertRow();
            row.className = 'hover:bg-gray-50 transition-colors duration-150';

            // Định dạng giá trị Diện Tích
            let dienTichText = "N/A";
            if (item.DienTich !== null && item.DienTich !== undefined) {
                dienTichText = parseFloat(item.DienTich).toLocaleString('vi-VN');
            }

            row.innerHTML = `
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700 font-mono">${item.Code}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    <a href="${item.Href}" target="_blank" class="text-blue-600 hover:text-blue-800 hover:underline">
                        ${item.XaPhuongMoi}
                    </a>
                </td>
                <td class="px-6 py-3 whitespace-nowrap text-sm text-gray-700">${item.LoaiDonVi}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm text-gray-700 text-right">${dienTichText}</td>
                <td class="px-6 py-3 text-sm text-gray-700">${item.DonViCu}</td>
                <td class="px-6 py-3 text-sm text-gray-700">${item.XaPhuongTruocSapNhap}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm text-gray-700">${item.TinhTPCu}</td>
            `;
        });
    }

    // Cập nhật số lượng bản ghi
    document.getElementById('recordCount').textContent = filteredData.length;
}
