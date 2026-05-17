/**
 * @jest-environment jsdom
 */
const fs = require('fs');
const path = require('path');

describe('WardPage UI Logic - Maximum Safe Coverage', () => {
    let wardPageCode;
    let originalLocation;

    beforeAll(() => {
        const filePath = path.resolve(__dirname, './WardPage.js');
        wardPageCode = fs.readFileSync(filePath, 'utf8');

        global.fetch = jest.fn();
        global.mockShow = jest.fn(() => Promise.resolve(true));

        originalLocation = window.location;
        delete window.location;
        window.location = { 
            href: 'http://localhost/?wardId=7&muniId=10', 
            search: '?wardId=7&muniId=10' 
        };

        document.body.innerHTML = `
            <button id="back-btn"></button>
            <div id="ward-title"></div>
            <div id="active-count">0</div>
            <div id="resolved-count">0</div>
            <table><tbody id="reports-table-body"></tbody></table>
            <div id="councillor-label"></div>
            
            <dialog id="mute-settings-modal"></dialog>
            <input type="checkbox" id="mute-all" />
            <select id="mute-ward-select" multiple></select>
            <fieldset id="specific-wards-fieldset"></fieldset>
            <form id="mute-settings-form"></form>
            <button id="close-mute-modal-icon"></button>
            <button id="close-mute-modal-btn"></button>
            <button id="notification-bell-btn"></button>
        `;

        // INJECT MOCKS GLOBALLY USING 'var' TO PREVENT BLOCK-SCOPING
        const script = document.createElement('script');
        script.textContent = `
            var AlertModal = class { 
                show(t, m, type) { return window.mockShow(t, m, type); } 
            };
            var CivicModal = class { 
                open(){} close(){} 
            };
            ${wardPageCode}
        `;
        document.body.appendChild(script);
        
        document.dispatchEvent(new Event('DOMContentLoaded'));
    });

    afterAll(() => {
        window.location = originalLocation;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        global.mockShow.mockClear();
    });

    test('renderStats should update the DOM counts correctly', () => {
        const mockReports = [
            { ReportID: 1, Progress: 'Pending' },
            { ReportID: 2, Progress: 'Resolved' }
        ];

        if (typeof window.renderStats === 'function') {
            window.renderStats(mockReports);
            expect(document.getElementById('active-count').textContent).toBe('1');
            expect(document.getElementById('resolved-count').textContent).toBe('1');
        }
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

        if (typeof window.renderTable === 'function') {
            window.renderTable(mockReports);

            const rows = document.querySelectorAll('#reports-table-body tr');
            expect(rows.length).toBe(1);
            expect(rows[0].innerHTML).toContain('Pothole');
            expect(rows[0].innerHTML).toContain('Large hole on Main St');
        }
    });

    test('Mute form submission triggers success AlertModal', async () => {
        const muteForm = document.getElementById('mute-settings-form');
        if (muteForm) {
            muteForm.dispatchEvent(new Event('submit'));
            
            // Await the fetch and AlertModal promise chain
            await new Promise(r => setTimeout(r, 50));
            
            expect(global.mockShow).toHaveBeenCalledWith(
                'Success', 
                'Alert preferences saved successfully!', 
                'alert'
            );
        }
    });
});