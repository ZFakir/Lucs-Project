/**
 * @jest-environment jsdom
 */

global.fetch = jest.fn();

// Map animation frames to synchronous callbacks so DOM injects instantly in Jest
window.requestAnimationFrame = (callback) => callback();

describe('Profile Modal UI - High Coverage', () => {

    beforeEach(() => {
        jest.resetModules();
        localStorage.clear();

        localStorage.setItem('role', 'worker');
        localStorage.setItem('workerId', 'W-101');

        // Minimal DOM: just what the page shell provides (header trigger).
        // The modal itself is created dynamically by openProfileModal() — do NOT
        // pre-seed pm-overlay, pm-fields, pm-firstname, etc. here; the source
        // creates those itself when open() is called.
        document.body.innerHTML = `
            <header>
                <figure><img alt="User profile photo" src="" /></figure>
            </header>
        `;

        jest.clearAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => {});

        const mockFileReader = {
            readAsDataURL: jest.fn().mockImplementation(function () {
                this.onload({ target: { result: 'data:image/png;base64,mocked_image_data' } });
            })
        };
        window.FileReader = jest.fn(() => mockFileReader);

        require('./profile-modal.js');
        document.dispatchEvent(new Event('DOMContentLoaded'));
    });

    afterEach(() => { jest.restoreAllMocks(); });

    // -----------------------------------------------------------------------
    test('Fails to open and shows toast if no identity is found', async () => {
        localStorage.clear();

        await window._profileModal.open();

        const toast = document.querySelector('.pm-toast-error');
        expect(toast).not.toBeNull();
        expect(toast.textContent).toContain('Not logged in');
    });

    // -----------------------------------------------------------------------
    test('Worker Profile: Opens, populates fields, and saves successfully', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ FirstName: 'John', LastName: 'Doe', Email: 'j@d.com', Cell: '123', EmployeeID: 'W-101' })
        });

        await window._profileModal.open();
        await new Promise(process.nextTick);

        // openProfileModal() creates the fields inside the overlay it builds
        expect(document.getElementById('pm-firstname').value).toBe('John');

        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
        document.getElementById('pm-firstname').value = 'Jane';

        await window._profileModal.save();
        await new Promise(process.nextTick);

        expect(fetch).toHaveBeenCalledWith('/api/workers/W-101/profile', expect.objectContaining({
            method: 'PUT',
            body: expect.stringContaining('Jane')
        }));

        expect(localStorage.getItem('workerName')).toBe('Jane');
    });

    // -----------------------------------------------------------------------
    test('Resident Profile: Opens and renders resident specific fields', async () => {
        localStorage.setItem('role', 'resident');
        localStorage.setItem('residentId', 'R-55');

        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ Username: 'CoolResident', ResidentID: 'R-55' })
        });

        await window._profileModal.open();
        await new Promise(process.nextTick);

        // populateModal() sets textContent on pm-display-name and value on pm-username
        expect(document.getElementById('pm-display-name').textContent).toContain('CoolResident');
        expect(document.getElementById('pm-username').value).toBe('CoolResident');
    });

    // -----------------------------------------------------------------------
    test('Handles fetch profile failure gracefully with error text', async () => {
        fetch.mockRejectedValueOnce(new Error('Network Error'));

        await window._profileModal.open();
        await new Promise(process.nextTick);

        expect(document.getElementById('pm-fields').innerHTML).toContain('Failed to load profile');
    });

    // -----------------------------------------------------------------------
    test('Closes modal cleanly and auto-wires avatar click triggers', async () => {
        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

        // Trigger open via the wired header figure click
        const headerImg = document.querySelector('header img[alt="User profile photo"]');
        headerImg.parentElement.click();
        await new Promise(process.nextTick);

        // Overlay should be in the DOM after opening
        expect(document.querySelector('.pm-overlay')).not.toBeNull();

        window._profileModal.close();

        // closeModal() calls overlay.remove() after a 200 ms setTimeout
        await new Promise(r => setTimeout(r, 250));

        expect(document.querySelector('.pm-overlay')).toBeNull();
    });

    // -----------------------------------------------------------------------
    test('Handles file upload process through simulated input change', async () => {
        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

        await window._profileModal.open();
        await new Promise(process.nextTick);

        // pm-pic-input is created inside the modal by openProfileModal()
        const input = document.getElementById('pm-pic-input');
        const file = new File(['dummy'], 'profile.png', { type: 'image/png' });

        Object.defineProperty(input, 'files', { value: [file], writable: true });
        input.dispatchEvent(new Event('change'));

        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
        await window._profileModal.save();
        await new Promise(process.nextTick);

        expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
            method: 'PUT',
            body: expect.stringContaining('mocked_image_data')
        }));
    });
});