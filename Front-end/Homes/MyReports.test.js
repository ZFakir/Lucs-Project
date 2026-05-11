/**
 * @jest-environment jsdom
 */

const mockModal = { open: jest.fn(), modalId: 'test-modal', showModal: jest.fn(), close: jest.fn() };
global.CivicModal = jest.fn().mockImplementation(() => mockModal);
global.fetch = jest.fn();
HTMLDialogElement.prototype.showModal = jest.fn();
HTMLDialogElement.prototype.close = jest.fn();

describe('MyReports Logic Tests - High Coverage', () => {
    let myReports;

    beforeEach(async () => {
        jest.resetModules(); 
        localStorage.clear();
        localStorage.setItem('residentId', '1');
        
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        window.alert = jest.fn();

        document.body.innerHTML = `
            <div id="test-modal"><main></main></div>
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

        fetch.mockResolvedValueOnce({ 
            ok: true, 
            json: async () => [{ ReportID: 101, Type: 'Pothole', Progress: 'Resolved', CreatedAt: '2026-05-10T12:00:00Z' }] 
        }); 
        
        myReports = require('./MyReports.js');
        document.dispatchEvent(new Event('DOMContentLoaded'));
        await new Promise(resolve => setTimeout(resolve, 50));
    });

    afterEach(() => { jest.restoreAllMocks(); });

    test('locks button if feedback was already submitted', () => {
        const report = { ReportID: 13, Progress: 'Resolved' };
        localStorage.setItem('submittedFeedback', JSON.stringify(['13']));
        myReports.injectFeedbackAction(report);
        const btn = document.querySelector('#dynamic-feedback-container button');
        expect(btn.disabled).toBe(true);
        expect(btn.innerHTML).toContain('Feedback Submitted');
    });

    test('disables button if report is not yet resolved', () => {
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

    test('updateStarUI correctly highlights stars based on rating', () => {
        myReports.updateStarUI(3);
        const stars = document.querySelectorAll('.star-btn span');
        expect(stars[0].style.color).not.toBe('rgba(255, 255, 255, 0.2)');
        expect(stars[2].style.color).not.toBe('rgba(255, 255, 255, 0.2)');
        expect(stars[3].style.color).toBe('rgba(255, 255, 255, 0.2)');
    });

    test('Close feedback modal via X button', () => {
        document.getElementById('close-feedback-x').click();
        expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
    });
});