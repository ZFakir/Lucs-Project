class DashboardExporter {
    /**
     * @param {string} buttonId - The ID of the export button
     * @param {string} targetSelector - The CSS selector of the container to capture (e.g., 'main')
     * @param {string} filenamePrefix - The prefix for the downloaded file (e.g., 'Age_Report')
     */
    constructor(buttonId, targetSelector, filenamePrefix) {
        this.exportBtn = document.getElementById(buttonId);
        this.targetSelector = targetSelector;
        this.filenamePrefix = filenamePrefix;

        if (this.exportBtn) {
            this.exportBtn.addEventListener('click', () => this.generatePDF());
        }
    }

generatePDF() {
        const originalHtml = this.exportBtn.innerHTML;
        this.exportBtn.innerHTML = `<span class="material-symbols-outlined animate-spin text-[1.2rem]">sync</span> Generating...`;
        
        const element = document.querySelector(this.targetSelector); 
        if (!element) return;

        const originalScrollY = window.scrollY;
        const originalScrollX = window.scrollX;
        window.scrollTo(0, 0);

        const dashboardWidth = element.scrollWidth;
        const dashboardHeight = element.scrollHeight;

        const opt = {
            margin:       0, 
            filename:     `${this.filenamePrefix}_${new Date().toISOString().split('T')[0]}.pdf`,
            image:        { type: 'jpeg', quality: 1 },
            html2canvas:  { 
                scale: 2, 
                useCORS: true, 
                backgroundColor: '#131313',
                // Modify the clone
                onclone: (clonedDoc) => {
                    const mapEl = clonedDoc.getElementById('map');
                    const panelEl = clonedDoc.getElementById('pdf-region-panel');
                    
                    if (mapEl) mapEl.style.display = 'none';
                    if (panelEl) {
                        panelEl.classList.remove('hidden');
                        panelEl.style.display = 'flex';
                    }
                }
            },
            jsPDF:        { 
                unit: 'px', 
                format: [dashboardWidth, dashboardHeight], 
                orientation: dashboardWidth > dashboardHeight ? 'landscape' : 'portrait' 
            }
        };

        // Remove set timeout and reverting
        html2pdf().set(opt).from(element).save().then(() => {
            this.exportBtn.innerHTML = originalHtml;
            window.scrollTo(originalScrollX, originalScrollY);
        }).catch(err => {
            console.error("PDF Generation Failed:", err);
            this.exportBtn.innerHTML = originalHtml;
            window.scrollTo(originalScrollX, originalScrollY);
        });
    }
}

/* istanbul ignore next */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DashboardExporter };
}