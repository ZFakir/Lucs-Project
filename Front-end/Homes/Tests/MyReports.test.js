/**
 * @jest-environment jsdom
 */

describe('MyReports Logic Tests - High Coverage', () => {
    let myReports;
    let originalLocation;
    const mockModal = { open: jest.fn(), modalId: 'test-modal' };

    beforeEach(async () => {
        jest.resetModules(); 
        localStorage.clear();
        localStorage.setItem('residentId', '1');
        
        // Mute console logs to keep test output clean
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});

        // 1. MOCK THE CUSTOM ALERT MODAL
        global.mockShow = jest.fn(() => Promise.resolve(true));
        global.AlertModal = class {
            show(title, message, type) {
                return global.mockShow(title, message, type);
            }
        };

        // Bypass JSDOM location protection to test location.reload()
        originalLocation = window.location;
        delete window.location;
        window.location = { reload: jest.fn() };

        // Mock the CivicModal class instantiation
        global.CivicModal = jest.fn().mockImplementation(() => mockModal);
        
        // Mock native dialog functions
        window.HTMLDialogElement.prototype.showModal = jest.fn();
        window.HTMLDialogElement.prototype.close = jest.fn();

        // Intelligent Fetch Routing
        global.fetch = jest.fn((url, options) => {
            if (url.includes('/api/reports/resident/')) {
                return Promise.resolve({ 
                    ok: true, 
                    json: async () => [{ 
                        ReportID: 101, 
                        Type: 'Pothole', 
                        Progress: 'Resolved', 
                        CreatedAt: '2026-05-10T12:00:00Z',
                        WardID: 5,
                        MunicipalityID: 10
                    }] 
                });
            }
            // Mock the Municipality fetch
            if (url.includes('/api/geography/municipalities/')) {
                return Promise.resolve({ ok: true, json: async () => ({ MunicipalityName: 'Testville' }) });
            }
            if (url.includes('/rating')) {
                return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
            }
            return Promise.reject(new Error('Route not matched'));
        });

        document.body.innerHTML = `
            <div id="test-modal">
                <main></main>
                <div id="test-modal-ward" class="text-white"></div>
                <div id="test-modal-muni" class="text-white"></div>
            </div>
            <div id="reports-grid"></div>
            <dialog id="feedback-modal"></dialog>
            <button id="close-feedback-x"></button>
            <button id="submit-feedback"></button>
            <div class="star-btn" data-value="1"><span></span></div>
            <div class="star-btn" data-value="2"><span></span></div>
            <div class="star-btn" data-value="3"><span></span></div>
            <div class="star-btn" data-value="4"><span></span></div>
            <div class="star-btn" data-value="5"><span></span></div>
            <div id="dynamic-feedback-container"></div>
        `;
        
        jest.clearAllMocks();
        global.mockShow.mockClear();
        
        myReports = require('../MyReports.js');
        document.dispatchEvent(new Event('DOMContentLoaded'));
        await new Promise(resolve => setTimeout(resolve, 50)); // Allow async setup to finish
    });

    afterEach(() => { 
        window.location = originalLocation;
        jest.restoreAllMocks(); 
    });

    // ==========================================
    // 1. DATA INITIALIZATION & RENDERING
    // ==========================================
    describe('Initialization & Data Loading', () => {
        test('Handles missing residentId gracefully', async () => {
            localStorage.removeItem('residentId');
            document.dispatchEvent(new Event('DOMContentLoaded'));
            await new Promise(r => setTimeout(r, 10));
            expect(document.getElementById('reports-grid').innerHTML).toContain('User Session Not Found');
        });

        test('Handles empty reports array', async () => {
            global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => [] });
            document.dispatchEvent(new Event('DOMContentLoaded'));
            await new Promise(r => setTimeout(r, 10));
            expect(document.getElementById('reports-grid').innerHTML).toContain('No reports logged yet');
        });

        test('Handles network failure / server error', async () => {
            global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network Fail'));
            document.dispatchEvent(new Event('DOMContentLoaded'));
            await new Promise(r => setTimeout(r, 10));
            expect(document.getElementById('reports-grid').innerHTML).toContain('Error connecting to database');
        });

        test('Renders rows and applies fallbacks for missing data', async () => {
            global.fetch = jest.fn().mockResolvedValueOnce({ 
                ok: true, 
                json: async () => ({ 
                    reports: [{ ReportID: 102, Status: 'Fixed' }] 
                }) 
            });
            document.dispatchEvent(new Event('DOMContentLoaded'));
            await new Promise(r => setTimeout(r, 10));
            
            const grid = document.getElementById('reports-grid');
            expect(grid.innerHTML).toContain('ISSUE'); 
            expect(grid.innerHTML).toContain('Fixed'); 
            expect(grid.innerHTML).toContain('RECENT'); 
            expect(grid.innerHTML).toContain('text-green-500'); 
        });

        test('Row click opens modal', async () => {
            const row = document.querySelector('#reports-grid > div');
            expect(row).not.toBeNull();
            row.click();
            
            // Wait for the async municipality fetch to finish
            await new Promise(r => setTimeout(r, 10));
            
            // Verify the modal opened with the fetched Municipality Name
            expect(mockModal.open).toHaveBeenCalledWith(expect.objectContaining({ municipality: 'TESTVILLE' }));
        });
    });

    // ==========================================
    // 2. MODAL & FEEDBACK INJECTION
    // ==========================================
    describe('Modal Actions & UI Injection', () => {
        test('openMyReportModal exits silently if report not found', async () => {
            await myReports.openMyReportModal(999);
            expect(mockModal.open).not.toHaveBeenCalled();
        });

        test('openMyReportModal handles municipality fetch failure gracefully', async () => {
            global.fetch = jest.fn().mockRejectedValue(new Error('Muni fetch failed'));
            await myReports.openMyReportModal(101);
            
            // Modal still opens, just with the fallback municipality name
            expect(mockModal.open).toHaveBeenCalledWith(expect.objectContaining({ municipality: 'Unknown Municipality' }));
        });

        test('openMyReportModal toggles text classes for ward and muni', async () => {
            await myReports.openMyReportModal(101);
            
            const wardEl = document.getElementById('test-modal-ward');
            const muniEl = document.getElementById('test-modal-muni');
            
            expect(wardEl.classList.contains('text-black')).toBe(true);
            expect(wardEl.classList.contains('text-white')).toBe(false);
            expect(muniEl.classList.contains('text-black')).toBe(true);
        });

        test('injectFeedbackAction disables button if report was already rated via DB', () => {
            const report = { ReportID: 13, Progress: 'Resolved', Rating: 4 }; 
            myReports.injectFeedbackAction(report);
            const btn = document.querySelector('#dynamic-feedback-container button');
            expect(btn.disabled).toBe(true);
            expect(btn.innerHTML).toContain('Feedback Submitted');
        });

        test('injectFeedbackAction disables button if report is not yet resolved', () => {
            const report = { ReportID: 14, Progress: 'Pending' };
            myReports.injectFeedbackAction(report);
            const btn = document.querySelector('#dynamic-feedback-container button');
            expect(btn.disabled).toBe(true);
            expect(btn.innerHTML).toContain('Unlock on Resolution');
        });

        test('injectFeedbackAction adds active feedback button when resolved', () => {
            const report = { ReportID: 15, Progress: 'Resolved' };
            myReports.injectFeedbackAction(report);
            const btn = document.querySelector('#dynamic-feedback-container button');
            expect(btn.disabled).toBe(false);
            expect(btn.innerHTML).toContain('Give Feedback');
        });
    });

    // ==========================================
    // 3. RATING LOGIC & FORM SUBMISSION
    // ==========================================
    describe('Rating System & Form Submission', () => {
        test('window.openFeedbackModal resets stars and opens dialog', () => {
            myReports.updateStarUI(5);
            window.openFeedbackModal(101);
            
            const dialog = document.getElementById('feedback-modal');
            expect(dialog.showModal).toHaveBeenCalled();
            
            const stars = document.querySelectorAll('.star-btn span');
            expect(stars[0].style.color).toBe('rgba(255, 255, 255, 0.2)');
        });

        test('Close feedback modal via X button', () => {
            document.getElementById('close-feedback-x').click();
            expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
        });

        test('Star clicks update UI and set internal rating', () => {
            const stars = document.querySelectorAll('.star-btn');
            stars[2].click(); 
            
            const starSpans = document.querySelectorAll('.star-btn span');
            expect(starSpans[0].style.color).not.toBe('rgba(255, 255, 255, 0.2)'); 
            expect(starSpans[2].style.color).not.toBe('rgba(255, 255, 255, 0.2)'); 
            expect(starSpans[3].style.color).toBe('rgba(255, 255, 255, 0.2)');     
        });

        test('Submit Button warns if no rating is selected', async () => {
            myReports.resetStars(); 
            document.getElementById('submit-feedback').click();
            
            // Allow the async click handler to execute
            await new Promise(r => setTimeout(r, 10));

            expect(global.mockShow).toHaveBeenCalledWith('Error', "Please select a rating before submitting.", 'alert');
        });

        test('Submit Button handles API rejection and restores button state', async () => {
            window.openFeedbackModal(101);
            document.querySelectorAll('.star-btn')[4].click();
            
            global.fetch = jest.fn().mockResolvedValueOnce({ 
                ok: false, json: async () => ({ error: 'Database locked' }) 
            });
            
            const submitBtn = document.getElementById('submit-feedback');
            submitBtn.click();
            
            await new Promise(r => setTimeout(r, 20)); // wait for fetch and alert
            
            expect(global.mockShow).toHaveBeenCalledWith('Error', "Error submitting feedback. Please try again.", 'alert');
            expect(submitBtn.disabled).toBe(false); 
            expect(submitBtn.innerText).toBe("Submit Feedback"); 
        });
    });
});