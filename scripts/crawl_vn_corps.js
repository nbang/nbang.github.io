import fs from 'fs';
import path from 'path';

const OUTPUT_FILE = path.join(process.cwd(), 'public-corp-data.json');

function formatPhone(phoneString) {
    if (!phoneString || phoneString === '-') return '-';
    let cleaned = phoneString.trim();
    
    // Replace country code (84) or (+84) inside parentheses or leading:
    cleaned = cleaned.replace(/\(84[.-](\d+)\)/g, '(0$1)'); // (84.24) -> (024)
    cleaned = cleaned.replace(/\(84(\d+)\)/g, '(0$1)');      // (8424) -> (024)
    cleaned = cleaned.replace(/^\+84\s*/g, '0');             // +84 -> 0
    cleaned = cleaned.replace(/^84\s*/g, '0');               // 84 -> 0
    
    cleaned = cleaned.replace(/\s+/g, ' ');
    return cleaned;
}

function roundPrecise3(val) {
    if (val === null || val === undefined || isNaN(val) || val === 0) return 0;
    return Number(Number(val).toPrecision(3));
}

function parseAddress(addressString) {
    if (!addressString) return null;
    
    // Split by - or ,
    const parts = addressString.split(/[-|,]/).map(p => p.trim()).filter(Boolean);
    let province = "", ward = "", detail = "";
    
    if (parts.length >= 3) {
        province = parts[parts.length - 1];
        ward = parts[parts.length - 2];
        detail = parts.slice(0, parts.length - 2).join(', ');
    } else if (parts.length === 2) {
        province = parts[1];
        detail = parts[0];
    } else {
        detail = addressString;
    }
    
    // Clean up prefixes for standard matching
    const cleanPrefix = (str) => {
        if (!str) return "";
        let cleaned = str.trim();
        const prefixes = [
            /^[Pp]hường\s+/, /^[Qq]uận\s+/, /^[Hh]uyện\s+/, /^[Tt]hị\s+xã\s+/, /^[Tt]hành\s+phố\s+/, /^[Tt]ỉnh\s+/,
            /^P\.\s*/, /^Q\.\s*/, /^Tx\.\s*/, /^H\.\s*/, /^Tp\.\s*/, /^TP\.\s*/, /^T\.\s*/
        ];
        for (const regex of prefixes) {
            cleaned = cleaned.replace(regex, "");
        }
        return cleaned.trim();
    };

    const cleanWord = (str) => {
        if (!str) return "";
        let cleaned = str.trim();
        if (cleaned.startsWith('P. ') || cleaned.startsWith('p. ')) cleaned = 'Phường ' + cleaned.substring(3);
        else if (cleaned.startsWith('P.') || cleaned.startsWith('p.')) cleaned = 'Phường ' + cleaned.substring(2);
        else if (cleaned.startsWith('X. ') || cleaned.startsWith('x. ')) cleaned = 'Xã ' + cleaned.substring(3);
        else if (cleaned.startsWith('X.') || cleaned.startsWith('x.')) cleaned = 'Xã ' + cleaned.substring(2);
        else if (cleaned.startsWith('Tt. ') || cleaned.startsWith('tt. ') || cleaned.startsWith('TT. ')) cleaned = 'Thị trấn ' + cleaned.substring(4);
        else if (cleaned.startsWith('Tt.') || cleaned.startsWith('tt.') || cleaned.startsWith('TT.')) cleaned = 'Thị trấn ' + cleaned.substring(3);
        return cleaned.trim();
    };

    const cleanProv = cleanPrefix(province);
    
    let standardProvince = province;
    if (cleanProv) {
        const specialCities = ["Hà Nội", "Hồ Chí Minh", "Đà Nẵng", "Hải Phòng", "Cần Thơ"];
        if (specialCities.includes(cleanProv) || cleanProv === "TP.HCM" || cleanProv === "HCM" || cleanProv === "Sài Gòn") {
            if (cleanProv === "TP.HCM" || cleanProv === "HCM" || cleanProv === "Sài Gòn") {
                standardProvince = "Thành phố Hồ Chí Minh";
            } else {
                standardProvince = "Thành phố " + cleanProv;
            }
        } else {
            standardProvince = "Tỉnh " + cleanProv;
        }
    }
    
    return {
        province: standardProvince,
        ward: cleanWord(ward),
        detail: detail,
        raw: addressString
    };
}

function parseLeadership(chairman, ceo) {
    const leadership = [];
    if (chairman && chairman !== '-' && chairman.trim() !== '') {
        leadership.push({ role: "Chairman", name: chairman.trim() });
    }
    if (ceo && ceo !== '-' && ceo.trim() !== '') {
        leadership.push({ role: "CEO", name: ceo.trim() });
    }
    return leadership;
}

function stripHtml(html) {
    if (!html) return "";
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

async function run() {
    console.log("Starting pure Node crawl using dn.aizia.info API (3 Precise Digits & No Chairman/CEO)...");
    
    const allRecords = [];
    const pageSize = 100;
    let page = 1;
    let totalPages = 1;
    
    try {
        do {
            const url = `https://dn.aizia.info/api/companies?page=${page}&pageSize=${pageSize}&sortBy=revenue&sortOrder=desc`;
            console.log(`Fetching page ${page} of ${totalPages || 'unknown'}...`);
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            
            const json = await response.json();
            if (!json.data || !Array.isArray(json.data)) {
                throw new Error("Invalid API response format");
            }
            
            allRecords.push(...json.data);
            
            if (json.pagination) {
                totalPages = json.pagination.totalPages;
            }
            
            page++;
            await new Promise(resolve => setTimeout(resolve, 150));
        } while (page <= totalPages);
        
        console.log(`Fetched a total of ${allRecords.length} companies from API.`);
        
        // Standardize the dataset to match index / detail expectations
        const standardizedData = allRecords.map(item => {
            const marginVal = item.revenue > 0 ? (item.gross_profit / item.revenue * 100) : 0;
            const roeVal = (item.equity > 0 && item.net_profit !== null) ? (item.net_profit / item.equity * 100) : 0;
            const roaVal = (item.total_assets > 0 && item.net_profit !== null) ? (item.net_profit / item.total_assets * 100) : 0;
            
            const peCalculated = (item.net_profit_parent > 0 && item.market_cap > 0) ? (item.market_cap / item.net_profit_parent) : 0;
            const pbCalculated = (item.equity > 0 && item.market_cap > 0) ? (item.market_cap / item.equity) : 0;

            return {
                code: item.symbol || '-',
                name: item.company_name || '-',
                exchange: item.floor || '-',
                sector: item.industry_name || '-',
                revenue: item.revenue || 0,
                netProfit: item.net_profit || 0,
                marketCap: item.market_cap || 0,
                margin: roundPrecise3(marginVal), // Precise 3 digits percentage
                period: item.report_year ? `${item.report_year}` : '2025',
                shortName: item.company_name ? item.company_name.replace(/(Công ty cổ phần|Tập đoàn|Tổng công ty|CTCP|- CTCP)/gi, '').trim() : '-',
                foundedDate: item.founded_date || '-',
                listedDate: item.listed_date || '-',
                charterCapital: item.charter_capital ? item.charter_capital * 1e9 : 0, 
                employees: item.employees || 0, // Raw number of employees (dots removed)
                website: item.website || '-',
                phone: formatPhone(item.phone),
                email: item.email || '-',
                taxCode: item.tax_code || '-',
                companyType: item.company_type || '-',
                description: stripHtml(item.business_desc) || 'Không có mô tả chi tiết cho doanh nghiệp này.',
                address: parseAddress(item.address),
                leadership: parseLeadership(item.chairman, item.ceo),
                roe: roundPrecise3(roeVal), // Precise 3 digits percentage
                roa: roundPrecise3(roaVal), // Precise 3 digits percentage
                eps: item.listed_volume > 0 ? Math.round(item.net_profit_parent / (item.listed_volume * 1e6)) : 0,
                pe: roundPrecise3(peCalculated), // Precise 3 digits PE
                pb: roundPrecise3(pbCalculated)  // Precise 3 digits PB
            };
        });
        
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(standardizedData, null, 2), 'utf-8');
        console.log(`Successfully saved ${standardizedData.length} fully standardized enterprise records to ${OUTPUT_FILE}`);
        
    } catch (e) {
        console.error("Crawl process failed:", e);
        process.exit(1);
    }
}

run();
