/**
 * @jest-environment jsdom
 */

HTMLDialogElement.prototype.showModal = jest.fn();
HTMLDialogElement.prototype.close = jest.fn();
global.fetch = jest.fn();

describe('WorkerHome Logic Tests - Pure JSDOM', () => {
    let workerModule;

    beforeEach(() => {
        delete window.location; // Allow mocking of location
        window.location = { href: '' }; // Mock location for navigation checks


        jest.resetModules();
        localStorage.clear();
        localStorage.setItem('workerId', 'W-101');
        localStorage.setItem('workerName', 'John Doe');

        window.alert = jest.fn();
        window.prompt = jest.fn(() => "Missing materials");
        window.confirm = jest.fn(() => true); 

        document.body.innerHTML = `
            <p class="text-xs font-bold"></p>
            <span id="dropdown-name"></span>
            <div id="active-tasks-container"></div>
            <div id="completed-tasks-list"></div>
            <footer><button></button></footer>
            <dialog id="task-detail-modal">
                <small id="detail-id"></small>
                <h2 id="detail-type"></h2>
                <p id="detail-description"></p>
                <p id="detail-ward"></p>
                <p id="detail-status"></p>
            </dialog>
            <div id="profile-dropdown-wrap">
                <div id="profile-dropdown" class="hidden"></div>
            </div>
            <div><output>Old Status</output></div>
            <select id="progress-99"></select>
            <div id="imagePreview-99"></div>
            
            <dialog id="worker-edit-modal"></dialog>
            <input type="text" id="edit-task-type" />
            <textarea id="edit-task-brief"></textarea>
            <select id="edit-task-priority">
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
            </select>
            <div id="edit-image-gallery"></div>
            <input type="file" id="edit-photo-input" />
        `;

        jest.clearAllMocks();
        fetch.mockResolvedValue({ ok: true, json: async () => [] });
        
        workerModule = require('./WorkerHome.js');
        document.dispatchEvent(new Event('DOMContentLoaded'));
    });

    test('acceptTask calls API securely', async () => {
        fetch.mockResolvedValueOnce({ ok: true });
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); // Mute the JSDOM reload error
        
        try { await workerModule.acceptTask(99); } catch (e) {}
        
        expect(fetch).toHaveBeenCalledWith('/api/reports/99/accept', expect.objectContaining({ method: 'PUT' }));
        consoleSpy.mockRestore();
    });

    test('declineTask calls decline API with reason', async () => {
        fetch.mockResolvedValueOnce({ ok: true });
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        
        await workerModule.declineTask(99);
        
        expect(fetch).toHaveBeenCalledWith('/api/reports/99/decline', expect.objectContaining({ 
            method: 'PUT',
            body: expect.stringContaining("Missing materials")
        }));
        consoleSpy.mockRestore();
    });

    test('resolveTask calls the /status API endpoint with Fixed', async () => {
        fetch.mockResolvedValueOnce({ ok: true });
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        
        await workerModule.resolveTask(99);
        
        expect(fetch).toHaveBeenCalledWith('/api/reports/99/status', expect.objectContaining({ 
            method: 'PUT',
            body: expect.stringContaining("Fixed")
        }));
        consoleSpy.mockRestore();
    });

    test('updateProgress calls the /status API and updates DOM label', async () => {
        fetch.mockResolvedValueOnce({ ok: true });
        await workerModule.updateProgress(99, 'In Progress - 75%');
        
        expect(fetch).toHaveBeenCalledWith('/api/reports/99/status', expect.objectContaining({ 
            method: 'PUT'
        }));
        
        const label = document.querySelector('output');
        expect(label.textContent).toBe('In Progress - 75%');
    });

    

    test('showTaskDetails populates and opens the modal', async () => {
        const mockReport = { ReportID: 55, Type: 'Electrical', Brief: 'Wire loose', WardID: 4, Progress: 'Assigned' };
        fetch.mockResolvedValueOnce({ ok: true, json: async () => mockReport });

        await workerModule.showTaskDetails(55);
        expect(document.getElementById('detail-type').textContent).toBe('Electrical');
        expect(document.getElementById('task-detail-modal').style.display).toBe('flex');
    });

    test('logoutWorker clears storage and navigates', () => {
        try { workerModule.logoutWorker(); } catch (e) {}
        expect(localStorage.getItem('workerId')).toBeNull();
    });

    test('Image Selection and Uploading Logic', async () => {
        const mockFile = new File([''], 'proof.png', { type: 'image/png' });
        const mockEvent = { target: { files: [mockFile], value: 'fakepath' } };
        window.handleImageSelect(mockEvent, 99);
        
        fetch.mockResolvedValueOnce({ ok: true });
        await workerModule.uploadTaskImages(99);
        expect(fetch).toHaveBeenCalledWith('/api/report-images/report/99', expect.objectContaining({ method: 'POST' }));
    });

    // ==========================================
    // EXTRA COVERAGE: CANCELLATIONS & EMPTY STATES
    // ==========================================
    test('declineTask does nothing if user cancels prompt', async () => {
        window.prompt.mockReturnValueOnce(null);
        await workerModule.declineTask(99);
        expect(fetch).not.toHaveBeenCalledWith('/api/reports/99/decline', expect.anything());
    });

    test('resolveTask does nothing if user cancels confirm', async () => {
        window.confirm.mockReturnValueOnce(false);
        await workerModule.resolveTask(99);
        expect(fetch).not.toHaveBeenCalledWith('/api/reports/99/status', expect.anything());
    });

    test('loadMyAssignedTasks renders empty state if no active tasks', async () => {
        fetch.mockResolvedValueOnce({ ok: true, json: async () => [] });
        await workerModule.loadMyAssignedTasks('W-101');
        expect(document.getElementById('active-tasks-container').innerHTML).toContain('Clear Ledger');
    });

    test('toggleCompletedTasks handles fetching empty state and then hiding', async () => {
        // 1. Fetch the empty state FIRST (completedVisible goes from false -> true)
        fetch.mockResolvedValueOnce({ ok: true, json: async () => [] });
        await workerModule.toggleCompletedTasks();
        expect(document.getElementById('completed-tasks-list').innerHTML).toContain('No completed operations');

        // 2. Now test hiding (completedVisible goes from true -> false)
        await workerModule.toggleCompletedTasks(); 
        expect(document.getElementById('completed-tasks-list').innerHTML).toBe('');
    });

    // ==========================================
    // EXTRA COVERAGE: UI & DROPDOWN LOGIC
    // ==========================================
    test('UI Functions: toggleProfileDropdown and closeDropdownOutside', () => {
        const dropdown = document.getElementById('profile-dropdown');
        
        // Open
        workerModule.toggleProfileDropdown();
        expect(dropdown.classList.contains('hidden')).toBe(false);
        
        // Close via outside click
        workerModule.closeDropdownOutside({ target: document.body });
        expect(dropdown.classList.contains('hidden')).toBe(true);
    });

    test('renderTaskCard generates correct HTML for new and active tasks', () => {
        const container = document.getElementById('active-tasks-container');
        
        const mockNewReport = { ReportID: 1, Priority: 1, Progress: 'Pending Assignment', Type: 'Pothole', WardID: 1 };
        const mockActiveReport = { ReportID: 2, Priority: 3, Progress: 'In Progress - 50%', Type: 'Water Leak', WardID: 1 };

        // Render both types of cards
        workerModule.renderTaskCard(mockNewReport, container);
        workerModule.renderTaskCard(mockActiveReport, container);

        const html = container.innerHTML;
        // Check if the "New Task" buttons rendered
        expect(html).toContain('Accept');
        expect(html).toContain('Decline');
        
        // Check if the "Active Task" interface rendered
        expect(html).toContain('Update Progress');
        expect(html).toContain('Attach Proof of Work');
    });

    test('openEditProfile hides dropdown and calls modal', () => {
        window._profileModal = { open: jest.fn() };
        workerModule.openEditProfile();
        expect(document.getElementById('profile-dropdown').classList.contains('hidden')).toBe(true);
        expect(window._profileModal.open).toHaveBeenCalled();
    });

    test('closeModal hides the task detail modal', () => {
        const modal = document.getElementById('task-detail-modal');
        workerModule.closeModal();
        expect(modal.close).toHaveBeenCalled();
        expect(modal.style.display).toBe('none');
    });

    test('removeImage splices array and re-renders', () => {
        const mockFile = new File([''], 'test.png', { type: 'image/png' });
        window.handleImageSelect({ target: { files: [mockFile], value: '' } }, 99);
        
        workerModule.removeImage(99, 0); // Remove the image we just added
        const preview = document.getElementById('imagePreview-99');
        expect(preview.innerHTML).toBe(''); // Should be empty again
    });

    // ==========================================
    // EXTRA COVERAGE: WORKER EDIT MODAL
    // ==========================================
    test('openWorkerEditModal fetches details and opens dialog', async () => {
        const mockReport = { Type: 'Water', Brief: 'Pipe burst', Priority: 2 };
        
        // Mock the report details fetch, then the images fetch
        fetch.mockResolvedValueOnce({ ok: true, json: async () => mockReport })
             .mockResolvedValueOnce({ ok: true, json: async () => [] }); 

        await workerModule.openWorkerEditModal(99);
        
        // Since we added the <option> tags in beforeEach, this will now successfully equal '2'
        expect(document.getElementById('edit-task-type').value).toBe('Water');
        expect(document.getElementById('edit-task-priority').value).toBe('2');
        expect(document.getElementById('worker-edit-modal').showModal).toHaveBeenCalled();
    });

    test('closeEditModal closes dialog', () => {
        workerModule.closeEditModal();
        expect(document.getElementById('worker-edit-modal').close).toHaveBeenCalled();
    });

    test('saveWorkerEdits sends PUT request and handles UI', async () => {
        fetch.mockResolvedValueOnce({ ok: true });
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        document.getElementById('edit-task-type').value = 'Test';
        await workerModule.saveWorkerEdits();
        
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/worker-edit'), expect.objectContaining({ method: 'PUT' }));
        consoleSpy.mockRestore();
    });

    test('fetchEditImages populates gallery', async () => {
        // First mock sets up the editingReportId safely
        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) }).mockResolvedValueOnce({ ok: true, json: async () => [] });
        await workerModule.openWorkerEditModal(99);

        // Actual test of the fetch function
        const mockImages = [{ ImageID: 1, Type: 'image/png', base64: 'abc' }];
        fetch.mockResolvedValueOnce({ ok: true, json: async () => mockImages });
        
        await workerModule.fetchEditImages();
        expect(document.getElementById('edit-image-gallery').innerHTML).toContain('<img');
    });

    test('deleteWorkerPhoto sends DELETE request', async () => {
        window.confirm.mockReturnValueOnce(true);
        fetch.mockResolvedValueOnce({ ok: true }); // Mock the delete call
        fetch.mockResolvedValueOnce({ ok: true, json: async () => [] }); // Mock the subsequent fetchEditImages call
        
        await workerModule.deleteWorkerPhoto(1);
        expect(fetch).toHaveBeenCalledWith('/api/report-images/1', expect.objectContaining({ method: 'DELETE' }));
    });
});