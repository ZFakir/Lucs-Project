import {withHammerLoader} from './loaderUtils';
// --- START GLOBAL STATE ---
let currentReports = []; 
let activeReportId = null;
let issueModal = null; // Holds CivicModal instance
let currentRating = 0;

// Function must be attached to 'window' so the button's onclick can find it
window.openFeedbackModal = (reportId) => {
    activeReportId = reportId;
    const modal = document.getElementById('feedback-modal');
    resetStars(); 
    if (modal) modal.showModal();
};

function updateStarUI(rating) {
    const stars = document.querySelectorAll('.star-btn span');
    
    stars.forEach((star, index) => {
        if (index < rating) {
            // Force Orange Color and Filled state
            star.style.color = '#ffb77d'; // Your 'primary' orange color
            star.style.fontVariationSettings = "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24";
            star.classList.remove('text-white/20');
        } else {
            // Return to Dimmed White and Outlined state
            star.style.color = 'rgba(255, 255, 255, 0.2)'; // text-white/20
            star.style.fontVariationSettings = "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24";
        }
    });
}

function resetStars() {
    currentRating = 0;
    updateStarUI(0);
}

// =====================================================
function injectFeedbackAction(report) {
    const modalMain = document.querySelector(`#${issueModal.modalId} main`);
    if (!modalMain) return;

    const existing = document.getElementById('dynamic-feedback-container');
    if (existing) existing.remove();

    const actionContainer = document.createElement('div');
    actionContainer.id = 'dynamic-feedback-container';
    actionContainer.className = 'mt-6 pt-6 border-t border-white/5 flex flex-col gap-3';

    const isResolved = (report.Progress || '').toLowerCase() === 'resolved' || 
                       (report.Status || '').toLowerCase() === 'fixed';

    // 🚨 NEW: Check if feedback was already given (via DB or LocalStorage)
    const submittedFeedback = JSON.parse(localStorage.getItem('submittedFeedback') || '[]');
    const hasGivenFeedback = (report.Rating && report.Rating > 0) || submittedFeedback.includes(String(report.ReportID));

    const feedbackBtn = document.createElement('button');

    if (hasGivenFeedback) {
        // STATE 1: ALREADY RATED (Disabled)
        feedbackBtn.disabled = true;
        feedbackBtn.className = 'w-full py-3 bg-surface-container-highest text-on-surface-variant font-black uppercase tracking-widest text-xs rounded-lg cursor-not-allowed opacity-50 flex items-center justify-center gap-2';
        feedbackBtn.innerHTML = `<i class="material-symbols-outlined text-sm">check_circle</i> Feedback Submitted`;
        
    } else if (isResolved) {
        // STATE 2: READY FOR FEEDBACK (Active)
        feedbackBtn.className = 'w-full py-3 bg-[#FF8C00] text-white font-black uppercase tracking-widest text-xs rounded-lg transition-all hover:brightness-110 active:scale-95 shadow-lg shadow-[#FF8C00]/20';
        feedbackBtn.innerHTML = `Give Feedback`;
        feedbackBtn.onclick = () => window.openFeedbackModal(report.ReportID);
        
    } else {
        // STATE 3: PENDING RESOLUTION (Disabled)
        feedbackBtn.disabled = true;
        feedbackBtn.className = 'w-full py-3 bg-white/5 text-black/40 border border-white/5 font-black uppercase tracking-widest text-xs rounded-lg cursor-not-allowed';
        feedbackBtn.innerHTML = `Feedback (Unlock on Resolution)`;
        
        const infoText = document.createElement('p');
        infoText.className = 'text-[10px] text-center text-white/40 italic m-0';
        infoText.textContent = "You can provide feedback once this issue is marked as Resolved.";
        actionContainer.appendChild(infoText);
    }

    actionContainer.prepend(feedbackBtn);
    modalMain.appendChild(actionContainer);
}

async function openMyReportModal(reportId) {
    // Tripwire 1: Did the click actually register?
    console.log("1. Clicked row! Trying to open modal for ID:", reportId);

    const report = currentReports.find(r => String(r.ReportID) === String(reportId));
    // Tripwire 2: Did it find the report in the array?
    console.log("2. Found report data:", report);

    if (!report) {
        console.warn("SILENT EXIT: Report was not found in currentReports!");
        return; 
    }

    activeReportId = reportId;

    // Optional: Fetch images if your backend supports it, otherwise leave empty array
    let fetchedImages = [];
    try {
        // Tripwire 3: Is the server hanging on the image fetch?
        console.log("3. Fetching images from server...");
        const response = await fetch(`/api/reports/report/${reportId}`);
        if (response.ok) {
            const imgData = await response.json();
            fetchedImages = imgData; // The modal handles the BLOB conversion
            console.log("4. Images fetched successfully!");
        } else {
            console.log("4. Server returned an error for images, continuing anyway.");
        }
    } catch (error) {
        console.error('No images found');
    }

    console.log("5. About to open the modal UI...");

    //const muniName = report.Ward?.Municipality?.MunicipalityName || "UNKNOWN MUNICIPALITY";
    // Map data to match CivicModal expectations
    const modalData = {
        type: report.Type,
        description: report.Brief || 'No description provided.',
        date: report.CreatedAt,
        status: report.Progress || report.Status,
        ward: report.WardID,
        municipality: report.MunicipalityID, 
        images: fetchedImages
    };

    // Open the modal
    issueModal.open(modalData);

    const wardElement = document.getElementById(`${issueModal.modalId}-ward`);
    const muniElement = document.getElementById(`${issueModal.modalId}-muni`);
    
    if (wardElement) {
        wardElement.classList.remove('text-white');
        wardElement.classList.add('text-black');
    }
    
    if (muniElement) {
        muniElement.classList.remove('text-white');
        muniElement.classList.add('text-black');
    }
    
    // Inject the Feedback logic
    injectFeedbackAction(report);
}
// =====================================================


// --- END GLOBAL STATE ---

document.addEventListener('DOMContentLoaded', async () => {
    // Initialise the modal from class
    issueModal = new CivicModal();

    const residentId = localStorage.getItem('residentId');
    console.log("Looking for reports belonging to Resident ID:", residentId);
    const grid = document.getElementById('reports-grid');

    // --- START MODAL LISTENERS ---
    const modal = document.getElementById('feedback-modal');
    const closeXBtn = document.getElementById('close-feedback-x');
    const submitBtn = document.getElementById('submit-feedback');
    const stars = document.querySelectorAll('.star-btn');

    // Handle X Button Click
    if (closeXBtn) {
        closeXBtn.addEventListener('click', () => {
            modal.close();
        });
    }

    // Handle Submit Button Click
    if (submitBtn) {
        await withHammerLoader(async () => {
            submitBtn.addEventListener('click', async () => {
                if (currentRating === 0) {
                    alert("Please select a rating before submitting.");
                    return;
                }
                
                // Change button state to show it's working
                submitBtn.disabled = true;
                submitBtn.innerText = "Submitting...";

                try {
                    const response = await fetch(`/api/reports/${activeReportId}/rating`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ rating: currentRating })
                    });

                    const result = await response.json();

                    if (response.ok) {
                        const submittedFeedback = JSON.parse(localStorage.getItem('submittedFeedback') || '[]');
                        if (!submittedFeedback.includes(String(activeReportId))) {
                            submittedFeedback.push(String(activeReportId));
                            localStorage.setItem('submittedFeedback', JSON.stringify(submittedFeedback));
                        }
                        alert("Thank you for your feedback!");
                        modal.close();
                        // Optional: You could reload the page or update the UI to hide the feedback button
                        location.reload(); 
                    } else {
                        throw new Error(result.error || "Failed to submit rating");
                    }
                    
                } catch (err) {
                    console.error("Submit Error:", err);
                    alert("Error submitting feedback. Please try again.");
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.innerText = "Submit Feedback";
                }
            });
        });
    }

    stars.forEach(star => {
        star.addEventListener('click', (e) => {
            // Use e.currentTarget to safely get the button value
            const ratingValue = parseInt(e.currentTarget.getAttribute('data-value'));
            currentRating = ratingValue;
            if (typeof updateStarUI === "function") updateStarUI(ratingValue);
            console.log(`Rating captured: ${currentRating}`);
            });
    });
    // --- END MODAL LISTENERS ---

    if (!residentId) {
        grid.innerHTML = `<p class="col-span-full text-center text-error">User Session Not Found.</p>`;
        return;
    }

    try {
        // GET: Fetch all reports for a SPECIFIC Resident
        const response = await fetch(`/api/reports/resident/${residentId}`);
        if (!response.ok) throw new Error('Failed to fetch reports');
        
        //const reports = await response.json();
        const data = await response.json();
        currentReports = data.reports || data; // Fallback handles both object and array structures
        
        if (currentReports.length === 0) {
            grid.innerHTML = `<p class="col-span-full text-center py-20 opacity-50 uppercase tracking-widest text-xs">No reports logged yet.</p>`;
            return;
        }

        // ADD THIS: Check what the database actually sent back!
        console.log("Fetched Reports from DB:", currentReports);

        grid.innerHTML = ''; // Clear loading state

        // Simplified List Rendering
        currentReports.forEach(report => {
            const isResolved = (report.Progress || '').toLowerCase() === 'resolved' || report.Status === 'Fixed';
            const statusColor = isResolved ? 'text-green-500' : 'text-orange-500';
            const formattedDate = report.CreatedAt ? new Date(report.CreatedAt).toLocaleDateString() : 'RECENT';

            const row = document.createElement('div');
            row.className = "flex items-center justify-between p-4 bg-surface-container-low border-b border-white/5 hover:bg-surface-container-high transition-colors cursor-pointer";
            
            // Minimal layout: Type, Status, and Date
            row.innerHTML = `
                <div class="flex items-center gap-4">
                    <span class="material-symbols-outlined text-[#FF8C00]">description</span>
                    <div>
                        <h3 class="text-sm font-black uppercase text-white tracking-tight">${report.Type || 'ISSUE'}</h3>
                        <span class="text-[10px] font-bold uppercase tracking-widest ${statusColor}">${report.Progress || report.Status || 'PENDING'}</span>
                    </div>
                </div>
                <div class="text-right flex flex-col">
                    <span class="text-xs font-mono text-white/40">ID: ${report.ReportID}</span>
                    <span class="text-[10px] uppercase font-bold text-white/60 tracking-widest">${formattedDate}</span>
                </div>
            `;

            // Click opens the CivicModal
            row.onclick = () => openMyReportModal(report.ReportID);
            grid.appendChild(row);
        });

    } catch (err) {
        console.error('Error:', err);
        grid.innerHTML = `<p class="col-span-full text-center text-error">Error connecting to database.</p>`;
    }
});