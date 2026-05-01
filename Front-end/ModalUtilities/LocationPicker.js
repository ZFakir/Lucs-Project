// LocationPicker.js
export class LocationPicker {
    constructor(containerId, statusTextId, onLocationFound) {
        this.containerId = containerId;
        this.statusTextId = statusTextId;
        this.onLocationFound = onLocationFound; // Callback function
        
        this.map = null;
        this.pin = null;
        this.wardGeoData = null;
        this.MunicipalityMap = {};
        
        this.provinceFullNameToId = {
            'Gauteng': 1, 'Western Cape': 2, 'Eastern Cape': 3,
            'Northern Cape': 4, 'Nothern Cape': 4, 'Free State': 5,
            'KwaZulu-Natal': 6, 'North West': 7, 'Mpumalanga': 8, 'Limpopo': 9
        };
    }

    // Helper method
    normalizeName(name) {
        if (!name) return "";
        return name.toLowerCase()
            .replace(/ metropolitan municipality/g, '').replace(/ local municipality/g, '')
            .replace(/ district municipality/g, '').replace(/-/g, ' ').trim();
    }

    async loadData() {
        try {
            const mapRes = await fetch('/api/sandbox/municipality-map');
            if (mapRes.ok) this.MunicipalityMap = await mapRes.json();
            
            const geoRes = await fetch('../Analytics/data/sa_wards.json');
            if (geoRes.ok) this.wardGeoData = await geoRes.json();
        } catch (error) { 
            console.error("Failed to load map dependencies:", error); 
        }
    }

    render() {
        if (this.map) return; // Prevent double rendering

        this.map = L.map(this.containerId).setView([-30.5595, 22.9375], 5);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);
        this.pin = L.marker([-30.5595, 22.9375], { draggable: true }).addTo(this.map);

        this.map.locate({setView: true, maxZoom: 16});
        
        // Map Events
        this.map.on('locationfound', (e) => this.updatePin(e.latlng.lat, e.latlng.lng, true));
        this.map.on('click', (e) => this.updatePin(e.latlng.lat, e.latlng.lng, false));
        this.pin.on('dragend', () => this.updatePin(this.pin.getLatLng().lat, this.pin.getLatLng().lng, false));

//force resize
        setTimeout(() => this.map.invalidateSize(), 100);
    }

    updatePin(lat, lng, centerMap) {
        this.pin.setLatLng([lat, lng]);
        if (centerMap) this.map.setView([lat, lng], 16);
        this.calculateLocation(lat, lng);
    }

    calculateLocation(lat, lng) {
        const statusEl = document.getElementById(this.statusTextId);
        
        if (!this.wardGeoData) {
            if (statusEl) statusEl.textContent = "Still loading boundaries...";
            return;
        }

        if (statusEl) statusEl.textContent = "Calculating...";
        const pt = turf.point([lng, lat]);
        let foundFeature = null;

        turf.featureEach(this.wardGeoData, (currentFeature) => {
            if (turf.booleanPointInPolygon(pt, currentFeature)) foundFeature = currentFeature;
        });

        if (foundFeature) {
            const wardNo = foundFeature.properties.WardNo;
            const muniNameRaw = foundFeature.properties.MAP_TITLE || foundFeature.properties.Municipali || '';
            const provNameRaw = foundFeature.properties.Province || '';

            const integerMuniId = this.MunicipalityMap[this.normalizeName(muniNameRaw)] || 0;
            const provId = this.provinceFullNameToId[provNameRaw];

            if (statusEl) statusEl.textContent = `Locked: Ward ${wardNo}, ${muniNameRaw}`;
            // 🚨 Send the data back to whatever file called this class!
            console.log(provId);
            this.onLocationFound({ 
                success: true, 
                wardNo: wardNo, 
                muniId: integerMuniId, 
                provId: provId,
                lat: lat,
                lng: lng
            });
        } else {
            if (statusEl) statusEl.textContent = "Outside known boundaries.";
            this.onLocationFound({ success: false });

        }
    }
}