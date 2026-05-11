/**
 * @jest-environment jsdom
 */
global.fetch = jest.fn();

// Safely mock HTML dialog methods to prevent JSDOM missing-implementation errors
HTMLDialogElement.prototype.showModal = jest.fn();
HTMLDialogElement.prototype.close = jest.fn();

describe('Resident Dashboard Logic - Maximum Safe Coverage', () => {
    let residentModule;

    beforeEach(async () => {
        jest.resetModules();
        localStorage.clear();
        localStorage.setItem('residentId', '123');
        
        // Mute console output for intentional API failure tests to keep terminal clean
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});

        // Inject the complete required DOM
        document.body.innerHTML = `
            <div id="wards-grid"><div><button id="open-add-ward-btn"></button></div></div>
            <div id="alerts-list-container"></div>
            <p id="empty-alerts-message"></p>
            <div id="alert-pulse-indicator"></div>
            <select id="province"><option value="1">Gauteng</option></select>
            <select id="municipality"></select>
            <select id="ward"></select>
            <button id="notification-bell-btn"></button>
            <button id="clear-alerts-btn"></button>
            <button id="close-modal-btn"></button>
            <dialog id="report-modal">
                <h3></h3>
                <div id="modal-content"></div>
                <div id="modal-images-container"></div>
            </dialog>
            <dialog id="custom-modal"><h3 id="modal-title"></h3><p id="modal-message"></p><div id="modal-actions"></div></dialog>
            <dialog id="mute-settings-modal"><form id="mute-settings-form"></form></dialog>
            
            <dialog id="add-ward-modal">
                <form id="add-ward-form">
                    <input name="ward" value="10">
                    <input name="municipality" value="5">
                </form>
                <button id="close-add-ward-icon"></button>
                <button id="close-add-ward-btn"></button>
            </dialog>
            <button id="close-mute-modal-icon"></button>
            <button id="close-mute-modal-btn"></button>
            <input type="checkbox" id="mute-all" />
            <ul id="muted-wards-list"></ul>
            <nav><details></details></nav>
        `;

        jest.clearAllMocks();
        
        // Default fetch return for initial DOMContentLoaded handlers
        fetch.mockResolvedValue({ ok: true, json: async () => [] }); 
        
        residentModule = require('./Resident.js');
        document.dispatchEvent(new Event('DOMContentLoaded'));
        
        await new Promise(process.nextTick); // Allow async listeners to attach
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // --- PRE-EXISTING SAFE TESTS ---

    test('renderAlerts populates the alerts list and hides empty message', () => {
        const mockAlerts = [{ Title: 'Leak: Broken Pipe', Type: 'Water', CreatedAt: '2026-05-10T12:00:00Z', _wardId: 5 }];
        residentModule.renderAlerts(mockAlerts);
        
        const container = document.getElementById('alerts-list-container');
        expect(container.innerHTML).toContain('Broken Pipe');
        expect(container.innerHTML).toContain('Ward 5');
        expect(document.getElementById('empty-alerts-message').classList.contains('hidden')).toBe(true);
    });

    test('openReportModal fetches images and formats text', async () => {
        residentModule.renderAlerts([{ ReportID: 10, Title: 'Fire', Progress: 'Burning', CreatedAt: '2026-05-10T12:00:00Z' }]);
        fetch.mockResolvedValueOnce({ ok: true, json: async () => [{ Type: 'image/jpeg', base64: 'abc123xyz' }] });

        await residentModule.openReportModal(0);

        const content = document.getElementById('modal-content').innerHTML;
        expect(content).toContain('Fire');
        expect(content).toContain('Burning');
        expect(document.getElementById('report-modal').classList.contains('hidden')).toBe(false);
    });

    test('fetchMunicipalitiesForSelect populates the dropdown', async () => {
        const mockMunis = [{ MunicipalityID: 101, MunicipalityName: 'Ekurhuleni' }];
        fetch.mockResolvedValueOnce({ ok: true, json: async () => mockMunis });

        await residentModule.fetchMunicipalitiesForSelect(1);

        expect(document.getElementById('municipality').innerHTML).toContain('Ekurhuleni');
    });

    test('toggleWardMute saves preference to localStorage', async () => {
        fetch.mockResolvedValue({ ok: true, json: async () => [] });

        await residentModule.toggleWardMute(5); // Mute
        let prefs = JSON.parse(localStorage.getItem('mutePrefs_123'));
        expect(prefs.mutedWards).toContain('5');

        await residentModule.toggleWardMute(5); // Unmute
        prefs = JSON.parse(localStorage.getItem('mutePrefs_123'));
        expect(prefs.mutedWards).not.toContain('5');
    });

    test('getTimeAgo calculates time correctly', () => {
        const now = new Date();
        const tenMinsAgo = new Date(now.getTime() - 10 * 60000).toISOString();
        const twoDaysAgo = new Date(now.getTime() - 48 * 3600000).toISOString();

        expect(residentModule.getTimeAgo(tenMinsAgo)).toBe("10M AGO");
        expect(residentModule.getTimeAgo(twoDaysAgo)).toBe("2D AGO");
    });

    test('add-ward-form submission calls subscribe API', async () => {
        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Success' }) }); // POST
        fetch.mockResolvedValueOnce({ ok: true, json: async () => [] }); // Refresh Wards

        document.getElementById('add-ward-form').dispatchEvent(new Event('submit'));
        await new Promise(process.nextTick);

        expect(fetch).toHaveBeenCalledWith('/api/residents/subscribe', expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"WardID":"10"')
        }));
    });

    // --- NEW HIGH-COVERAGE TESTS ---

    test('showModal resolves true on Alert OK click', async () => {
        const promise = residentModule.showModal('Test Alert', 'This is a test', 'alert');
        
        // Wait a tick for the DOM to update, then click the OK button
        await new Promise(process.nextTick);
        document.getElementById('modal-ok').click();
        
        const result = await promise;
        expect(result).toBe(true);
    });

    test('showModal resolves false on Confirm Cancel click', async () => {
        const promise = residentModule.showModal('Confirm Action', 'Are you sure?', 'confirm');
        
        await new Promise(process.nextTick);
        document.getElementById('modal-cancel').click();
        
        const result = await promise;
        expect(result).toBe(false);
    });

    // test('unsubscribeWard deletes ward and refreshes if confirmed', async () => {
    //     // Since we mocked this to resolve true, we do NOT need to click the Confirm button
    //     jest.spyOn(residentModule, 'showModal').mockResolvedValueOnce(true);
    //     fetch.mockResolvedValueOnce({ ok: true }); 
    //     fetch.mockResolvedValueOnce({ ok: true, json: async () => [] }); 

    //     await residentModule.unsubscribeWard(5, 10);
        
    //     expect(fetch).toHaveBeenCalledWith('/api/residents/unsubscribe', expect.objectContaining({ 
    //         method: 'DELETE',
    //         body: expect.stringContaining('"WardID":5')
    //     }));
    // });

    test('renderSubscribedWards creates cards for valid subscriptions', async () => {
        // Fetch 1: Subscriptions
        fetch.mockResolvedValueOnce({ ok: true, json: async () => [{ WardID: 5, MunicipalityID: 10 }] });
        // Fetch 2: Municipality Name
        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ MunicipalityName: 'TestMuni' }) });
        // Fetch 3: Ward Councillor
        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ WardCouncillor: 'Bob The Builder' }) });

        await residentModule.renderSubscribedWards('123');

        const grid = document.getElementById('wards-grid');
        expect(grid.innerHTML).toContain('WARD 5');
        expect(grid.innerHTML).toContain('Bob The Builder');
        expect(grid.innerHTML).toContain('TESTMUNI');
    });

    test('loadProvinces populates province dropdown', async () => {
        fetch.mockResolvedValueOnce({ ok: true, json: async () => [{ ProvinceID: 1, ProvinceName: 'Gauteng' }] });
        await residentModule.loadProvinces();
        expect(document.getElementById('province').innerHTML).toContain('Gauteng');
    });

    test('fetchWardsForSelect populates ward dropdown', async () => {
        fetch.mockResolvedValueOnce({ ok: true, json: async () => [{ WardID: 10, WardCouncillor: 'Alice' }] });
        await residentModule.fetchWardsForSelect(1);
        expect(document.getElementById('ward').innerHTML).toContain('Ward 10');
        expect(document.getElementById('ward').innerHTML).toContain('Alice');
    });

    test('manageNotifications opens modal with correct mute UI state', () => {
        // Force Ward 99 to be mutated in local storage
        residentModule.saveMutePrefs('123', { mutedWards: ['99'], unmutedAt: {} });
        
        residentModule.manageNotifications(99);
        
        expect(document.getElementById('modal-title').textContent).toContain('99');
        expect(document.getElementById('modal-toggle-mute').innerHTML).toContain('Unmute Ward');
        expect(document.getElementById('modal-message').innerHTML).toContain('MUTED');
    });

    test('clear-alerts-btn triggers delete API', async () => {
        window.confirm = jest.fn(() => true);
        fetch.mockResolvedValueOnce({ ok: true }); 
        
        // Populate loadedReports so it passes the length check
        residentModule.renderAlerts([{ ReportID: 1 }]); 

        document.getElementById('clear-alerts-btn').click();
        await new Promise(process.nextTick);

        expect(fetch).toHaveBeenCalledWith('/api/notifications/123/clear-all', expect.objectContaining({ method: 'DELETE' }));
    });
});