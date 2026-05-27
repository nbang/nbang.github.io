document.addEventListener('DOMContentLoaded', () => {
    // 1. Get the company code from the URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const companyCode = urlParams.get('code');

    if (!companyCode) {
        showError('No enterprise code provided in URL. Please select an enterprise from the dashboard.');
        return;
    }

    // 2. Fetch the corporations dataset with cache support and update-awareness
    window.BangUtils.fetchJSONWithCache('public-corp-data.json', {
        onUpdate: (updatedData) => {
            console.log('[Cache] public-corp-data.json updated on server. Reloading details dynamically...');
            const item = updatedData.find(c => c.code.trim().toUpperCase() === companyCode.trim().toUpperCase());
            if (item) {
                populateEnterpriseDetails(item);
            }
        }
    })
    .then(data => {
        // 3. Find the enterprise by code
        const item = data.find(c => c.code.trim().toUpperCase() === companyCode.trim().toUpperCase());

        if (!item) {
            showError(`Enterprise with code "${companyCode}" was not found in our database.`);
            return;
        }

        // 4. Populate details
        populateEnterpriseDetails(item);
    })
    .catch(error => {
        console.error('Error fetching enterprise details:', error);
        showError('An error occurred while loading the enterprise data. The file might be missing or corrupted.');
    });
});

function showError(messageText) {
    document.getElementById('loadingState').classList.add('hidden');
    const errorState = document.getElementById('errorState');
    errorState.classList.remove('hidden');
    document.getElementById('errorMessage').textContent = messageText;
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

function populateEnterpriseDetails(item) {
    // Basic codes and names
    document.getElementById('companyCodeHeader').textContent = item.code || '-';
    document.getElementById('companyExchangeBadge').textContent = item.exchange || '-';
    document.getElementById('companySectorText').textContent = item.sector || '-';
    document.getElementById('companyFullNameHeader').textContent = item.name || '-';
    document.getElementById('companyShortNameText').textContent = item.shortName || item.name || '-';

    // Set Avatar (Initials from ShortName or Code)
    const avatarBlock = document.getElementById('avatarBlock');
    const initials = (item.shortName || item.code || 'DN')
        .split(' ')
        .map(w => w.charAt(0))
        .slice(0, 2)
        .join('')
        .toUpperCase();
    avatarBlock.textContent = initials;

    // Financial indicators
    document.getElementById('companyMarketCapText').textContent = formatVND(item.marketCap);
    document.getElementById('companyRevenueText').textContent = formatVND(item.revenue);
    document.getElementById('companyPeriodText').textContent = `Dữ liệu tài chính: ${item.period || 'Gần nhất'}`;
    
    // Net profit rendering with colors
    const profitText = document.getElementById('companyProfitText');
    profitText.textContent = formatVND(item.netProfit);
    
    const profitValue = typeof item.netProfit === 'number' ? item.netProfit : parseFloat((item.netProfit || '0').toString().replace(/,/g, '').replace(/\./g, ''));
    const profitValueText = document.getElementById('companyProfitValueText');
    const profitIconContainer = document.getElementById('profitIconContainer');
    
    if (profitValue > 0) {
        profitValueText.className = "text-2xl font-bold text-emerald-600 font-mono";
        if (profitIconContainer) {
            profitIconContainer.className = "w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600";
            profitIconContainer.innerHTML = '<i class="fa-solid fa-arrow-up-right-dots text-xl"></i>';
        }
    } else if (profitValue < 0) {
        profitValueText.className = "text-2xl font-bold text-red-600 font-mono";
        if (profitIconContainer) {
            profitIconContainer.className = "w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-600";
            profitIconContainer.innerHTML = '<i class="fa-solid fa-arrow-trend-down text-xl"></i>';
        }
    } else {
        profitValueText.className = "text-2xl font-bold text-gray-800 font-mono";
        if (profitIconContainer) {
            profitIconContainer.className = "w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-600";
            profitIconContainer.innerHTML = '<i class="fa-solid fa-minus text-xl"></i>';
        }
    }

    document.getElementById('companyMarginText').textContent = typeof item.margin === 'number' ? `${item.margin.toLocaleString('vi-VN')}%` : (item.margin || '-');
    document.getElementById('companyRoeText').textContent = typeof item.roe === 'number' ? `${item.roe.toLocaleString('vi-VN')}%` : (item.roe || '-');

    // Left card overview details
    document.getElementById('companyDescriptionText').textContent = item.description || 'Không có mô tả chi tiết cho doanh nghiệp này.';
    document.getElementById('companyEstablishedText').textContent = item.established || '-';
    document.getElementById('companyListingDateText').textContent = item.listingDate || '-';
    
    // Dynamic leadership rendering
    const leadershipContainer = document.getElementById('leadershipContainer');
    leadershipContainer.innerHTML = '';
    const leadershipList = item.leadership || [];
    // Fallback if script hasn't run yet but item has chairman/ceo
    if (leadershipList.length === 0) {
        if (item.chairman) leadershipList.push({ role: 'Chủ tịch HĐQT', name: item.chairman });
        if (item.ceo) leadershipList.push({ role: 'Tổng Giám Đốc (CEO)', name: item.ceo });
    }
    
    if (leadershipList.length > 0) {
        leadershipList.forEach(l => {
            const row = document.createElement('div');
            row.className = "flex justify-between py-2 border-b border-gray-50";
            
            const roleSpan = document.createElement('span');
            roleSpan.className = "text-gray-500";
            roleSpan.textContent = l.role + ':';
            
            const nameStrong = document.createElement('strong');
            nameStrong.className = "text-gray-800";
            nameStrong.textContent = l.name;
            
            row.appendChild(roleSpan);
            row.appendChild(nameStrong);
            leadershipContainer.appendChild(row);
        });
    } else {
        leadershipContainer.innerHTML = '<div class="flex justify-between py-2 border-b border-gray-50"><span class="text-gray-500">Ban lãnh đạo:</span><strong class="text-gray-800">-</strong></div>';
    }

    // Contact info
    let addressStr = '-';
    if (item.address && typeof item.address === 'object') {
        const parts = [];
        if (item.address.detail) parts.push(item.address.detail);
        if (item.address.ward) parts.push(item.address.ward);
        if (item.address.province) parts.push(item.address.province);
        addressStr = parts.join(', ') || item.address.raw || '-';
    } else if (item.headquarters) {
        addressStr = item.headquarters;
    }
    document.getElementById('companyAddressText').textContent = addressStr;
    document.getElementById('companyPhoneText').textContent = item.phone || '-';
    
    const websiteLink = document.getElementById('companyWebsiteLink');
    if (item.website && item.website !== '-') {
        websiteLink.href = item.website;
        websiteLink.textContent = item.website.replace('https://', '').replace('http://', '').replace('www.', '');
    } else {
        websiteLink.href = '#';
        websiteLink.textContent = '-';
        websiteLink.removeAttribute('target');
        websiteLink.className = "text-gray-500 font-medium";
    }

    // Right side indicators
    document.getElementById('companyEpsText').textContent = typeof item.eps === 'number' ? item.eps.toLocaleString('vi-VN') : (item.eps || '-');
    document.getElementById('companyPeText').textContent = typeof item.pe === 'number' ? item.pe.toLocaleString('vi-VN') : (item.pe || '-');
    document.getElementById('companyPbText').textContent = typeof item.pb === 'number' ? item.pb.toLocaleString('vi-VN') : (item.pb || '-');
    document.getElementById('companyRoaText').textContent = typeof item.roa === 'number' ? `${item.roa.toLocaleString('vi-VN')}%` : (item.roa || '-');

    // Transition elements from loading to showing details
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('detailView').classList.remove('hidden');
}
