// Global variable to store loaded reports for modal access
let loadedReports = [];
import { LocationPicker } from '../ModalUtilities/LocationPicker.js';

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
        wards.forEach( async (ward) => {
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
            // Note: Update 'ward.district' and 'ward.number' to match your SQL column names
            const muniResponse = await fetch(`/api/geography/municipalities/${ward.MunicipalityID}`);
            const municipalityData = await muniResponse.json();
            const MunicipalityName=municipalityData.MunicipalityName.toUpperCase();
            const councillorName = (ward.Ward && ward.Ward.WardCouncillor) 
                           ? ward.Ward.WardCouncillor 
                           : 'Unassigned';
            console.log(ward);
            card.innerHTML = `
            <nav aria-label="Ward management options" class="absolute top-6 right-6 z-20">
                <button aria-haspopup="menu" aria-expanded="false" aria-controls="menu-${ward.WardID}" class="menu-btn text-on-surface-variant hover:text-primary transition-colors" data-ward="${ward.WardID}">
                    <i aria-hidden="true" class="material-symbols-outlined pointer-events-none">more_vert</i>
                    <span class="sr-only">Open options for Ward ${ward.WardID}</span> 
                </button>
                
                <menu id="menu-${ward.WardID}" role="menu" class="dropdown-menu hidden absolute right-0 mt-2 w-48 bg-surface-container-high border border-outline-variant rounded-md shadow-2xl z-50 overflow-hidden p-0 m-0">
                    <li role="none">
                        <button role="menuitem" onclick="manageNotifications(${ward.WardID})" class="w-full text-left px-4 py-3 hover:bg-primary/10 text-on-background transition-colors flex items-center gap-3 font-bold text-sm">
                            <i aria-hidden="true" class="material-symbols-outlined text-[18px]">notifications</i>
                            Manage Alerts
                        </button>
                    </li>
                    <li role="none">
                        <button role="menuitem" onclick="unsubscribeWard(${ward.WardID})" class="w-full text-left px-4 py-3 hover:bg-red-500/10 text-red-400 transition-colors flex items-center gap-3 border-t border-outline-variant font-bold text-sm">
                            <i aria-hidden="true" class="material-symbols-outlined text-[18px]">delete</i>
                            Remove Ward
                        </button>
                    </li>
                </menu>
            </nav>

            <header>
                <p class="label-md block text-orange-500 font-black tracking-[0.2em] mb-4">${(MunicipalityName || 'Yoh FUck').toUpperCase()}</p>
                <h3 class="text-4xl font-black mb-8">WARD ${ward.WardID}</h3>
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

    // 🚨 UPDATE THIS LINE: Add &muniId=${ward.MunicipalityID}
    window.location.href = `/NittyGritty/WardPage.html?wardId=${ward.WardID}&muniId=${ward.MunicipalityID}`;
});
            wardsGrid.insertBefore(card, addButton);
        });

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

// Placeholder functions for your buttons
function manageNotifications(wardId) {
    console.log(`Managing notifications for Ward ${wardId}`);
    // Add your routing logic here
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
        // 🚨 NEW: You must capture the MunicipalityID from the dropdown!
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

//notifications

// timestamps

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

// Updated to pass the full report object and an index, and added cursor-pointer
const createAlertHTML = (report, index) => `
    <li class="group cursor-pointer hover:bg-white/5 p-3 -mx-3 rounded-lg transition-colors" data-index="${index}">
        <article class="space-y-2 pointer-events-none"> <header class="flex justify-between items-start">
                <span class="text-orange-500 font-black tracking-widest text-[10px] uppercase">
                Ward ${report.WardID} - ${report.Type || 'SYSTEM ALERT'}
                </span>
                <span class="text-[9px] opacity-40 uppercase">${getTimeAgo(report.CreatedAt)}</span>
            </header>
            <p class="text-sm font-bold leading-snug group-hover:text-primary transition-colors">${report.Progress || 'No details provided.'}</p>
            <footer class="h-px w-8 bg-outline-variant group-hover:w-full transition-all"></footer>
        </article>
    </li>
`;

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

        // Pass the whole report object and its array index
        const alertsHTML = reports.map((report, index) => createAlertHTML(report, index)).join('');
        listContainer.innerHTML = alertsHTML;
    }
}

// Modal Control Functions
function openReportModal(index) {
    const report = loadedReports[index];
    if (!report) return;

    const modal = document.getElementById('report-modal');
    const modalContent = document.getElementById('modal-content');

    // Populate the modal with the specific report's data
    // Feel free to adjust report.Description/report.Status to match your DB schema
    modalContent.innerHTML = `
        <div class="space-y-3">
            <div class="flex justify-between items-center border-b border-white/10 pb-2">
                <span class="text-xs uppercase tracking-widest opacity-50">Ward</span>
                <span class="font-bold">${report.WardID}</span>
            </div>
            <div class="flex justify-between items-center border-b border-white/10 pb-2">
                <span class="text-xs uppercase tracking-widest opacity-50">Type</span>
                <span class="font-bold">${report.Type || 'System Alert'}</span>
            </div>
            <div class="flex justify-between items-center border-b border-white/10 pb-2">
                <span class="text-xs uppercase tracking-widest opacity-50">Date Logged</span>
                <span class="font-bold">${new Date(report.CreatedAt).toLocaleDateString()} ${new Date(report.CreatedAt).toLocaleTimeString()}</span>
            </div>
            
            <div class="mt-6 pt-4">
                <span class="text-xs uppercase tracking-widest opacity-50 block mb-2">Latest Progress / Details</span>
                <div class="bg-black/20 p-4 rounded-lg text-sm font-medium leading-relaxed">
                    ${report.Brief || 'No further details have been provided for this report.'}
                </div>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
}

function closeReportModal() {
    document.getElementById('report-modal').classList.add('hidden');
}

async function loadResidentNotifications(residentId) {
    try {
        const subRes = await fetch(`/api/residents/${residentId}/subscriptions`);
        if (!subRes.ok) throw new Error('Failed to fetch subscriptions');
        
        const subscribedWards = await subRes.json();
        
        if (subscribedWards.length === 0) {
            renderAlerts([]);
            return;
        }

        const reportPromises = subscribedWards.map(ward => {
            const wardId = ward.WardID || ward.WardId || ward.wardId;
            if (!wardId) throw new Error('Subscription item missing Ward ID');
            
            return fetch(`/api/reports/ward/${wardId}`).then(res => {
                if (!res.ok) throw new Error(`Failed to fetch reports for ward ${wardId}`);
                return res.json();
            });
        });

        const reportsArrays = await Promise.all(reportPromises);
        const allReports = reportsArrays
            .flat()
            .sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt));

        renderAlerts(allReports);

    } catch (error) {
        console.error("Error loading notifications:", error);
        document.getElementById('alerts-list-container').innerHTML = 
            `<li class="text-sm text-red-500">Failed to load alerts.</li>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const currentResidentId = localStorage.getItem('residentId') || 1;
    loadResidentNotifications(currentResidentId);

    document.getElementById('clear-alerts-btn').addEventListener('click', () => {
        renderAlerts([]);
    });

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

    //notifications settings logic
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
            // Inside bellBtn listener:
            wards.forEach(ward => {
                const option = document.createElement('option');
                // 🚨 Store a composite value like "WardID-MunicipalityID"
                option.value = `${ward.WardID}-${ward.MunicipalityID}`;
                option.textContent = `Ward ${ward.WardID} (${ward.Ward?.WardCouncillor || 'No Councillor'})`;
                muteWardSelect.appendChild(option);
            });
            // Show the modal
            muteModal.showModal();
        } catch (error) {
            console.error('Error loading wards for mute settings:', error);
            // Optionally show an error message to the user
        }
    });
}

//Close Modal Handlers
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
muteAllCheckbox.addEventListener('change', (e) => {
    if(e.target.checked) {
        muteWardSelect.disabled = true;
        specificWardsFieldset.classList.add('opacity-30', 'pointer-events-none');
    } else {
        muteWardSelect.disabled = false;
        specificWardsFieldset.classList.remove('opacity-30', 'pointer-events-none');
    }
});

// Form Submission Logic
muteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const isMutedAll = muteAllCheckbox.checked;
    
    // Get an array of the values the user selected
    const mutedWards = Array.from(muteWardSelect.selectedOptions).map(opt => opt.value);

    // This is the payload you will send to your Express backend
    const notificationPreferences = {
        muteAll: isMutedAll,
        // If mute all is true, it overrides specific wards, so we pass an empty array
        mutedWards: isMutedAll ? [] : mutedWards 
    };

    console.log("Sending preferences to backend:", notificationPreferences);

    try {
        // You will need to create a PUT/POST route on your backend to accept this data
        // Example API call:
        /*
        const response = await fetch(`/api/residents/${currentResidentId}/notifications/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(notificationPreferences)
        });

        if (!response.ok) throw new Error('Failed to update settings');
        */

        // For now, close the modal and maybe show a toast notification
        alert("Alert preferences saved successfully!");
        closeMuteModal();
    
        const modal = document.getElementById('report-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeReportModal();
                }
            });
        }
    } catch (error) {
        console.error("Error saving notification settings:", error);
        alert("Failed to save settings. Please try again.");
    }
});
});


// Closes account when clicking outside
document.addEventListener('click', (event) => {
    const detailsElement = document.querySelector('nav details');
    
    // Check if the click was outside the dropdown menu
    if (detailsElement && !detailsElement.contains(event.target)) {
        detailsElement.removeAttribute('open');
    }
});

const wardLocationPicker = new LocationPicker(
    'add-ward-map', 
    'map-status-text', 
    async (result) => {
        // This is the callback! It runs whenever the pin stops moving.
        if (result.success && result.provId && result.muniId && result.wardNo) {
            // Trigger your dropdown auto-fills sequentially
            provinceSelect.value = result.provId;
            await fetchMunicipalitiesForSelect(result.provId);
            
            municipalitySelect.value = result.muniId;
            await fetchWardsForSelect(result.muniId);
            
            wardSelect.value = parseInt(result.wardNo);
        } else {
            // Reset dropdowns if outside boundaries
            resetDropdown(municipalitySelect, 'Choose a municipality');
            resetDropdown(wardSelect, 'Choose a ward');
            provinceSelect.value = "";
        }
    }
);

// 2. Start downloading the GeoJSON in the background immediately
document.addEventListener('DOMContentLoaded', () => {
    wardLocationPicker.loadData();
});

// 3. Only draw the map when the user opens the modal
document.addEventListener('click', (event) => {
    const openBtn = event.target.closest('#open-add-ward-btn');
    if (openBtn) {
        wardLocationPicker.render();
    }
});