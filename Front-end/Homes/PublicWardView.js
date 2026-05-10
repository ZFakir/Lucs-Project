// ==========================================
// 1. GLOBAL STATE
// ==========================================
let currentReports = []; 
let activeReportId = null; 
let mainMap = null; 
let issueModal = null; // 🚨 Reusable modal class

// ==========================================
// 2. PAGE INITIALISATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const wardId = urlParams.get('wardId');

    // Instantiate the CivicModal
    issueModal = new CivicModal();

    if (!wardId) {
        window.location.href = 'GuestDashboard.html';
        return; 
    }

    document.getElementById('ward-title').textContent = `WARD ${wardId}`;

    initMap();
    fetchWardReports(wardId);
    fetchWardDetails(wardId);
});

// ==========================================
// 3. MAP CONTROLLER (Leaflet.js)
// ==========================================
function initMap() {
    mainMap = L.map('ward-map').setView([-26.2041, 28.0473], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        subdomains: 'abcd',
        maxZoom: 19 
    }).addTo(mainMap);
}

function renderMapMarkers(reports) {
    if (!mainMap) return; 

    let bounds = L.latLngBounds(); 
    let validMarkers = 0;

    reports.forEach(report => {
        const lat = report.Latitude || report.latitude;
        const lng = report.Longitude || report.longitude;

        if (lat && lng && parseFloat(lat) !== 0) {
            
            const progressStr = (report.Progress || '').toLowerCase();
            const isResolved = progressStr === 'resolved' || progressStr === 'fixed';
            const markerColor = isResolved ? '#808080' : '#FF8C00'; // Gray or Orange

            const marker = L.circleMarker([lat, lng], {
                radius: 8,
                fillColor: markerColor,
                color: '#ffffff', 
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            }).addTo(mainMap); 

            marker.bindPopup(`
                <b style="color: #000;">${report.Type || 'Issue'}</b><br>
                <span style="color: #333;">${report.Progress || 'Pending'}</span>
            `);

            // 🚨 Use the new modal directly from the map pin!
            marker.on('click', () => openIssueModal(report.ReportID));

            bounds.extend([lat, lng]);
            validMarkers++;
        }
    });

    if (validMarkers > 0) {
        mainMap.fitBounds(bounds, { padding: [50, 50] });
    }
}

// ==========================================
// 4. API FETCH FUNCTIONS
// ==========================================
async function fetchWardReports(wardId) {
    try {
        const response = await fetch(`/api/public/reports/ward/${wardId}`);
        if (!response.ok) throw new Error('Failed to fetch reports');
        
        currentReports = await response.json(); 
        
        renderStats(currentReports);
        renderTable(currentReports);
        renderMapMarkers(currentReports); // Draw pins after fetching

    } catch (error) {
        console.error('Error fetching ward data:', error);
        document.getElementById('reports-table-body').innerHTML = `
            <tr><td colspan="4" class="px-8 py-6 text-center text-red-400 font-bold">Failed to load reports. Please try again later.</td></tr>
        `;
    }
}

async function fetchWardDetails(wardId) {
    try {
        const response = await fetch(`/api/public/geography/wards/${wardId}`);
        if (!response.ok) throw new Error('Failed to fetch ward details');
        
        const ward = await response.json();
        const councillorName = ward.WardCouncillor ? ward.WardCouncillor : 'Unassigned'; 
        document.getElementById('councillor-label').textContent = `Councillor: ${councillorName}`;
    } catch (error) {
        console.error('Error fetching ward details:', error);
        document.getElementById('councillor-label').textContent = 'Civic Transparency View';
    }
}

// ==========================================
// 5. RENDER FUNCTIONS
// ==========================================
function renderStats(reports) {
    const activeReports = reports.filter(r => {
        const p = (r.Progress || '').toLowerCase();
        return p !== 'resolved' && p !== 'fixed';
    });
    
    const resolvedReports = reports.filter(r => {
        const p = (r.Progress || '').toLowerCase();
        return p === 'resolved' || p === 'fixed';
    });

    document.getElementById('active-count').textContent = activeReports.length;
    document.getElementById('resolved-count').textContent = resolvedReports.length;
}

function renderTable(reports) {
    const tbody = document.getElementById('reports-table-body');
    tbody.innerHTML = ''; 

    if (reports.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="px-8 py-6 text-center text-on-surface-variant font-bold">No public issues reported for this ward.</td></tr>`;
        return; 
    }

    reports.forEach(report => {
        let statusBadge = ''; 
        const progressStr = (report.Progress || '').toLowerCase(); 
        
        if (progressStr === 'resolved' || progressStr === 'fixed') {
            statusBadge = `<span class="px-3 py-1 bg-surface-container-highest text-on-surface-variant text-[10px] font-black uppercase rounded-full">Resolved</span>`;
        } else if (progressStr === 'in progress' || progressStr === 'assigned to field staff') {
            statusBadge = `<span class="px-3 py-1 bg-[#FF8C00]/20 text-[#FF8C00] border border-[#FF8C00]/40 text-[10px] font-black uppercase rounded-full">In Progress</span>`;
        } else {
            statusBadge = `<span class="px-3 py-1 bg-[#FF8C00] text-on-primary text-[10px] font-black uppercase rounded-full">Active</span>`;
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
        tr.className = 'hover:bg-surface-container-high transition-colors group cursor-pointer';
        tr.innerHTML = `
            <td class="px-8 py-6">
                <span class="flex items-center gap-3">
                    <span class="material-symbols-outlined text-[#FF8C00]" style="font-variation-settings: 'FILL' 1;">${icon}</span>
                    <span class="font-bold text-white uppercase tracking-tight">${report.Type || 'General'}</span>
                </span>
            </td>
            <td class="px-8 py-6 text-center">${statusBadge}</td>
            <td class="px-8 py-6 text-right font-mono text-on-surface-variant text-sm">${formattedDate}</td>
        `;
        
        // 🚨 Clicking the table row opens the modal
        tr.onclick = () => openIssueModal(report.ReportID);
        tbody.appendChild(tr);
    });
}

// ==========================================
// 6. MODAL CONTROLLER
// ==========================================
async function openIssueModal(reportId) {
    const report = currentReports.find(r => r.ReportID === reportId);
    if (!report) return;

    activeReportId = reportId;

    const modalData = {
        id: report.ReportID,
        type: report.Type,
        description: report.Brief || report.Progress || 'No description provided.',
        date: report.CreatedAt,
        status: report.Progress || report.Status,
        ward: report.WardID || report.wardId || 'Unknown',
        municipality: "Local Municipality" // Falls back gracefully since we don't fetch full muni strings here
    };

    // 🚨 Open the newly instantiated CivicModal (fetches images autonomously!)
    await issueModal.open(modalData);
}

// EXPORTS FOR JEST TESTING
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { fetchWardReports, fetchWardDetails, renderStats, renderTable, renderMapMarkers, openIssueModal,initMap, setCurrentReports:(fakeData)=>{currentReports=fakeData;} };
}