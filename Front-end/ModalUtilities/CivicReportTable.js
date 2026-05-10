class CivicTable {
    /**
     * @param {string} containerId - The ID of the empty <div> where the table should go
     * @param {function} onRowClick - What to do when a row is clicked (usually open the modal)
     */
    constructor(containerId, onRowClick) {
        this.container = document.getElementById(containerId);
        this.onRowClick = onRowClick;

        if (!this.container) {
            console.error(`CivicTable Error: Could not find element with ID '${containerId}'`);
        }
    }

    // Standardizes the status badges
getBadgeHTML(statusStr) {
        const progressStr = (statusStr || '').toLowerCase(); 
        
        //Fix textwrapping for "in progress"
        const baseClasses = "px-3 py-1 text-[10px] font-black uppercase rounded-full whitespace-nowrap inline-block";

        if (progressStr === 'resolved') {
            return `<span class="bg-surface-container-highest text-on-surface-variant ${baseClasses}">Resolved</span>`;
        } else if (progressStr === 'in progress' || progressStr === 'assigned to field staff') {
            return `<span class="bg-[#FF8C00]/20 text-[#FF8C00] border border-[#FF8C00]/40 ${baseClasses}">In Progress</span>`;
        } else {
            return `<span class="bg-[#FF8C00] text-[#4d2600] ${baseClasses}">Active</span>`;
        }
    }

    // Standardizes the icons
    getIcon(typeStr) {
        const iconMap = {
            'pothole': 'road',
            'water leak': 'water_drop',
            'street light': 'lightbulb',
            'illegal dumping': 'delete',
            'electricity': 'bolt',
            'sanitation': 'recycling'
        };
        return iconMap[(typeStr || '').toLowerCase()] || 'report_problem';
    }

    /**
     * Call this whenever you want to draw or redraw the table with new data
     * @param {Array} reports - The array of report objects from your database
     */
    render(reports) {
        if (!this.container) return;

        // 1. Build the table skeleton if it doesn't exist yet
        if (!this.container.querySelector('table')) {
            this.container.innerHTML = `
                <div class="max-h-[60vh] overflow-y-auto">
                    <table class="w-full text-left border-collapse">
                        <thead class="sticky top-0 bg-surface-container-low shadow-md z-10">
                            <tr class="text-on-surface-variant">
                                <th class="px-8 py-4 text-[0.7rem] font-black uppercase tracking-widest" scope="col">Type</th>
                                <th class="px-8 py-4 text-[0.7rem] font-black uppercase tracking-widest" scope="col">Description</th>
                                <th class="px-8 py-4 text-[0.7rem] font-black uppercase tracking-widest text-center" scope="col">Status</th>
                                <th class="px-8 py-4 text-[0.7rem] font-black uppercase tracking-widest text-right" scope="col">Date Reported</th>
                            </tr>
                        </thead>
                        <tbody id="${this.container.id}-tbody" class="divide-y divide-white/5">
                        </tbody>
                    </table>
                </div>
            `;
        }

        const tbody = document.getElementById(`${this.container.id}-tbody`);
        tbody.innerHTML = ''; // Wipe old rows

        // 2. Handle empty states
        if (!reports || reports.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="px-8 py-6 text-center text-on-surface-variant font-bold">No issues found for this view.</td></tr>`;
            return;
        }

        // 3. Populate the rows
        reports.forEach(report => {
            const icon = this.getIcon(report.Type);
            const statusBadge = this.getBadgeHTML(report.Progress);
            const formattedDate = report.CreatedAt ? new Date(report.CreatedAt).toISOString().split('T')[0] : 'Unknown';

            const tr = document.createElement('tr'); 
            tr.className = 'hover:bg-surface-container-high transition-colors group cursor-pointer';
            
            tr.innerHTML = `
                <td class="px-8 py-4">
                    <span class="flex items-center gap-3">
                        <span class="material-symbols-outlined text-[#FF8C00]" style="font-variation-settings: 'FILL' 1;">${icon}</span>
                        <span class="font-bold text-white uppercase tracking-tight">${report.Type || 'General'}</span>
                    </span>
                </td>
                <td class="px-8 py-4 text-on-surface-variant font-medium text-sm truncate max-w-[200px]" title="${report.Brief || 'No description provided.'}">
                    ${report.Brief || 'No description provided.'}
                </td>
                <td class="px-8 py-4 text-center">${statusBadge}</td>
                <td class="px-8 py-4 text-right font-mono text-on-surface-variant text-sm">${formattedDate}</td>
            `;
            
            // 4. Attach the click listener dynamically
            tr.onclick = () => {
                if (this.onRowClick) {
                    this.onRowClick(report); // Pass the raw report data back up
                }
            };
            
            tbody.appendChild(tr);
        });
    }
}

/* istanbul ignore next */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CivicTable };
}