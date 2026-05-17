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
        on: jest.fn((event, cb) => {
            if (event === 'click') markerClickCallback = cb;
        }),
    }),
};

const mockAlertShow = jest.fn().mockResolvedValue(true);
global.AlertModal = jest.fn().mockImplementation(() => ({
    show: mockAlertShow
}));

const mockModalOpen = jest.fn();
global.CivicModal = jest.fn().mockImplementation(() => ({
    open: mockModalOpen,
}));

let civicTableCallback = null;
global.CivicTable = jest.fn().mockImplementation((containerId, callback) => {
    civicTableCallback = callback;
    return { render: jest.fn() };
});

let civicMapCallback = null;
global.CivicMap = jest.fn().mockImplementation((id, path, cb) => {
    civicMapCallback = cb;
    return {
        map: { removeLayer: jest.fn(), addLayer: jest.fn(), fitBounds: jest.fn() },
        loadNewLayer: jest.fn(),
    };
});

global.DashboardExporter = jest.fn();
global.fetch = jest.fn();

describe('WorkerPerform.js - Maximum Safe Coverage Suite', () => {
    let WorkerPerform;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        jest.spyOn(console, 'error').mockImplementation(() => {});

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

        fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
        WorkerPerform = require('../WorkerPerform.js');
        document.dispatchEvent(new Event('DOMContentLoaded'));
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // ... [Utility Functions, UI Renderers, API Fetching, and Hidden Callback logic remain identical] ...
    
    describe('Utility Functions', () => {
        test('normalizeName cleans municipality strings for dictionary keys', () => {
            expect(WorkerPerform.normalizeName("City-of-Johannesburg Metropolitan Municipality")).toBe("city of johannesburg");
            expect(WorkerPerform.normalizeName(null)).toBe("");
        });

        test('getDateRange calculates 24h, 7 Days, and 30 Days windows', () => {
            document.getElementById('radio-30').checked = false;
            document.getElementById('radio-7').checked = true;
            let range = WorkerPerform.getDateRange();
            let diffDays = Math.round((new Date(range.end) - new Date(range.start)) / (1000 * 60 * 60 * 24));
            expect(diffDays).toBe(7);

            document.getElementById('radio-7').checked = false;
            document.getElementById('radio-24').checked = true;
            range = WorkerPerform.getDateRange();
            let diffHours = (new Date(range.end) - new Date(range.start)) / (1000 * 60 * 60);
            expect(diffHours).toBeGreaterThanOrEqual(23);
        });
    });

    describe('UI Updates: updateAnalyticsUI', () => {
        test('calculates efficiency and hits all category buckets', () => {
            const mockReports = [
                { Type: 'pothole', Progress: 'Resolved', CreatedAt: new Date().toISOString() }, 
                { Type: 'sanitation', Progress: 'Active', CreatedAt: new Date().toISOString() }, 
                { Type: 'water leak', Progress: 'Active', CreatedAt: new Date().toISOString() }  
            ];
            
            WorkerPerform.updateAnalyticsUI(mockReports, { accepted: 5, total: 10 });

            expect(document.getElementById('tasks-total').textContent).toBe("3");
            expect(document.getElementById('efficiency-rate-text').textContent).toContain('33.3');
            expect(document.getElementById('acceptance-rate-text').textContent).toContain('50.0');
            expect(document.getElementById('bar-one').textContent).toBe('Sanitation');
            expect(document.getElementById('bar-three').textContent).toBe('Utilities');
        });
    });

    describe('API Fetching Logic', () => {
        test('fetchSelectedWorkerStats handles success and failure', async () => {
            WorkerPerform.setWorkerId('W001'); 
            fetch.mockReset();
            fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([{ ReportID: 1 }]) })
                 .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ accepted: 5, total: 10 }) });
            await WorkerPerform.fetchSelectedWorkerStats();
            expect(fetch).toHaveBeenCalledTimes(2); 

            fetch.mockRejectedValueOnce(new Error("Network Fail"));
            await WorkerPerform.fetchSelectedWorkerStats();
            expect(console.error).toHaveBeenCalledWith("Analytics Error:", expect.any(Error));
        });

        test('fetchMunicipalityReports handles success and failure', async () => {
            WorkerPerform.setActiveMuni(101);
            fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([{ ReportID: 1 }]) });
            await WorkerPerform.fetchMunicipalityReports();
            expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/sandbox/municipality/101'));

            fetch.mockRejectedValueOnce(new Error("Network Fail"));
            await WorkerPerform.fetchMunicipalityReports();
            expect(console.error).toHaveBeenCalledWith("Municipality Fetch Error:", expect.any(Error));
        });
    });

    describe('Hidden Callback Logic (Map Pins & Tables)', () => {
        test('CivicTable Row Click fetches allocated workers and opens modal', async () => {
            expect(civicTableCallback).toBeDefined();
            fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([{ Name: 'Worker 1' }]) });
            
            await civicTableCallback({ ReportID: 99, Type: 'Pothole', Brief: 'Hole' });
            
            expect(fetch).toHaveBeenCalledWith('/api/sandbox/report/99/workers');
            expect(mockModalOpen).toHaveBeenCalledWith(expect.objectContaining({
                id: 99,
                type: 'Pothole'
            }));
        });
    });

    describe('Map Validation & Basic Event Listeners', () => {
        test('CivicMap callback triggers AlertModal if timeframe is not selected', async () => {
            document.querySelectorAll('input[name="timeframe"]').forEach(r => r.checked = false);
            
            await civicMapCallback({ muniId: 'City of Johannesburg' });
            
            expect(mockAlertShow).toHaveBeenCalledWith(
                'Selection Required', 
                expect.any(String), 
                'alert'
            );
        });

        test('CivicMap callback proceeds to logic if timeframe is selected', async () => {
            document.getElementById('radio-30').checked = true;
            fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
            
            await civicMapCallback({ muniId: 'City of Johannesburg' });
            
            expect(fetch).toHaveBeenCalled(); // Confirming map interaction fired the fetch
        });

        test('Radio button change triggers appropriate fetch', () => {
            const radio = document.getElementById('radio-7');
            WorkerPerform.setWorkerId('W123'); 
            radio.dispatchEvent(new Event('change'));
            
            WorkerPerform.setWorkerId(null);
            WorkerPerform.setActiveMuni(444);
            radio.dispatchEvent(new Event('change'));
            
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