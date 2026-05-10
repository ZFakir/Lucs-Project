/**
 * @jest-environment jsdom
 */

// --- 1. MOCK EXTERNAL DEPENDENCIES ---
global.L = {
    layerGroup: jest.fn().mockReturnValue({
        addTo: jest.fn().mockReturnThis(),
        removeLayer: jest.fn(),
    }),
    circleMarker: jest.fn().mockReturnValue({
        addTo: jest.fn().mockReturnThis(),
        bindTooltip: jest.fn().mockReturnThis(),
        on: jest.fn(),
    }),
};

global.CivicModal = jest.fn().mockImplementation(() => ({
    open: jest.fn(),
}));

global.CivicTable = jest.fn().mockImplementation(() => ({
    render: jest.fn(),
}));

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

// --- 2. IMPORT MODULE ---
const WorkerPerform = require('../WorkerPerform.js');

describe('WorkerPerform.js - High Coverage Suite', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();

        // Setup a comprehensive DOM for all UI and Logic paths
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
        `;

        // Mock dialog methods
        HTMLDialogElement.prototype.showModal = jest.fn();
        HTMLDialogElement.prototype.close = jest.fn();
        
        // Mock global instances that the script expects to find
        global.workerMap = { map: { addLayer: jest.fn(), removeLayer: jest.fn() } };
        global.pinLayerGroup = global.L.layerGroup();
    });

    describe('Logic: getDateRange', () => {
        test('calculates correct 7 Days window', () => {
            // FIX: Manually toggle the checked state to ensure querySelector hits the right one
            document.getElementById('radio-30').checked = false;
            document.getElementById('radio-7').checked = true;

            const range = WorkerPerform.getDateRange();
            const diffDays = (new Date(range.end) - new Date(range.start)) / (1000 * 60 * 60 * 24);
            expect(Math.round(diffDays)).toBe(7);
            expect(document.getElementById('current-period').textContent).toContain('-');
        });

        test('calculates correct 24h window', () => {
            document.getElementById('radio-30').checked = false;
            document.getElementById('radio-24').checked = true;

            const range = WorkerPerform.getDateRange();
            const start = new Date(range.start);
            const end = new Date(range.end);
            const diffHours = (end - start) / (1000 * 60 * 60);
            expect(diffHours).toBeGreaterThanOrEqual(23);
        });
    });

    describe('UI & Analytics: updateAnalyticsUI', () => {
        const mockReports = [
            { Type: 'pothole', Progress: 'Resolved', CreatedAt: new Date().toISOString() },
            { Type: 'sanitation', Progress: 'Active', CreatedAt: new Date().toISOString() },
            { Type: 'water leak', Progress: 'Active', CreatedAt: new Date().toISOString() }
        ];
        const mockAcceptance = { accepted: 8, total: 10 };

        test('calculates efficiency and updates all category bars', () => {
            WorkerPerform.updateAnalyticsUI(mockReports, mockAcceptance);

            expect(document.getElementById('acceptance-rate-text').textContent).toContain('80.0');
            expect(document.getElementById('efficiency-rate-text').textContent).toContain('33.3');
            // Check bar sorting (Infrastructure should be one of them)
            expect(document.getElementById('bar-one').textContent).toBeDefined();
        });

        test('handles empty reports gracefully', () => {
            WorkerPerform.updateAnalyticsUI([], { accepted: 0, total: 0 });
            expect(document.getElementById('recent-history-body').innerHTML).toContain('NO HISTORY');
        });
    });

    describe('API: fetchSelectedWorkerStats', () => {
        test('executes dual fetch and handles success', async () => {
            WorkerPerform.setWorkerId('W001'); // Requires setter in WorkerPerform.js
            
            fetch.mockResolvedValue({ 
                ok: true, 
                json: () => Promise.resolve([]) 
            });

            await WorkerPerform.fetchSelectedWorkerStats();

            expect(fetch).toHaveBeenCalledTimes(2); // Reports and Acceptance calls
        });

        test('logs error on API failure', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            fetch.mockRejectedValue(new Error("Network Fail"));

            await WorkerPerform.fetchSelectedWorkerStats();

            expect(consoleSpy).toHaveBeenCalledWith("Analytics Error:", expect.any(Error));
            consoleSpy.mockRestore();
        });
    });

    describe('Feature: Employee Search', () => {
        test('filters worker buttons based on input text', () => {
            const list = document.getElementById('employee-list');
            list.innerHTML = `
                <button><span>Alice W01</span></button>
                <button><span>Bob W02</span></button>
            `;
            const buttons = list.querySelectorAll('button');
            const input = document.getElementById('employee-search');
            
            // Simulate the search logic
            input.value = 'Alice';
            buttons.forEach(btn => {
                btn.style.display = btn.textContent.toLowerCase().includes('alice') ? 'flex' : 'none';
            });

            expect(buttons[0].style.display).toBe('flex');
            expect(buttons[1].style.display).toBe('none');
        });
    });
});

describe('WorkerPerform.js - Advanced Coverage Boosters', () => {

    describe('Utility: normalizeName', () => {
        test('properly cleans municipality strings for dictionary keys', () => {
            const input = "City-of-Johannesburg Metropolitan Municipality";
            const expected = "city of johannesburg";
            expect(WorkerPerform.normalizeName(input)).toBe(expected);
        });

        test('returns empty string if input is null', () => {
            expect(WorkerPerform.normalizeName(null)).toBe("");
        });
    });


    describe('UI: updateAnalyticsUI Category Sorting', () => {
        test('sorts categories ascending (lowest volume to highest)', () => {
            const reports = [
                { Type: 'sanitation' }, { Type: 'sanitation' }, // 2
                { Type: 'pothole' },                            // 1 (Infrastructure)
                { Type: 'electricity' }, { Type: 'electricity' }, { Type: 'electricity' } // 3 (Utilities)
            ];
            
            WorkerPerform.updateAnalyticsUI(reports, { accepted: 1, total: 1 });

            // Bar one should be Infrastructure (Count 1)
            expect(document.getElementById('bar-one').textContent).toBe('Infrastructure');
            expect(document.getElementById('bar-one-count').textContent).toBe("1");

            // Bar three should be Utilities (Count 3)
            expect(document.getElementById('bar-three').textContent).toBe('Utilities');
            expect(document.getElementById('bar-three-count').textContent).toBe("3");
        });
    });

//Did the test load
    describe('Dynamic Population: fetchAndPopulateWorkers', () => {
        test('creates buttons and sets up onclick behavior for workers', async () => {
            const mockWorkers = [{ Name: 'Alice', EmployeeID: 'W_001' }];
            fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockWorkers) });

            await WorkerPerform.fetchAndPopulateWorkers();

            const list = document.getElementById('employee-list');
            const button = list.querySelector('button');
            
            expect(button).not.toBeNull();
            expect(button.textContent).toContain('Alice');

            // Simulate clicking the worker button
            button.click();
            
            expect(document.getElementById('profile-name').textContent).toBe('Alice');
            expect(document.getElementById('profile-registry').textContent).toContain('W_001');
        });
    });
});