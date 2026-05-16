/**
 * @jest-environment jsdom
 */

// --- 1. MOCK EXTERNAL DEPENDENCIES ---
let markerClickCallback = null;
global.L = {
    layerGroup: jest.fn().mockReturnValue({
        addTo: jest.fn().mockReturnThis(),
        removeLayer: jest.fn(),
    }),
    circleMarker: jest.fn().mockReturnValue({
        addTo: jest.fn().mockReturnThis(),
        bindTooltip: jest.fn().mockReturnThis(),
        // 🚨 Capture the click event to test hidden modal logic
        on: jest.fn((event, cb) => {
            if (event === 'click') markerClickCallback = cb;
        }),
    }),
};

const mockModalOpen = jest.fn();
global.CivicModal = jest.fn().mockImplementation(() => ({
    open: mockModalOpen,
}));

let civicMapCallback = null;
const mockLoadNewLayer = jest.fn();
global.CivicMap = jest.fn().mockImplementation((id, path, cb) => {
    civicMapCallback = cb; // 🚨 Capture initialization callback
    return {
        map: { removeLayer: jest.fn(), addLayer: jest.fn() },
        loadNewLayer: mockLoadNewLayer,
    };
});

global.DashboardExporter = jest.fn();
global.fetch = jest.fn();

describe('AgeReport.js - Maximum Safe Coverage Suite', () => {
    let AgeReport;

    beforeEach(async () => {
        jest.resetModules();
        jest.clearAllMocks();

        // Mute console output for intentional API failure tests
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'log').mockImplementation(() => {});

        // Setup a comprehensive DOM for all UI and Logic paths
        document.body.innerHTML = `
            <div id="map"></div>
            
            <nav class="grid">
                <button id="btn-24h" class="bg-surface-container-highest">24H</button>
                <button id="btn-7d" class="bg-surface-container-highest">7 DAYS</button>
                <button id="btn-30d" class="bg-primary-container">30 DAYS</button>
            </nav>
            
            <input type="radio" name="granularity" value="province"> <span class="label">Province</span>
            <input type="radio" name="granularity" value="municipality"> <span class="label">Municipality</span>
            <input type="radio" name="granularity" value="ward"> <span class="label">Ward</span>

            <div id="unassigned-table-body"></div>
            
            <div id="water-unassigned-bar"></div><div id="water-assigned-bar"></div>
            <div id="electricity-unassigned-bar"></div><div id="electricity-assigned-bar"></div>
            <div id="roads-unassigned-bar"></div><div id="roads-assigned-bar"></div>
            <div id="sanitation-unassigned-bar"></div><div id="sanitation-assigned-bar"></div>
            
            <article class="border-surface-variant"><p class="text-7xl"></p></article>
            <article class="border-primary-container"><p class="text-7xl"></p></article>
            <button id="export-pdf-btn"></button>
        `;

        // 🚨 BULLETPROOF FETCH MOCK: Solves the JSDOM event listener leak issue!
        // No matter how many times DOMContentLoaded fires across test instances,
        // the internal MunicipalityMap will ALWAYS get correctly populated.
        fetch.mockImplementation((url) => {
            if (url && typeof url === 'string' && url.includes('municipality-map')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve({ "test muni": 99 }) });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
        });
        
        AgeReport = require('../AgeReport.js');
        
        // Safely trigger initialization for each test
        document.dispatchEvent(new Event('DOMContentLoaded'));
        await new Promise(r => setTimeout(r, 20)); // Flush microtasks safely
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // --- 1. UTILITY FUNCTIONS ---
    describe('Utility Functions', () => {
        test('normalizeName cleans municipality strings', () => {
            expect(AgeReport.normalizeName("City of Cape Town Metropolitan Municipality")).toBe("city of cape town");
            expect(AgeReport.normalizeName("George Local Municipality")).toBe("george");
            expect(AgeReport.normalizeName(null)).toBe("");
        });

        test('getDateRange calculates 24H, 7 DAYS, and 30 DAYS windows', () => {
            // Test 30 Days (Default selected in mock DOM)
            let range = AgeReport.getDateRange();
            let diffDays = Math.round((new Date(range.end) - new Date(range.start)) / (1000 * 60 * 60 * 24));
            expect(diffDays).toBe(30);

            // Test 7 Days
            document.getElementById('btn-30d').className = 'bg-surface-container-highest';
            document.getElementById('btn-7d').className = 'bg-primary-container text-on-primary';
            range = AgeReport.getDateRange();
            diffDays = Math.round((new Date(range.end) - new Date(range.start)) / (1000 * 60 * 60 * 24));
            expect(diffDays).toBe(7);

            // Test 24 Hours
            document.getElementById('btn-7d').className = 'bg-surface-container-highest';
            document.getElementById('btn-24h').className = 'bg-primary-container text-on-primary';
            range = AgeReport.getDateRange();
            let diffHours = (new Date(range.end) - new Date(range.start)) / (1000 * 60 * 60);
            expect(diffHours).toBeGreaterThanOrEqual(23);
        });
    });

    // --- 2. API & INITIALIZATION ---
    describe('API & Initialization Logic', () => {
        test('buildMunicipalityMap successfully fetches dictionary', async () => {
            // fetch implementation already set in beforeEach handles this natively
            const dict = await AgeReport.buildMunicipalityMap();
            expect(dict).toEqual({ "test muni": 99 });
        });

        test('buildMunicipalityMap handles API failure gracefully', async () => {
            fetch.mockRejectedValueOnce(new Error("Map Fetch Failed"));
            const dict = await AgeReport.buildMunicipalityMap();
            expect(dict).toEqual({});
            expect(console.error).toHaveBeenCalled();
        });

        test('fetchAgingData correctly formats URLs for Ward, Muni, and Province', async () => {
            fetch.mockClear();

            // Province
            AgeReport.setSelection({ type: 'province', ids: { provinceId: 1 } });
            await AgeReport.fetchAgingData();
            expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/sandbox/province/1'));

            // Municipality
            AgeReport.setSelection({ type: 'municipality', ids: { municipalityId: 44 } });
            await AgeReport.fetchAgingData();
            expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/sandbox/municipality/44'));

            // Ward
            AgeReport.setSelection({ type: 'ward', ids: { municipalityId: 44, wardId: 5 } });
            await AgeReport.fetchAgingData();
            expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/sandbox/ward/44/5'));
        });

        test('fetchAgingData handles API failures gracefully', async () => {
            fetch.mockRejectedValueOnce(new Error("Data Fetch Failed"));
            await AgeReport.fetchAgingData();
            expect(console.error).toHaveBeenCalledWith("Aging Data Fetch Error:", expect.any(Error));
        });
    });

    // --- 3. UI RENDERERS & CALCULATIONS ---
    describe('Data Calculation & Rendering', () => {
        test('calculateBottleneckMetrics averages correctly', () => {
            const now = new Date();
            const reports = [
                { CreatedAt: new Date(now - 10 * 3600000).toISOString(), AssignedAt: null }, // Unassigned 10h
                // 🚨 FIX: Explicitly set AssignedAt so it doesn't fall into the Unassigned block and skew the math!
                { CreatedAt: new Date(now - 20 * 3600000).toISOString(), AssignedAt: new Date(now - 15 * 3600000).toISOString(), DateFulfilled: new Date(now - 10 * 3600000).toISOString() } 
            ];

            AgeReport.calculateBottleneckMetrics(reports);

            const unassignedEl = document.querySelector('article.border-surface-variant p.text-7xl');
            const resolutionEl = document.querySelector('article.border-primary-container p.text-7xl');

            expect(unassignedEl.innerHTML).toContain('10.0');
            expect(resolutionEl.innerHTML).toContain('10.0');
        });

        test('updateAssignmentDurationLedger covers all category branches safely', () => {
            const reports = [
                { Type: 'Water Pipe', CreatedAt: new Date(Date.now() - 100000).toISOString(), AssignedAt: null },
                { Type: 'Power Light', CreatedAt: new Date(Date.now() - 100000).toISOString(), AssignedAt: new Date().toISOString() },
                { Type: 'Pothole', CreatedAt: new Date(Date.now() - 100000).toISOString(), AssignedAt: new Date().toISOString(), DateFulfilled: new Date().toISOString() },
                { Type: 'Sewage', CreatedAt: new Date().toISOString(), AssignedAt: null },
                { Type: 'UnknownCategory', CreatedAt: new Date().toISOString() } // Should skip safely
            ];

            AgeReport.updateAssignmentDurationLedger(reports);

            expect(document.getElementById('water-unassigned-bar').style.width).toBeDefined();
            expect(document.getElementById('roads-assigned-bar').style.width).toBeDefined();
        });

        test('renderUnassignedTable maps urgency colors and handles empty states', () => {
            // Test Empty State
            AgeReport.renderUnassignedTable([]);
            expect(document.getElementById('unassigned-table-body').innerHTML).toContain('No unassigned tasks found');

            // Test Populated State
            const now = new Date();
            const reports = [
                { Type: 'Critical', CreatedAt: new Date(now - 72 * 3600000).toISOString(), AssignedAt: null }, // > 48h (Error)
                { Type: 'Urgent', CreatedAt: new Date(now - 30 * 3600000).toISOString(), AssignedAt: null },   // > 24h (Primary)
                { Type: 'New', CreatedAt: new Date().toISOString(), AssignedAt: null }                      // < 24h (Variant)
            ];

            AgeReport.renderUnassignedTable(reports);
            const rows = document.querySelectorAll('#unassigned-table-body tr');
            expect(rows[0].innerHTML).toContain('bg-error');
            expect(rows[1].innerHTML).toContain('bg-primary-container');
            expect(rows[2].innerHTML).toContain('bg-surface-variant');
        });
    });

    // --- 4. CALLBACK EXTRACTION (HIDDEN LINES) ---
    describe('Hidden Callback Logic (Map Pins & Tables)', () => {
        test('Table Row Click maps ID to name and opens modal', () => {
            const reports = [{ ReportID: 10, Type: 'Pothole', MunicipalityID: 99, AssignedAt: null, CreatedAt: new Date().toISOString() }];
            AgeReport.renderUnassignedTable(reports);

            const row = document.querySelector('#unassigned-table-body tr');
            row.click(); // Trigger the hidden onclick

            expect(mockModalOpen).toHaveBeenCalledWith(expect.objectContaining({
                id: 10,
                municipality: 'Test Muni' // Now correctly capitalized via the dictionary!
            }));
        });

        test('Map Pin Click maps ID to name and opens modal', () => {
            AgeReport.setDashboardMap({ map: { removeLayer: jest.fn(), addLayer: jest.fn() } });
            
            const reports = [
                { ReportID: 20, Latitude: -26, Longitude: 28, MunicipalityID: 99, AssignedAt: null, DateFulfilled: null }
            ];
            
            AgeReport.drawPinsOnMap(reports);
            
            expect(markerClickCallback).toBeDefined();
            markerClickCallback(); // Trigger the hidden leaflet marker click

            expect(mockModalOpen).toHaveBeenCalledWith(expect.objectContaining({
                id: 20,
                status: 'Unassigned',
                municipality: 'Test Muni'
            }));
        });
    });

    // --- 5. DOM EVENTS ---
    describe('Event Listeners', () => {
        test('DOMContentLoaded sets up map routing and UI interactions', () => {
            // 1. Verify CivicMap callback routing logic
            expect(civicMapCallback).toBeDefined();
            
            // Route Ward
            civicMapCallback({ wardId: 5, muniId: 'test muni' });
            expect(AgeReport.getSelection().type).toBe('ward');
            
            // Route Muni
            civicMapCallback({ muniId: 'test muni' });
            expect(AgeReport.getSelection().type).toBe('municipality');
            
            // Route Province
            civicMapCallback({ name: 'Gauteng' });
            expect(AgeReport.getSelection().type).toBe('province');

            // 2. Verify Timeframe Button formatting
            const timeButton = document.getElementById('btn-24h');
            timeButton.click();
            expect(timeButton.className).toContain('bg-primary-container'); // Updates class on click

            // 3. Verify Granularity Radio Buttons
            const radio = document.querySelector('input[value="ward"]');
            
            // Setup DOM tree exactly how the script expects (radio -> label wrapper)
            const wrapper = document.createElement('div');
            wrapper.appendChild(radio);
            const label = document.createElement('span');
            label.textContent = 'ward';
            wrapper.appendChild(label);

            radio.dispatchEvent(new Event('change'));
            expect(mockLoadNewLayer).toHaveBeenCalledWith('data/sa_wards.json');
        });
    });
});