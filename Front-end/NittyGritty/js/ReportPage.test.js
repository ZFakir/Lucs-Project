/**
 * @jest-environment jsdom
 */
const fs = require('fs');
const path = require('path');

describe('ReportPage Logic - Maximum Safe Coverage', () => {
    let reportPageCode;

    beforeAll(() => {
        // 1. Load the actual JavaScript file
        const filePath = path.resolve(__dirname, './ReportPage.js');
        reportPageCode = fs.readFileSync(filePath, 'utf8');

        // 2. MOCK LEAFLET (L) globally
        const mockMarker = {
            addTo: jest.fn().mockReturnThis(),
            on: jest.fn(),
            getLatLng: jest.fn().mockReturnValue({ lat: -26.2041, lng: 28.0473 }),
            setLatLng: jest.fn()
        };
        global.L = {
            map: jest.fn(() => ({
                setView: jest.fn().mockReturnThis(),
                on: jest.fn(),
                locate: jest.fn()
            })),
            tileLayer: jest.fn(() => ({ addTo: jest.fn() })),
            marker: jest.fn(() => mockMarker)
        };

        // 3. MOCK TURF.JS (turf) globally
        global.turf = {
            point: jest.fn(),
            featureEach: jest.fn((data, callback) => {
                // Simulate finding a valid polygon for testing
                callback({
                    properties: { WardNo: '7', MAP_TITLE: 'Joburg', adm1_name: 'Gauteng' }
                });
            }),
            booleanPointInPolygon: jest.fn().mockReturnValue(true)
        };

        // 4. MOCK FILEREADER (Prevents async hanging)
        class MockFileReader {
            readAsDataURL() {
                setTimeout(() => {
                    this.result = 'data:image/png;base64,mocked_base64_data';
                    if (this.onload) this.onload({ target: this });
                }, 5);
            }
        }
        global.FileReader = MockFileReader;

        // MOCK ANIMATION FRAME (So toasts render instantly in tests)
        global.requestAnimationFrame = jest.fn(cb => cb());
    });

    beforeEach(async () => {
        jest.clearAllMocks();
        localStorage.clear();
        localStorage.setItem('residentId', '123');

        // Reset global coordinates
        window.mapLat = -26.2041;
        window.mapLng = 28.0473;

        // Mute expected console errors
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'log').mockImplementation(() => {});

        // Default mock fetch for map dependencies (run on DOMContentLoaded)
        global.fetch = jest.fn().mockResolvedValue({ 
            ok: true, 
            json: async () => ({}) 
        });

        // 6. SETUP THE DOM
        document.body.innerHTML = `
            <div id="submit-loader" class="hidden"></div>
            <div id="map"></div>
            <form id="pothole_report_form">
                <input type="hidden" id="detected-ward-id" value="7" />
                <input type="hidden" id="detected-muni-id" value="10" />
                <textarea id="description"></textarea>
                <select id="pothole-type">
                    <option value="Pothole" selected>Pothole</option>
                </select>
                <input type="file" id="imageInput" multiple />
                <div id="imagePreview"></div>
                <p id="location-text-display"></p>
                <span id="current-date"></span>
                <button type="submit" id="submit-btn">Submit</button>
            </form>
        `;

        // 7. INJECT SCRIPT SAFELY
        const script = document.createElement('script');
        script.textContent = `
            (() => {
                ${reportPageCode}
            })();
        `;
        document.body.appendChild(script);

        // Fire DOMContentLoaded and allow async map logic to settle
        document.dispatchEvent(new Event('DOMContentLoaded'));
        await new Promise(r => setTimeout(r, 20));
    });

    // ==========================================
    // 1. INITIALIZATION & UI LOGIC
    // ==========================================
    test('Initializes map and sets current date on load', () => {
        expect(global.L.map).toHaveBeenCalled();
        const dateElement = document.getElementById('current-date');
        expect(dateElement.textContent.length).toBeGreaterThan(0);
    });

    test('Renders image preview and allows removal', async () => {
        const imageInput = document.getElementById('imageInput');
        const preview = document.getElementById('imagePreview');

        // Simulate selecting a file
        const mockFile = new File([''], 'test.png', { type: 'image/png' });
        Object.defineProperty(imageInput, 'files', { value: [mockFile] });
        
        imageInput.dispatchEvent(new Event('change'));
        await new Promise(r => setTimeout(r, 20)); 

        expect(preview.innerHTML).toContain('<img');

        // Trigger removal via the globally exposed window.removeImage
        window.removeImage(0);
        expect(preview.innerHTML).toBe('');
    });

    // ==========================================
    // 2. FORM SUBMISSION VALIDATION
    // ==========================================
    test('Blocks submission if missing description or images', async () => {
        const form = document.querySelector('form');
        document.getElementById('description').value = ''; // Empty

        form.dispatchEvent(new Event('submit', { cancelable: true }));
        await new Promise(r => setTimeout(r, 20));

        // Verify Toast was created
        expect(document.body.innerHTML).toContain('Please add a description and at least one image.');
        
        // Ensure no POST fetch was made
        const postFetches = global.fetch.mock.calls.filter(call => call[1] && call[1].method === 'POST');
        expect(postFetches.length).toBe(0);
    });

    // ==========================================
    // 3. FORM SUBMISSION SUCCESS
    // ==========================================
    test('Successfully submits payload and resets UI', async () => {
        // Prepare valid form state
        document.getElementById('description').value = 'Test Issue';
        const mockFile = new File([''], 'test.png', { type: 'image/png' });
        Object.defineProperty(document.getElementById('imageInput'), 'files', { value: [mockFile] });
        document.getElementById('imageInput').dispatchEvent(new Event('change'));
        
        await new Promise(r => setTimeout(r, 20));

        // Mock successful POST fetch
        global.fetch.mockImplementation((url, options) => {
            if (options && options.method === 'POST') {
                return Promise.resolve({ ok: true });
            }
            return Promise.resolve({ ok: true, json: async () => ({}) });
        });

        const form = document.querySelector('form');
        form.dispatchEvent(new Event('submit', { cancelable: true }));
        await new Promise(r => setTimeout(r, 50));

        // Verify API was called with correct structure
        expect(fetch).toHaveBeenCalledWith('/api/reports', expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"Brief":"Test Issue"')
        }));

        // Verify Success Toast
        expect(document.body.innerHTML).toContain('Report successfully submitted');

        // Verify UI cleared
        expect(document.getElementById('description').value).toBe('');
    });

    // ==========================================
    // 4. FORM SUBMISSION API REJECTION
    // ==========================================
    test('Alerts the user if the server rejects the report (500/400 Error)', async () => {
        document.getElementById('description').value = 'Test Issue';
        const mockFile = new File([''], 'test.png', { type: 'image/png' });
        Object.defineProperty(document.getElementById('imageInput'), 'files', { value: [mockFile] });
        document.getElementById('imageInput').dispatchEvent(new Event('change'));
        await new Promise(r => setTimeout(r, 20));

        // Mock Failed POST fetch
        global.fetch.mockImplementation((url, options) => {
            if (options && options.method === 'POST') {
                return Promise.resolve({ ok: false }); // Fails here
            }
            return Promise.resolve({ ok: true, json: async () => ({}) });
        });

        const form = document.querySelector('form');
        form.dispatchEvent(new Event('submit', { cancelable: true }));
        await new Promise(r => setTimeout(r, 50));

        // Verify Error Toast
        expect(document.body.innerHTML).toContain('There was an error communicating');
    });
});