const customAlert = new AlertModal();
function getAdminEmail() {
    return localStorage.getItem('adminEmail');
}

localStorage.setItem('role', 'admin');
localStorage.removeItem('workerId');
localStorage.removeItem('workerName');

const adminEmail = getAdminEmail();

document.addEventListener('DOMContentLoaded', () => {
    loadUnassignedReports();
    loadAssignedTasks();
    loadPendingWorkers();
    loadActiveWorkers();

    const editForm = document.getElementById('edit-report-form');
    if (editForm) {
        editForm.addEventListener('submit', handleEditSubmit);
    }
});



let currentDetailReportId = null;

// Separate the submission logic for clarity
async function handleEditSubmit(e) {
    e.preventDefault();
    
    const id = document.getElementById('edit-report-id').value; //finds which report is being changed
    const updatedData = {
        Type: document.getElementById('edit-type').value,
        Brief: document.getElementById('edit-description').value
    };

    if (!id) {
        await customAlert.show('Error',"Error: Report ID is missing.",'alert');
        return;
    }

    try {
        const response = await fetch(`/api/reports/${id}/edit`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        });

        if (response.ok) {
            await customAlert.show('Success',"Report updated successfully!",'alert');
            closeEditModal();
            loadUnassignedReports(); // Refresh the table to see changes
        } else {
            const error = await response.json();
            await customAlert.show('Success',"Failed to save: " + error.message,'alert');
        }
    } catch (err) {
        console.error("Save Error:", err);
        await customAlert.show('Error',"Network error. Check server console.",'alert');
    }
}

// Ensure your openEditModal populates the hidden ID correctly
async function openEditModal(reportId) {
    try {
        const response = await fetch(`/api/reports/${reportId}`);
        const report = await response.json();

        document.getElementById('edit-report-id').value = report.ReportID;
        document.getElementById('edit-type').value = report.Type;
        document.getElementById('edit-description').value = report.Brief || '';
        
        document.getElementById('edit-report-modal').classList.remove('hidden');
    } catch (err) {
        console.error("Failed to load report data:", err);
    }
}

function closeEditModal() {
    document.getElementById('edit-report-modal').classList.add('hidden');
}

//loads all reports to be assigned by the admin
async function loadUnassignedReports() {
    try {
        //  Fetch all reports from the database
        const response = await fetch('/api/reports');
        if (!response.ok) throw new Error("Failed to fetch reports");
        
        const reports = await response.json();
        
        // Identify the target table body and clear existing rows
        const tableBody = document.getElementById('unassigned-reports-body');
        if (!tableBody) return; // Guard clause
        tableBody.innerHTML = '';

        // Filter for reports that need assignment (Progress includes "Pending")
        // We use toLowerCase() so it catches "Pending", "pending", or "PENDING"
        const pending = reports.filter(r => 
            r.Progress && r.Progress.toLowerCase().includes('pending')
        );

        // Handle Empty State: Show a clean message if the ledger is clear
        if (pending.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="p-12 text-center">
                        <p class="text-[10px] uppercase tracking-[0.3em] text-neutral-600 font-black">
                            Clear Ledger: No Active Assignments
                        </p>
                    </td>
                </tr>`;
            return;
        }

        //Generate and inject rows for each unassigned report
        pending.forEach(report => {
    // Inside the pending.forEach() in loadUnassignedReports(), replace the row template:
const isDeclined = report.Progress.toLowerCase().includes('declined');
const declinedBadge = isDeclined 
    ? `<span class="ml-2 px-2 py-0.5 bg-red-900/30 text-red-400 border border-red-500/20 text-[9px] font-black uppercase rounded">Re-assign</span>` 
    : '';

const row = `
<tr class="border-b border-surface-variant hover:bg-surface-container-high transition-colors group cursor-pointer ${isDeclined ? 'border-l-2 border-red-500/50' : ''}"
    onclick="openAssignmentDetail(${report.ReportID}, null)">
    <td class="p-4 font-mono text-primary-container text-xs">#${report.ReportID}</td>
    <td class="p-4 font-bold text-sm tracking-tight">${report.Type} ${declinedBadge}</td>
    <td class="p-4 text-[10px] font-black uppercase text-neutral-500">Ward ${report.WardID || 'N/A'}</td>
    <td class="p-4" onclick="event.stopPropagation()">
        <select onchange="updatePriority(${report.ReportID}, this.value)" 
                class="bg-surface-container-lowest text-[10px] border border-outline/20 rounded-lg px-3 py-1.5 text-on-surface uppercase font-black cursor-pointer">
            <option value="1" ${report.Priority == 1 ? 'selected' : ''}>1 - Critical</option>
            <option value="2" ${report.Priority == 2 ? 'selected' : ''}>2 - High</option>
            <option value="3" ${report.Priority == 3 ? 'selected' : ''}>3 - Routine</option>
        </select>
    </td>
    <td class="p-4 text-right flex gap-3 justify-end" onclick="event.stopPropagation()">
        <button onclick="openAssignModal(${report.ReportID})" 
                class="bg-primary-container text-black px-4 py-2 rounded-lg text-[10px] font-black uppercase hover:bg-white transition-all">
            ${isDeclined ? 'Re-assign' : 'Assign'}
        </button>
        <button onclick="openEditModal(${report.ReportID})" 
                class="bg-surface-container-highest text-on-surface px-4 py-2 rounded-lg text-[10px] font-black uppercase hover:bg-primary hover:text-black transition-all">
            Edit
        </button>
        <button onclick="handleDelete(${report.ReportID})" 
                class="bg-red-900/20 text-red-500 border border-red-500/30 px-4 py-2 rounded-lg text-[10px] font-black uppercase hover:bg-red-600 hover:text-white transition-all">
            Delete
        </button>
    </td>
</tr>`;
    
    tableBody.insertAdjacentHTML('beforeend', row);
});

        console.log(`Admin Ledger: Loaded ${pending.length} pending reports.`);

    } catch (err) {
        console.error("Critical Failure in loadUnassignedReports:", err);
        const tableBody = document.getElementById('unassigned-reports-body');
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-error text-[10px] font-bold uppercase text-center">Sync Error: Check Server Connection</td></tr>`;
        }
    }
}
//allows for admins to set priority
async function updatePriority(reportId, priorityValue) {
    try {
        const response = await fetch(`/api/reports/${reportId}/priority`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Priority: priorityValue })
        });

        if (response.ok) {
            console.log(`Report #${reportId} set to Priority ${priorityValue}`);
        }
    } catch (err) {
        console.error("Failed to update priority:", err);
    }
}

async function assignToWorker(reportId) {
    // For testing, we manually enter the EmployeeID (e.g., 1)
    const employeeId = prompt("Enter Employee ID to assign to this task:");
    
    if (!employeeId) return;

    try {
        const response = await fetch(`/api/reports/${reportId}/assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ EmployeeID: employeeId })
        });

        if (response.ok) {
            await customAlert.show('Success',`Report #${reportId} successfully assigned to Worker #${employeeId}`,'alert');
            loadUnassignedReports(); // Refresh table
        } else {
            await customAlert.show('Error',"Assignment failed. Check if Employee ID exists.",'alert');
        }
    } catch (err) {
        console.error("Assignment error:", err);
    }
}

async function loadPendingWorkers() {
    try {
        const response = await fetch('/api/workers/pending');
        const workers = await response.json();

        const container = document.getElementById('pending-workers-list');
        container.innerHTML = ''; 

        if (workers.length === 0) {
            container.innerHTML = '<p class="text-xs text-on-surface-variant uppercase">No pending registrations.</p>';
            return;
        }

        workers.forEach(worker => {
            const html = `
                <div class="flex justify-between items-center p-4 bg-surface-container-high rounded-xl mb-2">
                    <div>
                        <p class="font-bold">${worker.FirstName} ${worker.LastName}</p>
                        <p class="text-[10px] text-on-surface-variant">${worker.Email}</p>
                    </div>
                    <button onclick="approveWorker(${worker.EmployeeID})" class="bg-primary text-black px-4 py-2 rounded-lg font-black text-[10px] uppercase hover:bg-white transition-all">
                        Approve
                    </button>
                </div>`;
            container.insertAdjacentHTML('beforeend', html);
        });
    } catch (err) {
        console.error("Error loading workers:", err);
    }
}

async function approveWorker(employeeId) {
    try {
        const response = await fetch(`/api/workers/validate/${employeeId}`, {
            method: 'PUT'
        });

        if (response.ok) {
            await customAlert.show('Success',"Worker Approved!",'alert');
            loadPendingWorkers(); // Refresh the list
        }
    } catch (err) {
        console.error("Validation error:", err);
    }
}

// delete reports
const handleDelete = async (reportId) => {

    const adminEmail = getAdminEmail();
    const userAgreed = await customAlert.show('Warning', "Are you sure you want to delete this report?", 'confirm');
    if (!userAgreed) return;

    try {
        const response = await fetch(`/api/reports/${reportId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminEmail })
        });

        const data = await response.json();

        if (response.ok) {
            await customAlert.show('Success',"Report deleted successfully",'alert');
            loadUnassignedReports(); 
            // If the report was already assigned, refresh that table too
            if (typeof loadAssignedTasks === 'function') loadAssignedTasks();
        } else {
            await customAlert.show('Error',"Failed to delete: " + (data.message || "Unknown Error"),'alert');
        }
    } catch (error) {
        console.error("Error deleting report:", error);
    }
};

async function invalidateWorker(employeeId) {
    const adminEmail = getAdminEmail();
    const userAgreed = await customAlert.show('Warning', "Are you sure you want to disable this account?", 'confirm');
    if (!userAgreed) return;

    try {
        const response = await fetch(`/api/workers/invalidate/${employeeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminEmail })
        });

        if (response.ok) {
            await customAlert.show('Success',"Account Disabled!",'alert');
            location.reload(); // Refresh to update the UI
        }
    } catch (err) {
        console.error("Invalidation error:", err);
    }
}

function renderAssignmentTracker(allocations, container) {
    const html = `
    <section class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
            <thead>
                <tr class="text-[10px] uppercase tracking-widest text-zinc-500 border-b border-outline/20">
                    <th class="p-4">Report ID</th>
                    <th class="p-4">Task Type</th>
                    <th class="p-4">Assigned To</th>
                    <th class="p-4">Status</th>
                </tr>
            </thead>
            <tbody class="text-sm text-neutral-300">
                ${allocations.map(item => `
                    <tr class="border-b border-outline/10 hover:bg-white/5 transition-colors">
                        <td class="p-4 font-mono">#${item.ReportID}</td>
                        <td class="p-4 font-bold">${item.Report.Type}</td>
                        <td class="p-4 text-primary">${item.MunicipalWorker.FirstName} ${item.MunicipalWorker.LastName}</td>
                        <td class="p-4">
                            <span class="px-2 py-1 rounded-full bg-zinc-800 text-[10px] font-bold">
                                ${item.Report.Progress}
                            </span>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </section>`;
    
    container.innerHTML = html;
}


// Function to open the assign modal and set the report ID
function openAssignModal(reportId) {
    document.getElementById('assign-report-id').value = reportId;
    document.getElementById('assign-task-modal').classList.remove('hidden');
    loadWorkerDropdown(); // Refresh the list every time it opens
}

function closeAssignModal() {
    document.getElementById('assign-task-modal').classList.add('hidden');
}

// Fetches workers and puts them in the dropdown
async function loadWorkerDropdown() {
    const dropdown = document.getElementById('worker-dropdown');
    try {
        const response = await fetch('/api/workers/active');
        const workers = await response.json();

        dropdown.innerHTML = '<option value="" disabled selected>Select Operative...</option>';
        workers.forEach(worker => {
            const option = document.createElement('option');
            // Store the EmployeeID but show the Full Name
            option.value = worker.EmployeeID;
            option.textContent = `${worker.FirstName} ${worker.LastName}`;
            dropdown.appendChild(option);
        });
    } catch (err) {
        dropdown.innerHTML = '<option value="" disabled>Error loading personnel</option>';
    }
}

// Store all allocations globally for filtering
let allAllocations = [];

async function loadAssignedTasks() {
    try {
        const response = await fetch('/api/reports/admin/tracker');
        allAllocations = await response.json();
        renderAssignmentRows(allAllocations);
    } catch (err) {
        console.error("Error loading tracker:", err);
    }
}

function renderAssignmentRows(allocations) {
    const tableBody = document.getElementById('assigned-tasks-body');
    const noResults = document.getElementById('no-filter-results');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (allocations.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" class="p-10 text-center text-[10px] uppercase text-neutral-600">No active field assignments.</td></tr>`;
        if (noResults) noResults.classList.add('hidden');
        return;
    }

    const progressColors = {
        'assigned':    'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
        'in progress': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        'resolved':    'bg-green-500/10 text-green-400 border-green-500/20',
        'fixed':       'bg-green-500/10 text-green-400 border-green-500/20',
        'declined':    'bg-red-500/10 text-red-400 border-red-500/20',
    };

    allocations.forEach(item => {
        const progressLower = (item.Report.Progress || '').toLowerCase();
        const colorClass = Object.entries(progressColors).find(([key]) => progressLower.includes(key))?.[1]
            || 'bg-surface-container-highest text-primary border-primary/20';

        const row = `
        <tr class="border-b border-outline/10 hover:bg-white/5 transition-colors cursor-pointer group"
            onclick="openAssignmentDetail(${item.ReportID}, ${item.EmployeeID})">
            <td class="p-4 font-mono text-xs text-primary-container">#${item.ReportID}</td>
            <td class="p-4">
                <div class="flex flex-col">
                    <span class="font-bold text-sm text-on-surface">${item.MunicipalWorker.FirstName} ${item.MunicipalWorker.LastName}</span>
                    <span class="text-[9px] uppercase text-neutral-500">ID: ${item.EmployeeID}</span>
                </div>
            </td>
            <td class="p-4 font-medium text-xs text-neutral-300">${item.Report.Type}</td>
            <td class="p-4">
                <span class="px-2 py-1 rounded border text-[10px] font-black uppercase ${colorClass}">
                    ${item.Report.Progress || 'In Transit'}
                </span>
            </td>
        </tr>`;
        tableBody.insertAdjacentHTML('beforeend', row);
    });

    if (noResults) noResults.classList.add('hidden');
}

function filterAssignments() {
    const filter = document.getElementById('assignment-filter').value.toLowerCase();
    if (filter === 'all') {
        renderAssignmentRows(allAllocations);
        return;
    }
    const filtered = allAllocations.filter(item =>
        (item.Report.Progress || '').toLowerCase().includes(filter)
    );
    if (filtered.length === 0) {
        document.getElementById('assigned-tasks-body').innerHTML = '';
        document.getElementById('no-filter-results').classList.remove('hidden');
    } else {
        document.getElementById('no-filter-results').classList.add('hidden');
        renderAssignmentRows(filtered);
    }
}

async function deleteReportImage(imageId, reportId, employeeId) {
    const userAgreed = await customAlert.show('Warning', 'Delete this image? This cannot be undone.', 'confirm');
    if (!userAgreed) return;

    try {
        const response = await fetch(`/api/report-images/${imageId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            // Refresh the modal to show updated images
            openAssignmentDetail(reportId, employeeId);
        } else {
            await customAlert.show('Success','Failed to delete image.','alert');
        }
    } catch (err) {
        console.error('Image delete error:', err);
    }
}

async function openAssignmentDetail(reportId, employeeId) {
    currentDetailReportId = reportId;
    document.getElementById('assignment-detail-modal').classList.remove('hidden');
    document.getElementById('asgn-type').textContent = 'Loading...';
    document.getElementById('asgn-description').textContent = '—';

    try {
        const fetchWorker = employeeId 
            ? fetch(`/api/workers/${employeeId}/profile`) 
            : Promise.resolve(null);

        const [reportRes, imagesRes, workerRes] = await Promise.all([
            fetch(`/api/reports/${reportId}`),
            fetch(`/api/report-images/report/${reportId}`),
            fetchWorker
        ]);

        const report = await reportRes.json();
        const images = await imagesRes.json();
        const worker = workerRes ? await workerRes.json() : null;

        const priorityMap = { 1: '🔴 Critical', 2: '🟠 High', 3: '🔵 Routine' };

        document.getElementById('asgn-report-id').textContent = `Report #${report.ReportID}`;
        document.getElementById('asgn-type').textContent = report.Type;
        document.getElementById('asgn-worker').textContent = worker ? `${worker.FirstName} ${worker.LastName}` : 'Unassigned';
        document.getElementById('asgn-worker-id').textContent = worker ? `Employee ID: ${employeeId}` : '—';
        document.getElementById('asgn-progress').textContent = report.Progress || 'Pending';
        document.getElementById('asgn-ward').textContent = `Ward ${report.WardID || 'N/A'}`;
        document.getElementById('asgn-priority').textContent = priorityMap[report.Priority] || '🔵 Routine';
        document.getElementById('asgn-description').textContent = report.Brief || 'No description provided.';

        // Images with delete buttons
        const imagesSection = document.getElementById('asgn-images-section');
        const imagesGrid = document.getElementById('asgn-images-grid');
        if (images.length > 0) {
            imagesSection.classList.remove('hidden');
            
            // 1. Split the images using the secret MIME tag
            const residentImages = images.filter(img => !img.Type.includes('role=worker'));
            const workerImages = images.filter(img => img.Type.includes('role=worker'));
            
            let combinedHtml = '';

            // 2. Render Resident Images (The Problem)
            if (residentImages.length > 0) {
                // col-span-full ensures the title stretches across the whole grid row
                combinedHtml += `
                    <div class="col-span-full mt-2">
                        <p class="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Original Issue Photos</p>
                    </div>`;
                    
                combinedHtml += residentImages.map(img => `
                    <figure class="aspect-square rounded-lg overflow-hidden border border-outline/20 relative m-0 group">
                        <img src="data:${img.Type};base64,${img.base64}" 
                             class="w-full h-full object-cover" 
                             alt="Original Issue"/>
                        <button onclick="deleteReportImage(${img.ImageID}, ${reportId}, ${employeeId})"
                                class="absolute top-1 right-1 bg-red-600/80 hover:bg-red-600 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                            <span class="material-symbols-outlined text-white text-sm">delete</span>
                        </button>
                    </figure>`).join('');
            }

            // 3. Render Worker Images (The Solution/Proof of Work)
            if (workerImages.length > 0) {
                combinedHtml += `
                    <div class="col-span-full mt-4">
                        <p class="text-[10px] text-primary font-bold uppercase tracking-widest mb-1">Worker Proof of Work</p>
                    </div>`;
                    
                combinedHtml += workerImages.map(img => {
                    // Strip the secret tag before passing it to the src attribute
                    const cleanType = img.Type.replace(';role=worker', '');
                    return `
                    <figure class="aspect-square rounded-lg overflow-hidden border-2 border-primary/50 relative m-0 group shadow-lg">
                        <img src="data:${cleanType};base64,${img.base64}" 
                             class="w-full h-full object-cover" 
                             alt="Proof of work"/>
                        <button onclick="deleteReportImage(${img.ImageID}, ${reportId}, ${employeeId})"
                                class="absolute top-1 right-1 bg-red-600/80 hover:bg-red-600 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                            <span class="material-symbols-outlined text-white text-sm">delete</span>
                        </button>
                    </figure>`;
                }).join('');
            }

            imagesGrid.innerHTML = combinedHtml;
        } else {
            imagesSection.classList.add('hidden');
            imagesGrid.innerHTML = '';
        }

    } catch (err) {
        console.error('Failed to load assignment details:', err);
        document.getElementById('asgn-type').textContent = 'Error loading details';
    }
}

//delete report option
async function deleteReportFromDetail() {
    const adminEmail = getAdminEmail();
    if (!currentDetailReportId) return;
    const userAgreed = await customAlert.show('Warning', `Are you sure you want to permanently delete Report #${currentDetailReportId}? This cannot be undone.`, 'confirm');
    if (!userAgreed) return;

    try {
        const response = await fetch(`/api/reports/${currentDetailReportId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({adminEmail})
        });

        const data = await response.json();

        if (response.ok) {
            await customAlert.show('Success',`Report #${currentDetailReportId} deleted successfully.`,'alert');
            closeAssignmentDetail();
            loadAssignedTasks();    // Refresh the ledger
            loadUnassignedReports(); // Refresh unassigned table too
        } else {
            await customAlert.show('Error','Failed to delete: ' + (data.message || 'Unknown error'),'alert');
        }
    } catch (err) {
        console.error('Delete error:', err);
        await customAlert.show('Error','Network error — could not delete report.','alert');
    }
}

function closeAssignmentDetail() {
    document.getElementById('assignment-detail-modal').classList.add('hidden');
}

function toggleAdminDropdown() {
    const dropdown = document.getElementById('admin-profile-dropdown');
    dropdown.classList.toggle('hidden');
    if (!dropdown.classList.contains('hidden')) {
        setTimeout(() => {
            document.addEventListener('click', closeAdminDropdownOutside, { once: true });
        }, 0);
    }
}

function closeAdminDropdownOutside(e) {
    const wrap = document.getElementById('admin-profile-dropdown-wrap');
    if (wrap && !wrap.contains(e.target)) {
        document.getElementById('admin-profile-dropdown').classList.add('hidden');
    }
}

function openAdminProfile() {
    document.getElementById('admin-profile-dropdown').classList.add('hidden');
    if (window._profileModal) window._profileModal.open();
}

async function logoutAdmin() {
    document.getElementById('admin-profile-dropdown').classList.add('hidden');
    const userAgreed = await customAlert.show('Warning', 'Are you sure you want to log out?', 'confirm');
    if (!userAgreed) return;
    localStorage.clear();
    window.location.href = '../Login/Login.html';
}

// Handles the actual assignment submission
document.getElementById('assign-task-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const reportId = document.getElementById('assign-report-id').value;
    const workerId = document.getElementById('worker-dropdown').value;

    try {
        const response = await fetch(`/api/reports/${reportId}/assign`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-notif-paused': localStorage.getItem('notifPaused') || 'false'
            },
            body: JSON.stringify({ EmployeeID: workerId })
        });

        if (response.ok) {
            await customAlert.show('Success',"Operative Assigned!",'alert');
            location.reload();
        }
    } catch (err) {
        console.error("Assignment failed:", err);
    }
});


//loads the active workers so admin can see list of them
async function loadActiveWorkers() {
    try {
        // We fetch workers who are already validated (active)
        const response = await fetch('/api/workers/active'); 
        const workers = await response.json();

        const container = document.getElementById('active-workers-list');
        if (!container) return;
        
        container.innerHTML = ''; 

        if (workers.length === 0) {
            container.innerHTML = '<p class="text-[10px] text-neutral-600 uppercase p-4">No active personnel found.</p>';
            return;
        }

        workers.forEach(worker => {
            const html = `
                <article class="flex items-center justify-between p-4 bg-surface hover:bg-surface-container-high transition-colors rounded-lg mb-1">
                    <section class="flex items-center gap-4">
                        <figure class="w-10 h-10 bg-neutral-800 rounded-sm overflow-hidden flex items-center justify-center">
                            ${worker.ProfilePicture
                            ? `<img src="${worker.ProfilePicture}" class="w-full h-full object-cover" alt="${worker.FirstName}">`
                            : `<span class="material-symbols-outlined text-neutral-500">person</span>`
                            }
                            </figure>
                        <section>
                            <h4 class="text-sm font-bold tracking-tight text-on-surface">${worker.FirstName} ${worker.LastName}</h4>
                            <p class="text-[10px] uppercase text-neutral-500">${worker.Email}</p>
                        </section>
                    </section>
                    <section class="flex items-center gap-4">
                        <span class="px-2 py-1 bg-primary-container/10 text-primary-container text-[10px] font-black uppercase tracking-widest">Active</span>
                        <button onclick="invalidateWorker(${worker.EmployeeID})" 
                                class="text-error hover:text-white hover:bg-error px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest transition-all">
                            Invalidate
                        </button>
                    </section>
                </article>`;
            container.insertAdjacentHTML('beforeend', html);
        });
    } catch (err) {
        console.error("Error loading active workers:", err);
    }
}

// EXPORTS FOR JEST TESTING
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        handleEditSubmit, openEditModal, closeEditModal, loadUnassignedReports, 
        updatePriority, assignToWorker, loadPendingWorkers, approveWorker, 
        handleDelete, invalidateWorker, renderAssignmentTracker, openAssignModal, 
        closeAssignModal, loadWorkerDropdown, loadAssignedTasks, renderAssignmentRows, 
        filterAssignments, openAssignmentDetail, closeAssignmentDetail, 
        toggleAdminDropdown, closeAdminDropdownOutside, openAdminProfile, 
        logoutAdmin, loadActiveWorkers,deleteReportImage,deleteReportFromDetail
    };
}