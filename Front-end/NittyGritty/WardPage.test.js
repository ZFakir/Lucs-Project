/**
 * @jest-environment jsdom
 */

const {
    fetchWardReports,
    fetchWardDetails,
    renderStats,
    renderTable,
    openIssueModal,
    setCurrentReports
} = require('./WardPage.js');

// 1. Setup our mock DOM and Global Objects
// 1. Setup our mock DOM and Global Objects
beforeEach(() => {
    document.body.innerHTML = `
        <h1 id="ward-title"></h1>
        <p id="councillor-label"></p>
        <p id="active-count"></p>
        <p id="resolved-count"></p>
        
        <table>
            <tbody id="reports-table-body"></tbody>
        </table>
        
        <dialog id="issue-modal">
            <h2 id="modal-title"></h2>
            <p id="modal-desc"></p>
            <dd id="modal-date"></dd>
            <span id="modal-frequency"></span>
            <dd id="modal-status"></dd>
            <ul id="modal-carousel"></ul>
            <button id="bump-btn"></button>
            <button id="close-issue-modal"></button>
        </dialog>
    `;


    // Mock the HTMLDialogElement methods that JSDOM doesn't support natively
    window.HTMLDialogElement.prototype.showModal = jest.fn();
    window.HTMLDialogElement.prototype.close = jest.fn();

    // Mock global fetch
    global.fetch = jest.fn();

    // Mock localStorage
    const localStorageMock = (function() {
        let store = {};
        return {
            getItem: jest.fn(key => store[key] || null),
            setItem: jest.fn((key, value) => { store[key] = value.toString(); }),
            clear: jest.fn(() => { store = {}; })
        };
    })();
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });
});

afterEach(() => {
    jest.clearAllMocks();
});

// 2. The Test Cases
describe('WardPage.js UI Rendering', () => {
    const mockReports = [
        { ReportID: 1, Type: 'Pothole', Progress: 'Active', CreatedAt: '2026-04-10T10:00:00Z', Frequency: 5 },
        { ReportID: 2, Type: 'Water Leak', Progress: 'In Progress', CreatedAt: '2026-04-11T10:00:00Z', Frequency: 12 },
        { ReportID: 3, Type: 'Street Light', Progress: 'Resolved', CreatedAt: '2026-04-12T10:00:00Z', Frequency: 2 }
    ];

    test('renderStats() correctly tallies active vs resolved issues', () => {
        renderStats(mockReports);

        // Active should be 2 (Active + In Progress)
        expect(document.getElementById('active-count').textContent).toBe('2');
        // Resolved should be 1
        expect(document.getElementById('resolved-count').textContent).toBe('1');
    });

    test('renderTable() generates the correct number of rows and styling', () => {
        renderTable(mockReports);

        const tbody = document.getElementById('reports-table-body');
        const rows = tbody.querySelectorAll('tr');

        expect(rows.length).toBe(3);
        
        // Check if the first row contains the right text and badge
        expect(rows[0].innerHTML).toContain('Pothole');
        expect(rows[0].innerHTML).toContain('Active');
        expect(rows[0].classList.contains('cursor-pointer')).toBe(true);
    });

    test('renderTable() shows empty state when no reports exist', () => {
        renderTable([]);
        
        const tbody = document.getElementById('reports-table-body');
        expect(tbody.innerHTML).toContain('No issues reported for this ward.');
    });
});

describe('WardPage.js Data Fetching', () => {
    test('fetchWardDetails() updates councillor name on success', async () => {
        // Setup mock fetch response
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ WardCouncillor: 'Cllr. Sarah Khumalo' })
        });

        await fetchWardDetails(7);

        expect(global.fetch).toHaveBeenCalledWith('/api/geography/wards/7');
        expect(document.getElementById('councillor-label').textContent).toBe('Cllr. Sarah Khumalo');
    });

    test('fetchWardDetails() handles missing councillor data gracefully', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({}) // Empty object
        });

        await fetchWardDetails(7);
        expect(document.getElementById('councillor-label').textContent).toBe('Unassigned');
    });
test('fetchWardReports() handles API failure gracefully', async () => {
        // 1. Spy on console.error and temporarily mute it
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); //so it doesn't fail just because of the console error

        // 2. Setup mock fetch failure
        global.fetch.mockResolvedValueOnce({ ok: false });

        await fetchWardReports(7);

        const tbody = document.getElementById('reports-table-body');
        expect(tbody.innerHTML).toContain('Failed to load reports');

        // 3. Un-mute the console so other tests can use it normally
        consoleSpy.mockRestore();
    });
});

describe('WardPage.js Modal Interactions', () => {
    const mockReport = { 
        ReportID: 99, 
        Type: 'Pothole', 
        Progress: 'In Progress', 
        CreatedAt: '2026-04-10T10:00:00Z', 
        Frequency: 10 
    };

    beforeEach(() => {
        // Seed our global variable with test data so the modal can find it
        setCurrentReports([mockReport]);
    });

    test('openIssueModal() populates modal data and opens dialog', () => {
        openIssueModal(99);

        expect(document.getElementById('modal-title').textContent).toBe('Pothole');
        expect(document.getElementById('modal-frequency').textContent).toBe('10');
        expect(document.getElementById('modal-date').textContent).toBe('2026-04-10');
        
        // Verify the HTMLDialogElement polyfill was called
        const dialog = document.getElementById('issue-modal');
        expect(dialog.showModal).toHaveBeenCalled();
    });

    test('openIssueModal() disables bump button if issue was previously bumped', () => {
        // Seed local storage to simulate a previous bump
        window.localStorage.setItem('bumpedIssues', JSON.stringify([99]));

        openIssueModal(99);

        const bumpBtn = document.getElementById('bump-btn');
        expect(bumpBtn.disabled).toBe(true);
        expect(bumpBtn.innerHTML).toContain('Already Bumped');
    });
});