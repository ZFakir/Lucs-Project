/**
 * @jest-environment jsdom
 */



// --- 1. MOCK LEAFLET (L) ---
// We need to simulate the nested structure of Leaflet
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
    geoJSON: jest.fn().mockReturnValue({
        addTo: jest.fn().mockReturnThis(),
        resetStyle: jest.fn(),
    }),
};


// --- 3. MOCK FETCH ---
global.fetch = jest.fn();

const { CivicMap } = require('../CivicMap.js');
describe('CivicMap Class Tests', () => {
    let containerId = 'map-container';
    let geoJsonPath = 'data/test.json';
    let mockCallback;
    let civicMap;

    beforeEach(() => {
        jest.clearAllMocks();
        // Setup DOM container
        document.body.innerHTML = `<div id="${containerId}"></div>`;
        
        mockCallback = jest.fn();
        
        // Mock successful fetch for the constructor's init() call
        fetch.mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue({ type: "FeatureCollection", features: [] })
        });

        civicMap = new CivicMap(containerId, geoJsonPath, mockCallback);
    });

    describe('Initialization', () => {
        test('should initialize the Leaflet map on the correct container', () => {
            expect(L.map).toHaveBeenCalledWith(containerId, expect.any(Object));
        });

        test('should fetch GeoJSON data from the provided path', () => {
            expect(fetch).toHaveBeenCalledWith(geoJsonPath);
        });
    });

    describe('Map Controls', () => {
        test('zoomIn() should call Leaflet zoomIn', () => {
            civicMap.zoomIn();
            expect(civicMap.map.zoomIn).toHaveBeenCalled();
        });

        test('zoomOut() should call Leaflet zoomOut', () => {
            civicMap.zoomOut();
            expect(civicMap.map.zoomOut).toHaveBeenCalled();
        });
    });

    describe('Layer Management', () => {
        test('loadNewLayer() should remove old layer and fetch new data', () => {
            const newPath = 'data/new_layer.json';
            
            // Mock an existing layer
            civicMap.geojsonLayer = { test: 'layer' }; 
            
            civicMap.loadNewLayer(newPath);

            expect(civicMap.map.removeLayer).toHaveBeenCalledWith({ test: 'layer' });
            expect(fetch).toHaveBeenCalledWith(newPath);
        });
    });

    describe('Interaction Logic', () => {
        test('renderBoundaries should initialize L.geoJSON with correct handlers', () => {
            const mockData = { type: "FeatureCollection", features: [{ properties: { WardNo: "101" } }] };
            civicMap.renderBoundaries(mockData);

            expect(L.geoJSON).toHaveBeenCalledWith(mockData, expect.objectContaining({
                style: expect.any(Function),
                onEachFeature: expect.any(Function)
            }));
        });

        test('click handler should update style and trigger callback', () => {
            // We need to extract the onEachFeature internal logic
            const mockData = { features: [] };
            civicMap.renderBoundaries(mockData);
            
            // Get the onEachFeature function passed to Leaflet
            const onEachFeature = L.geoJSON.mock.calls[0][1].onEachFeature;
            
            const mockFeature = { 
                properties: { WardNo: "1", MAP_TITLE: "Joburg" } 
            };
            const mockLayer = { 
                setStyle: jest.fn(), 
                on: jest.fn(),
                bindTooltip: jest.fn()
            };

            onEachFeature(mockFeature, mockLayer);

            // Extract the 'click' function passed to layer.on
            const clickHandler = mockLayer.on.mock.calls[0][0].click;
            
            // Trigger the click event
            clickHandler({ target: mockLayer });

            expect(mockLayer.setStyle).toHaveBeenCalledWith(expect.objectContaining({ weight: 3 }));
            expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({ wardId: "1" }));
        });
    });
});

