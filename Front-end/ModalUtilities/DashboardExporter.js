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
                // THE CLEAN FIX: Modify the cloned document, leaving the live UI completely untouched.
                // When html2pdf generates the PDF, it creates an invisible, temporary copy (clone) of the HTML.
                // We manipulate THIS clone so the user doesn't see elements flashing or disappearing on their screen.
            onclone: (clonedDoc) => {
            // Grab references to elements inside the CLONE, not the real webpage
                const mapEl = clonedDoc.getElementById('map');
                const wardMapEl = clonedDoc.getElementById('ward-map'); // The map container on the Guest page
            const navEl = clonedDoc.querySelector('nav'); 
            const mainEl = clonedDoc.getElementById('pdf-region-ward'); // The main wrapper we want to export
            const panelEl = clonedDoc.getElementById('pdf-region-panel');
    
            // Maps cannot be easily converted to PDFs by html2canvas because they rely on
            // complex external canvas tiles. To prevent errors and weird visual glitches, 
            // we simply force them to be hidden in the final PDF.
            if (mapEl) mapEl.style.display = 'none';
            if (wardMapEl) wardMapEl.style.display = 'none'; 
    
            // Hide the navigation bar in the clone so the buttons don't appear in the document
            if (navEl) navEl.style.display = 'none'; 

            // Force the background of the main content to be a dark gray/black.
            // If we don't do this, html2canvas defaults to a transparent/white background, 
            // which makes all of our white text completely invisible in the PDF
            if (mainEl) mainEl.style.backgroundColor = '#131313';
    
            // Reset panel display properties for other dashboard exports
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