/**
 * @jest-environment jsdom
 */
global.fetch = jest.fn();

describe('Admin Dashboard Logic - High Coverage', () => {
    let adminModule;

    beforeEach(() => {
        jest.resetModules();
        localStorage.clear();
        
        window.alert = jest.fn();
        window.confirm = jest.fn(() => true);
        window.prompt = jest.fn(() => "10"); // Default mock for prompt
        
        // Mute console errors for clean test output (catches JSDOM Not Implemented errors silently)
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'log').mockImplementation(() => {});

        // Load the full structure from your Admin.html for high-fidelity testing
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
                <h2 id="asgn-type"></h2>
                <p id="asgn-description"></p>
                <p id="asgn-worker"></p>
                <p id="asgn-progress"></p>
                <p id="asgn-ward"></p>
                <p id="asgn-priority"></p>
                <small id="asgn-report-id"></small>
                <p id="asgn-worker-id"></p>
                <a id="asgn-email-btn" href=""></a>
                <section id="asgn-images-section" class="hidden"></section>
                <div id="asgn-images-grid"></div>
            </div>
            
            <select id="assignment-filter"><option value="all">All</option><option value="resolved">Resolved</option></select>
            <div id="no-filter-results" class="hidden"></div>
            
            <div id="admin-profile-dropdown-wrap">
                <div id="admin-profile-dropdown" class="hidden"></div>
            </div>
        `;

        jest.clearAllMocks();
        adminModule = require('./AdminHome.js');
    });

    afterEach(() => {
        console.error.mockRestore();
        console.log.mockRestore();
    });

    // --- PRE-EXISTING PASSING TESTS ---

    test('loadActiveWorkers renders personnel and handles invalidate button', async () => {
        const mockWorkers = [{ EmployeeID: 10, FirstName: 'John', LastName: 'Doe', Email: 'john@wits.ac.za' }];
        fetch.mockResolvedValueOnce({ ok: true, json: async () => mockWorkers });

        await adminModule.loadActiveWorkers();

        const container = document.getElementById('active-workers-list');
        expect(container.innerHTML).toContain('John Doe');
        expect(container.innerHTML).toContain('Invalidate');
    });

    test('openAssignmentDetail handles parallel fetches for report, images, and worker', async () => {
        // fetch
        //     .mockResolvedValueOnce({ ok: true, json: async () => ({ ReportID: 1, Type: 'Burst Pipe', Progress: 'Fixed', Description: 'Big leak' }) })
        //     .mockResolvedValueOnce({ ok: true, json: async () => [{ Type: 'image/png', base64: 'abc' }] })
        //     .mockResolvedValueOnce({ ok: true, json: async () => ({ FirstName: 'Bob', LastName: 'Builder', Email: 'bob@city.gov' }) });

        // await adminModule.openAssignmentDetail(1, 10);

        // expect(document.getElementById('asgn-type').textContent).toBe('Burst Pipe');
        // expect(document.getElementById('asgn-worker').textContent).toBe('Bob Builder');
        fetch.mockImplementation((url) => {
            if (url.includes('/api/reports/1')) {
                return Promise.resolve({ 
                    ok: true, 
                    json: async () => ({ ReportID: 1, Type: 'Burst Pipe', Priority: 2, Progress: 'Assigned', Brief: 'Water leaking' }) 
                });
            }
            if (url.includes('/api/report-images')) {
                return Promise.resolve({ ok: true, json: async () => [] }); // No images
            }
            if (url.includes('/api/workers/10/profile')) {
                return Promise.resolve({ 
                    ok: true, 
                    json: async () => ({ FirstName: 'Bob', LastName: 'Builder', Email: 'bob@build.com' }) 
                });
            }
            return Promise.resolve({ ok: false });
        });

        // 3. Trigger the function
        await adminModule.openAssignmentDetail(1, 10);

        // 4. Verify the UI updated correctly
        expect(document.getElementById('asgn-type').textContent).toBe('Burst Pipe');
        expect(document.getElementById('asgn-worker').textContent).toBe('Bob Builder');
    });

    test('logoutAdmin clears storage and redirects safely', () => {
        window.confirm = jest.fn(() => true);
        localStorage.setItem('role', 'admin');
        
        // Universal catch blocks any JSDOM navigation tantrum
        try { adminModule.logoutAdmin(); } catch (e) {} 
        
        expect(localStorage.getItem('role')).toBeNull();
    });

    // --- NEW HIGH-COVERAGE TESTS ---

    test('loadUnassignedReports renders pending reports successfully', async () => {
        const mockReports = [
            { ReportID: 101, Type: 'Pothole', Progress: 'Pending Allocation', WardID: 5, Priority: 2 }
        ];
        fetch.mockResolvedValueOnce({ ok: true, json: async () => mockReports });
        
        await adminModule.loadUnassignedReports();
        
        const tbody = document.getElementById('unassigned-reports-body');
        expect(tbody.innerHTML).toContain('Pothole');
        expect(tbody.innerHTML).toContain('#101');
    });

    test('handleEditSubmit triggers PUT API and alerts success', async () => {
        document.getElementById('edit-report-id').value = '101';
        document.getElementById('edit-type').value = 'Water Leak';
        document.getElementById('edit-description').value = 'Fixed pipe';
        
        fetch.mockResolvedValueOnce({ ok: true }); // For the edit PUT
        fetch.mockResolvedValueOnce({ ok: true, json: async () => [] }); // For the ledger refresh
        
        const mockEvent = { preventDefault: jest.fn() };
        await adminModule.handleEditSubmit(mockEvent);
        
        expect(fetch).toHaveBeenCalledWith('/api/reports/101/edit', expect.objectContaining({ method: 'PUT' }));
        expect(window.alert).toHaveBeenCalledWith("Report updated successfully!");
    });

    test('openEditModal fetches report data and populates fields', async () => {
        const mockReport = { ReportID: 55, Type: 'Electrical', Progress: 'Wire loose' };
        fetch.mockResolvedValueOnce({ ok: true, json: async () => mockReport });
        
        await adminModule.openEditModal(55);
        
        expect(document.getElementById('edit-report-id').value).toBe('55');
        expect(document.getElementById('edit-type').value).toBe('Electrical');
        expect(document.getElementById('edit-report-modal').classList.contains('hidden')).toBe(false);
    });

    test('updatePriority calls priority PUT API', async () => {
        fetch.mockResolvedValueOnce({ ok: true });
        await adminModule.updatePriority(55, "1");
        
        expect(fetch).toHaveBeenCalledWith('/api/reports/55/priority', expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify({ Priority: "1" })
        }));
    });

    test('assignToWorker uses prompt and calls POST API', async () => {
        window.prompt = jest.fn(() => "505");
        fetch.mockResolvedValueOnce({ ok: true }); // Assign POST
        fetch.mockResolvedValueOnce({ ok: true, json: async () => [] }); // loadUnassignedReports refresh
        
        await adminModule.assignToWorker(101);
        
        expect(fetch).toHaveBeenCalledWith('/api/reports/101/assign', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ EmployeeID: "505" })
        }));
        expect(window.alert).toHaveBeenCalledWith("Report #101 successfully assigned to Worker #505");
    });

    test('loadPendingWorkers renders registrations', async () => {
        const mockWorkers = [{ EmployeeID: 202, FirstName: 'Jane', LastName: 'Smith', Email: 'jane@gov.za' }];
        fetch.mockResolvedValueOnce({ ok: true, json: async () => mockWorkers });
        
        await adminModule.loadPendingWorkers();
        
        expect(document.getElementById('pending-workers-list').innerHTML).toContain('Jane Smith');
    });

    test('approveWorker triggers validation PUT API', async () => {
        fetch.mockResolvedValueOnce({ ok: true }); 
        fetch.mockResolvedValueOnce({ ok: true, json: async () => [] }); 
        
        await adminModule.approveWorker(202);
        
        expect(fetch).toHaveBeenCalledWith('/api/workers/validate/202', expect.objectContaining({ method: 'PUT' }));
        expect(window.alert).toHaveBeenCalledWith("Worker Approved!");
    });

    test('handleDelete confirms and triggers DELETE API', async () => {
        window.confirm = jest.fn(() => true);
        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) }); // Delete
        fetch.mockResolvedValueOnce({ ok: true, json: async () => [] }); // loadUnassignedReports
        fetch.mockResolvedValueOnce({ ok: true, json: async () => [] }); // loadAssignedTasks
        
        await adminModule.handleDelete(101);
        
        expect(fetch).toHaveBeenCalledWith('/api/reports/101', expect.objectContaining({ method: 'DELETE' }));
        expect(window.alert).toHaveBeenCalledWith("Report deleted successfully");
    });

    test('loadWorkerDropdown populates selection options', async () => {
        const mockWorkers = [{ EmployeeID: 303, FirstName: 'Bob', LastName: 'Builder' }];
        fetch.mockResolvedValueOnce({ ok: true, json: async () => mockWorkers });
        
        await adminModule.loadWorkerDropdown();
        
        const dropdown = document.getElementById('worker-dropdown');
        expect(dropdown.innerHTML).toContain('Bob Builder');
        expect(dropdown.innerHTML).toContain('value="303"');
    });

    test('loadAssignedTasks fetches tracker and renders allocations', async () => {
        const mockAllocations = [{
            ReportID: 101, EmployeeID: 303,
            Report: { Type: 'Leak', Progress: 'Assigned' },
            MunicipalWorker: { FirstName: 'Bob', LastName: 'Builder', Email: 'bob@gov.za' }
        }];
        fetch.mockResolvedValueOnce({ ok: true, json: async () => mockAllocations });
        
        await adminModule.loadAssignedTasks();
        
        const tbody = document.getElementById('assigned-tasks-body');
        expect(tbody.innerHTML).toContain('Bob Builder');
        expect(tbody.innerHTML).toContain('Assigned');
    });

    test('filterAssignments filters rows accurately based on selection', async () => {
        const mockAllocations = [
            { ReportID: 1, EmployeeID: 10, Report: { Type: 'Leak', Progress: 'resolved' }, MunicipalWorker: { FirstName: 'A', LastName: 'B' } },
            { ReportID: 2, EmployeeID: 20, Report: { Type: 'Fire', Progress: 'assigned' }, MunicipalWorker: { FirstName: 'C', LastName: 'D' } }
        ];
        
        // Populate the global allAllocations array first
        fetch.mockResolvedValueOnce({ ok: true, json: async () => mockAllocations });
        await adminModule.loadAssignedTasks();
        
        // Filter for 'resolved'
        document.getElementById('assignment-filter').value = 'resolved';
        adminModule.filterAssignments();
        
        const tbody = document.getElementById('assigned-tasks-body');
        expect(tbody.innerHTML).toContain('resolved');
        expect(tbody.innerHTML).not.toContain('assigned');
    });

    test('UI Modal Toggles hide modals correctly', () => {
        adminModule.closeEditModal();
        expect(document.getElementById('edit-report-modal').classList.contains('hidden')).toBe(true);

        adminModule.closeAssignModal();
        expect(document.getElementById('assign-task-modal').classList.contains('hidden')).toBe(true);

        adminModule.closeAssignmentDetail();
        expect(document.getElementById('assignment-detail-modal').classList.contains('hidden')).toBe(true);
    });

    test('invalidateWorker calls API and safely catches JSDOM reload error', async () => {
        window.confirm = jest.fn(() => true);
        fetch.mockResolvedValueOnce({ ok: true });
        
        await adminModule.invalidateWorker(10);
        
        expect(fetch).toHaveBeenCalledWith('/api/workers/invalidate/10', expect.objectContaining({ method: 'PUT' }));
        expect(window.alert).toHaveBeenCalledWith("Account Disabled!");
        // The caught JSDOM error is silenced by the console.error spy in beforeEach.
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
        window.confirm.mockReturnValueOnce(false);
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
        expect(window.alert).toHaveBeenCalledWith("Failed to save: Invalid data");
    });

    test('invalidateWorker returns early if confirm is cancelled', async () => {
        window.confirm.mockReturnValueOnce(false);
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
        window.confirm.mockReturnValueOnce(true);
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

        window.confirm.mockReturnValueOnce(true);
        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) }); // Delete fetch
        fetch.mockResolvedValueOnce({ ok: true, json: async () => [] }); // loadAssignedTasks fetch
        fetch.mockResolvedValueOnce({ ok: true, json: async () => [] }); // loadUnassignedReports fetch

        await adminModule.deleteReportFromDetail();
        
        expect(fetch).toHaveBeenCalledWith('/api/reports/99', expect.objectContaining({ method: 'DELETE' }));
        expect(window.alert).toHaveBeenCalledWith("Report #99 deleted successfully.");
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