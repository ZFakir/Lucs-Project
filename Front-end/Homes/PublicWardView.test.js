/**
 * @jest-environment jsdom
 */

global.fetch = jest.fn();

// Mock Leaflet safely so map logic doesn't crash
global.L = {
    map: jest.fn().mockReturnValue({
        setView: jest.fn().mockReturnThis(),
        fitBounds: jest.fn(),
    }),
    tileLayer: jest.fn().mockReturnValue({
        addTo: jest.fn(),
    }),
    latLngBounds: jest.fn().mockReturnValue({
        extend: jest.fn(),
    }),
    circleMarker: jest.fn().mockReturnValue({
        addTo: jest.fn().mockReturnThis(),
        bindPopup: jest.fn().mockReturnThis(),
        on: jest.fn(),
    })
};

const mockModalOpen = jest.fn();
global.CivicModal = class {
    open = mockModalOpen;
};

describe('PublicWardView Logic Tests - Safe Integration', () => {
    let publicWardModule;
    let originalURLSearchParams;

    beforeAll(() => {
        originalURLSearchParams = global.URLSearchParams;
        global.URLSearchParams = jest.fn(() => ({
            get: jest.fn().mockReturnValue('5')
        }));
    });

    afterAll(() => {
        global.URLSearchParams = originalURLSearchParams;
    });

    beforeEach(async () => {
        jest.resetModules();
        jest.clearAllMocks();

        // Wrapping tbody inside table prevents JSDOM from deleting it
        document.body.innerHTML = `
            <h1 id="ward-title"></h1>
            <p id="councillor-label"></p>
            <p id="active-count"></p>
            <p id="resolved-count"></p>
            <div id="ward-map"></div>
            <table><tbody id="reports-table-body"></tbody></table>
        `;

        // Mute expected console.error logs so the terminal output remains clean
        jest.spyOn(console, 'error').mockImplementation(() => {});

        // Intercept DOMContentLoaded to execute synchronously
        let domReadyCb;
        jest.spyOn(document, 'addEventListener').mockImplementation((evt, cb) => {
            if (evt === 'DOMContentLoaded') domReadyCb = cb;
        });

        fetch.mockResolvedValue({ ok: true, json: async () => [] });
        publicWardModule = require('./PublicWardView.js');
        
        if (domReadyCb) domReadyCb(); // Initialises issueModal safely
        //await new Promise(process.nextTick);
    });

    afterEach(() => {
        console.error.mockRestore();
    });

    // --- PRE-EXISTING SAFE TESTS ---

    test('renderStats counts active vs resolved correctly', () => {
        const mockReports = [
            { Progress: 'Resolved' },
            { Progress: 'Fixed' },
            { Progress: 'In Progress' },
            { Progress: 'Assigned to field staff' }
        ];
        publicWardModule.renderStats(mockReports);
        expect(document.getElementById('active-count').textContent).toBe('2');
        expect(document.getElementById('resolved-count').textContent).toBe('2');
    });

    // test('renderTable injects HTML correctly', () => {
    //     const mockReports = [
    //         { ReportID: 101, Type: 'Pothole', Progress: 'Resolved', CreatedAt: '2026-05-10T10:00:00Z' }
    //     ];
    //     publicWardModule.renderTable(mockReports);
    //     expect(document.getElementById('reports-table-body').innerHTML).toContain('Pothole');
    //     expect(document.getElementById('reports-table-body').innerHTML).toContain('Resolved');
    // });

    test('fetchWardDetails updates the councillor label successfully', async () => {
        fetch.mockResolvedValueOnce({ 
            ok: true, 
            json: async () => ({ WardCouncillor: 'Jane Doe' }) 
        });
        await publicWardModule.fetchWardDetails(5);
        expect(document.getElementById('councillor-label').textContent).toBe('Councillor: Jane Doe');
    });

    // test('openIssueModal triggers the CivicModal safely', async () => {
    //     const mockReport = { ReportID: 55, Type: 'Electricity', Progress: 'In Progress', WardID: 5 };
    //     publicWardModule.setCurrentReports([mockReport]);
    //     await publicWardModule.openIssueModal(55);
    //     expect(mockModalOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 55 }));
    // });

    // --- NEW HIGH-COVERAGE TESTS ---

    test('fetchWardReports handles API failure gracefully (Catch Block)', async () => {
        fetch.mockRejectedValueOnce(new Error('Network Error'));
        await publicWardModule.fetchWardReports(5);
        
        expect(document.getElementById('reports-table-body').innerHTML).toContain('Failed to load reports');
    });

    test('fetchWardDetails handles API failure gracefully (Catch Block)', async () => {
        fetch.mockRejectedValueOnce(new Error('Network Error'));
        await publicWardModule.fetchWardDetails(5);
        
        expect(document.getElementById('councillor-label').textContent).toBe('Civic Transparency View');
    });

    test('renderTable handles empty reports array', () => {
        publicWardModule.renderTable([]);
        
        expect(document.getElementById('reports-table-body').innerHTML).toContain('No public issues reported for this ward');
    });

    test('renderTable accurately parses different progress states', () => {
        const mockReports = [
            { ReportID: 1, Type: 'Water Leak', Progress: 'In Progress', CreatedAt: '2026-05-10T10:00:00Z' },
            { ReportID: 2, Type: 'Electricity', Progress: 'Unknown Status', CreatedAt: '2026-05-10T10:00:00Z' }
        ];
        publicWardModule.renderTable(mockReports);
        
        const html = document.getElementById('reports-table-body').innerHTML;
        // Verify the fallback class logic executes
        expect(html).toContain('In Progress');
        expect(html).toContain('Active'); // The fallback label for unknown status
    });

    test('initMap successfully initializes the Leaflet map logic', () => {
        publicWardModule.initMap();
        
        expect(global.L.map).toHaveBeenCalledWith('ward-map');
        expect(global.L.tileLayer).toHaveBeenCalled();
    });

    test('renderMapMarkers plots valid coordinates and handles coloring', () => {
        publicWardModule.initMap(); // Ensure map exists in state

        const mockReports = [
            { ReportID: 1, latitude: 0, longitude: 0 }, // Should skip invalid coord
            { ReportID: 2, Latitude: -26.2, Longitude: 28.0, Progress: 'Resolved' }, // Valid Resolved
            { ReportID: 3, Latitude: -26.3, Longitude: 28.1, Progress: 'Pending' }  // Valid Pending
        ];
        
        publicWardModule.renderMapMarkers(mockReports);
        
        // Assert only the 2 valid coordinates were mapped
        expect(global.L.circleMarker).toHaveBeenCalledTimes(2);
        
        // Assert the color logic passed correctly
        expect(global.L.circleMarker).toHaveBeenCalledWith(
            [-26.2, 28.0], 
            expect.objectContaining({ fillColor: '#808080' }) // Resolved = Gray
        );
        expect(global.L.circleMarker).toHaveBeenCalledWith(
            [-26.3, 28.1], 
            expect.objectContaining({ fillColor: '#FF8C00' }) // Active = Orange
        );
    });

    test('openIssueModal safely ignores invalid report IDs', async () => {
        mockModalOpen.mockClear();
        publicWardModule.setCurrentReports([]); // Empty the state
        
        await publicWardModule.openIssueModal(999);
        
        // The early return should fire, preventing the modal from opening
        expect(mockModalOpen).not.toHaveBeenCalled();
    });
});