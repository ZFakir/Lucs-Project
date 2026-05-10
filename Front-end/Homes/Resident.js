document.addEventListener('DOMContentLoaded', () => {
    // For testing, replace '1' with your actual logic to get the logged-in user's ID
    const residentId = localStorage.getItem('residentId');
    if (!residentId) {
        // Kick them back to the login screen
        window.location.href = '/'; 
        return; // Stop running any more code
    }
    renderSubscribedWards(residentId);
});

async function renderSubscribedWards(residentId) {
    const wardsGrid = document.getElementById('wards-grid');
    const addButton = wardsGrid.lastElementChild; // Keep the "Track New Ward" button

    try {
        const response = await fetch(`/api/residents/${residentId}/subscriptions`);
        
        if (!response.ok) throw new Error('Failed to fetch wards');

        const wards = await response.json();

        // 1. Clear everything EXCEPT the last element (the "Add" button)
        while (wardsGrid.children.length > 1) {
            wardsGrid.removeChild(wardsGrid.firstChild);
        }

        // 2. Map through the array and create cards
        for (const ward of wards) {
            try{
            const wardId = ward.WardID || ward.WardId || ward.wardId || (ward.Ward && ward.Ward.WardID);
            const municipalityId = ward.MunicipalityID || ward.MunicipalityId || (ward.Municipality && ward.Municipality.MunicipalityID);
            
            if(!wardId || !municipalityId) {
                console.warn('Skipping ward with missing IDs:', ward);
                continue;
            }
            let totalIssues=0;
            // Array of municipal-themed Material Symbols
            const wardIcons = [
                'location_city', 
                'domain', 
                'holiday_village', 
                'apartment', 
                'account_balance', 
                'corporate_fare', 
                'foundation', 
                'gite', 
                'villa',
                'cottage'
            ];

            function getRandomIcon() {
                const randomIndex = Math.floor(Math.random() * wardIcons.length);
                return wardIcons[randomIndex];
            }
            const card = document.createElement('article');
            //card.className = "group bg-surface-container-low p-8 relative overflow-hidden transition-all duration-300 hover:bg-surface-container-high cursor-pointer";
            card.className = "group bg-surface-container-low p-8 relative transition-all duration-300 hover:bg-surface-container-high cursor-pointer";
            
            // Fetch both municipality and ward data in parallel
            const [muniResponse, wardResponse] = await Promise.all([
                fetch(`/api/geography/municipalities/${municipalityId}`),
                fetch(`/api/geography/wards/${wardId}`)
            ]);
            
            const municipalityData = (muniResponse && muniResponse.ok) ? await muniResponse.json() : {};
            const wardData = (wardResponse && wardResponse.ok) ? await wardResponse.json() : {};
            
            const MunicipalityName = municipalityData.MunicipalityName.toUpperCase();
            const councillorName = (wardData && wardData.WardCouncillor) 
                           ? wardData.WardCouncillor 
                           : 'Unassigned';
            card.innerHTML = `
            <nav aria-label="Ward management options" class="absolute top-6 right-6 z-20">
                <button aria-haspopup="menu" aria-expanded="false" aria-controls="menu-${wardId}" class="menu-btn text-on-surface-variant hover:text-primary transition-colors" data-ward="${wardId}">
                    <i aria-hidden="true" class="material-symbols-outlined pointer-events-none">more_vert</i>
                    <span class="sr-only">Open options for Ward ${wardId}</span> 
                </button>
                
                <menu id="menu-${wardId}" role="menu" class="dropdown-menu hidden absolute right-0 mt-2 w-48 bg-surface-container-high border border-outline-variant rounded-md shadow-2xl z-50 overflow-hidden p-0 m-0">
                    <li role="none">
                        <button role="menuitem" onclick="manageNotifications(${wardId})" class="w-full text-left px-4 py-3 hover:bg-primary/10 text-on-background transition-colors flex items-center gap-3 font-bold text-sm">
                            <i aria-hidden="true" class="material-symbols-outlined text-[18px]">notifications</i>
                            Manage Alerts
                        </button>
                    </li>
                    <li role="none">
                        <button role="menuitem" onclick="unsubscribeWard(${wardId}, ${municipalityId})" class="w-full text-left px-4 py-3 hover:bg-red-500/10 text-red-400 transition-colors flex items-center gap-3 border-t border-outline-variant font-bold text-sm">
                            <i aria-hidden="true" class="material-symbols-outlined text-[18px]">delete</i>
                            Remove Ward
                        </button>
                    </li>
                </menu>
            </nav>

            <header>
                <p class="label-md block text-orange-500 font-black tracking-[0.2em] mb-4">${(MunicipalityName || 'Yoh FUck').toUpperCase()}</p>
                <h3 class="text-4xl font-black mb-8">WARD ${wardId}</h3>
            </header>

            <dl class="flex items-end justify-between m-0">
                <div class="flex flex-col">
                    <dt class="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">Councillor</dt>
                    <dd class="text-3xl font-black text-primary m-0">${councillorName}</dd>
                </div>
                <dd class="m-0" aria-hidden="true">
                    <i class="material-symbols-outlined text-orange-600/20 text-6xl translate-y-4 group-hover:text-orange-600 transition-colors">
                        ${getRandomIcon()}
                    </i>
                </dd>
            </dl>

            <footer aria-hidden="true" class="absolute bottom-0 left-0 h-1 w-0 bg-primary-container transition-all duration-500 group-hover:w-full"></footer>
        `;

        

            // Insert BEFORE the "Add New Ward" button
        card.addEventListener('click', (event) => {
            const clickedMenu = event.target.closest('nav[aria-label="Ward management options"]');
            
            if (clickedMenu) {
                return; 
            }

            window.location.href = `/NittyGritty/WardPage.html?wardId=${wardId}&muniId=${municipalityId}`;
            });
            wardsGrid.insertBefore(card, addButton);
            
        } catch(innerErr){
            console.error('Error rendering a ward card:', innerErr);
        }
    }
    } catch (error) {
        console.error('Error populating wards:', error);
    }
}


document.addEventListener('click', (event) => {
    // 1. Check if we clicked a three-dots button
    const isMenuButton = event.target.closest('.menu-btn');
    
    // 2. Close ALL open menus first
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
        menu.classList.add('hidden');
    });

    // 3. If we clicked a button, open its specific menu
    if (isMenuButton) {
        const wardId = isMenuButton.getAttribute('data-ward');
        const targetMenu = document.getElementById(`menu-${wardId}`);
        
        if (targetMenu) {
            event.stopPropagation(); // Stop the click from immediately hiding the menu
            targetMenu.classList.remove('hidden');
        }
    }
});

// MANAGE INDIVIDUAL WARD ALERTS MODAL
function manageNotifications(wardId) {
    const residentId = localStorage.getItem('residentId') || '1';
    const prefs = getMutePrefs(residentId);
    
    // Check if the ward is currently muted
    const isMuted = prefs.mutedWards && prefs.mutedWards.includes(String(wardId));

    const dialog = document.getElementById('custom-modal');
    const titleEl = document.getElementById('modal-title');
    const messageEl = document.getElementById('modal-message');
    const actionsEl = document.getElementById('modal-actions');

    // Customize the text based on state
    titleEl.textContent = `Ward ${wardId} Alerts`;
    titleEl.className = isMuted 
        ? 'text-xl font-black tracking-widest text-red-400 mb-2 uppercase' 
        : 'text-xl font-black tracking-widest text-primary mb-2 uppercase';
    
    messageEl.innerHTML = isMuted 
        ? `<span class="text-red-400 font-bold">MUTED</span> — You will not receive updates for this ward in your notifications panel.` 
        : `<span class="text-primary font-bold">ACTIVE</span> — You will receive all updates for this ward in your notifications panel.`;

    // Styling for the toggle button
    const buttonText = isMuted ? 'Unmute Ward' : 'Mute Ward';
    const buttonIcon = isMuted ? 'notifications_active' : 'notifications_off';
    const buttonStyle = isMuted 
        ? 'text-primary bg-primary-container/10 border-primary/20 hover:bg-primary-container/20' 
        : 'text-red-400 bg-red-500/10 border-red-500/20 hover:bg-red-500/20';

    // Inject the custom buttons
    actionsEl.innerHTML = `
        <button id="modal-cancel-manage" class="px-5 py-2 rounded-md text-on-surface-variant hover:text-on-background transition-colors font-bold text-sm">Close</button>
        <button id="modal-toggle-mute" class="px-5 py-2 rounded-md ${buttonStyle} border transition-colors font-bold text-sm flex items-center gap-2">
            <i class="material-symbols-outlined text-[18px]">${buttonIcon}</i>
            ${buttonText}
        </button>
    `;

    // Handle clicks
    document.getElementById('modal-cancel-manage').onclick = () => dialog.close();
    
    document.getElementById('modal-toggle-mute').onclick = async () => {
        dialog.close();
        await toggleWardMute(wardId); // Run the actual logic
    };

    dialog.showModal();
}

async function toggleWardMute(wardId) {
    const residentId = localStorage.getItem('residentId') || '1';
    const prefs = getMutePrefs(residentId);

    if (!prefs.mutedWards) prefs.mutedWards = [];
    // Ensure the unmutedAt map exists
    if (!prefs.unmutedAt) prefs.unmutedAt = {};

    const wardIdStr = String(wardId);
    const index = prefs.mutedWards.indexOf(wardIdStr);

    let isNowMuted = false;

    if (index === -1) {
        // ── MUTING ──
        // Add to muted list and clear any prior unmutedAt so old
        // "show after unmute" logic doesn't interfere with the new mute period.
        prefs.mutedWards.push(wardIdStr);
        delete prefs.unmutedAt[wardIdStr];
        isNowMuted = true;
    } else {
        // ── UNMUTING ──
        // Remove from muted list and record the exact moment we unmuted.
        // loadResidentNotifications will use this timestamp to hide every
        // notification that was created BEFORE this moment (i.e. while muted).
        prefs.mutedWards.splice(index, 1);
        prefs.unmutedAt[wardIdStr] = new Date().toISOString();
    }

    saveMutePrefs(residentId, prefs);

    await loadResidentNotifications(residentId);

    // Update the muted wards list display in the modal if it's open
    const muteModal = document.getElementById('mute-settings-modal');
    if (muteModal && muteModal.open) {
        const muteAllCheckbox = document.getElementById('mute-all');
        muteAllCheckbox.checked = prefs.muteAll || false;
        renderMutedWardsList(currentWardsForMute, prefs);
    }

    showModal(
        isNowMuted ? 'Alerts Muted' : 'Alerts Restored', 
        `Notifications for Ward ${wardId} have been ${isNowMuted ? 'muted' : 'unmuted'}.`, 
        'alert'
    );
}

// ==========================================
// MENU ACTIONS
// ==========================================
// ==========================================
// CUSTOM MODAL CONTROLLER
// ==========================================
function showModal(title, message, type = 'alert') {
    return new Promise((resolve) => {
        const dialog = document.getElementById('custom-modal');
        const titleEl = document.getElementById('modal-title');
        const messageEl = document.getElementById('modal-message');
        const actionsEl = document.getElementById('modal-actions');

        // Set the text
        titleEl.textContent = title;
        messageEl.textContent = message;
        
        // Reset styling and content
        actionsEl.innerHTML = ''; 
        titleEl.className = 'text-xl font-black tracking-widest mb-2 uppercase ';

        if (type === 'confirm') {
            titleEl.className += 'text-red-400'; // Make confirm titles red for warnings
            actionsEl.innerHTML = `
                <button id="modal-cancel" class="px-5 py-2 rounded-md text-on-surface-variant hover:text-on-background hover:bg-white/5 transition-colors font-bold text-sm">Cancel</button>
                <button id="modal-confirm" class="px-5 py-2 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors font-bold text-sm">Remove Ward</button>
            `;

            // Handle Clicks
            document.getElementById('modal-cancel').onclick = () => {
                dialog.close();
                resolve(false); // Returns false, just like clicking 'Cancel' on a native confirm
            };
            document.getElementById('modal-confirm').onclick = () => {
                dialog.close();
                resolve(true); // Returns true, just like clicking 'OK' on a native confirm
            };
        } else {
            // Default Alert Styling
            titleEl.className += title.toLowerCase() === 'error' ? 'text-red-500' : 'text-primary';
            actionsEl.innerHTML = `
                <button id="modal-ok" class="px-5 py-2 rounded-md bg-primary-container/10 text-primary hover:bg-primary-container/20 border border-primary/20 transition-colors font-bold text-sm">Got it</button>
            `;
            
            document.getElementById('modal-ok').onclick = () => {
                dialog.close();
                resolve(true); //resolves the promise
            };
        }

        // Show the modal
        dialog.showModal();
    });
}

async function unsubscribeWard(wardId, municipalityId) { // 🚨 Accept both IDs
    const confirmDelete = await showModal(
        'Remove Ward', 
        `Are you sure you want to stop tracking Ward ${wardId}?`, 
        'confirm'
    );
    
    if (confirmDelete) {
        try {
            const residentId = localStorage.getItem('residentId') || '1'; 

            const response = await fetch('/api/residents/unsubscribe', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ResidentID: residentId,
                    WardID: wardId,
                    MunicipalityID: municipalityId // 🚨 Send both to the backend
                })
            });

            if (response.ok) {
                await showModal('Success', `Ward ${wardId} removed.`, 'alert');
                await renderSubscribedWards(residentId); // Refresh the UI
            }
        } catch (error) {
            console.error('Failed to unsubscribe:', error);
        }
    }
}

// ==========================================
// ADD WARD SELECTION MODAL CONTROLLER (Native Dialog)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const addWardModal = document.getElementById('add-ward-modal');
    const addWardForm = document.getElementById('add-ward-form');
    const closeAddWardIcon = document.getElementById('close-add-ward-icon');
    const closeAddWardBtn = document.getElementById('close-add-ward-btn');

    // 1. Function to Close Dialog safely
    const closeAddModal = () => {
        addWardModal.close(); // Native HTML5 close method
        addWardForm.reset();  // Clear the dropdowns
    };

    // 2. Global click listener to open the modal
    document.addEventListener('click', (event) => {
        const openBtn = event.target.closest('#open-add-ward-btn');
        if (openBtn) {
            addWardModal.showModal(); // Native HTML5 open method
        }
        
        // Close modal if clicking directly on the backdrop
        if (event.target === addWardModal) {
            closeAddModal();
        }
    });

    // 3. Attach Close Events
    if (closeAddWardIcon) closeAddWardIcon.addEventListener('click', closeAddModal);
    if (closeAddWardBtn) closeAddWardBtn.addEventListener('click', closeAddModal);

    // 4. Handle the Form Submission
  // 4. Handle the Form Submission
  if (addWardForm) {
    addWardForm.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        
        const formData = new FormData(addWardForm);
        const selectedWardId = formData.get('ward');
        //capture the MunicipalityID from the dropdown!
        const selectedMuniId = formData.get('municipality'); 
        const residentId = localStorage.getItem('residentId') || '1';

        try {
            const response = await fetch('/api/residents/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ResidentID: residentId,
                    WardID: selectedWardId,
                    MunicipalityID: selectedMuniId // 🚨 Send the ID to the backend
                })
            });

                const data = await response.json();

                // 2. Handle the server's response
                if (response.ok) {
                    // Success (201 Created)! 
                    closeAddModal(); // Hide the modal
                    await renderSubscribedWards(residentId); // Refresh the cards to show the new ward
                    
                    
                } else {
                    // This catches your 400 (duplicate subscription) and 404 errors
                    await showModal('Notice', data.message || data.error, 'alert');
                }

            } catch (error) {
                // This catches network drops or server crashes
                console.error('Failed to subscribe:', error);
                await showModal('Network Error', 'Could not connect to the server to add the ward.', 'alert');
            }
        });
    }
});
// ==========================================
// CASCADING DROPDOWNS CONTROLLER
// ==========================================
const provinceSelect = document.getElementById('province');
const municipalitySelect = document.getElementById('municipality');
const wardSelect = document.getElementById('ward');

const resetDropdown = (selectElement, defaultText) => {
    selectElement.innerHTML = `<option disabled selected value="">${defaultText}</option>`;
};

// Extracted Fetch Functions so the Map can call them
async function loadProvinces() {
    try {
        const response = await fetch('/api/geography/provinces');
        if (response.ok) {
            const provinces = await response.json();
            provinces.forEach(prov => {
                const option = document.createElement('option');
                option.value = prov.ProvinceID;
                option.textContent = prov.ProvinceName;
                provinceSelect.appendChild(option);
            });
        }
    } catch (error) { console.error('Error loading provinces:', error); }
}

async function fetchMunicipalitiesForSelect(provinceId) {
    resetDropdown(municipalitySelect, 'Choose a municipality');
    resetDropdown(wardSelect, 'Choose a ward');
    try {
        const response = await fetch(`/api/geography/provinces/${provinceId}/municipalities`);
        if (response.ok) {
            const municipalities = await response.json();
            municipalities.forEach(muni => {
                const option = document.createElement('option');
                option.value = muni.MunicipalityID;
                option.textContent = muni.MunicipalityName;
                municipalitySelect.appendChild(option);
            });
        }
    } catch (error) { console.error('Error loading municipalities:', error); }
}

async function fetchWardsForSelect(municipalityId) {
    resetDropdown(wardSelect, 'Choose a ward');
    try {
        const response = await fetch(`/api/geography/municipalities/${municipalityId}/wards`);
        if (response.ok) {
            const wards = await response.json();
            wards.forEach(ward => {
                const option = document.createElement('option');
                option.value = ward.WardID;
                option.textContent = `Ward ${ward.WardID} (${ward.WardCouncillor || 'No Councillor listed'})`;
                wardSelect.appendChild(option);
            });
        }
    } catch (error) { console.error('Error loading wards:', error); }
}

// Keep the manual event listeners intact!
provinceSelect.addEventListener('change', (e) => fetchMunicipalitiesForSelect(e.target.value));
municipalitySelect.addEventListener('change', (e) => fetchWardsForSelect(e.target.value));

loadProvinces();


// NOTIFICATIONS PANEL
let loadedReports = [];

// ── Time-ago helper ───────────────────────────────────────────────────────
function getTimeAgo(dateString) {
    const date = new Date(dateString);
    const seconds = Math.floor((new Date() - date) / 1000);
    
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "Y AGO";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "MO AGO";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "D AGO";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "H AGO";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "M AGO";
    
    return "JUST NOW";
}

// ── Render a single notification row ─────────────────────────────────────
// Uses Notification model fields: Title, Type, CreatedAt, _wardId
const createAlertHTML = (notif, index) => {
    // Format the Ward Label (if the ID exists)
    const wardLabel = notif._wardId ? `Ward ${notif._wardId}` : '';

    //Extract the issue type by slicing the Title
    const rawTitle = notif.Title || '';
    const colonIdx = rawTitle.lastIndexOf(':');
    
    // If there's a colon, grab what's after it. Otherwise, fall back to the raw title or a default.
    const issueType = colonIdx !== -1 
        ? rawTitle.slice(colonIdx + 1).trim() 
        : (notif.Type || 'Update');

    const headerLabel = wardLabel ? `${wardLabel} - ${issueType}` : issueType;
    
    const latestTime = notif.CreatedAt || notif.createdAt;

    return `
    <li class="group cursor-pointer hover:bg-white/5 p-3 -mx-3 rounded-lg transition-colors" data-index="${index}">
        <article class="space-y-2 pointer-events-none">
            <header class="flex justify-between items-start">
            <span class="text-orange-500 font-black tracking-widest text-xs uppercase">
                ${headerLabel}
            </span>
                <span class="text-[9px] opacity-40 uppercase">${getTimeAgo(latestTime)}</span>
            </header>
            <p class="text-sm font-bold leading-snug group-hover:text-primary transition-colors">${rawTitle}</p>
            <footer class="h-px w-8 bg-outline-variant group-hover:w-full transition-all"></footer>
        </article>
    </li>
    `;
};

function renderAlerts(reports) {
    const listContainer = document.getElementById('alerts-list-container');
    const emptyMessage = document.getElementById('empty-alerts-message');
    const pulseIndicator = document.getElementById('alert-pulse-indicator');

    // Save to our global variable for modal lookup
    loadedReports = reports;
    listContainer.innerHTML = '';

    if (!reports || reports.length === 0) {
        emptyMessage.classList.remove('hidden');
        pulseIndicator.classList.remove('animate-pulse');
        pulseIndicator.classList.add('opacity-30');
    } else {
        emptyMessage.classList.add('hidden');
        pulseIndicator.classList.add('animate-pulse');
        pulseIndicator.classList.remove('opacity-30');

        // Pass the whole notification object and its array index
        const alertsHTML = reports.map((notif, index) => createAlertHTML(notif, index)).join('');
        listContainer.innerHTML = alertsHTML;
    }
}

// ── Open a notification's detail modal ───────────────────────────────────
async function openReportModal(index) {
    const notif = loadedReports[index];
    if (!notif) return;

    const modal = document.getElementById('report-modal');
    const modalContent = document.getElementById('modal-content');

    const modalHeader = modal.querySelector('h3');

    const createdAt = notif.CreatedAt || notif.createdAt;

    const rawTitle = notif.Title || 'System Alert';
        const colonIdx = rawTitle.lastIndexOf(':');
        
        const issueType = colonIdx !== -1 
            ? rawTitle.slice(colonIdx + 1).trim() 
            : (notif.Type || 'Update');
            
        // Removes the ": Street Light" part from the main title
        const cleanTitle = colonIdx !== -1 
            ? rawTitle.slice(0, colonIdx).trim() 
            : rawTitle;

        // 2. Format the top header
        const wardLabel = notif._wardId ? `Ward ${notif._wardId}` : '';
        const headerText = wardLabel ? `${wardLabel} - ${issueType}` : issueType;

        if (modalHeader) {
            modalHeader.textContent = headerText;
        }

    // Render the text details immediately so the modal opens without delay
    modalContent.innerHTML = `
        <div class="space-y-3">
            <div class="flex justify-between items-center border-b border-white/10 pb-2">
                <span class="text-xs uppercase tracking-widest opacity-50">Title</span>
                <span class="font-bold">${cleanTitle}</span>
            </div>
            <div class="flex justify-between items-center border-b border-white/10 pb-2">
                <span class="text-xs uppercase tracking-widest opacity-50">Type</span>
                <span class="font-bold">${issueType}</span>
            </div>
            <div class="flex justify-between items-center border-b border-white/10 pb-2">
                <span class="text-xs uppercase tracking-widest opacity-50">Date Received</span>
                <span class="font-bold">${new Date(createdAt).toLocaleDateString()} ${new Date(createdAt).toLocaleTimeString()}</span>
            </div>

            <div class="mt-6 pt-4">
                <span class="text-xs uppercase tracking-widest opacity-50 block mb-2">Details</span>
                <div class="bg-black/20 p-4 rounded-lg text-sm font-medium leading-relaxed">
                    ${notif.Progress || notif.Description || 'No further details have been provided for this report.'}
                </div>
            </div>

            <div class="mt-6 pt-4">
                <span class="text-xs uppercase tracking-widest opacity-50 block mb-2">Attached Images</span>
                <div id="modal-images-container" class="flex flex-wrap gap-4 min-h-[6rem] items-center">
                    <span class="text-xs opacity-40 italic text-orange-300">Loading images...</span>
                </div>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');

    // Fetch images only when this notification is linked to a report
    const realReportId = notif.ReportID || notif.reportId || notif.ReportId;
    const imagesContainer = document.getElementById('modal-images-container');
    if (!realReportId) {
        imagesContainer.innerHTML = `<span class="text-xs opacity-40 italic">No images attached.</span>`;
        return;
    }

    try {
        const res = await fetch(`/api/reportImages/report/${realReportId}`);

        // 404 means no images were uploaded for this report — that's fine
        if (res.status === 404) {
            imagesContainer.innerHTML = `<span class="text-xs opacity-40 italic">No images attached.</span>`;
            return;
        }
        if (!res.ok) throw new Error('Image fetch failed');

        const images = await res.json();

        if (!images || images.length === 0) {
            imagesContainer.innerHTML = `<span class="text-xs opacity-40 italic">No images attached.</span>`;
            return;
        }

        // Render each image as a clickable thumbnail that opens full-size in a new tab
        imagesContainer.innerHTML = images.map(img => `
            <a href="data:${img.Type};base64,${img.base64}" target="_blank" rel="noopener"
               title="Click to view full size">
                <img
                    src="data:${img.Type};base64,${img.base64}"
                    alt="Report image"
                    class="w-24 h-24 object-cover rounded-lg border border-white/10
                           hover:border-orange-500 transition-colors cursor-pointer"
                />
            </a>
        `).join('');

    } catch (err) {
        console.error('Failed to load report images:', err);
        imagesContainer.innerHTML = `<span class="text-xs text-red-400 italic">Could not load images.</span>`;
    }
}

function closeReportModal() {
    document.getElementById('report-modal').classList.add('hidden');
}

// ── Mute preference helpers ───────────────────────────────────────────────
// Shape: { muteAll: bool, mutedWards: string[], unmutedAt: { [wardId]: isoString } }
// unmutedAt[wardId] records the exact moment a ward was unmuted so that any
// notification created BEFORE that moment (i.e. while the ward was muted) is
// permanently hidden even after the user unmutes the ward.
function getMutePrefs(residentId) {
    const raw = localStorage.getItem(`mutePrefs_${residentId}`);
    const prefs = raw ? JSON.parse(raw) : {};
    // Ensure all keys exist with safe defaults
    if (!prefs.muteAll)      prefs.muteAll      = false;
    if (!prefs.mutedWards)   prefs.mutedWards   = [];
    if (!prefs.unmutedAt)    prefs.unmutedAt    = {};
    return prefs;
}

function saveMutePrefs(residentId, prefs) {
    localStorage.setItem(`mutePrefs_${residentId}`, JSON.stringify(prefs));
}

// ── Core notification loader ──────────────────────────────────────────────
// Fetches real Notification records from the DB (GET /api/notifications/:id),
// resolves each notification's WardID via a ReportID→WardID lookup built from
// the resident's subscribed ward reports, then filters by mute preferences.
async function loadResidentNotifications(residentId) {
    try {
        // Fetch subscriptions so we know which wards this resident tracks
        const subRes = await fetch(`/api/residents/${residentId}/subscriptions`);
        if (!subRes.ok) throw new Error('Failed to fetch subscriptions');
        const subscribedWards = await subRes.json();

        if (subscribedWards.length === 0) {
            loadedReports = [];
            renderAlerts([]);
            return;
        }

        // Fetch real Notification records for this resident
        const notifRes = await fetch(`/api/notifications/${residentId}`);
        if (!notifRes.ok) throw new Error('Failed to fetch notifications');
        let notifications = await notifRes.json();

        // Build ReportID → WardID lookup from ward report lists.
        //This lets us filter notifications by ward for muting
        const reportWardMap = {};
        const reportFetches = subscribedWards.map(ward => {
            const wardId = ward.WardID || ward.WardId || ward.wardId || (ward.Ward && ward.Ward.WardID);
            const muniId = ward.MunicipalityID;
            if (!wardId || !muniId) return Promise.resolve();
            return fetch(`/api/reports/ward/${wardId}/${muniId}`)
                .then(r => r.ok ? r.json() : [])
                .then(reports => {
                    reports.forEach(r => {
                        // Guard against ReportID being named differently (ReportID, reportId, id, etc.)
                        const id = r.ReportID ?? r.reportId ?? r.ReportId ?? r.id;
                        if (id != null) reportWardMap[String(id)] = String(wardId);
                    });
                })
                .catch(err => {
                    console.error(`Could not load reports for ward ${wardId}:`, err);
                });
        });
        await Promise.all(reportFetches);

        // 4. Augment every notification with a _wardId field so the render
        //    and filter functions can reference it without extra lookups.
        notifications = notifications.map(notif => ({
            ...notif,
            _wardId: (() => {
                const rid = notif.ReportID ?? notif.reportId ?? notif.ReportId;
                return rid != null ? (reportWardMap[String(rid)] || null) : null;
            })()
        }));

        // 5. Apply mute filters
        const mutePrefs = getMutePrefs(residentId);
        notifications = notifications.filter(notif => {
            // Hide everything when the resident has muted all wards
            if (mutePrefs.muteAll) return false;

            const wardId = notif._wardId;
            if (!wardId) return true; // Can't filter without a WardID — show it

            // Hide if the ward is currently muted
            if (mutePrefs.mutedWards.includes(wardId)) return false;

            // Hide notifications that arrived WHILE the ward was muted.
            // When a ward is unmuted we record the timestamp in unmutedAt[wardId].
            // Any notification whose CreatedAt is earlier than that timestamp was
            // generated during the mute period and must stay hidden permanently.
            const unmutedAt = mutePrefs.unmutedAt[wardId];
            if (unmutedAt) {
                const notifCreated = new Date(notif.CreatedAt || notif.createdAt);
                const unmuteTime   = new Date(unmutedAt);
                if (notifCreated < unmuteTime) return false;
            }

            return true;
        });

        // Sort newest first
        notifications.sort((a, b) => {
            return new Date(b.CreatedAt || b.createdAt) - new Date(a.CreatedAt || a.createdAt);
        });

        loadedReports = notifications;
        renderAlerts(notifications);

    } catch (error) {
        console.error("Error loading notifications:", error);
        document.getElementById('alerts-list-container').innerHTML = 
            `<li class="text-sm text-red-500">Failed to load alerts.</li>`;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const currentResidentId = localStorage.getItem('residentId') || 1;

    // Initial load, then poll every 30 seconds for new notifications
    loadResidentNotifications(currentResidentId);
    setInterval(() => loadResidentNotifications(currentResidentId), 30000);

    //Clear All Button
    const clearAllBtn = document.getElementById('clear-alerts-btn');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', async () => {
            if (!confirm('Are you sure you want to clear all alerts? This action cannot be undone.')) return;
            if (!loadedReports || loadedReports.length === 0) return;

            try {
                const res = await fetch(`/api/notifications/${currentResidentId}/clear-all`, {
                    method: 'DELETE'
                });
                if (!res.ok) throw new Error('Server rejected the clear-all request');

                // Immediately clear the UI
                loadedReports = [];
                renderAlerts([]);
            } catch (error) {
                console.error('Error clearing alerts:', error);
            }
        });
    }

    document.getElementById('alerts-list-container').addEventListener('click', (e) => {
        // Find the nearest list item that was clicked
        const clickedItem = e.target.closest('li[data-index]');
        if (clickedItem) {
            const index = clickedItem.getAttribute('data-index');
            openReportModal(index);
        }
    });

    // Listen for close button click
    const closeBtn = document.getElementById('close-modal-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeReportModal);
    }

    // Close the modal if the user clicks the dark background outside the modal
    const modal = document.getElementById('report-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeReportModal();
            }
        });
    }

// ── Notification Settings Logic ──────────────────────────────────────────
    const bellBtn = document.getElementById('notification-bell-btn');
    const muteModal = document.getElementById('mute-settings-modal');
    const closeMuteIcon = document.getElementById('close-mute-modal-icon');
    const closeMuteBtn = document.getElementById('close-mute-modal-btn');
    const muteAllCheckbox = document.getElementById('mute-all');
    const mutedWardsList = document.getElementById('muted-wards-list');

    // We'll store the wards globally so the checkbox toggle can access them
    let currentWardsForMute = []; 

    // Open the Modal
    if (bellBtn) {
        bellBtn.addEventListener('click', async () => {
            const residentId = localStorage.getItem('residentId') || 1;
            if (!residentId) {
                console.error('No resident ID found');
                return;
            }

            try {
                const response = await fetch(`/api/residents/${residentId}/subscriptions`);
                if (!response.ok) throw new Error('Failed to fetch subscriptions');

                currentWardsForMute = await response.json();

                // Restore saved preference
                const prefs = getMutePrefs(residentId);
                muteAllCheckbox.checked = prefs.muteAll || false;
                
                // Render the visual list of muted wards based on preferences
                renderMutedWardsList(currentWardsForMute, prefs);

                muteModal.showModal();
            } catch (error) {
                console.error('Error loading wards for mute settings:', error);
            }
        });
    }

    // Close Modal Handlers
    const closeMuteModal = () => muteModal.close();
    if (closeMuteIcon) closeMuteIcon.addEventListener('click', closeMuteModal);
    if (closeMuteBtn) closeMuteBtn.addEventListener('click', closeMuteModal);

    if (muteModal) {
        muteModal.addEventListener('click', (e) => {
            if (e.target === muteModal) closeMuteModal();
        });
    }

    // Mute All Checkbox
    muteAllCheckbox.addEventListener('change', (e) => {
        const isMuted = e.target.checked;
        
        //if muteall show all if mute some show some
        const prefs = getMutePrefs(currentResidentId);
        prefs.muteAll = isMuted;

        // Save preferences and reload notifications visually
        saveMutePrefs(currentResidentId, prefs);
        loadResidentNotifications(currentResidentId);

        // Dynamically update the Muted Wards list in the UI 
        renderMutedWardsList(currentWardsForMute, prefs);
    });

    // Helper to render muted wards list
    function renderMutedWardsList(wards, prefs) {
        const listElement = document.getElementById('muted-wards-list');
        if (!listElement) return;
        
        let wardsToDisplay = [];
        
        if (prefs.muteAll) {
            wardsToDisplay = wards;
        } else if (prefs.mutedWards && prefs.mutedWards.length > 0) {
            wardsToDisplay = wards.filter(ward => {
                const extractedId = ward.WardID || ward.WardId || ward.wardId || (ward.Ward && ward.Ward.WardID);
                return prefs.mutedWards.includes(String(extractedId));
            });
        }
        
        if (wardsToDisplay.length > 0) {
            listElement.innerHTML = wardsToDisplay.map(ward => {
                const extractedId = ward.WardID || ward.WardId || ward.wardId || (ward.Ward && ward.Ward.WardID);
                return `
                    <li class="flex items-center gap-2 text-sm font-bold text-on-surface-variant py-1 border-b border-white/5 last:border-0">
                        <i aria-hidden="true" class="material-symbols-outlined text-[16px] text-red-400">notifications_off</i>
                       Ward ${extractedId}
                    </li>
                `;
            }).join('');
        }
    }
});



// Closes account when clicking outside
document.addEventListener('click', (event) => {
    const detailsElement = document.querySelector('nav details');
    
    // Check if the click was outside the dropdown menu
    if (detailsElement && !detailsElement.contains(event.target)) {
        detailsElement.removeAttribute('open');
    }
});

// Expose functions to the global window object so inline HTML onclicks can use them
window.manageNotifications = manageNotifications;
window.unsubscribeWard = unsubscribeWard;