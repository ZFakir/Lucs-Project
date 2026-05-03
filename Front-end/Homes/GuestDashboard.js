// For interactive map  Front-end/ModalUtilities/LocationPicker.js
import { LocationPicker } from '../ModalUtilities/LocationPicker.js';

// ==========================================
// 1. INITIALISATION
// ==========================================
// 'DOMContentLoaded' ensures the browser has fully read and built the HTML page
// before we try to attach any JavaScript to it. If we didn't wait, JS might try 
// to grab a dropdown menu that hasn't been drawn yet, causing a crash.
document.addEventListener('DOMContentLoaded', async () => {
    // Unlike Resident.js, there is absolutely no localStorage auth check here.
    // This explicitly allows anyone on the internet to load the page.
    
    // As soon as the page is ready, we fire the function to go get the provinces from the database.
    loadProvinces();

    // Initialise the Location Picker
    const picker = new LocationPicker('map-container', 'map-status', handleMapLocation);
    
    try {
        await picker.loadData(); // Now this 'await' is valid!
        picker.render();         // This draws the map
    } catch (error) {
        console.error("Map initialization failed:", error);
    }
});

// The Callback Function
async function handleMapLocation(data) {
    if (!data.success) return;

    const { provId, muniId, wardNo } = data;

    // A. Update Province
    if (provId) {
        provinceSelect.value = provId;
        // We must manually trigger the 'change' event to load municipalities
        await triggerChangeEvent(provinceSelect);
    }

    // B. Update Municipality
    if (muniId) {
        municipalitySelect.value = muniId;
        // We must manually trigger the 'change' event to load wards
        await triggerChangeEvent(municipalitySelect);
    }

    // C. Update Ward
    if (wardNo) {
        // Find the option where the text starts with "Ward [wardNo]"
        const wardOption = Array.from(wardSelect.options).find(opt => 
            opt.textContent.startsWith(`Ward ${wardNo}`)
        );

        if (wardOption) {
            wardSelect.value = wardOption.value;
            triggerChangeEvent(wardSelect);
        }
    }
}

// Helper to force the cascading logic to fire
async function triggerChangeEvent(element) {
    // Create a new 'change' event
    const event = new Event('change', { bubbles: true });
    // Dispatch it so the event listeners in GuestDashboard.js react
    element.dispatchEvent(event);
    
    // Small delay to allow the async fetch calls in Step 2/3 to complete 
    // before we try to select values in the next dropdown
    return new Promise(resolve => setTimeout(resolve, 500));
}

// ==========================================
// 2. DOM ELEMENT REFERENCES
// ==========================================
// We grab all the HTML elements we need to interact with and store them in variables.
// Doing this once at the top is much faster than searching the DOM every time a user clicks.
const guestForm = document.getElementById('guest-ward-form');
const provinceSelect = document.getElementById('province');
const municipalitySelect = document.getElementById('municipality');
const wardSelect = document.getElementById('ward');
const submitBtn = document.getElementById('submit-btn');

// ==========================================
// 3. UTILITY FUNCTIONS
// ==========================================
// A helper function to quickly wipe a dropdown clean and disable it.
// This is crucial for "cascading" logic: if a user changes their Province, 
// we must instantly wipe out the old Municipalities and Wards so they don't submit mismatched data.
const resetDropdown = (selectElement, defaultText) => {
    // Injects a single, unselectable placeholder option
    selectElement.innerHTML = `<option disabled selected value="">${defaultText}</option>`;
    // Locks the dropdown so the user can't click it
    selectElement.disabled = true;
};

// ==========================================
// 4. API FETCHING & CASCADING DROPDOWNS
// ==========================================

// STEP 1: Fetch and build the Province list
// We use 'async' because fetching data over the network takes time, 
// and we need to 'await' the server's reply before moving on.
async function loadProvinces() {
    try {
        // Send a GET request to public Express route
        const response = await fetch('/api/geography/provinces');
        
        if (response.ok) {
            // Convert the raw text response into a usable JavaScript Array/Object
            const provinces = await response.json();
            
            // Loop through every province the database sent back
            provinces.forEach(prov => {
                // Create a brand new <option> HTML tag in memory
                const option = document.createElement('option');
                // Set the hidden value to the ID (what the database cares about)
                option.value = prov.ProvinceID;
                // Set the visible text to the Name (what the user cares about)
                option.textContent = prov.ProvinceName;
                // Attach this new option to the dropdown menu on the screen
                provinceSelect.appendChild(option);
            });
        }

    /* istanbul ignore next */
    } catch (error) {
        // This catch block only triggers if the network entirely fails (e.g., server offline)
        console.error('Error loading provinces:', error);
        showModal('Connection Error', 'Failed to load geography data. Please check your internet connection.');
    }
}

// STEP 2: When the user actually picks a Province...
provinceSelect.addEventListener('change', async (e) => {
    // e.target.value grabs the 'ProvinceID' of the exact option they just clicked
    const provinceId = e.target.value;
    
    // Instantly wipe out any lower-level dropdowns and lock the submit button
    resetDropdown(municipalitySelect, 'Choose a municipality...');
    resetDropdown(wardSelect, 'Waiting for municipality...');
    submitBtn.disabled = true;
    
    // Unlock the municipality dropdown and give it a loading message
    municipalitySelect.disabled = false;
    municipalitySelect.innerHTML = `<option disabled selected value="">Loading municipalities...</option>`;

    try {
        // Fetch ONLY the municipalities that belong to the specific ProvinceID they chose
        const response = await fetch(`/api/geography/provinces/${provinceId}/municipalities`);
        if (response.ok) {
            const municipalities = await response.json();
            
            // Clear the "Loading..." text now that data has arrived
            resetDropdown(municipalitySelect, 'Choose a municipality...'); 
            municipalitySelect.disabled = false; 
            
            // Build the new municipality options
            municipalities.forEach(muni => {
                const option = document.createElement('option');
                option.value = muni.MunicipalityID;
                option.textContent = muni.MunicipalityName;
                municipalitySelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading municipalities:', error);
    }
});

// STEP 3: When the user picks a Municipality... (Exact same logic as Step 2)
municipalitySelect.addEventListener('change', async (e) => {
    const municipalityId = e.target.value;
    
    resetDropdown(wardSelect, 'Choose a ward...');
    submitBtn.disabled = true;
    
    wardSelect.disabled = false;
    wardSelect.innerHTML = `<option disabled selected value="">Loading wards...</option>`;

    try {
        const response = await fetch(`/api/geography/municipalities/${municipalityId}/wards`);
        if (response.ok) {
            const wards = await response.json();
            resetDropdown(wardSelect, 'Choose a ward...');
            wardSelect.disabled = false; 
            
            wards.forEach(ward => {
                const option = document.createElement('option');
                option.value = ward.WardID;
                // We combine the Ward Number and Councillor name into one readable string
                option.textContent = `Ward ${ward.WardID} (${ward.WardCouncillor || 'No Councillor listed'})`;
                wardSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading wards:', error);
    }
});

// STEP 4: When the user finally picks a Ward...
wardSelect.addEventListener('change', (e) => {
    const wardId = e.target.value;
    
    if (wardId) {
        // Unlock the main "View Ward Dashboard" button!
        submitBtn.disabled = false;
        
        // Fire off our side-feature: automatically update the stats box on the right
        fetchWardStats(wardId); 
    }
});

// ==========================================
// 5. FORM SUBMISSION & NAVIGATION
// ==========================================
guestForm.addEventListener('submit', (e) => {
    // Stop the browser's default behavior of refreshing the page when a form is submitted
    e.preventDefault();
    
    const selectedWardId = wardSelect.value;
    
    if (selectedWardId) {
        // We aren't saving anything to the database here.
        // Instead, we simply redirect the user to the next HTML page.
        // We append '?wardId=123' to the URL so the next page knows what data to load
        window.location.href = `PublicWardView.html?wardId=${selectedWardId}`;
    }
});

// ==========================================
// 6. DYNAMIC STATS CONTROLLER
// ==========================================
// This function updates the right sidebar whenever a ward is selected
async function fetchWardStats(wardId) {
    const openIssuesDisplay = document.getElementById('global-open-issues');
    const resolvedIssuesDisplay = document.getElementById('global-resolved-issues');
    
    // Provide immediate visual feedback that data is loading
    openIssuesDisplay.textContent = '...';
    resolvedIssuesDisplay.textContent = '...';

    try {
        // Fetch every single public report for this specific ward
        const response = await fetch(`/api/public/reports/ward/${wardId}`);
        
        if (!response.ok) throw new Error('Failed to fetch stats');
        
        const reports = await response.json();
        
        // Initialise our tally counters
        let openCount = 0;
        let resolvedCount = 0;
        
        // Loop through the massive array of reports and sort them into our two buckets
        reports.forEach(report => {
            if (report.Progress === 'Resolved' || report.Progress === 'Fixed') {
                resolvedCount++;
            } else {
                openCount++;
            }
        });
        
        // Inject the final numbers directly into the HTML
        openIssuesDisplay.textContent = openCount;
        resolvedIssuesDisplay.textContent = resolvedCount;
        
        // A clever UI trick: find all elements that say "GLOBAL" and dynamically 
        // change them to say "WARD X" so the user knows the stats are localised.
        document.querySelectorAll('.uppercase.font-black.tracking-widest').forEach(el => {
            if (el.textContent === 'GLOBAL') el.textContent = `WARD ${wardId}`;
        });

    } catch (error) {
        console.error("Error fetching ward stats:", error);
        // If it fails, default to dashes instead of broken numbers
        openIssuesDisplay.textContent = '--';
        resolvedIssuesDisplay.textContent = '--';
    }
}

// ==========================================
// 7. CUSTOM MODAL CONTROLLER
// ==========================================
// Instead of using ugly browser alert() popups, we use the native HTML <dialog> element
function showModal(title, message) {
    const dialog = document.getElementById('custom-modal');
    const titleEl = document.getElementById('modal-title');
    const messageEl = document.getElementById('modal-message');

    // Inject the custom text passed into the function
    titleEl.textContent = title;
    messageEl.textContent = message;
    
    // Dynamic Styling: If the title contains the word "error", make the text red.
    // Otherwise, keep it the default orange primary theme color.
    titleEl.className = 'text-xl font-black tracking-widest mb-2 uppercase ';
    titleEl.className += title.toLowerCase().includes('error') ? 'text-red-500' : 'text-primary';

    // .showModal() is a built-in browser command that forces the <dialog> to appear
    // on top of everything else and grays out the background.
    dialog.showModal();
}

// EXPORTS FOR JEST TESTING
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { loadProvinces, fetchWardStats, showModal };
}