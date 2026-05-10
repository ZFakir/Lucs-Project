// ==========================================
// 1. GLOBAL STATE
// ==========================================
let currentReports = []; 
let activeReportId = null;
let issueModal = null; 
let currentMuniId = null;   // 🚨 NEW: Store the Municipality ID globally
let currentMuniName = "N/A"; // 🚨 NEW: Store name for the modal

function setCurrentReports(data) {
    currentReports = data;
}
// ==========================================
// 2. PAGE INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Extract both IDs from the URL
    const urlParams = new URLSearchParams(window.location.search);
    const wardId = urlParams.get('wardId');
    currentMuniId = urlParams.get('muniId'); 

    // Validation: Require BOTH for a composite key system
    if (!wardId || !currentMuniId) {
        window.location.href = '../Homes/Resident.html';
        return;
    }

    // Update the Page Title
    document.getElementById('ward-title').textContent = `WARD ${wardId}`;

    // Setup Navigation
    document.getElementById('back-btn').addEventListener('click', () => {
        window.location.href = '../Homes/Resident.html';
    });

    // Instantiate the reusable modal
    issueModal = new CivicModal();

    // Initial Data Fetching
    fetchWardReports(wardId, currentMuniId);
    fetchWardDetails(wardId, currentMuniId);
});

// ==========================================
// 3. FETCH FUNCTIONS
// ==========================================
async function fetchWardReports(wardId, muniId) {
    try {
        // 🚨 Update: API call now uses both IDs to pinpoint the correct ward
        const response = await fetch(`/api/reports/ward/${wardId}/${muniId}`);
        if (!response.ok) throw new Error('Failed to fetch reports');
        
        currentReports = await response.json(); 
        
        renderStats(currentReports);
        renderTable(currentReports);

    } catch (error) {
        console.error('Error fetching ward data:', error);
        document.getElementById('reports-table-body').innerHTML = `
            <tr><td colspan="4" class="px-8 py-6 text-center text-red-400 font-bold">Failed to load reports.</td></tr>
        `;
    }
}

async function fetchWardDetails(wardId, muniId) {
    try {
        // 🚨 Update: Fetch details using the composite key pair
        const response = await fetch(`/api/geography/wards/${muniId}/${wardId}`);
        if (!response.ok) throw new Error('Failed to fetch ward details');
        
        const ward = await response.json();
        
        // Save Municipality Name for the Modal display
        currentMuniName = ward.Municipality ? ward.Municipality.MunicipalityName : "Unknown";
        
        const councillorName = ward.WardCouncillor ? ward.WardCouncillor : 'Unassigned'; 
        document.getElementById('councillor-label').textContent = `${councillorName}`;

    } catch (error) {
        console.error('Error fetching ward details:', error);
        document.getElementById('councillor-label').textContent = 'Councillor data unavailable';
    }
}

// ==========================================
// 4. RENDER FUNCTIONS
// ==========================================
function renderStats(reports) {
    const activeReports = reports.filter(r => (r.Progress || '').toLowerCase() !== 'resolved');
    const resolvedReports = reports.filter(r => (r.Progress || '').toLowerCase() === 'resolved');

    document.getElementById('active-count').textContent = activeReports.length;
    document.getElementById('resolved-count').textContent = resolvedReports.length;
}

function renderTable(reports) {
    const tbody = document.getElementById('reports-table-body');
    tbody.innerHTML = ''; 

    if (reports.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="px-8 py-6 text-center text-on-surface-variant font-bold">No issues reported for this ward.</td></tr>`;
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
            <td class="px-8 py-6 text-on-surface-variant font-medium max-w-md">${report.Brief || report.Progress || 'No description provided.'}</td>
            <td class="px-8 py-6 text-center">${statusBadge}</td>
            <td class="px-8 py-6 text-right font-mono text-on-surface-variant text-sm">${formattedDate}</td>
        `;
        
        tr.onclick = () => openIssueModal(report.ReportID);
        tbody.appendChild(tr);
    });
}

// ==========================================
// 5. MODAL CONTROLLER
// ==========================================
async function openIssueModal(reportId) {
    const report = currentReports.find(r => r.ReportID === reportId);
    if (!report) return;

    activeReportId = reportId;

    // 🚨 1. We removed the manual image fetch! CivicModal handles it now.

    const modalData = {
        id: report.ReportID, // 🚨 2. THIS IS REQUIRED: Tells CivicModal what to fetch
        type: report.Type,
        description: report.Brief ||'No description provided.',
        date: report.CreatedAt,
        status: report.Progress || report.Status,
        ward: report.WardID,
        municipality: currentMuniName.toUpperCase() 
    };

    // 🚨 4. We added 'await' because issueModal.open is now an asynchronous function
    await issueModal.open(modalData);
    
    // Inject the bump button after the modal has rendered
    injectBumpButton(report);
}
// --- Dynamic Bump Button Logic ---
function injectBumpButton(report) {
    const modalMain = document.querySelector(`#${issueModal.modalId} main`);
    if (!modalMain) return;

    const existingContainer = document.getElementById('dynamic-bump-container');
    if (existingContainer) existingContainer.remove();

    const bumpContainer = document.createElement('div');
    bumpContainer.id = 'dynamic-bump-container';
    bumpContainer.className = 'mt-6 pt-6 border-t border-white/5 flex items-center justify-between';

    const freqDisplay = document.createElement('div');
    freqDisplay.innerHTML = `<span class="text-[10px] uppercase tracking-widest text-on-surface-variant">Issue Frequency: </span><span id="modal-frequency" class="font-bold text-white ml-2 text-lg">${report.Frequency || 0}</span>`;

    const bumpBtn = document.createElement('button');
    bumpBtn.id = 'bump-btn';
    bumpBtn.className = 'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors';

    const bumpedIssues = JSON.parse(localStorage.getItem('bumpedIssues') || '[]');
    
    if (bumpedIssues.includes(String(report.ReportID))) { 
        bumpBtn.disabled = true;
        bumpBtn.innerHTML = `<i class="material-symbols-outlined text-sm">check_circle</i> Already Bumped`;
        bumpBtn.className += ' bg-surface-container-highest text-on-surface-variant cursor-not-allowed opacity-50';
    } else {
        bumpBtn.disabled = false;
        bumpBtn.innerHTML = `<i class="material-symbols-outlined text-sm">exposure_plus_1</i> Bump Issue`;
        bumpBtn.className += ' bg-[#FF8C00]/10 text-[#FF8C00] hover:bg-[#FF8C00] hover:text-white';
        
        bumpBtn.addEventListener('click', () => handleBump(report.ReportID, bumpBtn));
    }

    bumpContainer.appendChild(freqDisplay);
    bumpContainer.appendChild(bumpBtn);
    modalMain.appendChild(bumpContainer);
}

async function handleBump(reportId, btnElement) {
    btnElement.innerHTML = `<i class="material-symbols-outlined text-sm animate-spin">refresh</i> Bumping...`;
    btnElement.disabled = true;

    try {
        const response = await fetch(`/api/reports/${reportId}/bump`, { method: 'PUT' });
        
        if (response.ok) {
            const data = await response.json();
            document.getElementById('modal-frequency').textContent = data.newFrequency; 
            
            const localReport = currentReports.find(r => r.ReportID === reportId);
            if (localReport) localReport.Frequency = data.newFrequency; 

            const currentBumped = JSON.parse(localStorage.getItem('bumpedIssues') || '[]');
            if (!currentBumped.includes(String(reportId))) {
                currentBumped.push(String(reportId));
                localStorage.setItem('bumpedIssues', JSON.stringify(currentBumped));
            }

            btnElement.innerHTML = `<i class="material-symbols-outlined text-sm">check</i> Bumped!`;
            btnElement.className = 'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors bg-[#FF8C00] text-white';
        }
    } catch (error) {
        console.error('Failed to bump issue', error);
        btnElement.innerHTML = `Error! Try again.`;
        btnElement.disabled = false;
    }
}

if (typeof module !== 'undefined') {
    module.exports = { 
        renderStats, 
        renderTable, 
        fetchWardDetails, 
        fetchWardReports, 
        setCurrentReports // 🚨 Don't forget this setter for your global state
    };
}

// ==========================================
// 6. NOTIFICATION & ACCOUNT MENU CONTROLLERS
// ==========================================

// Handle closing the profile dropdown when clicking outside
document.addEventListener('click', (event) => {
    const detailsElement = document.querySelector('nav details');
    if (detailsElement && !detailsElement.contains(event.target)) {
        detailsElement.removeAttribute('open');
    }
});

// Notifications settings logic
const bellBtn = document.getElementById('notification-bell-btn');
const muteModal = document.getElementById('mute-settings-modal');
const closeMuteIcon = document.getElementById('close-mute-modal-icon');
const closeMuteBtn = document.getElementById('close-mute-modal-btn');
const muteForm = document.getElementById('mute-settings-form');
const muteAllCheckbox = document.getElementById('mute-all');
const specificWardsFieldset = document.getElementById('specific-wards-fieldset');
const muteWardSelect = document.getElementById('mute-ward-select');

// Open the Modal
if(bellBtn) {
    bellBtn.addEventListener('click', async () => {
        const residentId = localStorage.getItem('residentId');
        if (!residentId) {
            console.error('No resident ID found');
            return;
        }

        try {
            // Fetch subscribed wards to populate the select
            const response = await fetch(`/api/residents/${residentId}/subscriptions`);
            if (!response.ok) throw new Error('Failed to fetch subscriptions');

            const wards = await response.json();

            // Clear existing options
            muteWardSelect.innerHTML = '';

            // Populate with subscribed wards
            wards.forEach(ward => {
                const option = document.createElement('option');
                option.value = `${ward.WardID}-${ward.MunicipalityID}`;
                option.textContent = `Ward ${ward.WardID} (${ward.Ward?.WardCouncillor || 'No Councillor'})`;
                muteWardSelect.appendChild(option);
            });
            
            // Show the modal
            muteModal.showModal();
        } catch (error) {
            console.error('Error loading wards for mute settings:', error);
        }
    });
}

// Close Modal Handlers
const closeMuteModal = () => muteModal.close();
if(closeMuteIcon) closeMuteIcon.addEventListener('click', closeMuteModal);
if(closeMuteBtn) closeMuteBtn.addEventListener('click', closeMuteModal);

// Close the modal if the user clicks the darkened background outside the modal
if (muteModal) {
    muteModal.addEventListener('click', (e) => {
        if (e.target === muteModal) {
            closeMuteModal();
        }
    });
}

// If "Mute All" is checked, disable the specific ward select
if (muteAllCheckbox) {
    muteAllCheckbox.addEventListener('change', (e) => {
        if(e.target.checked) {
            muteWardSelect.disabled = true;
            specificWardsFieldset.classList.add('opacity-30', 'pointer-events-none');
        } else {
            muteWardSelect.disabled = false;
            specificWardsFieldset.classList.remove('opacity-30', 'pointer-events-none');
        }
    });
}

// Form Submission Logic
if (muteForm) {
    muteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const isMutedAll = muteAllCheckbox.checked;
        const mutedWards = Array.from(muteWardSelect.selectedOptions).map(opt => opt.value);

        const notificationPreferences = {
            muteAll: isMutedAll,
            mutedWards: isMutedAll ? [] : mutedWards 
        };

        console.log("Sending preferences to backend:", notificationPreferences);

        try {
            // Simulated API Call
            alert("Alert preferences saved successfully!");
            closeMuteModal();
        } catch (error) {
            console.error("Error saving notification settings:", error);
            alert("Failed to save settings. Please try again.");
        }
    });
}