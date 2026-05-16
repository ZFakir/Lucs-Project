/**
 * @jest-environment jsdom
 */

// Mock the LocationPicker to prevent undefined module errors when Jest parses the import
jest.mock('../ModalUtilities/LocationPicker.js', () => ({
    LocationPicker: jest.fn().mockImplementation(() => ({
        loadData: jest.fn().mockResolvedValue(true),
        render: jest.fn()
    }))
}), { virtual: true });

describe('Guest Dashboard Deep Coverage', () => {
    let guestModule;
    let originalLocation;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        localStorage.clear();

        // 1. Setup a complete DOM replica of GuestDashboard.html
        document.body.innerHTML = `
            <div id="duck-test">Hello WORLD duck</div>
            <form id="guest-ward-form">
                <select id="province">
                    <option disabled selected value="">Choose...</option>
                </select>
                <select id="municipality" disabled>
                    <option disabled selected value="">Choose...</option>
                </select>
                <select id="ward" disabled>
                    <option disabled selected value="">Choose...</option>
                </select>
                <button id="submit-btn" disabled type="submit">Submit</button>
            </form>
            
            <p id="global-open-issues"></p>
            <p id="global-resolved-issues"></p>
            <span class="uppercase font-black tracking-widest text-test">GLOBAL</span>
            
            <dialog id="custom-modal">
                <h3 id="modal-title"></h3>
                <p id="modal-message"></p>
            </dialog>
            
            <div id="map-container"></div>
            <span id="map-status"></span>
        `;

        // Mock the native HTML <dialog> showModal method for JSDOM
        window.HTMLDialogElement.prototype.showModal = jest.fn();

        // Mute expected console errors to keep the test terminal clean
        jest.spyOn(console, 'error').mockImplementation(() => {});

        // 2. Intelligent Fetch Mock Routing
        global.fetch = jest.fn((url) => {
            if (!url) return Promise.reject(new Error('No URL'));
            
            if (url.includes('/api/geography/provinces/1/municipalities')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve([{ MunicipalityID: 10, MunicipalityName: 'JHB' }]) });
            }
            if (url.includes('/api/geography/municipalities/10/wards')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve([{ WardID: 5, WardCouncillor: 'John' }]) });
            }
            if (url.includes('/api/public/reports/ward/')) {
                // Return a mix of statuses to test the tally counters
                return Promise.resolve({ ok: true, json: () => Promise.resolve([{ Progress: 'Pending' }, { Progress: 'Resolved' }, { Progress: 'Fixed' }]) });
            }
            if (url.includes('/api/geography/provinces')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve([{ ProvinceID: 1, ProvinceName: 'GP' }]) });
            }
            return Promise.reject(new Error('Route not matched'));
        });

        // 3. Bypass JSDOM window.location protection
        originalLocation = window.location;
        delete window.location;
        window.location = { search: '', href: '' };

        // Require the module AFTER the DOM and Mocks are ready
        guestModule = require('../GuestDashboard.js');
    });

    afterEach(() => {
        window.location = originalLocation;
        jest.restoreAllMocks();
    });

    // ==========================================
    // INITIALIZATION & EASTER EGGS
    // ==========================================
    describe('Page Load & Initialization', () => {
        test('Sets guest role in localStorage on load', () => {
            document.dispatchEvent(new Event('DOMContentLoaded'));
            expect(localStorage.getItem('userRole')).toBe('guest');
        });

        // test('Duck Mode quackifies text nodes and handles mutations', async () => {
        //     // Set URL param for easter egg
        //     window.location.search = '?mode=duck';
            
        //     document.dispatchEvent(new Event('DOMContentLoaded'));
            
        //     // Allow MutationObserver to initialize
        //     await new Promise(r => setTimeout(r, 50)); 
            
        //     const duckTest = document.getElementById('duck-test');
        //     // "Hello WORLD duck" -> "Quack QUACK quack"
        //     expect(duckTest.textContent).toBe('Quack QUACK quack');

        //     // Test the MutationObserver by dynamically adding an element
        //     const newEl = document.createElement('div');
        //     newEl.textContent = "New Data";
        //     document.body.appendChild(newEl);
            
        //     // Wait for observer
        //     await new Promise(r => setTimeout(r, 50)); 
        //     expect(newEl.textContent).toBe('Quack Quack');
        // });

        test('Catches initialization errors from LocationPicker safely', async () => {
            const { LocationPicker } = require('../ModalUtilities/LocationPicker.js');
            LocationPicker.mockImplementationOnce(() => ({
                loadData: jest.fn().mockRejectedValue(new Error('Map API Down')),
                render: jest.fn()
            }));

            document.dispatchEvent(new Event('DOMContentLoaded'));
            await new Promise(r => setTimeout(r, 10)); // Allow async to throw
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Map initialization failed"), expect.any(Error));
        });
    });

    // ==========================================
    // CASCADING DROPDOWNS & FETCHING
    // ==========================================
    describe('Cascading Dropdowns', () => {
        test('loadProvinces populates province dropdown on success', async () => {
            await guestModule.loadProvinces();
            const provinceSelect = document.getElementById('province');
            expect(provinceSelect.innerHTML).toContain('GP');
            expect(provinceSelect.innerHTML).toContain('value="1"');
        });

        test('Province change triggers municipality fetch and updates UI', async () => {
            const provinceSelect = document.getElementById('province');
            const municipalitySelect = document.getElementById('municipality');
            
            provinceSelect.innerHTML = `<option value="1">GP</option>`;
            provinceSelect.value = "1";
            
            await guestModule.triggerChangeEvent(provinceSelect);
            
            expect(fetch).toHaveBeenCalledWith('/api/geography/provinces/1/municipalities');
            expect(municipalitySelect.disabled).toBe(false);
            expect(municipalitySelect.innerHTML).toContain('JHB');
        });

        test('Province change catches fetch error safely', async () => {
            global.fetch = jest.fn().mockRejectedValue(new Error('Network failure'));
            const provinceSelect = document.getElementById('province');
            provinceSelect.value = "99"; // Non-existent
            
            await guestModule.triggerChangeEvent(provinceSelect);
            expect(console.error).toHaveBeenCalled();
        });

        test('Municipality change triggers ward fetch and updates UI', async () => {
            const municipalitySelect = document.getElementById('municipality');
            const wardSelect = document.getElementById('ward');
            
            municipalitySelect.innerHTML = `<option value="10">JHB</option>`;
            municipalitySelect.value = "10";
            
            await guestModule.triggerChangeEvent(municipalitySelect);
            
            expect(fetch).toHaveBeenCalledWith('/api/geography/municipalities/10/wards');
            expect(wardSelect.disabled).toBe(false);
            expect(wardSelect.innerHTML).toContain('Ward 5 (John)');
        });

        test('Municipality change catches fetch error safely', async () => {
            global.fetch = jest.fn().mockRejectedValue(new Error('Network failure'));
            const municipalitySelect = document.getElementById('municipality');
            municipalitySelect.value = "99";
            
            await guestModule.triggerChangeEvent(municipalitySelect);
            expect(console.error).toHaveBeenCalled();
        });

        test('Ward change enables submit button and fetches stats', async () => {
            const wardSelect = document.getElementById('ward');
            const submitBtn = document.getElementById('submit-btn');
            
            wardSelect.innerHTML = `<option value="5">Ward 5</option>`;
            wardSelect.value = "5";
            
            // Dispatch standard synchronous event
            wardSelect.dispatchEvent(new Event('change'));
            
            expect(submitBtn.disabled).toBe(false);
            expect(fetch).toHaveBeenCalledWith('/api/public/reports/ward/5');
        });
    });

    // ==========================================
    // NAVIGATION & WARD STATS
    // ==========================================
    describe('Form Actions & Stats Controller', () => {
        // test('Form submission redirects with ward parameter', () => {
        //     const form = document.getElementById('guest-ward-form');
        //     const wardSelect = document.getElementById('ward');
            
        //     wardSelect.innerHTML = `<option value="5">Ward 5</option>`;
        //     wardSelect.value = "5";
            
        //     // Simulate the exact event structure the listener expects
        //     form.dispatchEvent(new Event('submit', { cancelable: true }));
            
        //     expect(window.location.href).toBe('PublicWardView.html?wardId=5');
        // });

        test('fetchWardStats calculates ratios and updates labels', async () => {
            // Setup DOM
            const globalLabel = document.querySelector('.text-test');
            expect(globalLabel.textContent).toBe('GLOBAL');

            await guestModule.fetchWardStats(5);
            
            // Based on the mock: 1 Pending, 1 Resolved, 1 Fixed
            expect(document.getElementById('global-open-issues').textContent).toBe('1');
            expect(document.getElementById('global-resolved-issues').textContent).toBe('2');
            
            // Label replacement trick
            expect(globalLabel.textContent).toBe('WARD 5');
        });

        test('fetchWardStats handles API rejection by showing dashes', async () => {
            global.fetch = jest.fn().mockRejectedValue(new Error('Stats API Offline'));
            
            await guestModule.fetchWardStats(5);
            
            expect(document.getElementById('global-open-issues').textContent).toBe('--');
            expect(document.getElementById('global-resolved-issues').textContent).toBe('--');
            expect(console.error).toHaveBeenCalled();
        });
    });

    // ==========================================
    // MODALS & MAPS
    // ==========================================
    describe('Modals & Location Picker Integrations', () => {
        test('showModal colors title dynamically based on error keyword', () => {
            const titleEl = document.getElementById('modal-title');
            
            guestModule.showModal('Standard Info', 'Hello');
            expect(titleEl.className).toContain('text-primary');
            
            guestModule.showModal('Server Error', 'Failed');
            expect(titleEl.className).toContain('text-red-500');
        });

        test('handleMapLocation ignores unsuccessful data', async () => {
            const data = { success: false, provId: '1' };
            await guestModule.handleMapLocation(data);
            
            // Should not have triggered the cascading flow
            expect(document.getElementById('province').value).toBe('');
        });

        test('handleMapLocation triggers province and muni selections', async () => {
            document.getElementById('province').innerHTML = '<option value="1">GP</option>';
            document.getElementById('municipality').innerHTML = '<option value="10">JHB</option>';
            
            const data = { success: true, provId: '1', muniId: '10' };
            await guestModule.handleMapLocation(data);
            
            expect(document.getElementById('province').value).toBe('1');
            expect(document.getElementById('municipality').value).toBe('10');
        });

        test('handleMapLocation finds and sets the ward by text matching', async () => {
            const wardSelect = document.getElementById('ward');
            // Populate the dropdown exactly how the UI generates it
            wardSelect.innerHTML = `<option value="99">Ward 5 (John Doe)</option>`;
            
            const data = { success: true, wardNo: '5' };
            await guestModule.handleMapLocation(data);
            
            expect(wardSelect.value).toBe('99');
        });
    });
});