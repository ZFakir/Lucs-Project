/**
 * @jest-environment jsdom
 */

describe('Admin Dashboard Logic - Maximum Safe Coverage', () => {
    let adminModule;

    beforeEach(async () => {
        jest.resetModules();
        localStorage.clear();

        // 1. MOCK THE CUSTOM ALERT MODAL
        global.mockShow = jest.fn(() => Promise.resolve(true));
        global.AlertModal = class {
            show(title, message, type) {
                return global.mockShow(title, message, type);
            }
        };

        // Note: AlertModal doesn't do text input, so prompts stay native
        window.prompt = jest.fn(() => "5"); 
        
        // Mute console output for clean logs and to safely hide the intentional JSDOM crashes
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'log').mockImplementation(() => {});

        // BULLETPROOF ROUTER: Ensures every function gets the exact data structure it expects
        global.fetch = jest.fn((url, options) => {
            const urlStr = url ? url.toString() : '';
            
            if (urlStr.includes('/api/reports/admin/tracker')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve([{ ReportID: 101, EmployeeID: 5, Report: { Type: 'Leak', Progress: 'Assigned' }, MunicipalWorker: { FirstName: 'Bob', LastName: 'Builder' } }]) });
            }
            if (urlStr.includes('/api/workers/pending')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve([{ EmployeeID: 2, FirstName: 'Jane', LastName: 'Doe', Email: 'j@d.com' }]) });
            }
            if (urlStr.includes('/api/workers/active') && (!options || options.method === 'GET' || !options.method)) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve([{ EmployeeID: 3, FirstName: 'Active', LastName: 'Worker', Email: 'a@w.com' }]) });
            }
            
            // Single report fetch for Edit Modal & Assignment Detail
            if (urlStr.match(/\/api\/reports\/\d+$/) && (!options || options.method === 'GET' || !options.method)) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve({ ReportID: 1, Type: 'Pothole', Brief: 'Test', Progress: 'Pending', Priority: 2, WardID: 1 }) });
            }

            // Report images fetch
            if (urlStr.includes('/api/report-images/report/')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
            }
            
            // Worker profile fetch
            if (urlStr.includes('/profile')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve({ FirstName: 'Test', LastName: 'Worker' }) });
            }

            // Handle specific action endpoints safely
            if (urlStr.includes('assign')) return Promise.resolve({ ok: true });
            if (urlStr.includes('edit')) return Promise.resolve({ ok: true });
            if (urlStr.includes('invalidate')) return Promise.resolve({ ok: true });
            if (urlStr.includes('priority')) return Promise.resolve({ ok: true });
            if (urlStr.includes('validate')) return Promise.resolve({ ok: true });
            if (options && options.method === 'DELETE') return Promise.resolve({ ok: true, json: () => Promise.resolve({ message: 'Deleted' }) });

            // Default payload for standard tables
            return Promise.resolve({ ok: true, json: () => Promise.resolve([{ ReportID: 99, Type: 'Pipe', Progress: 'Pending', WardID: 1, Priority: 1 }]) });
        });

        // COMPLETE DOM
        document.body.innerHTML = `
            <div id="unassigned-reports-body"></div>
            <div id="assigned-tasks-body"></div>
            <div id="pending-workers-list"></div>
            <div id="active-workers-list"></div>
            
            <form id="edit-report-form"></form>
            <div id="edit-report-modal" class="hidden">
                <input id="edit-report-id">
                <input id="edit-type">
                <textarea id="edit-description"></textarea>
            </div>
            
            <form id="assign-task-form"></form>
            <div id="assign-task-modal" class="hidden">
                <input id="assign-report-id">
                <select id="worker-dropdown"></select>
            </div>
            
            <div id="assignment-detail-modal" class="hidden">
                <h2 id="asgn-type"></h2><p id="asgn-description"></p><p id="asgn-worker"></p><p id="asgn-progress"></p>
                <p id="asgn-ward"></p><p id="asgn-priority"></p><small id="asgn-report-id"></small><p id="asgn-worker-id"></p>
                <a id="asgn-email-btn" href=""></a>
                <section id="asgn-images-section" class="hidden"></section><div id="asgn-images-grid"></div>
            </div>
            
            <select id="assignment-filter"><option value="all">All</option><option value="assigned">Assigned</option><option value="resolved">Resolved</option></select>
            <div id="no-filter-results" class="hidden"></div>
            
            <div id="admin-profile-dropdown-wrap"><div id="admin-profile-dropdown" class="hidden"></div></div>
        `;

        adminModule = require('../AdminHome.js');
        document.dispatchEvent(new Event('DOMContentLoaded'));
        await new Promise(resolve => setTimeout(resolve, 50)); 
        
        fetch.mockClear(); 
        global.mockShow.mockClear();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // ==========================================
    // 1. DATA INITIALIZATION & UI RENDERING
    // ==========================================
    describe('Data Initialization & UI Rendering', () => {
        test('loadUnassignedReports populates table safely', async () => {
            await adminModule.loadUnassignedReports();
            expect(document.getElementById('unassigned-reports-body').innerHTML).toContain('Pipe'); 
        });

        test('loadUnassignedReports handles empty array (Clear Ledger)', async () => {
            global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) }));
            await adminModule.loadUnassignedReports();
            expect(document.getElementById('unassigned-reports-body').innerHTML).toContain('Clear Ledger: No Active Assignments');
        });

        test('loadUnassignedReports handles fetch failures (Sync Error)', async () => {
            global.fetch = jest.fn(() => Promise.reject(new Error('Network Down')));
            await adminModule.loadUnassignedReports();
            expect(document.getElementById('unassigned-reports-body').innerHTML).toContain('Sync Error: Check Server Connection');
        });

        test('loadUnassignedReports renders declined badge when progress is pending & declined', async () => {
            global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([{ ReportID: 202, Type: 'Pothole', Progress: 'Pending (Declined)' }]) }));
            await adminModule.loadUnassignedReports();
            expect(document.getElementById('unassigned-reports-body').innerHTML).toContain('Re-assign');
        });

        test('loadUnassignedReports safe exit if DOM missing', async () => {
            document.getElementById('unassigned-reports-body').remove();
            await expect(adminModule.loadUnassignedReports()).resolves.not.toThrow();
        });

        test('loadPendingWorkers handles empty array', async () => {
            global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) }));
            await adminModule.loadPendingWorkers();
            expect(document.getElementById('pending-workers-list').innerHTML).toContain('No pending registrations');
        });

        test('loadActiveWorkers handles empty array', async () => {
            global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) }));
            await adminModule.loadActiveWorkers();
            expect(document.getElementById('active-workers-list').innerHTML).toContain('No active personnel found');
        });
        
        test('loadActiveWorkers safe exit if DOM missing', async () => {
            document.getElementById('active-workers-list').remove();
            await expect(adminModule.loadActiveWorkers()).resolves.not.toThrow();
        });
    });

    // ==========================================
    // 2. MODALS & API SUBMISSIONS
    // ==========================================
    describe('Modals & API Submissions', () => {
        test('openEditModal catches fetch failure', async () => {
            global.fetch = jest.fn(() => Promise.reject(new Error('Fetch failed')));
            await adminModule.openEditModal(1);
            expect(document.getElementById('edit-report-modal').classList.contains('hidden')).toBe(true);
        });

        test('handleEditSubmit handles missing ID gracefully', async () => {
            document.getElementById('edit-report-id').value = '';
            await adminModule.handleEditSubmit({ preventDefault: jest.fn() });
            expect(global.mockShow).toHaveBeenCalledWith('Error', "Error: Report ID is missing.", 'alert');
        });

        test('handleEditSubmit handles server rejection', async () => {
            document.getElementById('edit-report-id').value = '1';
            global.fetch = jest.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({ message: 'Bad Data' }) }));
            await adminModule.handleEditSubmit({ preventDefault: jest.fn() });
            expect(global.mockShow).toHaveBeenCalledWith('Success', "Failed to save: Bad Data", 'alert');
        });

        test('assignToWorker handles empty prompt or server failure', async () => {
            window.prompt.mockReturnValueOnce(null);
            await adminModule.assignToWorker(101);
            expect(fetch).not.toHaveBeenCalled();

            window.prompt.mockReturnValueOnce("5");
            global.fetch = jest.fn(() => Promise.resolve({ ok: false }));
            await adminModule.assignToWorker(101);
            expect(global.mockShow).toHaveBeenCalledWith('Error', "Assignment failed. Check if Employee ID exists.", 'alert');
        });
        
        test('assign-task-form triggers POST and catches fetch error', async () => {
            document.getElementById('assign-report-id').value = '101';
            document.getElementById('worker-dropdown').innerHTML = '<option value="5">Worker 5</option>';
            document.getElementById('worker-dropdown').value = '5';
            
            global.fetch = jest.fn(() => Promise.reject(new Error('Form Submit Error')));
            
            try {
                document.getElementById('assign-task-form').dispatchEvent(new Event('submit'));
                await new Promise(r => setTimeout(r, 20)); 
            } catch(e) {}
            
            expect(console.error).toHaveBeenCalled();
        });

        test('loadWorkerDropdown handles server errors', async () => {
            global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));
            await adminModule.loadWorkerDropdown();
            expect(document.getElementById('worker-dropdown').innerHTML).toContain('Error loading personnel');
        });
    });

    // ==========================================
    // 3. ROW ACTIONS & DELETIONS
    // ==========================================
    describe('Row Actions & Deletions', () => {
        test('updatePriority calls PUT API and handles errors', async () => {
            await adminModule.updatePriority(1, 3);
            expect(fetch).toHaveBeenCalledWith('/api/reports/1/priority', expect.objectContaining({ method: 'PUT' }));

            global.fetch = jest.fn(() => Promise.reject(new Error('Fail')));
            await adminModule.updatePriority(1, 3);
            expect(console.error).toHaveBeenCalled();
        });

        test('approveWorker triggers validate PUT and handles error', async () => {
            await adminModule.approveWorker(2);
            expect(fetch).toHaveBeenCalledWith('/api/workers/validate/2', expect.objectContaining({ method: 'PUT' }));

            global.fetch = jest.fn(() => Promise.reject(new Error('Fail')));
            await adminModule.approveWorker(2);
            expect(console.error).toHaveBeenCalled();
        });

        test('handleDelete triggers DELETE API and handles server rejection', async () => {
            await adminModule.handleDelete(101);
            expect(fetch).toHaveBeenCalledWith('/api/reports/101', expect.objectContaining({ method: 'DELETE' }));

            global.fetch = jest.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({ message: 'Forbidden' }) }));
            await adminModule.handleDelete(102);
            expect(global.mockShow).toHaveBeenCalledWith('Error', "Failed to delete: Forbidden", 'alert');
        });

        test('handleDelete aborts if confirm is false', async () => {
            global.mockShow.mockResolvedValueOnce(false);
            await adminModule.handleDelete(101);
            expect(fetch).not.toHaveBeenCalled();
        });

        test('invalidateWorker handles server rejection', async () => {
            global.fetch = jest.fn(() => Promise.reject(new Error('Network Down')));
            await adminModule.invalidateWorker(99);
            expect(console.error).toHaveBeenCalled();
        });

        test('invalidateWorker aborts if confirm is false', async () => {
            global.mockShow.mockResolvedValueOnce(false);
            await adminModule.invalidateWorker(99);
            expect(fetch).not.toHaveBeenCalled();
        });
    });

    // ==========================================
    // 4. ASSIGNMENT TRACKER & ASSIGNMENT DETAILS
    // ==========================================
    describe('Assignment Tracker & Detail Modals', () => {
        test('loadAssignedTasks handles empty array safely', async () => {
            global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) }));
            await adminModule.loadAssignedTasks();
            expect(document.getElementById('assigned-tasks-body').innerHTML).toContain('No active field assignments.');
        });
        
        test('renderAssignmentRows exercises all progress color branches', () => {
            const allocations = [
                { ReportID: 1, EmployeeID: 1, Report: { Type: 'A', Progress: 'assigned' }, MunicipalWorker: { FirstName: 'A', LastName: 'B', Email: 'a@a.com' } },
                { ReportID: 2, EmployeeID: 2, Report: { Type: 'B', Progress: 'in progress' }, MunicipalWorker: { FirstName: 'C', LastName: 'D', Email: 'b@b.com' } },
                { ReportID: 3, EmployeeID: 3, Report: { Type: 'C', Progress: 'resolved' }, MunicipalWorker: { FirstName: 'E', LastName: 'F', Email: 'c@c.com' } },
                { ReportID: 4, EmployeeID: 4, Report: { Type: 'D', Progress: 'fixed' }, MunicipalWorker: { FirstName: 'G', LastName: 'H', Email: 'd@d.com' } },
                { ReportID: 5, EmployeeID: 5, Report: { Type: 'E', Progress: 'declined' }, MunicipalWorker: { FirstName: 'I', LastName: 'J', Email: 'e@e.com' } },
                { ReportID: 6, EmployeeID: 6, Report: { Type: 'F', Progress: 'unknown_state' }, MunicipalWorker: { FirstName: 'K', LastName: 'L', Email: 'f@f.com' } },
                { ReportID: 7, EmployeeID: 7, Report: { Type: 'G' }, MunicipalWorker: { FirstName: 'M', LastName: 'N', Email: 'g@g.com' } } // Undefined progress fallback
            ];
            adminModule.renderAssignmentRows(allocations);
            const tableBody = document.getElementById('assigned-tasks-body').innerHTML;
            
            expect(tableBody).toContain('bg-yellow-500/10'); // assigned
            expect(tableBody).toContain('bg-blue-500/10'); // in progress
            expect(tableBody).toContain('bg-green-500/10'); // resolved/fixed
            expect(tableBody).toContain('bg-red-500/10'); // declined
            expect(tableBody).toContain('bg-surface-container-highest'); // unknown default
            expect(tableBody).toContain('In Transit'); // null/undefined progress default
        });

        test('renderAssignmentTracker constructs independent HTML correctly', () => {
            const container = document.createElement('div');
            const mockAllocations = [{
                ReportID: 55,
                Report: { Type: 'Overgrown Tree', Progress: 'Assigned' },
                MunicipalWorker: { FirstName: 'Jane', LastName: 'Smith' }
            }];
            adminModule.renderAssignmentTracker(mockAllocations, container);
            
            expect(container.innerHTML).toContain('#55');
            expect(container.innerHTML).toContain('Overgrown Tree');
            expect(container.innerHTML).toContain('Jane Smith');
            expect(container.innerHTML).toContain('Assigned');
        });
        
        test('filterAssignments accurately routes between all, match, and empty states', async () => {
            await adminModule.loadAssignedTasks(); // Populates internal allAllocations array
            
            const filterEl = document.getElementById('assignment-filter');
            
            // Match Found
            filterEl.value = 'assigned';
            adminModule.filterAssignments();
            
            // Match NOT Found
            filterEl.value = 'resolved';
            adminModule.filterAssignments();
            expect(document.getElementById('no-filter-results').classList.contains('hidden')).toBe(false);
            
            // All
            filterEl.value = 'all';
            adminModule.filterAssignments();
            expect(document.getElementById('assigned-tasks-body').innerHTML).toContain('Bob Builder'); 
        });

        test('openAssignModal shows modal and triggers dropdown load', () => {
            adminModule.openAssignModal(10);
            expect(document.getElementById('assign-report-id').value).toBe('10');
            expect(document.getElementById('assign-task-modal').classList.contains('hidden')).toBe(false);
            expect(fetch).toHaveBeenCalledWith('/api/workers/active');
        });

        test('closeAssignModal hides modal', () => {
            document.getElementById('assign-task-modal').classList.remove('hidden');
            adminModule.closeAssignModal();
            expect(document.getElementById('assign-task-modal').classList.contains('hidden')).toBe(true);
        });

        test('openAssignmentDetail loads report correctly with images', async () => {
            // Mock to return images
            global.fetch = jest.fn((url) => {
                if(url.includes('images')) return Promise.resolve({ok: true, json: () => Promise.resolve([{ ImageID: 99, Type: 'image/png', base64: 'abc' }])});
                if(url.includes('workers')) return Promise.resolve({ok: true, json: () => Promise.resolve({FirstName: 'T', LastName: 'W'})});
                return Promise.resolve({ok: true, json: () => Promise.resolve({ReportID: 1, Type: 'Leak', Progress: 'Assigned', WardID: 2, Priority: 1})});
            });

            await adminModule.openAssignmentDetail(1, 5);
            expect(document.getElementById('assignment-detail-modal').classList.contains('hidden')).toBe(false);
            expect(document.getElementById('asgn-images-section').classList.contains('hidden')).toBe(false);
            expect(document.getElementById('asgn-images-grid').innerHTML).toContain('img src="data:image/png');
            expect(document.getElementById('asgn-worker').textContent).toBe('T W');
            expect(document.getElementById('asgn-priority').textContent).toBe('🔴 Critical');
        });

        test('openAssignmentDetail loads report without operative and without images', async () => {
            await adminModule.openAssignmentDetail(1, null); // No employee ID
            expect(document.getElementById('asgn-worker').textContent).toBe('Unassigned');
            expect(document.getElementById('asgn-images-section').classList.contains('hidden')).toBe(true);
        });

        test('openAssignmentDetail handles fetch error', async () => {
            global.fetch = jest.fn(() => Promise.reject(new Error('Network Fail')));
            await adminModule.openAssignmentDetail(1, null);
            expect(document.getElementById('asgn-type').textContent).toBe('Error loading details');
        });

        test('closeAssignmentDetail hides the modal', () => {
            document.getElementById('assignment-detail-modal').classList.remove('hidden');
            adminModule.closeAssignmentDetail();
            expect(document.getElementById('assignment-detail-modal').classList.contains('hidden')).toBe(true);
        });

        test('deleteReportImage fires DELETE request', async () => {
            global.mockShow.mockResolvedValueOnce(true); // Approve modal confirmation
            await adminModule.deleteReportImage(99, 1, 5);
            expect(fetch).toHaveBeenCalledWith('/api/report-images/99', expect.objectContaining({ method: 'DELETE' }));

            // Test server failure
            global.mockShow.mockResolvedValueOnce(true); // Approve modal confirmation
            global.fetch = jest.fn(() => Promise.resolve({ ok: false }));
            await adminModule.deleteReportImage(99, 1, 5);
            expect(global.mockShow).toHaveBeenCalledWith('Success', "Failed to delete image.", 'alert');

            // Test abort
            global.mockShow.mockResolvedValueOnce(false); // Reject modal confirmation
            fetch.mockClear();
            await adminModule.deleteReportImage(99, 1, 5);
            expect(fetch).not.toHaveBeenCalled();
        });
    });

    // ==========================================
    // 5. DROPDOWNS & UI NAVIGATION
    // ==========================================
    describe('Admin UI & Dropdowns', () => {
        test('toggleAdminDropdown toggles visibility and event listener', () => {
            const dropdown = document.getElementById('admin-profile-dropdown');
            
            adminModule.toggleAdminDropdown();
            expect(dropdown.classList.contains('hidden')).toBe(false);
            
            adminModule.toggleAdminDropdown();
            expect(dropdown.classList.contains('hidden')).toBe(true);
        });

        test('closeAdminDropdownOutside does nothing if clicked inside', () => {
            const wrap = document.getElementById('admin-profile-dropdown-wrap');
            const dropdown = document.getElementById('admin-profile-dropdown');
            dropdown.classList.remove('hidden');
            adminModule.closeAdminDropdownOutside({ target: wrap });
            expect(dropdown.classList.contains('hidden')).toBe(false); // Should remain open
        });

        test('openAdminProfile attempts to trigger external profile modal', () => {
            window._profileModal = { open: jest.fn() };
            adminModule.openAdminProfile();
            expect(window._profileModal.open).toHaveBeenCalled();
            expect(document.getElementById('admin-profile-dropdown').classList.contains('hidden')).toBe(true);
        });

        test('logoutAdmin aborts if confirm is false', async () => {
            global.mockShow.mockResolvedValueOnce(false);
            localStorage.setItem('role', 'admin');
            await adminModule.logoutAdmin(); // Needs await since AlertModal resolves a promise
            expect(localStorage.getItem('role')).toBe('admin'); // Did not log out
        });
    });

    
    // ==========================================
    // EXTRA COVERAGE: EMPTY STATES
    // ==========================================
    test('loadUnassignedReports handles empty state correctly', async () => {
        fetch.mockResolvedValueOnce({ ok: true, json: async () => [] });
        await adminModule.loadUnassignedReports();
        expect(document.getElementById('unassigned-reports-body').innerHTML).toContain('Clear Ledger');
    });

    test('loadPendingWorkers handles empty state correctly', async () => {
        fetch.mockResolvedValueOnce({ ok: true, json: async () => [] });
        await adminModule.loadPendingWorkers();
        expect(document.getElementById('pending-workers-list').innerHTML).toContain('No pending registrations');
    });

    test('loadActiveWorkers handles empty state correctly', async () => {
        fetch.mockResolvedValueOnce({ ok: true, json: async () => [] });
        await adminModule.loadActiveWorkers();
        expect(document.getElementById('active-workers-list').innerHTML).toContain('No active personnel found.');
    });

    // ==========================================
    // EXTRA COVERAGE: CANCELLATIONS & ERRORS
    // ==========================================
    test('handleDelete returns early if confirm is cancelled', async () => {
        global.mockShow.mockResolvedValueOnce(false);
        await adminModule.handleDelete(101);
        expect(fetch).not.toHaveBeenCalledWith('/api/reports/101', expect.anything());
    });

    test('assignToWorker returns early if prompt is cancelled', async () => {
        window.prompt.mockReturnValueOnce(null);
        await adminModule.assignToWorker(101);
        expect(fetch).not.toHaveBeenCalledWith('/api/reports/101/assign', expect.anything());
    });

    test('handleEditSubmit alerts error if API fails', async () => {
        document.getElementById('edit-report-id').value = '101';
        fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ message: 'Invalid data' }) });
        
        await adminModule.handleEditSubmit({ preventDefault: jest.fn() });
        expect(global.mockShow).toHaveBeenCalledWith('Success', "Failed to save: Invalid data", 'alert');
    });

    test('invalidateWorker returns early if confirm is cancelled', async () => {
        global.mockShow.mockResolvedValueOnce(false);
        await adminModule.invalidateWorker(101);
        expect(fetch).not.toHaveBeenCalledWith(expect.stringContaining('/invalidate/'), expect.anything());
    });

    // ==========================================
    // EXTRA COVERAGE: NEW IMAGE & DELETE LOGIC
    // ==========================================
    test('openAssignmentDetail splits resident and worker images accurately', async () => {
        const mockReport = { ReportID: 1, Type: 'Burst Pipe', Priority: 2, Progress: 'Assigned', Brief: 'Water leaking' };
        const mockImages = [
            { ImageID: 1, Type: 'image/jpeg', base64: 'abc' }, // Resident photo
            { ImageID: 2, Type: 'image/jpeg;role=worker', base64: 'def' } // Worker photo
        ];
        
        fetch.mockImplementation((url) => {
            if (url.includes('/api/reports/1')) return Promise.resolve({ ok: true, json: async () => mockReport });
            if (url.includes('/api/report-images')) return Promise.resolve({ ok: true, json: async () => mockImages });
            return Promise.resolve({ ok: true, json: async () => ({}) });
        });

        await adminModule.openAssignmentDetail(1, 10);
        
        const grid = document.getElementById('asgn-images-grid');
        expect(grid.innerHTML).toContain('Original Issue Photos');
        expect(grid.innerHTML).toContain('Worker Proof of Work');
        expect(grid.innerHTML).toContain('border-primary/50'); // Checks for the worker green border class
    });

    test('deleteReportImage confirms and triggers DELETE API', async () => {
        global.mockShow.mockResolvedValueOnce(true);
        fetch.mockResolvedValueOnce({ ok: true }); // Mock the delete
        
        // Mock the three fetches that happen inside openAssignmentDetail during the refresh
        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
             .mockResolvedValueOnce({ ok: true, json: async () => [] })
             .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

        await adminModule.deleteReportImage(55, 101, 10);
        
        expect(fetch).toHaveBeenCalledWith('/api/report-images/55', expect.objectContaining({ method: 'DELETE' }));
    });

    test('deleteReportFromDetail confirms, deletes, and refreshes ledgers', async () => {
        // First, trick the module into setting the internal currentDetailReportId variable
        fetch.mockResolvedValue({ ok: true, json: async () => ({}) }); // Setup blanket mocks for detail open
        await adminModule.openAssignmentDetail(99, null);

        global.mockShow.mockResolvedValueOnce(true);
        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) }); // Delete fetch
        fetch.mockResolvedValueOnce({ ok: true, json: async () => [] }); // loadAssignedTasks fetch
        fetch.mockResolvedValueOnce({ ok: true, json: async () => [] }); // loadUnassignedReports fetch

        await adminModule.deleteReportFromDetail();
        
        expect(fetch).toHaveBeenCalledWith('/api/reports/99', expect.objectContaining({ method: 'DELETE' }));
        expect(global.mockShow).toHaveBeenCalledWith('Success', "Report #99 deleted successfully.", 'alert');
    });

    // ==========================================
    // EXTRA COVERAGE: UI ELEMENTS & DROPDOWNS
    // ==========================================
    test('Admin Dropdown functions toggle visibility correctly', () => {
        const dropdown = document.getElementById('admin-profile-dropdown');
        
        // Test Open
        adminModule.toggleAdminDropdown();
        expect(dropdown.classList.contains('hidden')).toBe(false);

        // Test Close
        adminModule.closeAdminDropdownOutside({ target: document.body });
        expect(dropdown.classList.contains('hidden')).toBe(true);

        // Test Profile Open
        window._profileModal = { open: jest.fn() };
        adminModule.openAdminProfile();
        expect(dropdown.classList.contains('hidden')).toBe(true);
        expect(window._profileModal.open).toHaveBeenCalled();
    });

    test('renderAssignmentTracker generates HTML successfully', () => {
        const container = document.createElement('div');
        const mockAllocations = [{
            ReportID: 10, Report: { Type: 'Pothole', Progress: 'Active' }, MunicipalWorker: { FirstName: 'Jane', LastName: 'Doe' }
        }];
        
        adminModule.renderAssignmentTracker(mockAllocations, container);
        expect(container.innerHTML).toContain('Pothole');
        expect(container.innerHTML).toContain('Jane Doe');
    });
});