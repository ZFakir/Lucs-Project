/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

describe('WardPage UI Logic', () => {
    let wardPageCode;

    beforeAll(() => {
        // 1. Load the file content
        const filePath = path.resolve(__dirname, './WardPage.js');
        wardPageCode = fs.readFileSync(filePath, 'utf8');

        // 2. Setup the Global Mocks ONCE
        global.fetch = jest.fn();
        global.CivicModal = jest.fn().mockImplementation(() => ({
            open: jest.fn(),
            modalId: 'test-modal'
        }));

        // 3. Inject the script ONCE for the whole suite
        // This prevents the "already declared" error
        const script = document.createElement('script');
        script.textContent = wardPageCode;
        document.body.appendChild(script);
    });

    beforeEach(() => {
        // 4. Reset the HTML elements so each test starts with a clean slate
        document.body.innerHTML = `
            <div id="active-count">0</div>
            <div id="resolved-count">0</div>
            <table><tbody id="reports-table-body"></tbody></table>
            <div id="ward-title"></div>
            <div id="councillor-label"></div>
        `;
        
        // Clear fetch history so tests don't interfere
        jest.clearAllMocks();
    });

    test('renderStats should update the DOM counts correctly', () => {
        const mockReports = [
            { ReportID: 1, Progress: 'Pending' },
            { ReportID: 2, Progress: 'Resolved' }
        ];

        window.renderStats(mockReports);

        expect(document.getElementById('active-count').textContent).toBe('1');
        expect(document.getElementById('resolved-count').textContent).toBe('1');
    });

    test('renderTable should create rows for each report', () => {
        const mockReports = [
            { 
                ReportID: 1, 
                Type: 'Pothole', 
                Progress: 'Active', 
                Brief: 'Large hole on Main St',
                CreatedAt: '2026-05-10'
            }
        ];

        window.renderTable(mockReports);

        const rows = document.querySelectorAll('#reports-table-body tr');
        expect(rows.length).toBe(1);
        expect(rows[0].innerHTML).toContain('Pothole');
        expect(rows[0].innerHTML).toContain('Large hole on Main St');
    });
});