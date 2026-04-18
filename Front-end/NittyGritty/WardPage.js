// ==========================================
// 1. GLOBAL STATE (Must be at the very top!)
// ==========================================
let currentReports = []; 
let activeReportId = null;

// ==========================================
// 2. PAGE INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Get the Ward ID from the URL
    const urlParams = new URLSearchParams(window.location.search);
    const wardId = urlParams.get('wardId');

    // If there is no Ward ID, send them back to the dashboard
    if (!wardId) {
        window.location.href = '/Resident.html';
        return;
    }

    // Update the Page Title
    document.getElementById('ward-title').textContent = `WARD ${wardId}`;

    // Setup Navigation (Back Button)
    document.getElementById('back-btn').addEventListener('click', () => {
        window.location.href = '/Homes/Resident.html';
    });

    // Fetch the Data
    fetchWardReports(wardId);
    fetchWardDetails(wardId);

    // --- MODAL & BUMP BUTTON LISTENERS ---
    const dialog = document.getElementById('issue-modal');
    
    // Close Modal Logic
    document.getElementById('close-issue-modal').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) dialog.close(); // Close if clicking outside the box
    });


    // Carousel Desktop Navigation Logic
    const carousel = document.getElementById('modal-carousel');
    const btnPrev = document.getElementById('carousel-prev');
    const btnNext = document.getElementById('carousel-next');

    if (btnPrev && btnNext && carousel) {
        btnNext.addEventListener('click', () => {
            // Scroll right by the exact width of one image container
            carousel.scrollBy({ left: carousel.clientWidth, behavior: 'smooth' });
        });

        btnPrev.addEventListener('click', () => {
            // Scroll left by the exact width of one image container
            carousel.scrollBy({ left: -carousel.clientWidth, behavior: 'smooth' });
        });
    }

    // Bump Button Logic
    document.getElementById('bump-btn').addEventListener('click', async () => {
        if (!activeReportId) return;
        
        const btn = document.getElementById('bump-btn');
        btn.innerHTML = `<i class="material-symbols-outlined animate-spin">refresh</i> Bumping...`;
        btn.disabled = true;

        try {
            const response = await fetch(`/api/reports/${activeReportId}/bump`, { method: 'PUT' });
            
            if (response.ok) {
                const data = await response.json();
                document.getElementById('modal-frequency').textContent = data.newFrequency;
                
                const localReport = currentReports.find(r => r.ReportID === activeReportId);
                if (localReport) localReport.Frequency = data.newFrequency;
                
                btn.innerHTML = `<i class="material-symbols-outlined">check</i> Bumped!`;
                btn.classList.add('bg-[#FF8C00]', 'text-white');
                setTimeout(() => {
                    btn.innerHTML = `<i class="material-symbols-outlined">exposure_plus_1</i> Bump this Issue`;
                    btn.classList.remove('bg-[#FF8C00]', 'text-white');
                    btn.disabled = false;
                }, 2000);
            }
        } catch (error) {
            console.error('Failed to bump issue', error);
            btn.innerHTML = `Error! Try again.`;
            btn.disabled = false;
        }
    });
});

// ==========================================
// 3. FETCH FUNCTIONS
// ==========================================
async function fetchWardReports(wardId) {
    try {
        const response = await fetch(`/api/reports/ward/${wardId}`);
        if (!response.ok) throw new Error('Failed to fetch reports');
        
        // Correctly assign the data to our global variable
        currentReports = await response.json(); 
        
        renderStats(currentReports);
        renderTable(currentReports);

    } catch (error) {
        console.error('Error fetching ward data:', error);
        document.getElementById('reports-table-body').innerHTML = `
            <tr><td colspan="4" class="px-8 py-6 text-center text-red-400 font-bold">Failed to load reports. Please try again later.</td></tr>
        `;
    }
}

async function fetchWardDetails(wardId) {
    try {
        const response = await fetch(`/api/geography/wards/${wardId}`);
        if (!response.ok) throw new Error('Failed to fetch ward details');
        
        const ward = await response.json();
        
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
        
        if (progressStr === 'active' || progressStr === 'pending allocation') {
            statusBadge = `<span class="px-3 py-1 bg-[#FF8C00] text-on-primary text-[10px] font-black uppercase rounded-full">Active</span>`;
        } else if (progressStr === 'in progress') {
            statusBadge = `<span class="px-3 py-1 bg-[#FF8C00]/20 text-[#FF8C00] border border-[#FF8C00]/40 text-[10px] font-black uppercase rounded-full">In Progress</span>`;
        } else {
            statusBadge = `<span class="px-3 py-1 bg-surface-container-highest text-on-surface-variant text-[10px] font-black uppercase rounded-full">Resolved</span>`;
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
        // Added cursor-pointer so the user knows it's clickable
        tr.className = 'hover:bg-surface-container-high transition-colors group cursor-pointer';
        tr.innerHTML = `
            <td class="px-8 py-6">
                <span class="flex items-center gap-3">
                    <span class="material-symbols-outlined text-[#FF8C00]" style="font-variation-settings: 'FILL' 1;">${icon}</span>
                    <span class="font-bold text-white uppercase tracking-tight">${report.Type || 'General'}</span>
                </span>
            </td>
            <td class="px-8 py-6 text-on-surface-variant font-medium max-w-md">${report.Progress || 'No description provided.'}</td>
            <td class="px-8 py-6 text-center">${statusBadge}</td>
            <td class="px-8 py-6 text-right font-mono text-on-surface-variant text-sm">${formattedDate}</td>
        `;
        
        // Connect the click to the row!
        tr.onclick = () => openIssueModal(report.ReportID);
        
        tbody.appendChild(tr);
    });
}

// ==========================================
// 5. MODAL CONTROLLER
// ==========================================
function openIssueModal(reportId) {
    const report = currentReports.find(r => r.ReportID === reportId);
    if (!report) return;

    activeReportId = reportId;
    const dialog = document.getElementById('issue-modal');

    document.getElementById('modal-title').textContent = report.Type || 'General Issue';
    //document.getElementById('modal-desc').textContent = report.Progress || 'No description provided.';
    document.getElementById('modal-date').textContent = report.CreatedAt ? new Date(report.CreatedAt).toISOString().split('T')[0] : 'Unknown';
    document.getElementById('modal-frequency').textContent = report.Frequency || 0;
    
    const progressStr = (report.Progress || '').toLowerCase();
    let badgeHTML = '';
    if (progressStr === 'active' || progressStr === 'pending allocation') {
        badgeHTML = `<span class="px-3 py-1 bg-[#FF8C00] text-on-primary text-[10px] font-black uppercase rounded-full">Active</span>`;
    } else if (progressStr === 'in progress') {
        badgeHTML = `<span class="px-3 py-1 bg-[#FF8C00]/20 text-[#FF8C00] border border-[#FF8C00]/40 text-[10px] font-black uppercase rounded-full">In Progress</span>`;
    } else {
        badgeHTML = `<span class="px-3 py-1 bg-surface-container-highest text-on-surface-variant text-[10px] font-black uppercase rounded-full">Resolved</span>`;
    }
    document.getElementById('modal-status').innerHTML = badgeHTML;

    const carousel = document.getElementById('modal-carousel');
    carousel.innerHTML = ''; 
    
for(let i=1; i<=3; i++) {
        const imgUrl = `https://picsum.photos/seed/${reportId + i}/800/600`;
        carousel.innerHTML += `
            <li class="snap-center shrink-0 w-full h-full relative p-0 m-0 list-none">
                <img src="${imgUrl}" alt="Issue Photo ${i}" class="w-full h-full object-cover" />
            </li>
        `;
    }

    const bumpBtn = document.getElementById('bump-btn');
    const bumpedIssues = JSON.parse(localStorage.getItem('bumpedIssues') || '[]');
    
    if (bumpedIssues.includes(reportId)) {
        // Already bumped: Disable button and show grayed out state
        bumpBtn.disabled = true;
        bumpBtn.innerHTML = `<i class="material-symbols-outlined">check_circle</i> Already Bumped`;
        bumpBtn.classList.remove('bg-[#FF8C00]/10', 'text-[#FF8C00]', 'hover:bg-[#FF8C00]', 'hover:text-white');
        bumpBtn.classList.add('bg-surface-container-highest', 'text-on-surface-variant', 'cursor-not-allowed', 'opacity-50');
    } else {
        // Not bumped: Reset to active state
        bumpBtn.disabled = false;
        bumpBtn.innerHTML = `<i class="material-symbols-outlined">exposure_plus_1</i> Bump this Issue`;
        bumpBtn.classList.remove('bg-surface-container-highest', 'text-on-surface-variant', 'cursor-not-allowed', 'opacity-50');
        bumpBtn.classList.add('bg-[#FF8C00]/10', 'text-[#FF8C00]', 'hover:bg-[#FF8C00]', 'hover:text-white');
    }

    dialog.showModal();
}

// JEST TEST CASE RUNNING TO SIMULATE DOM INTERACTIONS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        fetchWardReports,
        fetchWardDetails,
        renderStats,
        renderTable,
        openIssueModal,
        // Expose global state for testing
        getCurrentReports: () => currentReports,
        setCurrentReports: (reports) => { currentReports = reports; },
        getActiveReportId: () => activeReportId
    };
}