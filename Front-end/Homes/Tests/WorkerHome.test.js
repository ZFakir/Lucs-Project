/**
 * @jest-environment jsdom
 */

// 1. Global Mocks & Overrides
global.fetch = jest.fn();
window.HTMLDialogElement.prototype.showModal = jest.fn();
window.HTMLDialogElement.prototype.close = jest.fn();

// Mock FileReader for Image Logic - Fix Promise Hanging (Timeout Issue)
class MockFileReader {
    readAsDataURL(file) {
        // Use a tiny timeout to ensure the execution yields back to the main thread.
        // This allows 'reader.onload = ...' to attach before we fire the event!
        setTimeout(() => {
            this.result = 'data:image/png;base64,mocked_image_data';
            if (this.onload) this.onload({ target: this });
        }, 5);
    }
}
global.FileReader = MockFileReader;

describe('Worker Dashboard Logic - Maximum Safe Coverage', () => {
    let workerModule;
    let mockReload;
    let originalLocation;

    beforeEach(async () => {
        jest.resetModules();
        localStorage.clear();
        localStorage.setItem('workerId', 'W-101');
        localStorage.setItem('workerName', 'John Doe');

        // Mute console output for intentional error paths
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'log').mockImplementation(() => {});
        
        window.alert = jest.fn();
        window.prompt = jest.fn(() => "Missing materials");
        window.confirm = jest.fn(() => true); 

        // Safely bypass JSDOM location protection
        originalLocation = window.location;
        mockReload = jest.fn();
        delete window.location;
        window.location = { href: 'http://localhost/', search: '', reload: mockReload };

        // 2. Inject complete required DOM
        document.body.innerHTML = `
            <header>
                <p class="text-xs font-bold"></p>
                <div id="profile-dropdown-wrap">
                    <span id="dropdown-name"></span>
                    <div id="profile-dropdown" class="hidden"></div>
                </div>
            </header>
            
            <main>
                <div id="active-tasks-container"></div>
                <div id="completed-tasks-list"></div>
                <footer><button id="toggle-completed-btn"><span class="material-symbols-outlined text-sm">history</span> Show Completed Tasks</button></footer>
            </main>
            
            <dialog id="task-detail-modal">
                <small id="detail-id"></small>
                <h2 id="detail-type"></h2>
                <p id="detail-description"></p>
                <p id="detail-ward"></p>
                <p id="detail-status"></p>
            </dialog>
        `;

        jest.clearAllMocks();
        
        // Default fetch return for initial DOMContentLoaded
        global.fetch.mockResolvedValue({ ok: true, json: async () => [] });
        
        workerModule = require('../WorkerHome.js');
        document.dispatchEvent(new Event('DOMContentLoaded'));
        
        await new Promise(r => setTimeout(r, 20)); 
        
        // Clear the fetch calls that happen during DOMContentLoaded so our tests start fresh
        global.fetch.mockClear();
    });

    afterEach(() => {
        window.location = originalLocation;
        jest.restoreAllMocks();
    });

    // ==========================================
    // 0. AUTHENTICATION & INITIAL LOAD
    // ==========================================
    describe('Authentication & Initialization', () => {

        test('Updates header names correctly', () => {
            const nameEl = document.querySelector('p.text-xs.font-bold');
            const dropdownName = document.getElementById('dropdown-name');
            expect(nameEl.textContent).toBe('John Doe');
            expect(dropdownName.textContent).toBe('John Doe');
        });
    });

    // ==========================================
    // 1. TASK LEDGER (ACTIVE & COMPLETED)
    // ==========================================
    describe('Task Ledger (Loading & Rendering)', () => {
        test('loadMyAssignedTasks renders empty state', async () => {
            fetch.mockResolvedValueOnce({ ok: true, json: async () => [] });
            await workerModule.loadMyAssignedTasks('W-101');
            expect(document.getElementById('active-tasks-container').innerHTML).toContain('Clear Ledger');
        });

        test('loadMyAssignedTasks sorts by priority and renders active & new tasks', async () => {
            const mockReports = [
                { ReportID: 1, Type: 'Pipe', Progress: 'In Progress - 25%', Priority: 2, WardID: 1 }, 
                { ReportID: 2, Type: 'Pothole', Progress: 'Assigned', Priority: 1, WardID: 2 }, 
                { ReportID: 3, Type: 'Resolved Issue', Progress: 'Fixed', Priority: 3, WardID: 3 } 
            ];
            fetch.mockResolvedValueOnce({ ok: true, json: async () => mockReports });
            
            await workerModule.loadMyAssignedTasks('W-101');
            const containerHTML = document.getElementById('active-tasks-container').innerHTML;
            
            expect(containerHTML).toContain('Pothole');
            expect(containerHTML).toContain('Accept'); 
            expect(containerHTML).toContain('Pipe');
            expect(containerHTML).toContain('progress-1'); 
            expect(containerHTML).not.toContain('Resolved Issue');
        });

        test('loadMyAssignedTasks catches and logs fetch errors', async () => {
            fetch.mockRejectedValueOnce(new Error('Network Fail'));
            await workerModule.loadMyAssignedTasks('W-101');
            expect(console.error).toHaveBeenCalled();
        });

        test('toggleCompletedTasks fetches and renders archived reports', async () => {
            const mockCompleted = [{ ReportID: 10, Type: 'Pothole', Progress: 'Fixed', DateFulfilled: '2026-05-10T12:00:00Z' }];
            fetch.mockResolvedValueOnce({ ok: true, json: async () => mockCompleted });

            await workerModule.toggleCompletedTasks();
            expect(document.getElementById('completed-tasks-list').innerHTML).toContain('#10');
            expect(document.getElementById('completed-tasks-list').innerHTML).toContain('Pothole');
        });

        test('toggleCompletedTasks renders empty state if no completed reports', async () => {
            fetch.mockResolvedValueOnce({ ok: true, json: async () => [] });
            await workerModule.toggleCompletedTasks();
            expect(document.getElementById('completed-tasks-list').innerHTML).toContain('No completed operations found');
        });

        test('toggleCompletedTasks toggles visibility off when clicked again', async () => {
            fetch.mockResolvedValueOnce({ ok: true, json: async () => [{ ReportID: 10, Progress: 'Fixed' }] });
            await workerModule.toggleCompletedTasks();
            expect(document.getElementById('completed-tasks-list').innerHTML).toContain('#10');
            
            await workerModule.toggleCompletedTasks();
            expect(document.getElementById('completed-tasks-list').innerHTML).toBe('');
        });

        test('toggleCompletedTasks catches fetch errors', async () => {
            fetch.mockRejectedValueOnce(new Error('Network Drop'));
            await workerModule.toggleCompletedTasks();
            expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Sync Error'));
        });
    });

    // ==========================================
    // 2. TASK ACTIONS
    // ==========================================
    describe('Task Actions (Accept, Decline, Resolve, Progress)', () => {

        test('declineTask aborts if prompt is cancelled', async () => {
            window.prompt.mockReturnValueOnce(null);
            await workerModule.declineTask(99);
            expect(fetch).not.toHaveBeenCalled();
        });

        test('updateProgress calls API and updates DOM label without reloading', async () => {
            document.body.innerHTML += `
                <div id="progress-container-99">
                    <label><output>Old Status</output></label>
                    <select id="progress-99"></select>
                </div>
            `;
            fetch.mockResolvedValueOnce({ ok: true });
            
            await workerModule.updateProgress(99, 'In Progress - 75%');
            
            expect(fetch).toHaveBeenCalledWith('/api/reports/99/status', expect.objectContaining({ method: 'PUT' }));
            expect(document.querySelector('output').textContent).toBe('In Progress - 75%');
            expect(mockReload).not.toHaveBeenCalled();
        });

        test('updateProgress catches API errors safely', async () => {
            fetch.mockRejectedValueOnce(new Error('Network Fail'));
            await workerModule.updateProgress(99, 'In Progress - 75%');
            expect(console.error).toHaveBeenCalled();
        });
    });

    // ==========================================
    // 3. IMAGES & UPLOADS
    // ==========================================
    describe('Image Logic', () => {
        test('handleImageSelect, renderPreviews, and removeImage lifecycle', async () => {
            document.body.innerHTML += `<div id="imagePreview-99"></div>`;
            
            // 1. Select
            const mockFile = new File([''], 'proof.png', { type: 'image/png' });
            workerModule.handleImageSelect({ target: { files: [mockFile], value: 'C:\\fakepath' } }, 99);
            
            await new Promise(r => setTimeout(r, 20)); // Await FileReader
            
            const preview = document.getElementById('imagePreview-99');
            expect(preview.innerHTML).toContain('img');
            expect(preview.innerHTML).toContain('mocked_image_data');

            // 2. Remove
            workerModule.removeImage(99, 0);
            expect(preview.innerHTML).toBe('');
        });

        test('uploadTaskImages aborts if no images exist', async () => {
            await workerModule.uploadTaskImages(100);
            expect(fetch).not.toHaveBeenCalled();
        });

        test('uploadTaskImages uploads and clears array', async () => {
            const mockFile = new File([''], 'proof.png', { type: 'image/png' });
            workerModule.handleImageSelect({ target: { files: [mockFile], value: '' } }, 88);
            await new Promise(r => setTimeout(r, 20));
            
            fetch.mockResolvedValueOnce({ ok: true });
            await workerModule.uploadTaskImages(88);
            
            expect(fetch).toHaveBeenCalledWith('/api/reportImages/report/88', expect.objectContaining({ method: 'POST' }));
            
            // Should be cleared, so second call won't fetch
            fetch.mockClear();
            await workerModule.uploadTaskImages(88);
            expect(fetch).not.toHaveBeenCalled();
        });

        test('uploadTaskImages handles fetch rejection gracefully', async () => {
            const mockFile = new File([''], 'proof.png', { type: 'image/png' });
            workerModule.handleImageSelect({ target: { files: [mockFile], value: '' } }, 12);
            await new Promise(r => setTimeout(r, 20));
            
            fetch.mockResolvedValueOnce({ ok: false });
            await workerModule.uploadTaskImages(12);
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Failed to upload'));
        });
    });

    // ==========================================
    // 4. MODALS & DROPDOWNS
    // ==========================================
    describe('Modals & UI Controls', () => {
        test('showTaskDetails populates and opens the modal', async () => {
            const mockReport = { ReportID: 55, Type: 'Electrical', Brief: 'Wire loose', WardID: 4, Progress: 'Assigned' };
            fetch.mockResolvedValueOnce({ ok: true, json: async () => mockReport });

            await workerModule.showTaskDetails(55);
            expect(document.getElementById('detail-type').textContent).toBe('Electrical');
            expect(window.HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
        });

        test('showTaskDetails catches API error safely', async () => {
            fetch.mockRejectedValueOnce(new Error('Offline'));
            await workerModule.showTaskDetails(55);
            expect(console.error).toHaveBeenCalled();
        });

        test('closeModal hides the task detail dialog', () => {
            const modal = document.getElementById('task-detail-modal');
            modal.style.display = 'flex';
            
            workerModule.closeModal();
            
            expect(window.HTMLDialogElement.prototype.close).toHaveBeenCalled();
            expect(modal.style.display).toBe('none');
            expect(modal.classList.contains('hidden')).toBe(true);
        });

        test('toggleProfileDropdown toggles visibility', () => {
            const dropdown = document.getElementById('profile-dropdown');
            
            workerModule.toggleProfileDropdown();
            expect(dropdown.classList.contains('hidden')).toBe(false);
            
            workerModule.toggleProfileDropdown();
            expect(dropdown.classList.contains('hidden')).toBe(true);
        });

        test('closeDropdownOutside closes dropdown if clicked outside', () => {
            const dropdown = document.getElementById('profile-dropdown');
            dropdown.classList.remove('hidden');
            
            workerModule.closeDropdownOutside({ target: document.body });
            expect(dropdown.classList.contains('hidden')).toBe(true);
        });

        test('openEditProfile hides dropdown and calls external modal', () => {
            window._profileModal = { open: jest.fn() };
            const dropdown = document.getElementById('profile-dropdown');
            dropdown.classList.remove('hidden');
            
            workerModule.openEditProfile();
            
            expect(dropdown.classList.contains('hidden')).toBe(true);
            expect(window._profileModal.open).toHaveBeenCalled();
        });

        test('logoutWorker aborts if confirm is false', () => {
            window.confirm.mockReturnValueOnce(false);
            workerModule.logoutWorker();
            expect(localStorage.getItem('workerId')).toBe('W-101');
        });
    });
});