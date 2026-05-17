/**
 * @jest-environment jsdom
 */

// 1. Global Mocks & Overrides
global.fetch = jest.fn();
window.HTMLDialogElement.prototype.showModal = jest.fn();
window.HTMLDialogElement.prototype.close = jest.fn();

const mockCivicModalOpen = jest.fn();
global.CivicModal = class {
    constructor() {}
    open = mockCivicModalOpen;
};

// MOCK THE CUSTOM ALERT MODAL
global.mockShow = jest.fn(() => Promise.resolve(true));
global.AlertModal = class {
    show(title, message, type) {
        return global.mockShow(title, message, type);
    }
};

// Mock LocationPicker safely using an ES6 class we can spy on later
jest.mock('../ModalUtilities/LocationPicker.js', () => {
    class LocationPicker {
        loadData() {}
        render() {}
    }
    return { LocationPicker };
}, { virtual: true });

describe('Resident Dashboard Logic - Maximum Safe Coverage', () => {
    let residentModule;
    let originalLocation;

    beforeEach(async () => {
        jest.resetModules();
        localStorage.clear();
        localStorage.setItem('residentId', '123');
        
        mockCivicModalOpen.mockClear();
        window.HTMLDialogElement.prototype.showModal.mockClear();
        window.HTMLDialogElement.prototype.close.mockClear();
        global.mockShow.mockClear();

        // Mute console output for intentional error paths
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});

        // Safely bypass JSDOM location protection
        originalLocation = window.location;
        delete window.location;
        window.location = { href: 'http://localhost/', search: '' };

        // 2. Inject complete required DOM
        document.body.innerHTML = `
            <div id="wards-grid">
                <button id="open-add-ward-btn"></button>
            </div>
            
            <div id="alerts-list-container"></div>
            <p id="empty-alerts-message"></p>
            <div id="alert-pulse-indicator"></div>
            
            <select id="province"><option value="1">Gauteng</option></select>
            <select id="municipality"></select>
            <select id="ward"></select>
            
            <button id="notification-bell-btn"></button>
            <button id="clear-alerts-btn"></button>
            
            <dialog id="custom-modal">
                <h3 id="modal-title"></h3>
                <p id="modal-message"></p>
                <div id="modal-actions"></div>
            </dialog>
            
            <dialog id="mute-settings-modal"></dialog>
            <button id="close-mute-modal-icon"></button>
            <button id="close-mute-modal-btn"></button>
            <input type="checkbox" id="mute-all" />
            <ul id="muted-wards-list"></ul>
            
            <dialog id="add-ward-modal">
                <form id="add-ward-form">
                    <input name="ward" value="10">
                    <input name="municipality" value="5">
                </form>
                <button id="close-add-ward-icon"></button>
                <button id="close-add-ward-btn"></button>
            </dialog>

            <img id="resident-profile-pic" class="hidden" />
            <span id="resident-profile-fallback"></span>
            
            <nav><details></details></nav>
        `;

        jest.clearAllMocks();
        
        // Default fetch return for initial DOMContentLoaded
        global.fetch = jest.fn((url) => {
            if (url.includes('/subscriptions')) return Promise.resolve({ ok: true, json: async () => [] });
            if (url.includes('/provinces')) return Promise.resolve({ ok: true, json: async () => [] });
            return Promise.resolve({ ok: true, json: async () => [] });
        });
        
        residentModule = require('../Resident.js');
        document.dispatchEvent(new Event('DOMContentLoaded'));
        
        await new Promise(r => setTimeout(r, 20)); 
    });

    afterEach(() => {
        window.location = originalLocation;
        jest.restoreAllMocks();
    });

    // ==========================================
    // 0. AUTHENTICATION & INITIAL LOAD
    // ==========================================
    describe('Authentication & Initialization', () => {
        //
    });

    // ==========================================
    // 1. WARD CARDS & RENDERING
    // ==========================================
    describe('Ward Cards & UI Rendering', () => {
        test('renderSubscribedWards creates cards for valid subscriptions', async () => {
            fetch.mockImplementation((url) => {
                if (url.includes('/subscriptions')) return Promise.resolve({ ok: true, json: async () => [{ WardID: 5, MunicipalityID: 10 }] });
                if (url.includes('municipalities/10')) return Promise.resolve({ ok: true, json: async () => ({ MunicipalityName: 'TestMuni' }) });
                if (url.includes('wards/5')) return Promise.resolve({ ok: true, json: async () => ({ WardCouncillor: 'Bob The Builder' }) });
                return Promise.resolve({ ok: true, json: async () => [] });
            });

            await residentModule.renderSubscribedWards('123');

            const grid = document.getElementById('wards-grid');
            expect(grid.innerHTML).toContain('WARD 5');
            expect(grid.innerHTML).toContain('Bob The Builder');
            expect(grid.innerHTML).toContain('TESTMUNI');
        });

        test('renderSubscribedWards skips wards with missing IDs', async () => {
            fetch.mockResolvedValueOnce({ ok: true, json: async () => [{ InvalidWardProp: 99 }] });
            await residentModule.renderSubscribedWards('123');
            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Skipping ward'), expect.any(Object));
        });

    });

    // ==========================================
    // 2. GLOBAL EVENT LISTENERS & UI
    // ==========================================
    describe('Global Event Listeners & Modals', () => {
        test('Clicking menu-btn opens specific menu and closes others', () => {
            document.body.innerHTML += `
                <button class="menu-btn" data-ward="5"></button>
                <menu id="menu-5" class="dropdown-menu hidden"></menu>
                <menu id="menu-99" class="dropdown-menu"></menu>
            `;
            
            document.querySelector('.menu-btn').click();
            
            expect(document.getElementById('menu-5').classList.contains('hidden')).toBe(false);
            expect(document.getElementById('menu-99').classList.contains('hidden')).toBe(true);
        });

        test('Clicking outside account details dropdown closes it', async () => {
            const details = document.querySelector('nav details');
            details.setAttribute('open', '');
            
            document.body.click();
            
            expect(details.hasAttribute('open')).toBe(false);
        });

        test('Notification bell click opens mute settings modal and loads wards', async () => {
            residentModule.saveMutePrefs('123', { mutedWards: ['5'] });
            
            fetch.mockResolvedValueOnce({ ok: true, json: async () => [{ WardID: 5 }] }); 
            
            document.getElementById('notification-bell-btn').click();
            await new Promise(r => setTimeout(r, 50)); 
            
            expect(window.HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
            expect(document.getElementById('muted-wards-list').innerHTML).toContain('Ward 5');
        });

        test('clear-alerts-btn triggers delete API and clears UI', async () => {
            global.mockShow.mockResolvedValueOnce(true);
            fetch.mockResolvedValueOnce({ ok: true }); 
            
            residentModule.renderAlerts([{ ReportID: 1, Title: 'Test Alert' }]); 

            document.getElementById('clear-alerts-btn').click();
            await new Promise(r => setTimeout(r, 20));

            expect(fetch).toHaveBeenCalledWith('/api/notifications/123/clear-all', expect.objectContaining({ method: 'DELETE' }));
            expect(document.getElementById('alerts-list-container').innerHTML).toBe('');
        });

        test('Mute settings modal closes when clicking the backdrop', () => {
            const muteModal = document.getElementById('mute-settings-modal');
            muteModal.click();
            expect(window.HTMLDialogElement.prototype.close).toHaveBeenCalled();
        });
    });

    // ==========================================
    // 3. NOTIFICATIONS ENGINE & MUTE FILTERS
    // ==========================================
    describe('Alerts & Notifications Engine', () => {
        test('getTimeAgo calculates all time boundaries correctly', () => {
            const now = new Date();
            const justNow = new Date(now.getTime() - 10 * 1000).toISOString();
            const minsAgo = new Date(now.getTime() - 10 * 60000).toISOString();
            const hoursAgo = new Date(now.getTime() - 2 * 3600000).toISOString();
            const daysAgo = new Date(now.getTime() - 48 * 3600000).toISOString();
            
            expect(residentModule.getTimeAgo(justNow)).toBe("JUST NOW");
            expect(residentModule.getTimeAgo(minsAgo)).toBe("10M AGO");
            expect(residentModule.getTimeAgo(hoursAgo)).toBe("2H AGO");
            expect(residentModule.getTimeAgo(daysAgo)).toBe("2D AGO");
        });

        test('loadResidentNotifications filters out muted wards and respects unmutedAt timestamps', async () => {
            const now = new Date();
            const twoDaysAgo = new Date(now.getTime() - 2 * 86400000).toISOString();
            
            residentModule.saveMutePrefs('123', {
                mutedWards: ['5'],
                unmutedAt: { '10': new Date(now.getTime() - 86400000).toISOString() } 
            });

            fetch.mockImplementation((url) => {
                if (url.includes('/subscriptions')) return Promise.resolve({ ok: true, json: async () => [{ WardID: 5, MunicipalityID: 1 }, { WardID: 10, MunicipalityID: 1 }, { WardID: 99, MunicipalityID: 1 }] });
                
                if (url.includes('/notifications/123')) return Promise.resolve({ ok: true, json: async () => [
                    { ReportID: 1, Title: 'Ward 5 Issue', CreatedAt: now.toISOString() }, // Hidden
                    { ReportID: 2, Title: 'Ward 10 Old Issue', CreatedAt: twoDaysAgo }, // Hidden
                    { ReportID: 3, Title: 'Ward 10 New Issue', CreatedAt: now.toISOString() }, // Visible
                    { ReportID: 4, Title: 'Ward 99 Issue', CreatedAt: now.toISOString() } // Visible
                ]});

                if (url.includes('/reports/ward/5')) return Promise.resolve({ ok: true, json: async () => [{ ReportID: 1 }] });
                if (url.includes('/reports/ward/10')) return Promise.resolve({ ok: true, json: async () => [{ ReportID: 2 }, { ReportID: 3 }] });
                if (url.includes('/reports/ward/99')) return Promise.resolve({ ok: true, json: async () => [{ ReportID: 4 }] });
                
                return Promise.resolve({ ok: true, json: async () => [] });
            });

            await residentModule.loadResidentNotifications('123');
            await new Promise(r => setTimeout(r, 50));
            
            const listHTML = document.getElementById('alerts-list-container').innerHTML;
            
            expect(listHTML).not.toContain('Ward 5 Issue');
            expect(listHTML).not.toContain('Ward 10 Old Issue');
            expect(listHTML).toContain('Ward 10 New Issue');
            expect(listHTML).toContain('Ward 99 Issue');
        });

        test('openReportModal fetches full data and handles Missing Municipality gracefully', async () => {
            residentModule.renderAlerts([{ ReportID: 10, Title: 'Alert: Fire', Progress: 'Active', CreatedAt: '2026-05-10T12:00:00Z', _wardId: 5 }]);

            fetch.mockImplementation((url) => {
                if (url.includes('/reports/10')) return Promise.resolve({ ok: true, json: async () => ({ Type: 'Fire', Brief: 'Burning', Progress: 'Active', WardID: 5, MunicipalityID: 166, CreatedAt: '2026-05-10' }) });
                if (url.includes('municipalities/166')) return Promise.resolve({ ok: false }); // Force Muni failure
                if (url.includes('/workers')) return Promise.resolve({ ok: false }); // Force worker failure
                return Promise.resolve({ ok: false });
            });

            await residentModule.openReportModal(0);
            await new Promise(r => setTimeout(r, 50));

            expect(mockCivicModalOpen).toHaveBeenCalledWith(expect.objectContaining({
                municipality: 'Muni ID: 166', // Fallback from failed muni fetch
                workers: []
            }));
        });
    });

    // ==========================================
    // 4. MODALS & MUTE MANAGEMENT
    // ==========================================
    describe('Modals & Settings', () => {
        test('toggleWardMute removes ward from muted array and adds unmutedAt timestamp', async () => {
            residentModule.saveMutePrefs('123', { mutedWards: ['5'], unmutedAt: {} });
            
            await residentModule.toggleWardMute(5);
            
            const prefs = residentModule.getMutePrefs('123');
            expect(prefs.mutedWards).not.toContain('5');
            expect(prefs.unmutedAt['5']).toBeDefined();
        });

        test('muteAllCheckbox change event updates prefs and reloads notifications', () => {
            document.getElementById('mute-all').checked = true;
            document.getElementById('mute-all').dispatchEvent(new Event('change'));
            
            const prefs = residentModule.getMutePrefs('123');
            expect(prefs.muteAll).toBe(true);
        });

        test('unsubscribeWard handles cancel flow', async () => {
            global.mockShow.mockResolvedValueOnce(false); 
            
            await residentModule.unsubscribeWard(5, 10);
            
            expect(fetch).not.toHaveBeenCalledWith('/api/residents/unsubscribe', expect.any(Object));
        });

        test('unsubscribeWard handles success flow', async () => {
            global.mockShow.mockResolvedValueOnce(true); 
            fetch.mockResolvedValueOnce({ ok: true }); 
            global.mockShow.mockResolvedValueOnce(true); 
            
            await residentModule.unsubscribeWard(5, 10);
            
            expect(fetch).toHaveBeenCalledWith('/api/residents/unsubscribe', expect.objectContaining({
                method: 'DELETE',
                body: expect.stringContaining('"WardID":5')
            }));
        });
    });

    // ==========================================
    // 5. CASCADING DROPDOWNS
    // ==========================================
    describe('Cascading Dropdowns', () => {
        test('loadProvinces populates dropdown on success', async () => {
            fetch.mockResolvedValueOnce({ ok: true, json: async () => [{ ProvinceID: 99, ProvinceName: 'TestProv' }] });
            await residentModule.loadProvinces();
            expect(document.getElementById('province').innerHTML).toContain('TestProv');
        });

        test('fetchMunicipalitiesForSelect populates dropdown on success', async () => {
            fetch.mockResolvedValueOnce({ ok: true, json: async () => [{ MunicipalityID: 88, MunicipalityName: 'TestMuni' }] });
            await residentModule.fetchMunicipalitiesForSelect(99);
            expect(document.getElementById('municipality').innerHTML).toContain('TestMuni');
        });

        test('fetchWardsForSelect populates dropdown on success', async () => {
            fetch.mockResolvedValueOnce({ ok: true, json: async () => [{ WardID: 77, WardCouncillor: 'Jane Doe' }] });
            await residentModule.fetchWardsForSelect(88);
            expect(document.getElementById('ward').innerHTML).toContain('Ward 77');
            expect(document.getElementById('ward').innerHTML).toContain('Jane Doe');
        });

        test('Catches fetch errors safely', async () => {
            fetch.mockRejectedValue(new Error('DB Offline'));
            await residentModule.fetchMunicipalitiesForSelect(1);
            await residentModule.fetchWardsForSelect(10);
            expect(console.error).toHaveBeenCalled();
        });
    });

    // ==========================================
    // 6. ADD WARD FORM SUBMISSION & PROFILES
    // ==========================================
    describe('Add Ward Form & Profile Settings', () => {

        test('Handles 400 Duplicate Subscription Response', async () => {
            fetch.mockResolvedValueOnce({ 
                ok: false, 
                json: async () => ({ error: 'Already subscribed to this ward.' }) 
            });

            document.getElementById('add-ward-form').dispatchEvent(new Event('submit'));
            await new Promise(r => setTimeout(r, 20));

            expect(global.mockShow).toHaveBeenCalledWith('Notice', 'Already subscribed to this ward.', 'alert');
        });

        test('Handles Network Error Exception', async () => {
            fetch.mockRejectedValueOnce(new Error('Network Crash'));

            document.getElementById('add-ward-form').dispatchEvent(new Event('submit'));
            await new Promise(r => setTimeout(r, 20));

            expect(global.mockShow).toHaveBeenCalledWith('Network Error', 'Could not connect to the server to add the ward.', 'alert');
        });

        test('Form success fetches profile picture and renders ward', async () => {
            fetch.mockImplementation((url) => {
                if (url.includes('/subscribe')) return Promise.resolve({ ok: true, json: async () => ({ message: 'ok' }) });
                if (url.includes('/subscriptions')) return Promise.resolve({ ok: true, json: async () => [] });
                if (url.includes('/profile')) return Promise.resolve({ ok: true, json: async () => ({ ProfilePicture: 'https://test.com/img.jpg', Username: 'Test' }) });
                return Promise.resolve({ ok: true, json: async () => [] });
            });

            document.getElementById('add-ward-form').dispatchEvent(new Event('submit'));
            await new Promise(r => setTimeout(r, 50));

            const pic = document.getElementById('resident-profile-pic');
            expect(pic.src).toBe('https://test.com/img.jpg');
            expect(pic.classList.contains('hidden')).toBe(false);
        });

    });
});