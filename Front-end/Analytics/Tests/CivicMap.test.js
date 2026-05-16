/**
 * @jest-environment jsdom
 */

// --- 1. MOCK LEAFLET (L) ---
const mockResetStyle = jest.fn();

global.L = {
    map: jest.fn().mockReturnValue({
        setView: jest.fn().mockReturnThis(),
        zoomIn: jest.fn(),
        zoomOut: jest.fn(),
        removeLayer: jest.fn(),
        addLayer: jest.fn(),
    }),
    tileLayer: jest.fn().mockReturnValue({
        addTo: jest.fn().mockReturnThis(),
    }),
    // Mock the geoJSON factory and the object it returns
    geoJSON: jest.fn().mockReturnValue({
        addTo: jest.fn().mockReturnThis(),
        resetStyle: mockResetStyle,
    }),
};

// --- 2. MOCK FETCH ---
global.fetch = jest.fn();

const { CivicMap } = require('../CivicMap.js');

describe('CivicMap Class - Maximum Safe Coverage Suite', () => {
    let containerId = 'map-container';
    let geoJsonPath = 'data/test.json';
    let mockCallback;
    let civicMap;

    beforeEach(async () => {
        jest.clearAllMocks();
        
        // Mute console output for intentional API failure tests
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        
        document.body.innerHTML = `<div id="${containerId}"></div>`;
        mockCallback = jest.fn();
        
        fetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ type: "FeatureCollection", features: [] })
        });

        civicMap = new CivicMap(containerId, geoJsonPath, mockCallback);
        await new Promise(process.nextTick); // Flush constructor fetches
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // --- INITIALIZATION & API ---
    describe('Initialization & API Handling', () => {
        test('should initialize the Leaflet map and tile layer', () => {
            expect(L.map).toHaveBeenCalledWith(containerId, expect.any(Object));
            expect(L.tileLayer).toHaveBeenCalled();
        });

        test('fetchAndDraw handles non-ok response gracefully', async () => {
            fetch.mockResolvedValueOnce({ ok: false });
            civicMap.fetchAndDraw('bad_data.json');
            
            await new Promise(process.nextTick); 
            expect(console.warn).toHaveBeenCalledWith("Map data pending...", expect.any(Error));
        });

        test('fetchAndDraw handles fetch rejection gracefully', async () => {
            fetch.mockRejectedValueOnce(new Error("Network disconnect"));
            civicMap.fetchAndDraw('network_fail.json');
            
            await new Promise(process.nextTick);
            expect(console.warn).toHaveBeenCalledWith("Map data pending...", expect.any(Error));
        });
    });

    // --- CONTROLS & LAYERS ---
    describe('Map Controls & Layer Management', () => {
        test('zoomIn and zoomOut methods trigger Leaflet equivalents safely', () => {
            civicMap.zoomIn();
            expect(civicMap.map.zoomIn).toHaveBeenCalled();

            civicMap.zoomOut();
            expect(civicMap.map.zoomOut).toHaveBeenCalled();
            
            // Safe guard test (should not crash if map is null)
            civicMap.map = null;
            expect(() => { civicMap.zoomIn(); civicMap.zoomOut(); }).not.toThrow();
        });

        test('loadNewLayer removes old layer before fetching new one', () => {
            const newPath = 'data/new_layer.json';
            civicMap.geojsonLayer = { testId: 'fake-layer' }; // Inject fake existing layer
            
            civicMap.loadNewLayer(newPath);

            expect(civicMap.map.removeLayer).toHaveBeenCalledWith({ testId: 'fake-layer' });
            expect(fetch).toHaveBeenCalledWith(newPath);
        });

        test('loadNewLayer handles fetch safely if no previous layer exists', () => {
            civicMap.geojsonLayer = null; 
            civicMap.loadNewLayer('data/fresh.json');
            expect(civicMap.map.removeLayer).not.toHaveBeenCalled();
            expect(fetch).toHaveBeenCalledWith('data/fresh.json');
        });
    });

    // --- INTERNAL LEAFLET LOGIC (THE HIDDEN CALLBACKS) ---
    describe('Hidden Leaflet Callbacks & Interactions', () => {
        
        test('renderBoundaries defines the correct default layer style', () => {
            civicMap.renderBoundaries({ features: [] });
            
            // Extract the style function passed to L.geoJSON
            const styleFn = L.geoJSON.mock.calls[0][1].style;
            
            expect(styleFn()).toEqual({
                color: "#564334",
                weight: 1,
                fillColor: "#ff8c00",
                fillOpacity: 0.1 
            });
        });

        test('onEachFeature resolves areaName correctly based on priority', () => {
            civicMap.renderBoundaries({ features: [] });
            const onEachFeature = L.geoJSON.mock.calls[0][1].onEachFeature;
            const mockLayer = { setStyle: jest.fn(), on: jest.fn(), bindTooltip: jest.fn() };

            // 1. Ward Priority
            onEachFeature({ properties: { WardNo: "12", MAP_TITLE: "Joburg" } }, mockLayer);
            expect(mockLayer.bindTooltip).toHaveBeenCalledWith("<b>Ward 12</b>", { sticky: true });

            // 2. Municipality Priority
            mockLayer.bindTooltip.mockClear();
            onEachFeature({ properties: { MAP_TITLE: "Joburg" } }, mockLayer);
            expect(mockLayer.bindTooltip).toHaveBeenCalledWith("<b>Joburg</b>", { sticky: true });

            // 3. Province Priority
            mockLayer.bindTooltip.mockClear();
            onEachFeature({ properties: { adm1_name: "Gauteng" } }, mockLayer);
            expect(mockLayer.bindTooltip).toHaveBeenCalledWith("<b>Gauteng</b>", { sticky: true });

            // 4. Fallback
            mockLayer.bindTooltip.mockClear();
            onEachFeature({ properties: {} }, mockLayer);
            expect(mockLayer.bindTooltip).toHaveBeenCalledWith("<b>Unknown Region</b>", { sticky: true });
        });

        test('Layer interaction events (mouseover, mouseout, click) behave correctly', () => {
            civicMap.renderBoundaries({ features: [] });
            const onEachFeature = L.geoJSON.mock.calls[0][1].onEachFeature;

            // Setup two mock map polygons
            const layerA = { setStyle: jest.fn(), on: jest.fn(), bindTooltip: jest.fn() };
            const layerB = { setStyle: jest.fn(), on: jest.fn(), bindTooltip: jest.fn() };

            onEachFeature({ properties: { WardNo: "1" } }, layerA);
            onEachFeature({ properties: { WardNo: "2" } }, layerB);

            // Extract the event dictionaries bound to the layers
            const eventsA = layerA.on.mock.calls[0][0]; // { mouseover, mouseout, click }
            const eventsB = layerB.on.mock.calls[0][0];

            // --- HOVER IN (mouseover) ---
            eventsA.mouseover({ target: layerA });
            expect(layerA.setStyle).toHaveBeenCalledWith(expect.objectContaining({ fillOpacity: 0.3 }));

            // --- HOVER OUT (mouseout) ---
            eventsA.mouseout({ target: layerA });
            expect(mockResetStyle).toHaveBeenCalledWith(layerA);

            // --- CLICK (Select Layer A) ---
            eventsA.click({ target: layerA });
            expect(layerA.setStyle).toHaveBeenCalledWith(expect.objectContaining({ weight: 3, fillOpacity: 0.5 }));
            expect(civicMap.selectedLayer).toBe(layerA);
            expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({ wardId: "1" }));

            // --- HOVER IN on ACTIVE layer (Should be ignored) ---
            layerA.setStyle.mockClear();
            eventsA.mouseover({ target: layerA });
            expect(layerA.setStyle).not.toHaveBeenCalled();

            // --- HOVER OUT on ACTIVE layer (Should be ignored) ---
            mockResetStyle.mockClear();
            eventsA.mouseout({ target: layerA });
            expect(mockResetStyle).not.toHaveBeenCalled();

            // --- CLICK B (Should reset A, and highlight B) ---
            mockResetStyle.mockClear();
            eventsB.click({ target: layerB });
            expect(mockResetStyle).toHaveBeenCalledWith(layerA); // Clears old selection
            expect(layerB.setStyle).toHaveBeenCalledWith(expect.objectContaining({ fillOpacity: 0.5 })); // Highlights new
            expect(civicMap.selectedLayer).toBe(layerB);
        });
    });
});