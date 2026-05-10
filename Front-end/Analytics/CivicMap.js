class CivicMap {
constructor(containerId, geoJsonPath, onClickCallback) {
        this.containerId = containerId;
        this.geoJsonPath = geoJsonPath;
        this.onClickCallback = onClickCallback; 
        this.map = null;
        this.geojsonLayer = null;
        
        this.selectedLayer = null; //track the clicked polygon

        this.init();
    }

    init() {
        this.map = L.map(this.containerId, { zoomControl: false }).setView([-28.4793, 24.6727], 6);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '© OpenStreetMap contributors',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(this.map);

        this.fetchAndDraw(this.geoJsonPath);
    }

    zoomIn() {
        if (this.map) this.map.zoomIn();
    }

    zoomOut() {
        if (this.map) this.map.zoomOut();
    }

    // --- NEW METHOD: Fetch and Draw ---
    fetchAndDraw(path) {
        fetch(path)
            .then(response => {
                if (!response.ok) throw new Error("Could not load GeoJSON");
                return response.json();
            })
            .then(data => this.renderBoundaries(data))
            .catch(err => console.warn("Map data pending...", err));
    }

    //Swap data based on path
    loadNewLayer(newGeoJsonPath) {
        // 1. Remove the old polygons if they exist
        if (this.geojsonLayer) {
            this.map.removeLayer(this.geojsonLayer);
        }
        // 2. Fetch and draw the new ones!
        this.fetchAndDraw(newGeoJsonPath);
    }

    renderBoundaries(geojsonData) {
        this.geojsonLayer = L.geoJSON(geojsonData, {
            //default styling
            style: function () {
                return {
                    color: "#564334",
                    weight: 1,
                    fillColor: "#ff8c00",
                    fillOpacity: 0.1 
                };
            },
            onEachFeature: (feature, layer) => {
                const wardId = feature.properties.WardNo;
                const muniId = feature.properties.MAP_TITLE || feature.properties.Municipali; 
                const provId = feature.properties.adm1_name; 

                let areaName = "Unknown Region";
                if (wardId) {
                    areaName = `Ward ${wardId}`; 
                } else if (muniId) {
                    areaName = muniId;
                } else if (provId) {
                    areaName = provId;
                }

                layer.bindTooltip(`<b>${areaName}</b>`, { sticky: true });

                // Map Interactions
                layer.on({
                    //Hover In
                    mouseover: (e) => {
                        const targetLayer = e.target;
                        // Only apply the hover effect if this ISN'T the currently clicked ward
                        if (this.selectedLayer !== targetLayer) {
                            targetLayer.setStyle({
                                fillOpacity: 0.3, // Brighten
                                weight: 2         // Thicken the border
                            });
                        }
                    },
                    // 2. Hover Out
                    mouseout: (e) => {
                        const targetLayer = e.target;
                        // Only reset the style if this ISN'T the currently clicked ward
                        if (this.selectedLayer !== targetLayer) {
                            this.geojsonLayer.resetStyle(targetLayer); // Snaps back to default 0.1 opacity
                        }
                    },
                    // 3. Click
                    click: (e) => {
                        const targetLayer = e.target;

                        // Clear the highlight from whatever was clicked previously
                        if (this.selectedLayer) {
                            this.geojsonLayer.resetStyle(this.selectedLayer);
                        }

                        // Save this new layer as the active one and give it the boldest style
                        this.selectedLayer = targetLayer;
                        targetLayer.setStyle({ 
                            weight: 3, 
                            color: "#ff8c00", 
                            fillOpacity: 0.5 
                        });

                        // Trigger your dashboard update
                        if (this.onClickCallback) {
                            this.onClickCallback({ wardId, muniId, provId, name: areaName });
                        }
                        
                    }


                });
            }
        }).addTo(this.map);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CivicMap };
}