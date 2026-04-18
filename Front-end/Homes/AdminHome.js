document.addEventListener('DOMContentLoaded', () => {
    loadUnassignedReports();
    loadPendingWorkers();
    loadActiveWorkers();
});

async function loadUnassignedReports() {
    try {
        // Fetching reports where Status is 'Pending'
        const response = await fetch('/api/reports'); 
        const reports = await response.json();
        
        const tableBody = document.getElementById('unassigned-reports-body');
        tableBody.innerHTML = '';

        // Filter for Pending only (or handle this in the backend route)
        const pending = reports.filter(r => r.Status === 'Pending');

    pending.forEach(report => {
    const row = `
        <tr class="border-b border-surface-variant hover:bg-surface-container-high transition-colors">
            <td class="p-4 font-mono text-primary-container">#${report.ReportID}</td>
            <td class="p-4 font-bold">${report.Type}</td>
            <td class="p-4 text-xs font-medium">Ward ${report.WardID}</td>
            <td class="p-4 text-[10px] font-black uppercase tracking-tighter text-orange-400">${report.Status}</td>
            <td class="p-4 text-right flex gap-2 justify-end">
                <button onclick="assignToWorker(${report.ReportID})" 
                        class="bg-primary-container text-on-primary px-4 py-2 rounded text-[10px] font-black uppercase hover:bg-white transition-all">
                    Assign
                </button>
                <button onclick="handleDelete(${report.ReportID})" 
                        class="bg-red-500 text-white px-4 py-2 rounded text-[10px] font-black uppercase hover:bg-red-700 transition-all">
                    Delete
                </button>
            </td>
        </tr>
    `;
    tableBody.insertAdjacentHTML('beforeend', row);
});
    } catch (err) {
        console.error("Failed to load admin ledger:", err);
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
            alert(`Report #${reportId} successfully assigned to Worker #${employeeId}`);
            loadUnassignedReports(); // Refresh table
        } else {
            alert("Assignment failed. Check if Employee ID exists.");
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
            alert("Worker Approved!");
            loadPendingWorkers(); // Refresh the list
        }
    } catch (err) {
        console.error("Validation error:", err);
    }
}

// delete reports
const handleDelete = async (reportId) => {
    const adminEmail = "2820314@students.wits.ac.za"; 

    if (!window.confirm("Are you sure you want to delete this report?")) return;

    try {
        const response = await fetch(`http://18.170.126.9:8080/api/admin/delete-report/${reportId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminEmail })
        });

        const data = await response.json();

        if (data.success) {
            alert("Report deleted successfully");
            loadUnassignedReports(); 
        } else {
            alert("Failed to delete: " + data.message);
        }
    } catch (error) {
        console.error("Error deleting report:", error);
    }
};

async function invalidateWorker(employeeId) {
    const adminEmail = "2820314@students.wits.ac.za";

    if (!confirm("Are you sure you want to disable this account?")) return;

    try {
        const response = await fetch(`/api/workers/invalidate/${employeeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminEmail })
        });

        if (response.ok) {
            alert("Account Disabled!");
            location.reload(); // Refresh to update the UI
        }
    } catch (err) {
        console.error("Invalidation error:", err);
    }
}

// --- LOAD ACTIVE WORKERS ---
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
                            <span class="material-symbols-outlined text-neutral-500">person</span>
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