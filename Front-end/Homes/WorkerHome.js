document.addEventListener('DOMContentLoaded', () => {
    const workerId = localStorage.getItem('workerId');
    const workerName = localStorage.getItem('workerName');

    if (!workerId) {
        window.location.href = "../Login/Worker_login.html";
        return;
    }

    // Update Header
    document.querySelector('p.text-xs.font-bold').textContent = workerName || "Field Operative";

    loadMyAssignedTasks(workerId);
});

async function loadMyAssignedTasks(workerId) {
    try {
        const response = await fetch(`/api/reports/assigned/${workerId}`);
        const reports = await response.json();

        const container = document.getElementById('active-tasks-container');
        container.innerHTML = ''; 

        if (!reports || reports.length === 0) {
            container.innerHTML = `
                <div class="text-center py-10">
                    <p class="text-on-surface-variant text-xs font-bold uppercase tracking-widest">No active tasks assigned</p>
                </div>`;
            return;
        }

        reports.forEach(report => {
            renderTaskCard(report, container);
        });
    } catch (err) {
        console.error("Failed to load worker tasks:", err);
    }
}

function renderTaskCard(report, container) {
    const html = `
        <article class="bg-surface-container-high p-8 rounded-2xl border-l-4 border-primary relative mb-6">
            <header class="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
                <section>
                    <span class="text-[10px] font-bold uppercase tracking-widest text-primary mb-1 block">${report.Status}</span>
                    <h3 class="text-3xl font-black tracking-tight">${report.Type}</h3>
                    <p class="text-on-surface-variant text-sm mt-1">Ward ${report.WardID} • ID: #${report.ReportID}</p>
                </section>
            </header>
            <nav class="flex flex-wrap gap-4">
                <button onclick="resolveTask(${report.ReportID})" class="flex-1 bg-primary text-black px-6 py-4 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
                    <span class="material-symbols-outlined text-base">check_circle</span> Mark as Complete
                </button>
                <button class="bg-surface-container-low text-on-surface px-6 py-4 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-surface-container transition-all border border-outline/50">
                    <span class="material-symbols-outlined text-base">add_a_photo</span> Attach Images
                </button>
            </nav>
        </article>`;
    container.insertAdjacentHTML('beforeend', html);
}

async function resolveTask(reportId) {
    if(!confirm("Are you sure this job is finished?")) return;
    
    try {
        const response = await fetch(`/api/reports/${reportId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Status: 'Resolved', Progress: '100%' })
        });

        if (response.ok) {
            alert("Job Marked as Resolved!");
            location.reload(); // Refresh to clear the task
        }
    } catch (err) {
        console.error("Error resolving task:", err);
    }
}