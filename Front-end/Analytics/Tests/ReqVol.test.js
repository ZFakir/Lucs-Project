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

const mockLoadNewLayer = jest.fn();
const mockZoomIn = jest.fn();
const mockZoomOut = jest.fn();
const mockRemoveLayer = jest.fn();

global.CivicMap = jest.fn().mockImplementation(() => ({
    map: { removeLayer: mockRemoveLayer, addLayer: jest.fn() },
    loadNewLayer: mockLoadNewLayer,
    zoomIn: mockZoomIn,
    zoomOut: mockZoomOut,
}));

const mockModalOpen = jest.fn();
global.CivicModal = jest.fn().mockImplementation(() => ({
    open: mockModalOpen,
}));

global.DashboardExporter = jest.fn();
global.fetch = jest.fn();

// --- 2. LOAD & INJECT SCRIPT ---
const { 
    onMapClick, 
    getDateRange, 
    fetchDashboardData, 
    updateUI, 
    updateBarCharts, 
    formatNumber, 
    normalizeName, 
    buildMunicipalityMap, 
    renderLedgerTable, 
    drawPinsOnMap 
} = require('../ReqVol.js');

describe('ReqVol.js Integration Tests - High Coverage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Inject all elements required by the DOMContentLoaded event listener
        document.body.innerHTML = `
            <input type="radio" name="timeframe" id="t1"><label for="t1">24h</label>
            <input type="radio" name="timeframe" id="t2"><label for="t2">7 Days</label>
            <input type="radio" name="timeframe" id="t3" checked><label for="t3">30 Days</label>
            
            <input type="radio" name="granularity" id="g1"><label for="g1">provincial</label>
            <input type="radio" name="granularity" id="g2"><label for="g2">municipal</label>
            <input type="radio" name="granularity" id="g3"><label for="g3">ward</label>

            <div id="req-volume-count">0</div>
            <div id="res-volume-count">0</div>
            <div id="res-rate-text">0%</div>
            <svg><circle id="res-rate-circle" style="stroke-dashoffset: 0"></circle></svg>
            
            <div id="req-chart-container"></div>
            <div id="res-chart-container"></div>
            
            <table><tbody id="ledger-table-body"></tbody></table>
            <dialog id="ledger-modal">
                <button id="view-ledger-btn"></button>
                <button id="close-ledger-btn"></button>
            </dialog>

            <button id="zoom-in-btn"></button>
            <button id="zoom-out-btn"></button>
            <button id="export-pdf-btn"></button>
            <div id="map"></div>
        `;
        
        HTMLDialogElement.prototype.showModal = jest.fn();
        HTMLDialogElement.prototype.close = jest.fn();

        // Trigger DOMContentLoaded to wire up all the internal map/modal events
        document.dispatchEvent(new Event('DOMContentLoaded'));
    });

    describe('Utility Functions', () => {
        test('normalizeName cleans municipal strings correctly', () => {
            expect(normalizeName("CITY-OF-JOHANNESBURG Metropolitan Municipality")).toBe("city of johannesburg");
        });

        test('formatNumber handles thousands with k suffix', () => {
            expect(formatNumber(1200)).toBe("1.2k");
            expect(formatNumber(500)).toBe(500);
        });
    });

    describe('Logic: getDateRange', () => {
        test('calculates correct 30-day window', () => {
            const range = getDateRange();
            const start = new Date(range.start);
            const end = new Date(range.end);
            const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
            expect(diffDays).toBe(30);
        });
    });

    describe('UI Updates: updateUI', () => {
        const mockReports = [
            { CreatedAt: new Date().toISOString(), Progress: 'Active' },
            { CreatedAt: new Date().toISOString(), DateFulfilled: new Date().toISOString(), Progress: 'Resolved' }
        ];

        test('calculates and displays 50% resolution rate for 2 reports (1 resolved)', () => {
            const start = new Date(Date.now() - 86400000).toISOString();
            const end = new Date().toISOString();

            updateUI(mockReports, start, end);

            expect(document.getElementById('req-volume-count').textContent).toBe("2");
            expect(document.getElementById('res-volume-count').textContent).toBe("1");
            expect(document.getElementById('res-rate-text').textContent).toBe("50%");
        });

        test('handles zero requests without division by zero error', () => {
            updateUI([], new Date().toISOString(), new Date().toISOString());
            expect(document.getElementById('res-rate-text').textContent).toBe("0%");
        });
    });

    describe('Component: renderLedgerTable', () => {
        test('renders empty state message when no reports exist', () => {
            renderLedgerTable([]);
            const tbody = document.getElementById('ledger-table-body');
            expect(tbody.innerHTML).toContain('No issues found');
        });

        test('renders a table row with correct icon for pothole', () => {
            const reports = [{ Type: 'pothole', Brief: 'Big hole', CreatedAt: '2026-05-01', ReportID: 123 }];
            renderLedgerTable(reports);

            const tbody = document.getElementById('ledger-table-body');
            expect(tbody.innerHTML).toContain('road'); // Icon name for potholes
            expect(tbody.innerHTML).toContain('Big hole');
        });
    });

    describe('ReqVol.js - Advanced Logic', () => {
        test('updateBarCharts: correctly buckets reports into 7 segments', () => {
            const start = new Date('2023-01-01').toISOString();
            const end = new Date('2023-01-07').toISOString();
            const reports = [
                { CreatedAt: '2023-01-01T10:00:00Z' }, // Bucket 0
                { CreatedAt: '2023-01-04T10:00:00Z' }, // Bucket 3
                { CreatedAt: '2023-01-07T10:00:00Z' }  // Bucket 6
            ];

            updateBarCharts(reports, start, end);
            const chart = document.getElementById('req-chart-container');
            const barsWithData = Array.from(chart.children).filter(bar => bar.style.height !== '5%');
            expect(barsWithData.length).toBe(3);
        });
    });

    describe('Logic: getDateRange Branches', () => {
        test('calculates correct 24h window when selected', () => {
            document.querySelectorAll('input[name="timeframe"]')[0].checked = true;
            const range = getDateRange();
            const start = new Date(range.start);
            const end = new Date(range.end);
            const diffHours = (end - start) / (1000 * 60 * 60);
            expect(diffHours).toBeGreaterThanOrEqual(23);
        });

        test('calculates correct 7-day window when selected', () => {
            document.querySelectorAll('input[name="timeframe"]')[1].checked = true;
            const range = getDateRange();
            const diffDays = Math.round((new Date(range.end) - new Date(range.start)) / (1000 * 60 * 60 * 24));
            expect(diffDays).toBe(7);
        });
    });

    describe('API: fetchDashboardData', () => {
        test('constructs ward-specific URL correctly', async () => {
            onMapClick('ward', { municipalityId: 10, wardId: 5 });
            fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
            
            await fetchDashboardData();
            expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/sandbox/ward/10/5'));
        });

        test('constructs municipality-specific URL correctly', async () => {
            onMapClick('municipality', { municipalityId: 20 });
            fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
            
            await fetchDashboardData();
            expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/sandbox/municipality/20'));
        });

        test('handles fetch errors by updating UI with error text', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            fetch.mockRejectedValueOnce(new Error('API Failure'));

            await fetchDashboardData();

            expect(document.getElementById('req-volume-count').textContent).toBe("Error");
            consoleSpy.mockRestore();
        });
    });

    describe('Map Pin Generation & Interactions', () => {
        test('drawPinsOnMap plots coordinates, applies colors, and attaches click events', () => {
            const mockReports = [
                { ReportID: 10, Latitude: -26.1, Longitude: 28.1, Progress: 'Resolved' },
                { ReportID: 11, Latitude: -26.2, Longitude: 28.2, Progress: 'Pending' },
                { ReportID: 12, Latitude: null, Longitude: null } // Skipped due to null lat/long
            ];
            
            drawPinsOnMap(mockReports);
            
            expect(global.L.circleMarker).toHaveBeenCalledTimes(2);
            expect(global.L.circleMarker).toHaveBeenCalledWith(
                [-26.1, 28.1], 
                expect.objectContaining({ fillColor: '#808080' }) // Resolved status
            );
            expect(global.L.circleMarker).toHaveBeenCalledWith(
                [-26.2, 28.2], 
                expect.objectContaining({ fillColor: '#FF8C00' }) // Pending status
            );
        });
    });

    describe('Initialization & Event Listeners', () => {
        test('buildMunicipalityMap fetches successfully', async () => {
            fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ "test city": 99 }) });
            const result = await buildMunicipalityMap();
            expect(result).toEqual({ "test city": 99 });
        });

        test('buildMunicipalityMap handles failure gracefully', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            fetch.mockRejectedValueOnce(new Error('Map API Down'));
            const result = await buildMunicipalityMap();
            expect(result).toEqual({});
            consoleSpy.mockRestore();
        });

        test('Clicking granularity radio updates map layer', () => {
            const wardRadio = document.getElementById('g3');
            wardRadio.checked = true;
            wardRadio.dispatchEvent(new Event('change'));
            
            expect(mockLoadNewLayer).toHaveBeenCalledWith('data/sa_wards.json');
            expect(mockRemoveLayer).toHaveBeenCalled();

            const provRadio = document.getElementById('g1'); 
            provRadio.checked = true;
            provRadio.dispatchEvent(new Event('change'));
            
            expect(mockLoadNewLayer).toHaveBeenCalledWith('data/sa_provincial.json');
        });

        test('Map zoom buttons call CivicMap methods', () => {
            document.getElementById('zoom-in-btn').click();
            expect(mockZoomIn).toHaveBeenCalled();

            document.getElementById('zoom-out-btn').click();
            expect(mockZoomOut).toHaveBeenCalled();
        });

        test('Ledger modal opens and closes correctly', () => {
            const modal = document.getElementById('ledger-modal');
            document.getElementById('view-ledger-btn').click();
            expect(modal.showModal).toHaveBeenCalled();

            document.getElementById('close-ledger-btn').click();
            expect(modal.close).toHaveBeenCalled();
            
            // Simulate click outside the dialog context box
            modal.dispatchEvent(new Event('click'));
            expect(modal.close).toHaveBeenCalledTimes(2);
        });
    });
});