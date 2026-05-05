// ==========================================
// 1. GLOBAL STATE & DICTIONARIES
// ==========================================
let currentSelection = { type: 'province', ids: { provinceId: 1 } }; 
let MunicipalityMap = {};
let dashboardMap = null;
const issueViewer = new CivicModal();
let pinLayerGroup = null;

const provinceFullNameToId = {
    'Gauteng': 1, 
    'Western Cape': 2, 
    'Eastern Cape': 3,
    'Northern Cape': 4,
    'Nothern Cape': 4, // Catching the geojson typo!
    'Free State': 5,
    'KwaZulu-Natal': 6, 
    'North West': 7,
    'Mpumalanga': 8, 
    'Limpopo': 9
};

const normalizeName = (name) => {
    if (!name) return "";
    return name.toLowerCase()
        .replace(/ metropolitan municipality/g, '')
        .replace(/ local municipality/g, '')
        .replace(/ district municipality/g, '')
        .replace(/-/g, ' ') 
        .trim();
};

// ==========================================
// DATE HELPER
// ==========================================
function getDateRange() {
    // Find the active time button (the one with the orange background)
    const activeBtn = document.querySelector('button.bg-primary-container');
    const selectedTime = activeBtn ? activeBtn.textContent.trim() : '30 DAYS'; // Default fallback
    console.log(selectedTime);

    const endDate = new Date();
    const startDate = new Date();

    if (selectedTime === '24H') {
        startDate.setHours(startDate.getHours() - 24);
    } else if (selectedTime === '7 DAYS') {
        startDate.setDate(startDate.getDate() - 7);
    } else if (selectedTime === '30 DAYS') {
        startDate.setDate(startDate.getDate() - 30);
    }
    console.log(startDate);
    console.log(endDate);
    return {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0]
    };
}

// ==========================================
// 2. DATA FETCHING
// ==========================================
async function buildMunicipalityMap() {
    try {
        const response = await fetch('/api/sandbox/municipality-map');
        if (!response.ok) throw new Error("Failed to fetch map dictionary");
        return await response.json();
    } catch (error) {
        console.error("Error loading municipality map:", error);
        return {};
    }
}

// 🚨 This will be the main function we build out next to fetch the aging data!
// ==========================================
// THE MAIN FETCH & UPDATE LOGIC
// ==========================================
async function fetchAgingData() {
    console.log("Fetching bottleneck data for:", currentSelection);
    
    const { start, end } = getDateRange();
    const { type, ids } = currentSelection;
    let url = '';

    // 1. Determine which of your Sandbox.js routes to hit based on the map click
    if (type === 'ward') {
        url = `/api/sandbox/ward/${ids.municipalityId}/${ids.wardId}?startDate=${start}&endDate=${end}`;
    } else if (type === 'municipality') {
        url = `/api/sandbox/municipality/${ids.municipalityId}?startDate=${start}&endDate=${end}`;
    } else if (type === 'province') {
        url = `/api/sandbox/province/${ids.provinceId}?startDate=${start}&endDate=${end}`;
    }

    try {
        // 2. Fetch the data from your database
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch aging reports');
        
        const reports = await response.json();
        console.log(reports);
        
        // 3. Render the Unassigned Scrollable Ledger (from the previous step)
        if (typeof renderUnassignedTable === 'function') {
            renderUnassignedTable(reports);
        }

        drawPinsOnMap(reports);
        updateAssignmentDurationLedger(reports);

        // 4. Calculate Top-Level Bottleneck Metrics
        calculateBottleneckMetrics(reports);

    } catch (error) {
        console.error("Aging Data Fetch Error:", error);
    }
}

// ==========================================
// ASSIGNMENT DURATION LEDGER
// ==========================================
function updateAssignmentDurationLedger(reports) {
    const now = new Date();

    // 1. Setup buckets for our 4 categories
    const categories = {
        water: { unassignedTotal: 0, assignedTotal: 0, count: 0 },
        electricity: { unassignedTotal: 0, assignedTotal: 0, count: 0 },
        roads: { unassignedTotal: 0, assignedTotal: 0, count: 0 },
        sanitation: { unassignedTotal: 0, assignedTotal: 0, count: 0 }
    };

    // 2. Loop through and process timestamps
    reports.forEach(r => {
        const type = (r.Type || '').toLowerCase();
        let cat = null;

        // Map database types to our UI categories
        if (type.includes('water') || type.includes('pipe')) cat = 'water';
        else if (type.includes('electric') || type.includes('power') || type.includes('light')) cat = 'electricity';
        else if (type.includes('road') || type.includes('pothole')) cat = 'roads';
        else if (type.includes('sanitation') || type.includes('dumping') || type.includes('sewage')) cat = 'sanitation';

        if (!cat) return; // Skip if it doesn't match a main category

        const created = new Date(r.CreatedAt);
        let unassignedHours = 0;
        let assignedHours = 0;

        // Math: Time spent Unassigned vs Assigned
        if (r.AssignedAt) {
            const assigned = new Date(r.AssignedAt);
            unassignedHours = Math.max(0, (assigned - created) / (1000 * 60 * 60));
            
            if (r.DateFulfilled) {
                // Resolved task: Assigned time is between Assignment and Fulfillment
                assignedHours = Math.max(0, (new Date(r.DateFulfilled) - assigned) / (1000 * 60 * 60));
            } else {
                // In Progress task: Assigned time is from Assignment until right now
                assignedHours = Math.max(0, (now - assigned) / (1000 * 60 * 60));
            }
        } else {
            // Unassigned task: Sat there from creation until right now
            unassignedHours = Math.max(0, (now - created) / (1000 * 60 * 60));
        }

        // Add to our buckets
        categories[cat].unassignedTotal += unassignedHours;
        categories[cat].assignedTotal += assignedHours;
        categories[cat].count += 1;
    });

    // 3. Render the UI updates
    Object.keys(categories).forEach(cat => {
        const data = categories[cat];
        
        let avgUnassigned = data.count > 0 ? Math.round(data.unassignedTotal / data.count) : 0;
        let avgAssigned = data.count > 0 ? Math.round(data.assignedTotal / data.count) : 0;
        const total = avgUnassigned + avgAssigned;

        let unassignedPct = 0;
        let assignedPct = 0;

        if (total > 0) {
            unassignedPct = (avgUnassigned / total) * 100;
            assignedPct = (avgAssigned / total) * 100;
        }

        const unassignedBar = document.getElementById(`${cat}-unassigned-bar`);
        const assignedBar = document.getElementById(`${cat}-assigned-bar`);

        if (unassignedBar && assignedBar) {
            // Only show text if it's wide enough to fit, and percentage > 0
            unassignedBar.style.width = `${unassignedPct}%`;
            unassignedBar.textContent = unassignedPct > 5 ? `${avgUnassigned}H` : '';
            
            assignedBar.style.width = `${assignedPct}%`;
            assignedBar.textContent = assignedPct > 5 ? `${avgAssigned}H` : '';
        }
    });
}


function calculateBottleneckMetrics(reports) {
    const now = new Date();
    
    // Arrays to hold the calculated hours
    let unassignedHoursArray = [];
    let resolutionHoursArray = [];

    reports.forEach(report => {
        const createdTime = new Date(report.CreatedAt);
        const progress = (report.Progress || '').toLowerCase();


// 1. Calculate Unassigned Time (Using the null check!)
        if (report.AssignedAt === null || report.AssignedAt === undefined) {
            const hoursWaiting = (now - createdTime) / (1000 * 60 * 60);
            if (hoursWaiting >= 0) unassignedHoursArray.push(hoursWaiting);
        }

        // 2. Calculate Total Resolution Time (only for resolved tasks)
        if (report.DateFulfilled) {
            const resolvedTime = new Date(report.DateFulfilled);
            const hoursToResolve = (resolvedTime - createdTime) / (1000 * 60 * 60);
            if (hoursToResolve >= 0) resolutionHoursArray.push(hoursToResolve);
        }
    });

    // Helper function to average an array of numbers
    const getAverage = (arr) => arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

    const avgUnassigned = getAverage(unassignedHoursArray);
    const avgResolution = getAverage(resolutionHoursArray);

    // 3. Update the DOM elements (Make sure these selectors match your HTML!)
    // For Avg Unassigned Time
    const unassignedEl = document.querySelector('article.border-surface-variant p.text-7xl');
    if (unassignedEl) {
        unassignedEl.innerHTML = `${avgUnassigned.toFixed(1)}<span class="text-2xl text-on-surface-variant ml-2">HOURS</span>`;
    }

    // For Avg Total Resolution Time
    const resolutionEl = document.querySelector('article.border-primary-container p.text-7xl');
    if (resolutionEl) {
        resolutionEl.innerHTML = `${avgResolution.toFixed(1)}<span class="text-2xl text-on-surface-variant ml-2">HOURS</span>`;
    }
}


// ==========================================
// 3. MAP EVENT HANDLERS
// ==========================================
function onMapClick(type, ids) {
    currentSelection = { type, ids };
    fetchAgingData(); // Fetch new analytics whenever a map region is clicked
}

// ==========================================
// 4. INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. Load the dictionary first
    MunicipalityMap = await buildMunicipalityMap();
    console.log(`✅ Dictionary Loaded! Found ${Object.keys(MunicipalityMap).length} municipalities.`);

    // 2. Initialize the Map
    dashboardMap = new CivicMap('map', 'data/sa_provincial.json', (data) => {
        if (data.wardId) {
            onMapClick('ward', { wardId: data.wardId, municipalityId: MunicipalityMap[normalizeName(data.muniId)]});
        } else if (data.muniId) {
            onMapClick('municipality', { municipalityId: MunicipalityMap[normalizeName(data.muniId)] });
        } else {
            onMapClick('province', { provinceId: provinceFullNameToId[data.name] });
        }
    });

    // 3. Hook up the Granularity Radio Buttons
    const granularityRadios = document.querySelectorAll('input[name="granularity"]');
    granularityRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            // Uncheck other styling (Tailwind CSS toggle)
            granularityRadios.forEach(r => {
                const label = r.parentElement;
                label.classList.remove('bg-primary-container', 'text-on-primary');
                label.classList.add('text-on-surface-variant');
            });

            // Style the active label
            const activeLabel = e.target.parentElement;
            activeLabel.classList.remove('text-on-surface-variant');
            activeLabel.classList.add('bg-primary-container', 'text-on-primary');

            // Determine which map layer to load based on the text
            const labelText = activeLabel.textContent.trim().toLowerCase();
            
            if (labelText.includes('province')) {
                dashboardMap.loadNewLayer('data/sa_provincial.json');
            } else if (labelText.includes('ward')) {
                dashboardMap.loadNewLayer('data/sa_wards.json');
            } else if (labelText.includes('municipality')) {
                dashboardMap.loadNewLayer('data/sa_municipal.json');
            }
        });
    });

    // Hook up Temporal Range Buttons
    const timeButtons = document.querySelectorAll('nav.grid button');
    timeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Remove active classes from all buttons
            timeButtons.forEach(b => {
                b.className = 'bg-surface-container-highest border border-surface-variant py-3 rounded-lg text-xs font-bold hover:bg-primary-container hover:text-on-primary transition-all';
            });
            // Add active classes to the clicked button
            e.target.className = 'bg-primary-container text-on-primary py-3 rounded-lg text-xs font-bold';
            
            // Re-fetch data using the new time period!
            fetchAgingData(); 
        });
    });

    // 4. Initial Data Fetch
    fetchAgingData();

    const pdfExporter = new DashboardExporter('export-pdf-btn', 'body', 'Aging_Bottlenecks_Report');
});

// ==========================================
// 5. LEDGER TABLE RENDERER
// ==========================================
function renderUnassignedTable(reports) {
    const tbody = document.getElementById('unassigned-table-body');
    if (!tbody) return;

// 1. Filter by checking if AssignedAt is null (or undefined, just to be safe with JSON)
    const unassignedReports = reports.filter(r => 
        r.AssignedAt === null || r.AssignedAt === undefined
    );
    
    tbody.innerHTML = '';
    
    if (unassignedReports.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="px-8 py-6 text-center text-on-surface-variant font-bold">No unassigned tasks found in this area.</td></tr>`;
        return;
    }

    // 2. Sort by oldest first so the most critical bottlenecks are at the top
    unassignedReports.sort((a, b) => new Date(a.CreatedAt) - new Date(b.CreatedAt));

    const now = new Date();
    // We use 72 hours as the "100% width" baseline for the bar chart
    const maxDurationHours = 72; 

    unassignedReports.forEach(report => {
        const createdDate = new Date(report.CreatedAt);
        const hoursUnassigned = Math.max(0, Math.floor((now - createdDate) / (1000 * 60 * 60)));
        
        // Calculate bar width (cap at 100%)
        const widthPct = Math.min(100, (hoursUnassigned / maxDurationHours) * 100);
        
        // 3. Color mapping for urgency
        let barColor = 'bg-surface-variant';
        let textColor = 'text-on-surface';
        
        if (hoursUnassigned > 48) { 
            barColor = 'bg-error'; 
            textColor = 'text-on-error'; 
        } else if (hoursUnassigned > 24) { 
            barColor = 'bg-primary-container'; 
            textColor = 'text-on-primary-container'; 
        }

        const typeStr = report.Type || 'General Issue';
        const formattedDate = createdDate.toISOString().split('T')[0];

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-surface-container-high transition-colors group cursor-pointer';
        
        tr.innerHTML = `
            <td class="px-8 py-4">
                <p class="font-bold text-white uppercase tracking-tight text-sm">${typeStr}</p>
                <p class="text-on-surface-variant text-xs truncate max-w-[250px] mt-1">${report.Brief || 'No description provided.'}</p>
            </td>
            <td class="px-8 py-4 text-sm font-bold text-on-surface-variant uppercase tracking-wide">
                ${report.WardID ? `Ward ${report.WardID}` : 'N/A'}
            </td>
            <td class="px-8 py-4">
                <section class="h-6 w-full flex rounded-full overflow-hidden bg-surface-container-lowest border border-white/5">
                    <span class="h-full ${barColor} flex items-center px-3 text-[0.6rem] font-black ${textColor} transition-all duration-1000 ease-out" style="width: ${widthPct}%">
                        ${hoursUnassigned}H
                    </span>
                </section>
            </td>
            <td class="px-8 py-4 text-right font-mono text-on-surface-variant text-sm">${formattedDate}</td>
        `;

        tr.onclick = () => {
            // Find the readable municipality name from our dictionary
            let muniName = Object.keys(MunicipalityMap).find(key => MunicipalityMap[key] === report.MunicipalityID);
            muniName = muniName ? muniName.replace(/\b\w/g, letter => letter.toUpperCase()) : 'Unknown';

            issueViewer.open({
                id: report.ReportID,
                type: report.Type,
                description: report.Brief,
                date: report.CreatedAt,
                status: report.Progress,
                ward: report.WardID || 'N/A',
                municipality: muniName
            });
        };
        
        tbody.appendChild(tr);
    });
}

// ==========================================
// MAP PIN RENDERER
// ==========================================
// ==========================================
// MAP PIN RENDERER
// ==========================================
function drawPinsOnMap(reports) {
    if (!dashboardMap || !dashboardMap.map) return;

    // 1. Clear existing pins
    if (pinLayerGroup) {
        dashboardMap.map.removeLayer(pinLayerGroup);
    }
    pinLayerGroup = L.layerGroup().addTo(dashboardMap.map);

    // 2. Loop through reports and draw
    reports.forEach(report => {
        // Skip if no GPS data
        if (!report.Latitude || !report.Longitude) return;

        // 🚨 3. Determine Color based purely on database timestamps!
        let pinColor = '#FF8C00'; // Default: Orange (Unallocated)
        // Rule 1: Does it have a DateFulfilled? If yes, it's done.
        if (report.DateFulfilled !== null) {
            pinColor = '#000000'; // Black: Resolved/Fulfilled
        } 
        // Rule 2: If not fulfilled, does it have an AssignedAt date? If yes, someone is on it.
        else if (report.AssignedAt !== null) {
            pinColor = '#808080'; // Grey: Allocated/Assigned
        }
        // Fallback remains Orange because it failed both checks above.

        // 4. Create the Marker
        const marker = L.circleMarker([report.Latitude, report.Longitude], {
            radius: 8,
            fillColor: pinColor,
            color: "#FFFFFF", // White border
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9
        }).addTo(pinLayerGroup);

        // Update tooltip to reflect timestamps if preferred, or keep Progress for readable UI
        const statusText = report.DateFulfilled ? 'Resolved' : (report.AssignedAt ? 'Assigned' : 'Unassigned');
        marker.bindTooltip(`<b>${report.Type || 'Issue'}</b><br/>${statusText}`, { direction: 'top' });

        // 5. Make it clickable to open the CivicModal!
        marker.on('click', () => {
            let muniName = Object.keys(MunicipalityMap).find(key => MunicipalityMap[key] === report.MunicipalityID);
            muniName = muniName ? muniName.replace(/\b\w/g, letter => letter.toUpperCase()) : 'Unknown';

            issueViewer.open({
                id: report.ReportID,
                type: report.Type,
                description: report.Brief,
                date: report.CreatedAt,
                status: statusText, // Pass our newly derived status string to the modal
                ward: report.WardID || 'N/A',
                municipality: muniName
            });
        });
    });
}