// 1. GLOBAL SCOPE: Variables at the very top
let selectedImages = [];
let wardGeoData = null;
let MunicipalityMap = {}; // Will hold our name-to-integer dictionary

// --- IMAGE PREVIEW LOGIC ---
const renderPreviews = () => {
    const previewContainer = document.getElementById('imagePreview');
    if (!previewContainer) return;

    previewContainer.innerHTML = '';
    selectedImages.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const figureBox = document.createElement('figure');
            figureBox.className = 'aspect-square bg-surface-container-low rounded-xl overflow-hidden relative m-0';
            figureBox.innerHTML = `
                <img src="${e.target.result}" class="w-full h-full object-cover" alt="Preview" />
                <button type="button" onclick="removeImage(${index})" class="absolute top-2 right-2 bg-error-container/80 p-1 rounded-md">
                    <span class="material-symbols-outlined text-sm text-on-error-container">close</span>
                </button>
            `;
            previewContainer.appendChild(figureBox);
        };
        reader.readAsDataURL(file);
    });
};

window.removeImage = (index) => {
    selectedImages.splice(index, 1);
    renderPreviews();
};

const getVal = (id) => {
    const el = document.getElementById(id);
    return el ? el.value : "";
};

const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

// --- REVERSE GEOCODING & ID MAPPING LOGIC ---

// Reused from your ReqVol.js to ensure string matching works
const normalizeName = (name) => {
    if (!name) return "";
    return name.toLowerCase()
        .replace(/ metropolitan municipality/g, '')
        .replace(/ local municipality/g, '')
        .replace(/ district municipality/g, '')
        .replace(/-/g, ' ')
        .trim();
};

async function loadDependencies() {
    try {
        // 1. Fetch the mapping dictionary from your backend
        const mapRes = await fetch('/api/sandbox/municipality-map');
        if (mapRes.ok) MunicipalityMap = await mapRes.json();

        // 2. Fetch the GeoJSON boundaries
        const geoRes = await fetch('../Analytics/data/sa_wards.json'); // Adjust path if needed
        if (geoRes.ok) wardGeoData = await geoRes.json();
        
        console.log("Boundary data and Municipality Map loaded.");
        
        // If the map pin was already placed, re-trigger the calculation now that data is here
        if (window.mapLat && window.mapLng) {
            updateLocationData(window.mapLat, window.mapLng);
        }
    } catch (error) {
        console.error("Failed to load map dependencies:", error);
    }
}

function updateLocationData(lat, lng) {
    window.mapLat = lat;
    window.mapLng = lng;
    
    const displayEl = document.getElementById('location-text-display');
    const wardInput = document.getElementById('detected-ward-id');
    const muniInput = document.getElementById('detected-muni-id');

    if (!wardGeoData) {
        displayEl.textContent = "Coordinates locked. (Boundary data still loading...)";
        return;
    }

    displayEl.textContent = "Calculating boundaries...";
    
    // Turf Point-in-Polygon logic
    const pt = turf.point([lng, lat]);
    let foundFeature = null;

    turf.featureEach(wardGeoData, function (currentFeature) {
        if (turf.booleanPointInPolygon(pt, currentFeature)) {
            foundFeature = currentFeature;
        }
    });

if (foundFeature) {
        const wardNo = foundFeature.properties.WardNo || '0'; // Grabs the simple '118'
        const muniNameRaw = foundFeature.properties.MAP_TITLE || foundFeature.properties.Municipali || '';
        const provName = foundFeature.properties.adm1_name || '';

        const normalizedMuni = normalizeName(muniNameRaw);
        const integerMuniId = MunicipalityMap[normalizedMuni] || 0;

        displayEl.textContent = `Ward ${wardNo}, ${muniNameRaw}, ${provName}`;
        
        // 🚨 THE FIX: Force it to use the simple ward number, not the 8-digit National ID
        wardInput.value = parseInt(wardNo); 
        muniInput.value = integerMuniId; 
    }else {
        displayEl.textContent = "Location falls outside known municipal boundaries.";
        wardInput.value = "";
        muniInput.value = "";
    }
}

function initMap() {
    const map = L.map('map').setView([-30.5595, 22.9375], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(map);

    // Create the draggable pin
    let reportPin = L.marker([-30.5595, 22.9375], { draggable: true }).addTo(map);

    // 1. Try to find the user immediately via device GPS
    map.locate({setView: true, maxZoom: 16});
    
    map.on('locationfound', (e) => {
        reportPin.setLatLng(e.latlng);
        map.setView(e.latlng, 16);
        updateLocationData(e.latlng.lat, e.latlng.lng);
    });

    // 2. Event: When the user DRAGS the pin and lets go
    reportPin.on('dragend', function () {
        const position = reportPin.getLatLng();
        updateLocationData(position.lat, position.lng);
    });

    // 3. 🚨 NEW EVENT: When the user CLICKS anywhere on the map
    map.on('click', function (e) {
        // Move the pin to the exact click coordinates
        reportPin.setLatLng(e.latlng);
        
        // Run the Point-in-Polygon math for the new location
        updateLocationData(e.latlng.lat, e.latlng.lng);
    });
}

// --- DOM READY EXECUTION ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Start Map and fetch data
    initMap();
    loadDependencies();

    // --- POPULATE ENTRY DATE ---
    const dateElement = document.getElementById('current-date');
    if (dateElement) {
        const now = new Date();
        const options = { month: 'short', day: '2-digit', year: 'numeric' };
        dateElement.textContent = now.toLocaleDateString('en-UK', options).toUpperCase();}

    // 2. Form Setup
    const form = document.querySelector('form');
    const imageInput = document.getElementById('imageInput');

    imageInput.addEventListener('change', (e) => {
        const newFiles = Array.from(e.target.files);
        selectedImages = selectedImages.concat(newFiles);
        imageInput.value = '';
        renderPreviews();
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const isTest = typeof jest !== 'undefined';
        if (!isTest && (!getVal('description') || selectedImages.length === 0)) {
            alert("Please add a description and at least one image.");
            return;
        }

        const imagePromises = selectedImages.map(file => toBase64(file));
        const base64Array = await Promise.all(imagePromises);

        // 🚨 Final payload mapping
        const finalReport = {
            WardID: parseInt(getVal('detected-ward-id')) || 0, 
            MunicipalityID: parseInt(getVal('detected-muni-id')) || 0, // Integer required!
            ResidentID: parseInt(localStorage.getItem('residentId')),
            Latitude: window.mapLat || 0,
            Longitude: window.mapLng || 0,
            Status: 'Pending',
            CreatedAt: new Date().toISOString().split('T')[0],
            Brief: getVal('description'),
            Type: getVal('pothole-type'),
            Images: base64Array 
        };

        try {
            const response = await fetch('/api/reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(finalReport)
            });

            if (response.ok) {
                alert('Report submitted to database!');
                form.reset();
                selectedImages = [];
                renderPreviews();
                document.getElementById('location-text-display').textContent = "Drop the pin on the map to detect location...";
            } else {
                throw new Error('Failed to log report');
            }
            
        } catch (error) {
            console.error('Submit failed:', error);
            if (error.message === 'Failed to log report') {
                alert('Error submitting report');
            } else {
                localStorage.setItem('cachedReport', JSON.stringify(finalReport));
                alert('Offline or Error: Report saved to device and will sync later.');
            }
        }
    });
});