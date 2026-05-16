/**
 * @jest-environment jsdom
 */

global.fetch = jest.fn();

describe('Admin Dashboard Logic - Maximum Safe Coverage', () => {
    let adminModule;

    beforeEach(async () => {
        jest.resetModules();
        localStorage.clear();
        
        window.alert = jest.fn();
        window.confirm = jest.fn(() => true);
        window.prompt = jest.fn(() => "10"); 
        
        // Mute console output to keep the terminal perfectly clean
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'log').mockImplementation(() => {});

        global.fetch = jest.fn();
        fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });

        // Inject the complete Admin.html DOM
        document.body.innerHTML = `
            <div id="unassigned-reports-body"></div>
            <div id="assigned-tasks-body"></div>
            <div id="pending-workers-list"></div>
            <div id="active-workers-list"></div>
            
            <div id="edit-report-modal" class="hidden">
                <input id="edit-report-id">
                <input id="edit-type">
                <textarea id="edit-description"></textarea>
            </div>
            <form id="edit-report-form"></form>
            
            <div id="assign-task-modal" class="hidden">
                <input id="assign-report-id">
                <select id="worker-dropdown"></select>
            </div>
            <form id="assign-task-form"></form>
            
            <div id="assignment-detail-modal" class="hidden">
                <h2 id="asgn-type"></h2><p id="asgn-description"></p><p id="asgn-worker"></p><p id="asgn-progress"></p>
                <p id="asgn-ward"></p><p id="asgn-priority"></p><small id="asgn-report-id"></small><p id="asgn-worker-id"></p>
                <a id="asgn-email-btn" href=""></a>
                <section id="asgn-images-section" class="hidden"></section><div id="asgn-images-grid"></div>
            </div>
            
            <select id="assignment-filter"><option value="all">All</option><option value="resolved">Resolved</option></select>
            <div id="no-filter-results" class="hidden"></div>
            
            <div id="admin-profile-dropdown-wrap"><div id="admin-profile-dropdown" class="hidden"></div></div>
        `;

        adminModule = require('../AdminHome.js');
        
        // Trigger the internal DOMContentLoaded fetches
        document.dispatchEvent(new Event('DOMContentLoaded'));
        await new Promise(process.nextTick);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // ==========================================
    // 1. DATA LOADING & RENDERING
    // ==========================================
    describe('Data Initialization', () => {
        test('loadUnassignedReports renders pending reports successfully', async () => {
            const mockReports = [{ ReportID: 101, Type: 'Pothole', Progress: 'Pending Allocation', WardID: 5, Priority: 2 }];
            fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockReports) });
            
            await adminModule.loadUnassignedReports();
            expect(document.getElementById('unassigned-reports-body').innerHTML).toContain('#101');
        });

        test('loadUnassignedReports handles API failure safely', async () => {
            fetch.mockRejectedValueOnce(new Error('API Down'));
            await adminModule.loadUnassignedReports();
            expect(document.getElementById('unassigned-reports-body').innerHTML).toContain('Sync Error');
        });

        test('loadPendingWorkers handles empty arrays', async () => {
            fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
            await adminModule.loadPendingWorkers();
            expect(document.getElementById('pending-workers-list').innerHTML).toContain('No pending registrations');
        });

        test('loadActiveWorkers handles empty arrays', async () => {
            fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
            await adminModule.loadActiveWorkers();
            expect(document.getElementById('active-workers-list').innerHTML).toContain('No active personnel found');
        });
    });

    // ==========================================
    // 2. FORM SUBMISSIONS & ASSIGNMENT
    // ==========================================
    describe('Form Submissions & Assignment', () => {
        test('handleEditSubmit handles API success and failure', async () => {
            document.getElementById('edit-report-id').value = '101';
            
            fetch.mockResolvedValueOnce({ ok: true }); 
            await adminModule.handleEditSubmit({ preventDefault: jest.fn() });
            expect(window.alert).toHaveBeenCalledWith("Report updated successfully!");

            fetch.mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({ message: 'Bad Data' }) });
            await adminModule.handleEditSubmit({ preventDefault: jest.fn() });
            expect(window.alert).toHaveBeenCalledWith("Failed to save: Bad Data");
        });

        test('assign-task-form triggers POST and safely catches JSDOM reload', async () => {
            fetch.mockClear();
            document.getElementById('assign-report-id').value = '101';
            document.getElementById('worker-dropdown').innerHTML = '<option value="5">Worker 5</option>';
            document.getElementById('worker-dropdown').value = '5';
            
            fetch.mockResolvedValueOnce({ ok: true });

            // 🚨 Wrapped in try/catch to absorb JSDOM's "Navigation Not Implemented" error
            try {
                document.getElementById('assign-task-form').dispatchEvent(new Event('submit'));
                await new Promise(process.nextTick);
            } catch(e) {}

            expect(fetch).toHaveBeenCalledWith('/api/reports/101/assign', expect.objectContaining({ method: 'POST' }));
            expect(window.alert).toHaveBeenCalledWith("Operative Assigned!");
        });

        test('assignToWorker aborts if prompt returns null', async () => {
            fetch.mockClear();
            window.prompt = jest.fn(() => null);
            await adminModule.assignToWorker(101);
            expect(fetch).not.toHaveBeenCalled();
        });
    });

    // ==========================================
    // 3. ROW ACTIONS & DELETIONS
    // ==========================================
    describe('Row Actions & Deletions', () => {
        test('handleDelete aborts if confirm is false, handles API errors', async () => {
            fetch.mockClear();
            
            window.confirm = jest.fn(() => false);
            await adminModule.handleDelete(101);
            expect(fetch).not.toHaveBeenCalled();

            window.confirm = jest.fn(() => true);
            fetch.mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({ message: 'Cannot delete' }) });
            await adminModule.handleDelete(101);
            expect(window.alert).toHaveBeenCalledWith("Failed to delete: Cannot delete");
        });

        test('deleteReportImage handles confirm logic and API failures', async () => {
            fetch.mockClear();
            
            window.confirm = jest.fn(() => false);
            await adminModule.deleteReportImage(1, 101, 5);
            expect(fetch).not.toHaveBeenCalled();

            window.confirm = jest.fn(() => true);
            fetch.mockResolvedValueOnce({ ok: false }); 
            await adminModule.deleteReportImage(1, 101, 5);
            expect(window.alert).toHaveBeenCalledWith('Failed to delete image.');
        });

        test('invalidateWorker triggers PUT and safely catches JSDOM reload', async () => {
            window.confirm = jest.fn(() => true);
            fetch.mockResolvedValueOnce({ ok: true });
            
            // 🚨 Wrapped in try/catch to absorb JSDOM's "Navigation Not Implemented" error
            try {
                await adminModule.invalidateWorker(10);
            } catch (e) {}
            
            expect(fetch).toHaveBeenCalledWith('/api/workers/invalidate/10', expect.objectContaining({ method: 'PUT' }));
            expect(window.alert).toHaveBeenCalledWith("Account Disabled!");
        });
    });

    // ==========================================
    // 4. ASSIGNMENT TRACKER (FILTERS & DETAILS)
    // ==========================================
    describe('Assignment Tracker & Detail Modals', () => {
        test('renderAssignmentTracker injects table HTML', () => {
            const container = document.createElement('div');
            adminModule.renderAssignmentTracker([{
                ReportID: 55, Report: { Type: 'Leak', Progress: 'Active' },
                MunicipalWorker: { FirstName: 'A', LastName: 'B' }
            }], container);
            
            expect(container.innerHTML).toContain('Leak');
            expect(container.innerHTML).toContain('#55');
        });

        test('filterAssignments accurately hides/shows rows', async () => {
            const mockAllocations = [
                { ReportID: 1, EmployeeID: 10, Report: { Type: 'Leak', Progress: 'resolved' }, MunicipalWorker: { FirstName: 'A', LastName: 'B' } }
            ];
            
            // 🚨 Proper Promise resolution ensures allAllocations initializes in time
            fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockAllocations) });
            await adminModule.loadAssignedTasks(); 
            
            // Verify empty filter state
            document.getElementById('assignment-filter').value = 'fake_progress';
            adminModule.filterAssignments();
            
            expect(document.getElementById('no-filter-results').classList.contains('hidden')).toBe(false); 
        });

        test('openAssignmentDetail accurately handles missing EmployeeID', async () => {
            fetch.mockImplementation((url) => {
                if (url.includes('/reports/')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ ReportID: 1, Priority: 1 }) });
                if (url.includes('/report-images/')) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
                return Promise.resolve({ ok: false });
            });

            await adminModule.openAssignmentDetail(1, null); 
            
            expect(document.getElementById('asgn-worker').textContent).toBe('Unassigned');
            expect(document.getElementById('asgn-priority').textContent).toBe('🔴 Critical');
        });
    });

    // ==========================================
    // 5. UI DROPDOWNS & NAVIGATION
    // ==========================================
    describe('Admin UI & Dropdowns', () => {
        test('UI Modal Toggles hide modals correctly', () => {
            adminModule.closeEditModal();
            expect(document.getElementById('edit-report-modal').classList.contains('hidden')).toBe(true);

            adminModule.closeAssignModal();
            expect(document.getElementById('assign-task-modal').classList.contains('hidden')).toBe(true);

            adminModule.closeAssignmentDetail();
            expect(document.getElementById('assignment-detail-modal').classList.contains('hidden')).toBe(true);
        });

        test('toggleAdminDropdown opens and outside click closes it', () => {
            jest.useFakeTimers();
            const dropdown = document.getElementById('admin-profile-dropdown');
            
            adminModule.toggleAdminDropdown();
            expect(dropdown.classList.contains('hidden')).toBe(false);

            jest.runAllTimers(); 
            
            document.body.click();
            expect(dropdown.classList.contains('hidden')).toBe(true);
            
            jest.useRealTimers();
        });

        test('openAdminProfile closes dropdown and triggers global modal if available', () => {
            window._profileModal = { open: jest.fn() };
            adminModule.openAdminProfile();
            
            expect(document.getElementById('admin-profile-dropdown').classList.contains('hidden')).toBe(true);
            expect(window._profileModal.open).toHaveBeenCalled();
        });

        test('logoutAdmin clears storage and catches redirect safely', () => {
            window.confirm = jest.fn(() => true);
            localStorage.setItem('role', 'admin');
            
            // 🚨 Wrapped in try/catch to absorb JSDOM's "Navigation Not Implemented" error
            try { adminModule.logoutAdmin(); } catch(e) {}
            
            expect(localStorage.getItem('role')).toBeNull();
        });
    });
});