/**
 * @jest-environment jsdom
 */
global.fetch = jest.fn();

describe('GuestDashboard Deep Coverage', () => {
    let guestModule;

    beforeEach(() => {
        jest.resetModules();
        document.body.innerHTML = `
            <form id="guest-ward-form">
                <select id="province"><option value="1">GP</option></select>
                <select id="municipality"><option value="10">JHB</option></select>
                <select id="ward"><option value="5">5</option></select>
                <button id="submit-btn" disabled></button>
            </form>
            <p id="global-open-issues"></p>
            <p id="global-resolved-issues"></p>
            <dialog id="custom-modal">
                <h3 id="modal-title"></h3>
                <p id="modal-message"></p>
            </dialog>
        `;
        jest.clearAllMocks();
        fetch.mockResolvedValue({ ok: true, json: async () => [] });
        
        guestModule = require('./GuestDashboard.js');
    });

    test('fetchWardStats updates UI correctly', async () => {
        fetch.mockResolvedValueOnce({ 
            ok: true, 
            json: async () => [{ Progress: 'Pending' }, { Progress: 'Resolved' }] 
        });
        
        await guestModule.fetchWardStats(5);
        expect(document.getElementById('global-open-issues').textContent).toBe('1');
    });

    test('showModal displays custom dialog', () => {
        HTMLDialogElement.prototype.showModal = jest.fn();
        guestModule.showModal('Error', 'Test Message');
        expect(document.getElementById('modal-title').textContent).toBe('Error');
    });

    test('handleMapLocation processes valid data', async () => {
        const data = { success: true, provId: '1', muniId: '10', wardNo: '5' };
        await guestModule.handleMapLocation(data);
        expect(document.getElementById('province').value).toBe('1');
    });
});