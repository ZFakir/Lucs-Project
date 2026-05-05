


// ==========================================
// 1. GLOBAL STATE
// ==========================================
let currentSelection = { type: 'province', ids: { provinceId: 1 } }; 
let currentFilteredReports = []; // Stores the reports currently matching the date filter
let MunicipalityMap={};
let dashboardMap = null;   // 🚨 NEW: Global map instance
let pinLayerGroup = null;  // 🚨 NEW: Stores the pins so we can clear them easily




// ==========================================
// 2. THE MAP CLICK HANDLER
// ==========================================

const provinceFullNameToId = {
    'Gauteng': 1, 
    'Western Cape': 2, 
    'Eastern Cape': 3,
    'Northern Cape': 4,
    'Nothern Cape':4, //Can't fucking beleive this
    'Free State': 5,
    'KwaZulu-Natal': 6, 
    'North West': 7,
    'Mpumalanga': 8, 
    'Limpopo': 9
};

function onMapClick(type, ids) {
    currentSelection = { type, ids };
    
    const radios = document.querySelectorAll('input[name="granularity"]');
    radios.forEach(radio => {
        // Updated to handle "Provincial" vs "province"
        const label = radio.nextElementSibling.textContent.trim().toLowerCase();
        if (label.includes(type.substring(0, 4))) radio.checked = true;
    });

    fetchDashboardData();
}

// ==========================================
// 3. TIMEFRAME & FETCH LOGIC
// ==========================================
function getDateRange() {
    const selectedTime = document.querySelector('input[name="timeframe"]:checked').nextElementSibling.textContent.trim();
    const endDate = new Date();
    const startDate = new Date();

    if (selectedTime === '24h') {
        startDate.setHours(startDate.getHours() - 24);
    } else if (selectedTime === '7 Days') {
        startDate.setDate(startDate.getDate() - 7);
    } else if (selectedTime === '30 Days') {
        startDate.setDate(startDate.getDate() - 30);
    }

    return {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0]
    };
}
async function buildMunicipalityMapOuter(){
    MunicipalityMap= await buildMunicipalityMap();

    // 2. Count how many items are in it
    const mapSize = Object.keys(MunicipalityMap).length;
    
    // 3. Print the results!
    console.log(`✅ Dictionary Loaded! Found ${mapSize} municipalities.`);
    
    // 4. Draw the actual data as a table
    console.table(MunicipalityMap);
}

async function fetchDashboardData() {
    const { start, end } = getDateRange();
    const { type, ids } = currentSelection;
    let url = '';

// Route selection based on map click
    if (type === 'ward') {
        url = `/api/sandbox/ward/${ids.municipalityId}/${ids.wardId}?startDate=${start}&endDate=${end}`;
    } else if (type === 'municipality') {
        url = `/api/sandbox/municipality/${ids.municipalityId}?startDate=${start}&endDate=${end}`;
    } else if (type === 'province') {
        url = `/api/sandbox/province/${ids.provinceId}?startDate=${start}&endDate=${end}`;
    }

    try {
        console.log(url);
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        const reports = await response.json();
        console.log(reports);
        updateUI(reports,start,end);
    } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        // Show error in UI
        document.getElementById('req-volume-count').textContent = "Error";
        document.getElementById('res-volume-count').textContent = "Error";
    }
}

// ==========================================
// 4. UI UPDATER
// ==========================================
function updateUI(reports, startDateStr, endDateStr) {
    // 1. Convert the dates so we can compare them
    const start = new Date(startDateStr).getTime();
    const endObj = new Date(endDateStr);
    endObj.setHours(23, 59, 59, 999);
    const end = endObj.getTime();

    // 2. Build the combined list for the Modal (Created OR Resolved in this window)
    currentFilteredReports = reports.filter(report => {
        const cTime = report.CreatedAt ? new Date(report.CreatedAt).getTime() : 0;
        const rTime = report.DateFulfilled ? new Date(report.DateFulfilled).getTime() : 0;
        
        const createdInWindow = cTime >= start && cTime <= end;
        const resolvedInWindow = rTime >= start && rTime <= end;
        
        return createdInWindow || resolvedInWindow;
    });

    // 3. Count Requests (Was it CREATED in this window?)
    const totalRequests = reports.filter(report => {
        if (!report.CreatedAt) return false;
        const time = new Date(report.CreatedAt).getTime();
        return time >= start && time <= end;
    }).length;

    // 4. Count Resolutions (Was it RESOLVED in this window?)
    const resolvedRequests = reports.filter(report => {
        if ((report.Progress || '').toLowerCase() !== 'resolved' || !report.DateFulfilled) return false;
        const time = new Date(report.DateFulfilled).getTime();
        return time >= start && time <= end;
    }).length;

    // Avoid division by zero for the efficiency ring
    const resolutionRate = totalRequests === 0 ? 0 : Math.round((resolvedRequests / totalRequests) * 100);
    // Update Text Fields
    document.getElementById('req-volume-count').textContent = formatNumber(totalRequests);
    document.getElementById('res-volume-count').textContent = formatNumber(resolvedRequests);
    document.getElementById('res-rate-text').textContent = `${resolutionRate}%`;

    // Update SVG Circle
    const circle = document.getElementById('res-rate-circle');
    const dashOffset = 402.12 - ((402.12 * resolutionRate) / 100);
    circle.style.strokeDashoffset = dashOffset;
    circle.style.transition = 'stroke-dashoffset 1s ease-in-out';
    
    // Update Bar Charts
    updateBarCharts(reports, startDateStr, endDateStr);

    drawPinsOnMap(currentFilteredReports);
}
// ==========================================
// 6. BAR CHART GENERATOR
// ==========================================
function updateBarCharts(reports, startDateStr, endDateStr) {
    const numBuckets = 7; // Matches the 7 visual bars you had in your design
    const reqCounts = new Array(numBuckets).fill(0);
    const resCounts = new Array(numBuckets).fill(0);

    // Convert string dates back to timestamps
    const startObj = new Date(startDateStr);
    const endObj = new Date(endDateStr);
    endObj.setHours(23, 59, 59, 999); // Stretch to midnight
    
    const start = startObj.getTime();
    const end = endObj.getTime();
    const timeSpan = end - start || 1; // Avoid division by zero

    reports.forEach(report => {
        // 1. Bucket the Requests (When was it reported?)
        if (report.CreatedAt) {
            const createdTime = new Date(report.CreatedAt).getTime();
            if (createdTime >= start && createdTime <= end) {
                // Calculate which of the 7 buckets this timestamp falls into
                let bucketIndex = Math.floor(((createdTime - start) / timeSpan) * numBuckets);
                if (bucketIndex >= numBuckets) bucketIndex = numBuckets - 1; // Cap to max index
                if (bucketIndex >= 0) reqCounts[bucketIndex]++;
            }
        }

        // 2. Bucket the Resolutions (When was it fixed?)
        if ((report.Progress || '').toLowerCase() === 'resolved' && report.DateFulfilled) {
            const resolvedTime = new Date(report.DateFulfilled).getTime();
            if (resolvedTime >= start && resolvedTime <= end) {
                let bucketIndex = Math.floor(((resolvedTime - start) / timeSpan) * numBuckets);
                if (bucketIndex >= numBuckets) bucketIndex = numBuckets - 1;
                if (bucketIndex >= 0) resCounts[bucketIndex]++;
            }
        }
    });

    // Render both charts
    renderChart('req-chart-container', reqCounts);
    renderChart('res-chart-container', resCounts);
}

function renderChart(containerId, dataArr) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = ''; // Wipe previous chart
    
    // Find the highest value to scale the bars from 0% to 100%
    const maxVal = Math.max(...dataArr) || 1; 
    
    dataArr.forEach(val => {
        const span = document.createElement('span');
        
        // If there is data, use orange. If 0, use the dark gray container color.
        const bgClass = val > 0 ? 'bg-primary-container' : 'bg-surface-container-highest';
        span.className = `flex-1 ${bgClass} rounded-t-sm transition-all duration-700 ease-out hover:opacity-80`;
        
        // Calculate height. If 0, give it a tiny 5% height so the bar is still visible on the baseline
        const heightPct = val === 0 ? 5 : (val / maxVal) * 100;
        span.style.height = `${heightPct}%`;
        
        // Add a tooltip so hovering over the bar shows the exact number!
        span.title = `${val} reports`;
        
        container.appendChild(span);
    });
}

function formatNumber(num) {
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return num;
}




const normalizeName = (name) => {
    if (!name) return "";
    return name.toLowerCase()
        .replace(/ metropolitan municipality/g, '')
        .replace(/ local municipality/g, '')
        .replace(/ district municipality/g, '')
        .replace(/-/g, ' ') 
        .trim();
};
// 2. Initialize the empty Map

async function buildMunicipalityMap() {
    try {
        const response = await fetch('/api/sandbox/municipality-map');
        console.log(response.body);
        if (!response.ok) throw new Error("Failed to fetch map");
        
        const mapData = await response.json();
        return mapData;
    } catch (error) {
        console.error("Error loading municipality map:", error);
        return {};
    }
}

// ==========================================
// 5. INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Existing Timeframe Logic
   buildMunicipalityMapOuter();
    const timeRadios = document.querySelectorAll('input[name="timeframe"]');
    timeRadios.forEach(radio => {
        radio.addEventListener('change', fetchDashboardData);
    });

   // 2. Instantiate the modular map (Starting with Provinces!)
   //Fetches only from data from provincial.json I think but then why does it work?
   //THIS DOES NOT FUCKING WORK

    dashboardMap = new CivicMap(
        'map', 
        'data/sa_provincial.json', // <-- Removed the leading slash, updated filename
        (data) => {
            if (data.wardId) {
                //Municipality Require mapping
                console.log(data);
                onMapClick('ward', { wardId: data.wardId, municipalityId: MunicipalityMap[normalizeName(data.muniId)]});
            } else if (data.muniId) {
                console.log(MunicipalityMap);//GivesBackName, needs mapping
                onMapClick('municipality', { municipalityId: MunicipalityMap[normalizeName(data.muniId)] });
            } else {
                console.log(data.name);
                console.log(provinceFullNameToId[data.name]);
                onMapClick('province', { provinceId: provinceFullNameToId[data.name] });
            }
        }
    );

    // 3. Connect the Granularity Radio Buttons
    const granularityRadios = document.querySelectorAll('input[name="granularity"]');
    granularityRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const label = e.target.nextElementSibling.textContent.trim().toLowerCase();
            
            // Swap the map data based on what they clicked
            if (label === 'provincial') {
                dashboardMap.loadNewLayer('data/sa_provincial.json'); // <-- Relative path
            } else if (label === 'ward') {
                dashboardMap.loadNewLayer('data/sa_wards.json');      // <-- Relative path
            } else if (label === 'municipal') {
                dashboardMap.loadNewLayer('data/sa_municipal.json');  // <-- Relative path
            }
            dashboardMap.map.removeLayer(pinLayerGroup);
        });
    });
    document.getElementById('zoom-in-btn').addEventListener('click', () => dashboardMap.zoomIn());
    document.getElementById('zoom-out-btn').addEventListener('click', () => dashboardMap.zoomOut());
    fetchDashboardData(); 
    const pdfExporter = new DashboardExporter('export-pdf-btn', 'main', 'Request_Volume_Report');
});
// ==========================================
// 7. LEDGER MODAL LOGIC
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('ledger-modal');
    const openBtn = document.getElementById('view-ledger-btn');
    const closeBtn = document.getElementById('close-ledger-btn');

    // Open Modal
    openBtn.addEventListener('click', () => {
        renderLedgerTable(currentFilteredReports);
        modal.showModal();
    });

    // Close Modal
    closeBtn.addEventListener('click', () => modal.close());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.close(); // Close if clicking outside the box
    });
});

function renderLedgerTable(reports) {
    const tbody = document.getElementById('ledger-table-body');
    tbody.innerHTML = ''; 

    if (reports.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="px-8 py-6 text-center text-on-surface-variant font-bold">No issues found for this period.</td></tr>`;
        return;
    }

    reports.forEach(report => {
        let statusBadge = ''; 
        const progressStr = (report.Progress || '').toLowerCase(); 
        
        if (progressStr === 'resolved') {
            statusBadge = `<span class="px-3 py-1 bg-surface-container-highest text-on-surface-variant text-[10px] font-black uppercase rounded-full">Resolved</span>`;
        } else if (progressStr === 'in progress' || progressStr === 'assigned to field staff') {
            statusBadge = `<span class="px-3 py-1 bg-[#FF8C00]/20 text-[#FF8C00] border border-[#FF8C00]/40 text-[10px] font-black uppercase rounded-full">In Progress</span>`;
        } else {
            statusBadge = `<span class="px-3 py-1 bg-[#FF8C00] text-[#4d2600] text-[10px] font-black uppercase rounded-full">Active</span>`;
        }

        const iconMap = {
            'pothole': 'road',
            'water leak': 'water_drop',
            'street light': 'lightbulb',
            'illegal dumping': 'delete',
            'electricity': 'bolt',
            'sanitation': 'recycling'
        };
        const typeStr = (report.Type || '').toLowerCase();
        const icon = iconMap[typeStr] || 'report_problem'; 

        const formattedDate = report.CreatedAt ? new Date(report.CreatedAt).toISOString().split('T')[0] : 'Unknown';

        const tr = document.createElement('tr'); 
        
        // 🚨 NEW PART 1: Added 'cursor-pointer' so the mouse turns into a hand when hovering
        tr.className = 'hover:bg-surface-container-high transition-colors group cursor-pointer';
        
        tr.innerHTML = `
            <td class="px-8 py-4">
                <span class="flex items-center gap-3">
                    <span class="material-symbols-outlined text-[#FF8C00]" style="font-variation-settings: 'FILL' 1;">${icon}</span>
                    <span class="font-bold text-white uppercase tracking-tight">${report.Type || 'General'}</span>
                </span>
            </td>
            <td class="px-8 py-4 text-on-surface-variant font-medium text-sm truncate max-w-[200px]" title="${report.Description || 'No description provided.'}">
                ${report.Description || 'No description provided.'}
            </td>
            <td class="px-8 py-4 text-center">${statusBadge}</td>
            <td class="px-8 py-4 text-right font-mono text-on-surface-variant text-sm">${formattedDate}</td>
        `;
        
        // 🚨 NEW PART 2: We are ADDING the click handler right here!
        // When this specific row is clicked, it feeds its data to the CivicModal class
        tr.onclick = () => {
            openIssueModal(report.ReportID);
        };
        
        tbody.appendChild(tr);
    });
}

//ModalView
// 1. Initialize the modal manager at the top of your file
const issueViewer = new CivicModal();

// 2. Call it in your row click handler
// 🚨 Make sure to add 'async' here
async function openIssueModal(reportId) {
    const report = currentFilteredReports.find(r => r.ReportID === reportId);
    if (!report) return;
    
    let muniName = Object.keys(MunicipalityMap).find(key => MunicipalityMap[key] === report.MunicipalityID);
    if (muniName) {
        muniName = muniName.replace(/\b\w/g, letter => letter.toUpperCase());
    } else {
        muniName = 'Unknown';
    }

    // 🚨 LAZY LOAD THE IMAGES: Ask the backend for photos only when clicked
    let fetchedImages = [];
    try {
        // This hits the route at the bottom of your reports.js file
        const imgRes = await fetch(`/api/reports/report/${report.ReportID}`);
        if (imgRes.ok) {
            fetchedImages = await imgRes.json();
        }
    } catch (error) {
        console.error("Failed to load images for modal:", error);
    }

    issueViewer.open({
        id: report.ReportID,
        type: report.Type,
        description: report.Brief,
        date: report.CreatedAt,
        status: report.Progress,
        ward: report.WardID || report.wardId || 'Unknown',
        municipality: muniName,
        images: fetchedImages // 🚨 Pass the downloaded images to the modal
    });
}
function drawPinsOnMap(reports) {
    if (!dashboardMap || !dashboardMap.map) return;

    // 1. Clear existing pins so they don't pile up on top of each other
    if (pinLayerGroup) {
        dashboardMap.map.removeLayer(pinLayerGroup);
    }
    pinLayerGroup = L.layerGroup().addTo(dashboardMap.map);

    // 2. Loop through the currently filtered reports
    reports.forEach(report => {
        // Skip reports that don't have GPS coordinates
        if (!report.Latitude || !report.Longitude) return;

        // Gray for Resolved, Orange for Active
        const isResolved = (report.Progress || '').toLowerCase() === 'resolved';
        const pinColor = isResolved ? '#808080' : '#FF8C00'; 

        // Create the Leaflet circle marker
        const marker = L.circleMarker([report.Latitude, report.Longitude], {
            radius: 8,
            fillColor: pinColor,
            color: "#FFFFFF",
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9
        }).addTo(pinLayerGroup);

        // Add a nice hover tooltip
        marker.bindTooltip(`<b>${report.Type || 'Issue'}</b><br/>${report.Progress || 'Active'}`, { direction: 'top' });

        // 🚨 Make the pin clickable!
        // We can completely reuse the openIssueModal function you built for the table!
        marker.on('click', () => {
            openIssueModal(report.ReportID);
        });
    });
}
