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
        window.alert = jest.fn();

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
            if (url.includes('/api/reports/report/')) {
                return Promise.resolve({ ok: true, json: async () => ['base64image_data'] });
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
            // Testing the fallback branches: missing Type, missing CreatedAt, Status instead of Progress, data.reports structure
            global.fetch = jest.fn().mockResolvedValueOnce({ 
                ok: true, 
                json: async () => ({ 
                    reports: [{ ReportID: 102, Status: 'Fixed' }] 
                }) 
            });
            document.dispatchEvent(new Event('DOMContentLoaded'));
            await new Promise(r => setTimeout(r, 10));
            
            const grid = document.getElementById('reports-grid');
            expect(grid.innerHTML).toContain('ISSUE'); // Fallback type
            expect(grid.innerHTML).toContain('Fixed'); // Status fallback
            expect(grid.innerHTML).toContain('RECENT'); // CreatedAt fallback
            expect(grid.innerHTML).toContain('text-green-500'); // Fixed color
        });

        test('Row click opens modal', () => {
            // The beforeEach already loaded Report 101 successfully into the DOM
            const row = document.querySelector('#reports-grid > div');
            expect(row).not.toBeNull();
            row.click();
            // Modal open should trigger the image fetch
            expect(fetch).toHaveBeenCalledWith('/api/reports/report/101');
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

        test('openMyReportModal handles image fetch failure gracefully', async () => {
            global.fetch = jest.fn().mockRejectedValue(new Error('Images failed'));
            await myReports.openMyReportModal(101);
            
            // Modal still opens, just with empty images
            expect(mockModal.open).toHaveBeenCalledWith(expect.objectContaining({ images: [] }));
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
            const report = { ReportID: 13, Progress: 'Resolved', Rating: 4 }; // Rating > 0 triggers hasGivenFeedback
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
            // Set some dirty state first
            myReports.updateStarUI(5);
            
            window.openFeedbackModal(101);
            
            const dialog = document.getElementById('feedback-modal');
            expect(dialog.showModal).toHaveBeenCalled();
            
            // Stars should be reset to 0
            const stars = document.querySelectorAll('.star-btn span');
            expect(stars[0].style.color).toBe('rgba(255, 255, 255, 0.2)');
        });

        test('Close feedback modal via X button', () => {
            document.getElementById('close-feedback-x').click();
            expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
        });

        test('Star clicks update UI and set internal rating', () => {
            const stars = document.querySelectorAll('.star-btn');
            stars[2].click(); // Click the 3rd star (value: 3)
            
            const starSpans = document.querySelectorAll('.star-btn span');
            expect(starSpans[0].style.color).not.toBe('rgba(255, 255, 255, 0.2)'); // Highlighted
            expect(starSpans[2].style.color).not.toBe('rgba(255, 255, 255, 0.2)'); // Highlighted
            expect(starSpans[3].style.color).toBe('rgba(255, 255, 255, 0.2)');     // Dim
        });

        test('Submit Button warns if no rating is selected', () => {
            myReports.resetStars(); // Ensure 0
            document.getElementById('submit-feedback').click();
            expect(window.alert).toHaveBeenCalledWith("Please select a rating before submitting.");
        });

        test('Submit Button handles API rejection and restores button state', async () => {
            window.openFeedbackModal(101);
            document.querySelectorAll('.star-btn')[4].click();
            
            // Force rejection
            global.fetch = jest.fn().mockResolvedValueOnce({ 
                ok: false, json: async () => ({ error: 'Database locked' }) 
            });
            
            const submitBtn = document.getElementById('submit-feedback');
            submitBtn.click();
            
            await new Promise(r => setTimeout(r, 10));
            
            expect(window.alert).toHaveBeenCalledWith("Error submitting feedback. Please try again.");
            expect(submitBtn.disabled).toBe(false); // Should re-enable
            expect(submitBtn.innerText).toBe("Submit Feedback"); // Should restore text
        });
    });
});