/**
 * @jest-environment jsdom
 */

const { LocationPicker } = require('../LocationPicker.js');
// --- 1. MOCK EXTERNAL LIBRARIES ---

// Leaflet Mock
global.L = {
    map: jest.fn().mockReturnValue({
        setView: jest.fn().mockReturnThis(),
        on: jest.fn(),
        locate: jest.fn(),
        invalidateSize: jest.fn(),
    }),
    tileLayer: jest.fn().mockReturnValue({
        addTo: jest.fn().mockReturnThis(),
    }),
    marker: jest.fn().mockReturnValue({
        addTo: jest.fn().mockReturnThis(),
        on: jest.fn(),
        setLatLng: jest.fn(),
        getLatLng: jest.fn().mockReturnValue({ lat: -30, lng: 22 }),
    }),
};

// Turf.js Mock
global.turf = {
    point: jest.fn((coords) => ({ type: 'Point', coordinates: coords })),
    featureEach: jest.fn((geojson, callback) => {
        if (geojson && geojson.features) {
            geojson.features.forEach(callback);
        }
    }),
    booleanPointInPolygon: jest.fn().mockReturnValue(true), // Default to 'found' for tests
};

// Global Fetch Mock
global.fetch = jest.fn();


describe('LocationPicker Class Tests', () => {
    let picker;
    let mockOnLocationFound;
    const containerId = 'map-picker';
    const statusId = 'status-text';

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        
        // Setup DOM
        document.body.innerHTML = `
            <div id="${containerId}"></div>
            <div id="${statusId}"></div>
        `;
        
        mockOnLocationFound = jest.fn();
        picker = new LocationPicker(containerId, statusId, mockOnLocationFound);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('Utility Logic', () => {
        test('normalizeName correctly strips municipality suffixes', () => {
            const result = picker.normalizeName("Ekurhuleni Metropolitan Municipality");
            expect(result).toBe("ekurhuleni");
        });

        test('normalizeName handles dashes and casing', () => {
            const result = picker.normalizeName("City-of-Cape-Town");
            expect(result).toBe("city of cape town");
        });
    });

    describe('Data Loading', () => {
        test('loadData fetches both municipality dictionary and ward GeoJSON', async () => {
            fetch.mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue({ 'joburg': 1 }) });
            fetch.mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue({ type: 'FeatureCollection' }) });

            await picker.loadData();

            expect(fetch).toHaveBeenCalledTimes(2);
            expect(picker.MunicipalityMap['joburg']).toBe(1);
            expect(picker.wardGeoData.type).toBe('FeatureCollection');
        });
    });

    describe('Map Interactions', () => {
        test('render initializes the map and triggers locate', () => {
            picker.render();
            
            expect(L.map).toHaveBeenCalledWith(containerId);
            expect(picker.map.locate).toHaveBeenCalled();
            
            // Fast-forward for the invalidateSize timeout
            jest.runAllTimers();
            expect(picker.map.invalidateSize).toHaveBeenCalled();
        });

        test('updatePin updates marker position and centers map if requested', () => {
            picker.render();
            const spy = jest.spyOn(picker, 'calculateLocation').mockImplementation();
            
            picker.updatePin(-26, 28, true);

            expect(picker.pin.setLatLng).toHaveBeenCalledWith([-26, 28]);
            expect(picker.map.setView).toHaveBeenCalledWith([-26, 28], 16);
            expect(spy).toHaveBeenCalled();
        });
    });

    describe('Geospatial Logic ( Turf.js )', () => {
        test('calculateLocation finds ward and returns success data', () => {
            // Setup state
            picker.wardGeoData = {
                features: [{
                    properties: { WardNo: "5", MAP_TITLE: "Joburg", Province: "Gauteng" }
                }]
            };
            picker.MunicipalityMap = { "joburg": 101 };
            turf.booleanPointInPolygon.mockReturnValue(true);

            picker.calculateLocation(-26.2, 28.0);

            expect(mockOnLocationFound).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                wardNo: "5",
                muniId: 101,
                provId: 1
            }));
            expect(document.getElementById(statusId).textContent).toContain("Locked: Ward 5");
        });

        test('calculateLocation returns failure if point is outside polygons', () => {
            picker.wardGeoData = { features: [] };
            turf.booleanPointInPolygon.mockReturnValue(false);

            picker.calculateLocation(0, 0);

            expect(mockOnLocationFound).toHaveBeenCalledWith({ success: false });
            expect(document.getElementById(statusId).textContent).toBe("Outside known boundaries.");
        });
    });
});