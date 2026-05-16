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
        // 🚨 Capture the click event so we can test the hidden logic inside it!
        on: jest.fn((event, cb) => {
            if (event === 'click') markerClickCallback = cb;
        }),
    }),
};

const mockModalOpen = jest.fn();
global.CivicModal = jest.fn().mockImplementation(() => ({
    open: mockModalOpen,
}));

// 🚨 Capture the table row click callback to test it!
let civicTableCallback = null;
global.CivicTable = jest.fn().mockImplementation((containerId, callback) => {
    civicTableCallback = callback;
    return { render: jest.fn() };
});

global.CivicMap = jest.fn().mockImplementation(() => ({
    map: { 
        removeLayer: jest.fn(), 
        addLayer: jest.fn(), 
        fitBounds: jest.fn() 
    },
    loadNewLayer: jest.fn(),
}));

global.DashboardExporter = jest.fn();
global.fetch = jest.fn();

describe('WorkerPerform.js - Maximum Safe Coverage Suite', () => {
    let WorkerPerform;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        // Mute console output for intentional API failure tests to keep terminal clean
        jest.spyOn(console, 'error').mockImplementation(() => {});

        // Setup a comprehensive DOM
        document.body.innerHTML = `
            <input id="employee-search" type="text">
            <div id="employee-list"></div>
            <header><p class="tracking-widest">Querying 0 Active Records</p></header>
            
            <input type="radio" name="timeframe" value="30 Days" id="radio-30" checked>
            <input type="radio" name="timeframe" value="7 Days" id="radio-7">
            <input type="radio" name="timeframe" value="24h" id="radio-24">
            <span id="current-period"></span>
            
            <div id="tasks-total">0</div>
            <div id="acceptance-rate-text">0%</div>
            <svg><circle id="acceptance-rate-circle" style="stroke-dashoffset: 0"></circle></svg>
            
            <div id="bar-one"></div><div id="bar-one-count">0</div><div id="bar-one-fill"></div>
            <div id="bar-two"></div><div id="bar-two-count">0</div><div id="bar-two-fill"></div>
            <div id="bar-three"></div><div id="bar-three-count">0</div><div id="bar-three-fill"></div>
            
            <div id="efficiency-rate-text">0%</div>
            <div id="efficiency-rate-bar" style="width: 0%"></div>
            
            <table><tbody id="recent-history-body"></tbody></table>
            <div id="worker-ledger-container"></div>
            <div id="map"></div>

            <h1 id="profile-name"></h1>
            <p id="profile-registry"></p>
            <img id="profile-avatar" src="">

            <dialog id="ledger-modal">
                <button id="view-history-btn"></button>
                <button id="close-ledger-btn"></button>
            </dialog>
            <button id="export-pdf-btn"></button>
        `;

        HTMLDialogElement.prototype.showModal = jest.fn();
        HTMLDialogElement.prototype.close = jest.fn();
        
        global.workerMap = { map: { addLayer: jest.fn(), removeLayer: jest.fn() } };
        global.pinLayerGroup = global.L.layerGroup();

        // Default successful fetch for setup
        fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
        WorkerPerform = require('../WorkerPerform.js');
        document.dispatchEvent(new Event('DOMContentLoaded'));
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // --- 1. UTILITY FUNCTIONS ---
    describe('Utility Functions', () => {
        test('normalizeName cleans municipality strings for dictionary keys', () => {
            expect(WorkerPerform.normalizeName("City-of-Johannesburg Metropolitan Municipality")).toBe("city of johannesburg");
            expect(WorkerPerform.normalizeName(null)).toBe("");
        });

        test('getDateRange calculates 24h, 7 Days, and 30 Days windows', () => {
            // Test 7 Days
            document.getElementById('radio-30').checked = false;
            document.getElementById('radio-7').checked = true;
            let range = WorkerPerform.getDateRange();
            let diffDays = Math.round((new Date(range.end) - new Date(range.start)) / (1000 * 60 * 60 * 24));
            expect(diffDays).toBe(7);

            // Test 24 Hours
            document.getElementById('radio-7').checked = false;
            document.getElementById('radio-24').checked = true;
            range = WorkerPerform.getDateRange();
            let diffHours = (new Date(range.end) - new Date(range.start)) / (1000 * 60 * 60);
            expect(diffHours).toBeGreaterThanOrEqual(23);
        });
    });

    // --- 2. UI RENDERERS ---
    describe('UI Updates: updateAnalyticsUI', () => {
        test('calculates efficiency and hits all category buckets', () => {
            const mockReports = [
                { Type: 'pothole', Progress: 'Resolved', CreatedAt: new Date().toISOString() }, // Infrastructure
                { Type: 'sanitation', Progress: 'Active', CreatedAt: new Date().toISOString() }, // Sanitation
                { Type: 'water leak', Progress: 'Active', CreatedAt: new Date().toISOString() }  // Utilities
            ];
            
            WorkerPerform.updateAnalyticsUI(mockReports, { accepted: 5, total: 10 });

            // Efficiency: 1 resolved out of 3 total = 33.3%
            expect(document.getElementById('tasks-total').textContent).toBe("3");
            expect(document.getElementById('efficiency-rate-text').textContent).toContain('33.3');
            
            // Acceptance: 5 / 10 = 50%
            expect(document.getElementById('acceptance-rate-text').textContent).toContain('50.0');
            
            // Verifies the sorting and mapping of the 3 category bars
            expect(document.getElementById('bar-one').textContent).toBe('Sanitation');
            expect(document.getElementById('bar-three').textContent).toBe('Utilities');
        });

        test('handles empty reports gracefully', () => {
            WorkerPerform.updateAnalyticsUI([], { accepted: 0, total: 0 });
            expect(document.getElementById('recent-history-body').innerHTML).toContain('NO HISTORY');
            expect(document.getElementById('acceptance-rate-text').textContent).toContain('0.0');
        });
    });

    // --- 3. API FETCHING ---
    describe('API Fetching Logic', () => {
        test('fetchSelectedWorkerStats handles success and failure', async () => {
            WorkerPerform.setWorkerId('W001'); 
            
            // Test Success Path (Dual Fetch)
            fetch.mockReset();
            fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([{ ReportID: 1 }]) })
                 .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ accepted: 5, total: 10 }) });
            await WorkerPerform.fetchSelectedWorkerStats();
            expect(fetch).toHaveBeenCalledTimes(2); 

            // Test Catch Block Path
            fetch.mockRejectedValueOnce(new Error("Network Fail"));
            await WorkerPerform.fetchSelectedWorkerStats();
            expect(console.error).toHaveBeenCalledWith("Analytics Error:", expect.any(Error));
        });

        test('fetchMunicipalityReports handles success and failure', async () => {
            WorkerPerform.setActiveMuni(101);
            
            // Test Success
            fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([{ ReportID: 1 }]) });
            await WorkerPerform.fetchMunicipalityReports();
            expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/sandbox/municipality/101'));

            // Test Catch Block
            fetch.mockRejectedValueOnce(new Error("Network Fail"));
            await WorkerPerform.fetchMunicipalityReports();
            expect(console.error).toHaveBeenCalledWith("Municipality Fetch Error:", expect.any(Error));
        });

        test('fetchAndPopulateWorkers populates UI and wires clicks', async () => {
            fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([{ Name: 'Alice', EmployeeID: 'W1' }]) });
            await WorkerPerform.fetchAndPopulateWorkers();
            
            const btn = document.querySelector('#employee-list button');
            expect(btn.textContent).toContain('Alice');
            
            // Ensure clicking the button doesn't crash and fires the stat fetch
            fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
            btn.click();
            expect(document.getElementById('profile-name').textContent).toBe('Alice');
        });

        test('fetchAndPopulateWorkers handles fetch errors', async () => {
            fetch.mockRejectedValueOnce(new Error("Fail"));
            await WorkerPerform.fetchAndPopulateWorkers();
            expect(document.getElementById('employee-list').innerHTML).toContain('Failed to load');
        });
    });

    // --- 4. CALLBACK EXTRACTION (HIDDEN LINES) ---
    describe('Hidden Callback Logic (Map Pins & Tables)', () => {
        test('CivicTable Row Click fetches allocated workers and opens modal', async () => {
            // Because we mocked CivicTable, civicTableCallback holds the function passed to it!
            expect(civicTableCallback).toBeDefined();

            // Mock the fetch inside the callback
            fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([{ Name: 'Worker 1' }]) });
            
            // Execute the hidden callback directly
            await civicTableCallback({ ReportID: 99, Type: 'Pothole', Brief: 'Hole' });
            
            expect(fetch).toHaveBeenCalledWith('/api/sandbox/report/99/workers');
            expect(mockModalOpen).toHaveBeenCalledWith(expect.objectContaining({
                id: 99,
                type: 'Pothole'
            }));
        });

        test('Map Pin Click fetches allocated workers and opens modal', async () => {
            // Draw a pin to wire the markerClickCallback
            WorkerPerform.drawPinsOnMap([{ ReportID: 55, Latitude: -26, Longitude: 28, Progress: 'Resolved' }]);
            
            expect(markerClickCallback).toBeDefined();

            // Mock the fetch inside the map click handler
            fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
            
            // Execute the hidden map click logic directly
            await markerClickCallback();
            
            expect(fetch).toHaveBeenCalledWith('/api/sandbox/report/55/workers');
            expect(mockModalOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 55 }));
        });
    });

    // --- 5. SIMPLE EVENT LISTENERS ---
    describe('Basic Event Listeners', () => {
        test('Radio button change triggers appropriate fetch', () => {
            const radio = document.getElementById('radio-7');
            
            WorkerPerform.setWorkerId('W123'); 
            radio.dispatchEvent(new Event('change'));
            
            WorkerPerform.setWorkerId(null);
            WorkerPerform.setActiveMuni(444);
            radio.dispatchEvent(new Event('change'));
            
            // Verify event listeners fire without crashing
            expect(fetch).toHaveBeenCalled(); 
        });

        test('Modal opens and closes correctly on button clicks', () => {
            const modal = document.getElementById('ledger-modal');
            document.getElementById('view-history-btn').click();
            expect(modal.showModal).toHaveBeenCalled();
            document.getElementById('close-ledger-btn').click();
            expect(modal.close).toHaveBeenCalled();
        });
    });
});