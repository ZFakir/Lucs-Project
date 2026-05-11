/**
 * @jest-environment jsdom
 */

HTMLDialogElement.prototype.showModal = jest.fn();
HTMLDialogElement.prototype.close = jest.fn();
global.fetch = jest.fn();

describe('WorkerHome Logic Tests - Pure JSDOM', () => {
    let workerModule;

    beforeEach(() => {
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
            <div id="profile-dropdown" class="hidden"></div>
            <div><output>Old Status</output></div>
            <select id="progress-99"></select>
            <div id="imagePreview-99"></div>
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

    test('toggleCompletedTasks fetches and renders archived reports', async () => {
        const mockCompleted = [{ ReportID: 10, Type: 'Pothole', Progress: 'Fixed', DateFulfilled: '2026-05-10T12:00:00Z' }];
        fetch.mockResolvedValueOnce({ ok: true, json: async () => mockCompleted });

        await workerModule.toggleCompletedTasks();
        expect(document.getElementById('completed-tasks-list').innerHTML).toContain('#10');
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
        expect(fetch).toHaveBeenCalledWith('/api/reportImages/report/99', expect.objectContaining({ method: 'POST' }));
    });
});