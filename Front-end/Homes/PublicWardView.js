/**
 * PUBLIC WARD VIEW CONTROLLER
 * ---------------------------
 * This script manages the "Public Ledger" interface where guests can view 
 * transparency data for a specific ward without authenticating.
 * * It handles three primary pillars of the UI:
 * 1. Geographic Data (Leaflet.js Map + Pins)
 * 2. Tabular Data (The Ledger Table)
 * 3. Portable Data (The Dashboard Exporter)
 */

// ==========================================
// 1. GLOBAL STATE
// ==========================================
let currentReports = []; // Cache for reports fetched from the API for the current ward
let activeReportId = null; // Tracks which report is currently being viewed in the modal
let mainMap = null;      // Holds the Leaflet map instance
let issueModal = null;   // Reusable instance of the CivicModal utility class

// ==========================================
// 2. PAGE INITIALISATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Extract the 'wardId' from the URL query string (e.g., PublicWardView.html?wardId=101)
    const urlParams = new URLSearchParams(window.location.search);
    const wardId = urlParams.get('wardId');

    // 🚨 MODULAR COMPONENT PATTERN:
    // We instantiate the CivicModal class once. This class contains all logic
    // for opening, closing, and lazy-loading report images from the backend.
    issueModal = new CivicModal();

    // GUARD CLAUSE: If no wardId is provided, the page cannot function.
    // We redirect the guest back to the search dashboard.
    if (!wardId) {
        window.location.href = 'GuestDashboard.html';
        return; 
    }

    // ==========================================
    // PDF EXPORT INITIALISATION
    // ==========================================
    /**
     * SAFETY CHECK: We verify 'DashboardExporter' exists in the global scope.
     * This ensures that if the external JS file fails to load (due to 404 or network error),
     * the rest of the ward view logic (maps/tables) still works.
     */
    if (typeof DashboardExporter !== 'undefined') {
        // Create a dedicated exporter for this page.
        // It targets the #pdf-region-ward wrapper which includes the stats and table.
        new DashboardExporter(
            'export-ward-pdf-btn',         // The ID of the UI button to trigger the export
            '#pdf-region-ward',            // The CSS selector of the content to be captured
            `Ward_${wardId}_Public_Ledger` // Dynamic naming based on the ward currently being viewed
        );
    } else {
        console.warn("DashboardExporter utility not detected. PDF export disabled.");
    }

    // Dynamic UI Update: Show the ward number in the header
    document.getElementById('ward-title').textContent = `WARD ${wardId}`;

    // Parallel Initialisation: Setup map and begin async API calls
    initMap();
    fetchWardReports(wardId);
    fetchWardDetails(wardId);
});

// ==========================================
// 3. MAP CONTROLLER (Leaflet.js)
// ==========================================
function initMap() {
    /**
     * Initialises the Leaflet map container.
     * Uses CartoDB 'Dark Matter' tiles to match the project's aesthetic.
     */
    mainMap = L.map('ward-map').setView([-26.2041, 28.0473], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        subdomains: 'abcd',
        maxZoom: 19 
    }).addTo(mainMap);
}

function renderMapMarkers(reports) {
    if (!mainMap) return; 

    // latLngBounds allows the map to automatically zoom/pan to show all pins at once
    let bounds = L.latLngBounds(); 
    let validMarkers = 0;

    reports.forEach(report => {
        const lat = report.Latitude || report.latitude;
        const lng = report.Longitude || report.longitude;

        // Skip records that haven't been geocoded yet (lat/lng 0 or null)
        if (lat && lng && parseFloat(lat) !== 0) {
            
            // Visual logic: Resolved issues are Grayed out; Active issues are High-Contrast Orange
            const progressStr = (report.Progress || '').toLowerCase();
            const isResolved = progressStr === 'resolved' || progressStr === 'fixed';
            const markerColor = isResolved ? '#808080' : '#FF8C00'; 

            const marker = L.circleMarker([lat, lng], {
                radius: 8,
                fillColor: markerColor,
                color: '#ffffff', 
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            }).addTo(mainMap); 

            // Clicking a map pin triggers the SAME logic as clicking a table row
            marker.on('click', () => openIssueModal(report.ReportID));

            bounds.extend([lat, lng]);
            validMarkers++;
        }
    });

    // Auto-frame the map only if there is data to show
    if (validMarkers > 0) {
        mainMap.fitBounds(bounds, { padding: [50, 50] });
    }
}

// ==========================================
// 4. API FETCH FUNCTIONS
// ==========================================
async function fetchWardReports(wardId) {
    /**
     * Hits the Public API route to get all reports for a specific ward.
     * Note: This route is unauthenticated (public-facing).
     */
    try {
        const response = await fetch(`/api/public/reports/ward/${wardId}`);
        if (!response.ok) throw new Error('Failed to fetch reports');
        
        currentReports = await response.json(); 
        
        // Populate the three UI layers with the fresh data
        renderStats(currentReports);
        renderTable(currentReports);
        renderMapMarkers(currentReports); 

    } catch (error) {
        console.error('Data Fetch Error:', error);
        document.getElementById('reports-table-body').innerHTML = `
            <tr><td colspan="4" class="px-8 py-6 text-center text-red-400 font-bold">Error connecting to the ledger.</td></tr>
        `;
    }
}

async function fetchWardDetails(wardId) {
    /**
     * Fetches metadata about the ward, primarily to identify the Ward Councillor.
     */
    try {
        const response = await fetch(`/api/public/geography/wards/${wardId}`);
        if (!response.ok) throw new Error('Failed to fetch ward details');
        
        const ward = await response.json();
        const councillorName = ward.WardCouncillor ? ward.WardCouncillor : 'Unassigned'; 
        document.getElementById('councillor-label').textContent = `Councillor: ${councillorName}`;
    } catch (error) {
        document.getElementById('councillor-label').textContent = 'Civic Transparency View';
    }
}

// ==========================================
// 5. RENDER FUNCTIONS
// ==========================================
function renderStats(reports) {
    /**
     * Calculates the totals for the "Active" and "Resolved" metric cards at the top of the page.
     */
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
    /**
     * Dynamically builds the HTML table rows.
     * Includes logic for Status Badges and dynamic Icon mapping based on Issue Type.
     */
    const tbody = document.getElementById('reports-table-body');
    tbody.innerHTML = ''; 

    if (reports.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="px-8 py-6 text-center text-on-surface-variant font-bold">No public issues reported.</td></tr>`;
        return; 
    }

    reports.forEach(report => {
        // Status Badge Logic
        let statusBadge = ''; 
        const progressStr = (report.Progress || '').toLowerCase(); 
        
        if (progressStr === 'resolved' || progressStr === 'fixed') {
            statusBadge = `<span class="px-3 py-1 bg-surface-container-highest text-on-surface-variant text-[10px] font-black uppercase rounded-full">Resolved</span>`;
        } else if (progressStr === 'in progress' || progressStr === 'assigned to field staff') {
            statusBadge = `<span class="px-3 py-1 bg-[#FF8C00]/20 text-[#FF8C00] border border-[#FF8C00]/40 text-[10px] font-black uppercase rounded-full">In Progress</span>`;
        } else {
            statusBadge = `<span class="px-3 py-1 bg-[#FF8C00] text-on-primary text-[10px] font-black uppercase rounded-full">Active</span>`;
        }

        // Material Symbol Mapping: Matches 'Type' string to specific Google Font Icons
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
        
        // INTERACTION: Row-level click event for deep-diving into issue details
        tr.onclick = () => openIssueModal(report.ReportID);
        tbody.appendChild(tr);
    });
}

// ==========================================
// 6. MODAL CONTROLLER
// ==========================================
async function openIssueModal(reportId) {
    /**
     * Prepares data and opens the modular CivicModal.
     * This function bridges the data from this page's cache to the reusable component.
     */
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
        municipality: "Local Municipality" // Generic placeholder for the Public View
    };

    // Trigger the CivicModal 'open' method which handles UI rendering and image fetching
    await issueModal.open(modalData);
}

// ==========================================
// 7. JEST TESTING EXPORTS
// ==========================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        fetchWardReports, 
        fetchWardDetails, 
        renderStats, 
        renderTable, 
        renderMapMarkers, 
        openIssueModal,
        initMap, 
        setCurrentReports:(fakeData)=>{currentReports=fakeData;} 
    };
}