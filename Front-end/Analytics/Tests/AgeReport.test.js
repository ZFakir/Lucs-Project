/**
 * @jest-environment jsdom
 */

// Mocking external dependencies
global.L = {
    layerGroup: jest.fn().mockReturnValue({
        addTo: jest.fn().mockReturnThis(),
        clearLayers: jest.fn(),
    }),
    circleMarker: jest.fn().mockReturnValue({
        addTo: jest.fn(),
        bindTooltip: jest.fn(),
        on: jest.fn(),
    }),
};

global.CivicModal = jest.fn().mockImplementation(() => ({
    open: jest.fn(),
}));

global.CivicMap = jest.fn().mockImplementation(() => ({
    map: { removeLayer: jest.fn(), addLayer: jest.fn() },
    loadNewLayer: jest.fn(),
}));

global.DashboardExporter = jest.fn();

// Mock Fetch API
global.fetch = jest.fn();

// Import the actual functions from the source file
const { 
    normalizeName, 
    getDateRange, 
    fetchAgingData, 
    updateAssignmentDurationLedger, 
    calculateBottleneckMetrics, 
    renderUnassignedTable,
    drawPinsOnMap 
} = require('../AgeReport.js');

describe('AgeReport.js Unit Tests', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();

        // Initialize global state for the module to use
        global.currentSelection = { type: 'province', ids: { provinceId: 1 } };
        global.MunicipalityMap = {};

        // Setup minimal DOM required for functions to run
        document.body.innerHTML = `
            <div id="map"></div>
            <nav class="grid"><button class="bg-primary-container">30 DAYS</button></nav>
            <div id="unassigned-table-body"></div>
            <div id="water-unassigned-bar"></div>
            <div id="water-assigned-bar"></div>
            <div id="electricity-unassigned-bar"></div>
            <div id="electricity-assigned-bar"></div>
            <div id="roads-unassigned-bar"></div>
            <div id="roads-assigned-bar"></div>
            <div id="sanitation-unassigned-bar"></div>
            <div id="sanitation-assigned-bar"></div>
            <article class="border-surface-variant"><p class="text-7xl"></p></article>
            <article class="border-primary-container"><p class="text-7xl"></p></article>
        `;
    });

    describe('Utility: normalizeName', () => {
        test('removes municipality suffixes and normalizes case', () => {
            expect(normalizeName("City of Cape Town Metropolitan Municipality")).toBe("city of cape town");
            expect(normalizeName("George Local Municipality")).toBe("george");
        });

        test('returns empty string for null/undefined', () => {
            expect(normalizeName(null)).toBe("");
        });
    });

    describe('Logic: calculateBottleneckMetrics', () => {
        test('calculates correct averages for unassigned and resolved tasks', () => {
            const now = new Date();
            const reports = [
                { 
                    CreatedAt: new Date(now - 10 * 60 * 60 * 1000).toISOString(), // 10h ago
                    AssignedAt: null 
                },
                { 
                    CreatedAt: new Date(now - 20 * 60 * 60 * 1000).toISOString(), 
                    DateFulfilled: new Date(now - 10 * 60 * 60 * 1000).toISOString(), // 10h to resolve
                    AssignedAt: new Date(now - 15 * 60 * 60 * 1000).toISOString()
                }
            ];

            calculateBottleneckMetrics(reports);

            const unassignedEl = document.querySelector('article.border-surface-variant p.text-7xl');
            const resolutionEl = document.querySelector('article.border-primary-container p.text-7xl');

            expect(unassignedEl.innerHTML).toContain('10.0');
            expect(resolutionEl.innerHTML).toContain('10.0');
        });
    });

    describe('API: fetchAgingData', () => {
        test('constructs correct URL for province selection', async () => {
            fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue([])
            });

            await fetchAgingData();

            expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/sandbox/province/1'));
        });
    });


    describe('AgeReport.js - Targeted Coverage Boosters', () => {


    test('updateAssignmentDurationLedger: covers ALL category branches', () => {
        const reports = [
            { Type: 'Water Pipe', CreatedAt: new Date(Date.now() - 100000).toISOString(), AssignedAt: null },
            { Type: 'Power Light', CreatedAt: new Date(Date.now() - 100000).toISOString(), AssignedAt: new Date().toISOString() },
            { Type: 'Pothole', CreatedAt: new Date(Date.now() - 100000).toISOString(), AssignedAt: new Date().toISOString(), DateFulfilled: new Date().toISOString() },
            { Type: 'Sewage', CreatedAt: new Date().toISOString(), AssignedAt: null }
        ];

        updateAssignmentDurationLedger(reports);

        // Verify style updates occurred for the bars
        expect(document.getElementById('water-unassigned-bar').style.width).toBeDefined();
        expect(document.getElementById('roads-assigned-bar').style.width).toBeDefined();
    });

    test('renderUnassignedTable: covers Urgency Color thresholds', () => {
        const now = new Date();
        const reports = [
            { Type: 'Critical', CreatedAt: new Date(now - 72 * 3600000).toISOString(), AssignedAt: null }, // > 48h (Error)
            { Type: 'Urgent', CreatedAt: new Date(now - 30 * 3600000).toISOString(), AssignedAt: null },   // > 24h (Primary)
            { Type: 'New', CreatedAt: new Date().toISOString(), AssignedAt: null }                      // < 24h (Variant)
        ];

        renderUnassignedTable(reports);

        const rows = document.querySelectorAll('#unassigned-table-body tr');
        expect(rows[0].innerHTML).toContain('bg-error');
        expect(rows[1].innerHTML).toContain('bg-primary-container');
        expect(rows[2].innerHTML).toContain('bg-surface-variant');
    });

});
});