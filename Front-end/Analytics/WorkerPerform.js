//GLOBAL STATE VARIABLES
// Allow variables to be initialized from global scope for testing
let currentDisplayedReports = []; 
let workerMap = typeof global !== 'undefined' && global.workerMap ? global.workerMap : null;
let pinLayerGroup = typeof global !== 'undefined' && global.pinLayerGroup ? global.pinLayerGroup : null;
let MunicipalityMap = {};
let currentActiveMuniId = null;
let currentWorkerReports = [];
let currentWorkerId = '';



// ==========================================
// 1.5 SEARCHBAR LOGIC
// ==========================================
const searchInput = document.getElementById('employee-search');
    const employeeList = document.getElementById('employee-list');
    
    if (searchInput && employeeList) {
        const employeeButtons = employeeList.querySelectorAll('button');//searches in existing DOM

        searchInput.addEventListener('input', (e) => {
            // Grab what the user typed, make it lowercase, and remove extra spaces
            const searchTerm = e.target.value.toLowerCase().trim();

            employeeButtons.forEach(button => {
                // .textContent grabs all the text inside the button (Both Name AND ID!)
                const workerText = button.textContent.toLowerCase();
                
                // If the text contains our search term, show it. Otherwise, hide it.
                if (workerText.includes(searchTerm)) {
                    button.style.display = 'flex'; // Restore Tailwind's flex layout
                } else {
                    button.style.display = 'none'; // Hide it completely
                }
            });
        });
    }


//MODULAR COMPONNENTS
// 2A. The Modal Viewer
const issueViewer = new CivicModal();

// 2B. The Table Viewer
const historyTable = new CivicTable('worker-ledger-container', async (clickedReport) => {
    
    let allocatedWorkers = [];
    try {
        const res = await fetch(`/api/sandbox/report/${clickedReport.ReportID}/workers`);
        if (res.ok) allocatedWorkers = await res.json();
    } catch (e) { console.error(e); }

    issueViewer.open({
        id: clickedReport.ReportID,
        type: clickedReport.Type,
        description: clickedReport.Brief,
        date: clickedReport.CreatedAt,
        status: clickedReport.Progress,
        ward: clickedReport.WardID || 'N/A',
        municipality: clickedReport.MunicipalityID || 'Unknown',
        workers: allocatedWorkers // 🚨 Pass the data!
    });
});

// Helper to normalize strings for dictionary lookup
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
// 3. CORE LOGIC & MAP CLICKS
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {

    await fetchAndPopulateWorkers();

    if (searchInput && employeeList) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            
            // 🚨 We MUST query the buttons INSIDE the event listener now, 
            // because they are generated dynamically after the page loads!
            const employeeButtons = employeeList.querySelectorAll('button');

            employeeButtons.forEach(button => {
                const workerText = button.textContent.toLowerCase();
                if (workerText.includes(searchTerm)) {
                    button.style.display = 'flex'; 
                } else {
                    button.style.display = 'none'; 
                }
            });
        });
    }
    
    // 1. Fetch the dictionary so we can translate Map Clicks -> Database IDs
    try {
        const res = await fetch('/api/sandbox/municipality-map');
        MunicipalityMap = await res.json();
    } catch (e) {
        console.error("Failed to load map dictionary", e);
    }

    // 2. Initialize Map explicitly forcing only municipal data
    workerMap = new CivicMap('map', 'data/sa_municipal.json', (data) => {
        if (data.muniId) {
            const cleanName = normalizeName(data.muniId);
            currentActiveMuniId = MunicipalityMap[cleanName];
            currentWorkerId = null;


            console.log(`Clicked: ${data.muniId} -> ID: ${currentActiveMuniId}`);

            // If your CivicMap passes the Leaflet layer, force it to zoom in!
            if (data.layer && workerMap.map) {
                workerMap.map.fitBounds(data.layer.getBounds(), { padding: [50, 50] });
            }

            // Fetch the reports for this specific area
            fetchMunicipalityReports();
        }
    });


    // 3.5 Timeframe Listeners (Updates the map AND the active worker automatically!)
    document.querySelectorAll('input[name="timeframe"]').forEach(radio => {
        radio.addEventListener('change', () => {
            
            // If a worker is currently selected in the left panel, refresh their entire dashboard
            if (currentWorkerId) {
                fetchSelectedWorkerStats();
            } 
            // Otherwise, if they only clicked a map region, refresh the region
            else if (currentActiveMuniId) {
                fetchMunicipalityReports(); 
            }
            
        });
    });

    // 4. Modal Triggers (CONSOLIDATED)
    const modal = document.getElementById('ledger-modal');
    
    document.getElementById('view-history-btn').addEventListener('click', () => {
        historyTable.render(currentWorkerReports); 
        modal.showModal();
    });
    
    document.getElementById('close-ledger-btn').addEventListener('click', () => {
        modal.close();
    });

    const pdfExporter = new DashboardExporter('export-pdf-btn', 'main', 'Worker_Performance_Report');
}); // End of DOMContentLoaded

// ==========================================
// 4. DATA FETCHING & PIN DROPPING
// ==========================================
function getDateRange() {
    const selectedTime = document.querySelector('input[name="timeframe"]:checked').value;
    const endDate = new Date();
    const startDate = new Date();

    if (selectedTime === '24h') {
        startDate.setHours(startDate.getHours() - 24);
    } else if (selectedTime === '7 Days') {
        startDate.setDate(startDate.getDate() - 7);
    } else if (selectedTime === '30 Days') {
        startDate.setDate(startDate.getDate() - 30);
    }

    const periodSpan = document.getElementById('current-period');
    if (periodSpan) {
        // Format as "MMM D" (e.g., "Aug 15")
        const formatOpt = { month: 'short', day: 'numeric' };
        const startStr = startDate.toLocaleDateString('en-US', formatOpt).toUpperCase();
        const endStr = endDate.toLocaleDateString('en-US', formatOpt).toUpperCase();
        
        // Inject exactly like the hardcoded version: "AUG 15 - AUG 22"
        periodSpan.textContent = `${startStr} - ${endStr}`;
    }


    return { start: startDate.toISOString().split('T')[0], end: endDate.toISOString().split('T')[0] };
}

async function fetchMunicipalityReports() {
    if (!currentActiveMuniId) return; // Do nothing if they haven't clicked a map region yet

    const { start, end } = getDateRange();
    
    try {
        // We reuse the exact same route we built for the ReqVol Dashboard!
        const url = `/api/sandbox/municipality/${currentActiveMuniId}?startDate=${start}&endDate=${end}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch municipality reports");
        
        currentDisplayedReports = await response.json();
        drawPinsOnMap(currentDisplayedReports);
        
    } catch (error) {
        console.error("Municipality Fetch Error:", error);
    }
}

function drawPinsOnMap(reports) {
    if (!workerMap || !workerMap.map) return;

    // 1. Clear existing pins so we don't duplicate them
    if (pinLayerGroup) {
        workerMap.map.removeLayer(pinLayerGroup);
    }
    pinLayerGroup = L.layerGroup().addTo(workerMap.map);

    // 2. Loop through reports and create color-coded markers
    reports.forEach(report => {
        const lat = report.Latitude ;
        const lng = report.Longitude ;

        // 🚨 LOGIC: Check if resolved. Grey if True, Red if False.
        const isResolved = (report.Progress || '').toLowerCase() === 'resolved';
        const pinColor = isResolved ? '#808080' : '#FF0000'; 

        const marker = L.circleMarker([lat, lng], {
            radius: 8,
            fillColor: pinColor, // Injects the chosen color
            color: "#FFFFFF",
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9
        }).addTo(pinLayerGroup);
        
        marker.bindTooltip(`<b>${report.Type || 'Issue'}</b><br/>${report.Progress || 'Active'}`, { direction: 'top' });

        // Make the pin clickable to open the Modal
marker.on('click',async () => {
            // 🚨 REVERSE LOOKUP: Find the name that matches our ID
            let muniName = Object.keys(MunicipalityMap).find(key => MunicipalityMap[key] === currentActiveMuniId);
            if (muniName) {
                muniName = muniName.replace(/\b\w/g, letter => letter.toUpperCase()); // Capitalize each word start
            } else {
                muniName = 'Unknown Municipality';
            }

            let allocatedWorkers = [];
            try {
                const res = await fetch(`/api/sandbox/report/${report.ReportID}/workers`);
                if (res.ok) allocatedWorkers = await res.json();
            } catch (e) {
                console.error("Failed to fetch allocated workers", e);
            }

            issueViewer.open({
                id: report.ReportID,
                type: report.Type,
                description: report.Brief,
                date: report.CreatedAt,
                status: report.Progress,
                ward: report.WardID || 'N/A',
                municipality: muniName, 
                workers: allocatedWorkers
            });
        });
    });
}

// ==========================================
// 5. EMPLOYEE LIST POPULATION
// ==========================================
async function fetchAndPopulateWorkers() {
    const listContainer = document.getElementById('employee-list');
    if (!listContainer) return;

    try {
        listContainer.innerHTML = `<p class="text-xs text-on-surface-variant p-4">Loading registry...</p>`;
        
        const response = await fetch('/api/sandbox/workers');
        if (!response.ok) throw new Error("Failed to fetch workers");
        
        const workers = await response.json();
        listContainer.innerHTML = ''; // Clear loading text

        workers.forEach(worker => {
            const btn = document.createElement('button');
            btn.className = 'flex items-center p-4 hover:bg-[#353535]/20 text-on-surface/60 text-left transition-colors w-full border-l-4 border-transparent focus:border-[#FF8C00] focus:bg-[#FF8C00]/10 focus:text-on-surface';
            
            // Use UI-Avatars generates icons based on names
            const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(worker.Name)}&background=353535&color=FF8C00&bold=true`;

            btn.innerHTML = `
                <img alt="${worker.Name}" class="w-10 h-10 rounded-full mr-4 opacity-80" src="${avatarUrl}"/>
                <section>
                    <p class="text-sm font-bold text-on-surface">${worker.Name}</p>
                    <p class="text-[0.65rem] uppercase font-bold tracking-wider">${worker.EmployeeID}</p>
                </section>
            `;

            // When clicked, you can eventually hook this up to change the main dashboard stats!
            btn.onclick = () => {
                // Update Global State
                currentWorkerId = worker.EmployeeID;
                currentActiveMuniId = null; //remove muni selection

                // 1. Instantly Update the Header UI
                document.getElementById('profile-name').textContent = worker.Name;
                document.getElementById('profile-registry').textContent = `Registry ID: ${worker.EmployeeID}`;
                document.getElementById('profile-avatar').src = avatarUrl;

                // 2. Fetch their reports and calculate the stats!
                fetchSelectedWorkerStats();
            };

            listContainer.appendChild(btn);
        });

        // Update the subtitle count
        document.querySelector('header p.tracking-widest').textContent = `Querying ${workers.length} Active Records`;

    } catch (error) {
        console.error("Worker Fetch Error:", error);
        listContainer.innerHTML = `<p class="text-xs text-red-400 p-4">Failed to load registry.</p>`;
    }
}

// ==========================================
// 6. WORKER ANALYTICS & STATS POPULATION
// ==========================================
async function fetchSelectedWorkerStats() {
    const { start, end } = getDateRange();
    
    // Define both URLs
    const reportsUrl = `/api/sandbox/worker/${currentWorkerId}/reports?startDate=${start}&endDate=${end}`;
    const acceptanceUrl = `/api/sandbox/worker/${currentWorkerId}/acceptance`;

    try {
        const [reportsRes, acceptanceRes] = await Promise.all([
            fetch(reportsUrl),
            fetch(acceptanceUrl)
        ]);

        if (!reportsRes.ok || !acceptanceRes.ok) throw new Error("Failed to fetch worker stats");

        currentWorkerReports = await reportsRes.json(); 
        const acceptanceData = await acceptanceRes.json();

        updateAnalyticsUI(currentWorkerReports, acceptanceData);
        
        drawPinsOnMap(currentWorkerReports);

    } catch (error) {
        console.error("Analytics Error:", error);
    }
}


function updateAnalyticsUI(reports, acceptanceData) {
    // 1. Update Total Tasks (from the Reports array)
    const totalTasks = reports.length;
    document.getElementById('tasks-total').textContent = totalTasks.toLocaleString();


    // Calculate percentage (protect against dividing by zero)
    const acceptanceRate = acceptanceData.total > 0 
        ? (acceptanceData.accepted / acceptanceData.total) * 100 
        : 0;
    
    // Update the large text number
    document.getElementById('acceptance-rate-text').innerHTML = `${acceptanceRate.toFixed(1)}<span class="text-primary">%</span>`;

    // Animate the SVG Circle
    const circle = document.getElementById('acceptance-rate-circle');
    if (circle) {
        const circumference = 527.78; 
        const offset = circumference - (circumference * (acceptanceRate / 100));
        circle.style.strokeDashoffset = offset;
    }
    // --------------------------------------------------------
    // 2. Count the Categories based on Report Types
    let counts = { sanitation: 0, infrastructure: 0, utilities: 0 };

    reports.forEach(r => {
        const type = (r.Type || '').toLowerCase();
        if (['sanitation', 'illegal dumping'].includes(type)) counts.sanitation++;
        else if (['pothole', 'street light'].includes(type)) counts.infrastructure++;
        else if (['water leak', 'electricity'].includes(type)) counts.utilities++;
    });

    // 3. Bundle into an array and SORT ASCENDING (lowest to highest)
    const sortedCategories = [
        { name: 'Sanitation', count: counts.sanitation },
        { name: 'Infrastructure', count: counts.infrastructure },
        { name: 'Utilities', count: counts.utilities }
    ].sort((a, b) => a.count - b.count);

    // 4. Map the sorted array to the HTML elements
    const wordMap = ['one', 'two', 'three'];

    sortedCategories.forEach((cat, index) => {
        const idPrefix = `bar-${wordMap[index]}`;
        
        // Update Text and Count
        document.getElementById(idPrefix).textContent = cat.name;
        document.getElementById(`${idPrefix}-count`).textContent = cat.count;
        
        // Calculate Percentage and update Width
        const percentage = totalTasks > 0 ? (cat.count / totalTasks) * 100 : 0;
        const barFill = document.getElementById(`${idPrefix}-fill`);
        
        if (barFill) {
            barFill.style.width = `${percentage}%`;
        }
    });

    //UPDATE COMPLETED ALLOCATIION
    const resolvedCount = reports.filter(r => (r.Progress || '').toLowerCase() === 'resolved').length;
    
    // Calculate the efficiency percentage
    const efficiencyRate = totalTasks > 0 ? (resolvedCount / totalTasks) * 100 : 0;
    
    // Update the Text
    document.getElementById('efficiency-rate-text').innerHTML = `${efficiencyRate.toFixed(1)}<span class="text-primary">%</span>`;
    
    // Update the Progress Bar Width
    const efficiencyBar = document.getElementById('efficiency-rate-bar');
    if (efficiencyBar) {
        efficiencyBar.style.width = `${efficiencyRate}%`;
    }
    // --------------------------------------------------------

    // --------------------------------------------------------
    //Resolution history to top 3
    const recentBody = document.getElementById('recent-history-body');
    recentBody.innerHTML = '';

    if (totalTasks === 0) {
        recentBody.innerHTML = `<tr><td colspan="3" class="py-4 text-center text-on-surface/40 font-black text-[0.6rem] tracking-widest">NO HISTORY IN CURRENT TIMEFRAME</td></tr>`;
        return;
    }

    // Sort by newest first, grab top 3
    const sortedReports = [...reports].sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt));
    const top3 = sortedReports.slice(0, 3);

    top3.forEach(report => {
        const dateObj = new Date(report.CreatedAt);
        const dateStr = `${dateObj.toLocaleString('default', { month: 'short' })} ${dateObj.getDate()}`;
        
        recentBody.innerHTML += `
            <tr class="hover:bg-surface-container-high transition-colors">
                <td class="py-3 px-2 text-on-surface/40">${dateStr}</td>
                <td class="py-3 text-on-surface truncate max-w-[150px]">${report.Type || 'General Task'}</td>
                <td class="py-3 px-2 text-right text-primary">${report.Progress || 'Active'}</td>
            </tr>
        `;
    });
}

/* istanbul ignore next */
// At the bottom of WorkerPerform.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        normalizeName,
        getDateRange, // Added this export
        fetchMunicipalityReports,
        drawPinsOnMap,
        fetchAndPopulateWorkers,
        fetchSelectedWorkerStats,
        updateAnalyticsUI,
        // Setters for testing internal state
        setWorkerMap: (map) => { workerMap = map; },
        setPinLayerGroup: (group) => { pinLayerGroup = group; },
        setWorkerId: (id) => { currentWorkerId = id; },
        setActiveMuni: (id) => { currentActiveMuniId = id; }
    };
}