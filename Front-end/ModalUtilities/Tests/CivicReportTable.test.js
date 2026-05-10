/**
 * @jest-environment jsdom
 */
const fs = require('fs');
const path = require('path'); // Add this line
const { CivicTable } = require('../CivicReportTable.js');

// --- 1. LOAD & INJECT SCRIPT ---
const tablePath = path.resolve(__dirname, '../CivicReportTable.js');
let tableSource = fs.readFileSync(tablePath, 'utf8');

describe('CivicTable Component Tests', () => {
    let container;
    let mockOnRowClick;
    let civicTable;
    const containerId = 'table-container';

    beforeEach(() => {
        jest.clearAllMocks();
        // Setup a fresh container for every test
        document.body.innerHTML = `<div id="${containerId}"></div>`;
        container = document.getElementById(containerId);
        mockOnRowClick = jest.fn();
        civicTable = new CivicTable(containerId, mockOnRowClick);
    });

    describe('Constructor & Initialization', () => {
        test('should throw an error in console if container is not found', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            new CivicTable('non-existent-id', mockOnRowClick);
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Could not find element"));
            consoleSpy.mockRestore();
        });
    });

    describe('Utility Logic: getBadgeHTML & getIcon', () => {
        test('getBadgeHTML returns correct classes for "resolved"', () => {
            const html = civicTable.getBadgeHTML('resolved');
            expect(html).toContain('Resolved');
            expect(html).toContain('bg-surface-container-highest');
        });

        test('getIcon maps "pothole" to "road"', () => {
            expect(civicTable.getIcon('pothole')).toBe('road');
        });

        test('getIcon returns "report_problem" for unknown types', () => {
            expect(civicTable.getIcon('alien-invasion')).toBe('report_problem');
        });
    });

    describe('Rendering Logic', () => {
        test('render() creates the table skeleton on first call', () => {
            civicTable.render([]);
            const table = container.querySelector('table');
            expect(table).not.toBeNull();
            expect(container.innerHTML).toContain('Type');
            expect(container.innerHTML).toContain('Description');
        });

        test('render() shows empty state message when no reports are provided', () => {
            civicTable.render([]);
            const tbody = document.getElementById(`${containerId}-tbody`);
            expect(tbody.innerHTML).toContain('No issues found');
        });

        test('render() populates rows correctly with data', () => {
            const mockReports = [
                { 
                    Type: 'Water Leak', 
                    Brief: 'Burst pipe', 
                    Progress: 'Resolved', 
                    CreatedAt: '2026-05-01' 
                }
            ];

            civicTable.render(mockReports);
            const tbody = document.getElementById(`${containerId}-tbody`);
            const rows = tbody.querySelectorAll('tr');

            expect(rows.length).toBe(1);
            expect(rows[0].innerHTML).toContain('Water Leak');
            expect(rows[0].innerHTML).toContain('Burst pipe');
            expect(rows[0].innerHTML).toContain('2026-05-01');
        });
    });

    describe('Interaction Logic', () => {
        test('clicking a row triggers onRowClick with the correct report data', () => {
            const mockReport = { ReportID: 101, Type: 'Pothole', Progress: 'Active' };
            civicTable.render([mockReport]);

            const row = document.getElementById(`${containerId}-tbody`).querySelector('tr');
            row.click();

            expect(mockOnRowClick).toHaveBeenCalledTimes(1);
            expect(mockOnRowClick).toHaveBeenCalledWith(mockReport);
        });
    });
});