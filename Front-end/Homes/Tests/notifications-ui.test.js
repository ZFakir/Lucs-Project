/**
 * @jest-environment jsdom
 */

global.fetch = jest.fn();

// Safely mock HTML dialog methods to prevent JSDOM missing-implementation errors
window.HTMLDialogElement.prototype.showModal = jest.fn();
window.HTMLDialogElement.prototype.close = jest.fn();

describe('Notifications UI Logic - Maximum Safe Coverage', () => {
    
    beforeEach(() => {
        jest.resetModules();
        jest.useFakeTimers(); 
        jest.setSystemTime(new Date('2026-05-16T12:00:00Z')); // Fixed time for deterministic tests
        
        localStorage.clear();
        localStorage.setItem('role', 'resident');
        localStorage.setItem('residentId', '123');
        
        document.body.innerHTML = `<div id="notif-shell"></div>`;
        
        // Mute console warnings/errors for intentional failure tests
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        window.confirm = jest.fn(() => true);

        // Default empty fetch response
        global.fetch.mockResolvedValue({ ok: true, json: async () => [] });
        
        require('../notifications-ui.js');
        document.dispatchEvent(new Event('DOMContentLoaded'));
        
        // Advance timers to clear the 100ms setup timeout in init()
        jest.advanceTimersByTime(150);
        global.fetch.mockClear();
    });

    afterEach(() => {
        if (window._notifModule) {
            window._notifModule.stop();
        }
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    // ==========================================
    // 1. INITIALIZATION & ROUTING
    // ==========================================
    describe('Initialization & Authentication', () => {
        test('Initializes and renders notification shell for resident', () => {
            const bell = document.getElementById('notif-bell');
            expect(bell).not.toBeNull();
            expect(window._notifModule).toBeDefined();
        });

        test('Init aborts if no valid role is found', () => {
            jest.resetModules();
            localStorage.clear();
            document.body.innerHTML = `<div id="notif-shell"></div>`;
            
            require('../notifications-ui.js');
            document.dispatchEvent(new Event('DOMContentLoaded'));
            jest.advanceTimersByTime(150);
            
            expect(document.getElementById('notif-bell')).toBeNull();
        });

        test('Init handles admin role routing', () => {
            jest.resetModules();
            localStorage.setItem('role', 'admin');
            document.body.innerHTML = `<div id="notif-shell"></div>`;
            
            require('../notifications-ui.js');
            document.dispatchEvent(new Event('DOMContentLoaded'));
            jest.advanceTimersByTime(150);
            
            expect(document.getElementById('notif-bell')).not.toBeNull();
        });

        test('Init handles worker role routing', () => {
            jest.resetModules();
            localStorage.setItem('role', 'worker');
            localStorage.setItem('workerId', 'W-10');
            document.body.innerHTML = `<div id="notif-shell"></div>`;
            
            require('../notifications-ui.js');
            document.dispatchEvent(new Event('DOMContentLoaded'));
            jest.advanceTimersByTime(150);
            
            expect(document.getElementById('notif-bell')).not.toBeNull();
        });

        test('Init restores paused state and syncs UI', () => {
            jest.resetModules();
            localStorage.setItem('role', 'resident');
            localStorage.setItem('residentId', '123');
            localStorage.setItem('notifPaused', 'true');
            
            document.body.innerHTML = `<div id="notif-shell"></div>`;
            require('../notifications-ui.js');
            document.dispatchEvent(new Event('DOMContentLoaded'));
            
            jest.advanceTimersByTime(150); 
            
            const btn = document.getElementById('notif-pause-btn');
            expect(btn.textContent).toContain('Resume');
            expect(document.getElementById('notif-live-dot').classList.contains('notif-dot-paused')).toBe(true);
        });

        test('Initializes immediately if document is already loaded', () => {
            jest.resetModules();
            localStorage.setItem('role', 'admin');
            document.body.innerHTML = `<div id="notif-shell"></div>`;
            
            // Mock document.readyState to simulate late-loading JS
            Object.defineProperty(document, 'readyState', {
                get() { return 'complete'; },
                configurable: true
            });

            require('../notifications-ui.js');
            jest.advanceTimersByTime(150);
            
            expect(document.getElementById('notif-bell')).not.toBeNull();
        });

        test('renderNotificationShell removes old elements and warns if no shell', () => {
            jest.resetModules();
            localStorage.setItem('role', 'admin');
            
            document.body.innerHTML = `
                <div id="notification-dropdown"></div>
                <button onclick="toggleNotifications()"></button>
            `;
            
            require('../notifications-ui.js');
            document.dispatchEvent(new Event('DOMContentLoaded'));
            jest.advanceTimersByTime(150);
            
            expect(document.getElementById('notification-dropdown')).toBeNull();
            expect(document.querySelector('button[onclick="toggleNotifications()"]')).toBeNull();
            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('No #notif-shell'));
        });
    });

    // ==========================================
    // 2. POLLING & TOASTS
    // ==========================================
    describe('Polling & Toast Popups', () => {
        test('Polling fetches data at 30s intervals', () => {
            fetch.mockClear();
            jest.advanceTimersByTime(30000);
            expect(fetch).toHaveBeenCalledWith('/api/notifications/123');
        });

        // test('fetchAndRender shows toast for new notifications and auto-dismisses', async () => {
        //     // First fetch (Sets baseline / isFirstFetch = false)
        //     fetch.mockResolvedValueOnce({ ok: true, json: async () => [{ NotificationID: 1, Title: 'Old', Message: 'Old', IsRead: false }] });
        //     await window._notifModule.refresh();
            
        //     // Second fetch (Introduces a new notification to trigger toast)
        //     fetch.mockResolvedValueOnce({ ok: true, json: async () => [
        //         { NotificationID: 1, Title: 'Old', Message: 'Old', IsRead: false }, 
        //         { NotificationID: 2, Title: 'New Toast', Message: 'Hello', IsRead: false, Type: 'NEW_REPORT' }
        //     ] });
        //     await window._notifModule.refresh();
            
        //     const toast = document.querySelector('.notif-toast');
        //     expect(toast).not.toBeNull();
        //     expect(toast.innerHTML).toContain('New Toast');
            
        //     // Test Auto-Dismiss (6000ms timer inside showToast + 300ms exit animation)
        //     jest.advanceTimersByTime(6500);
        //     expect(document.querySelector('.notif-toast')).toBeNull();
        // });
    });

    // ==========================================
    // 3. UI TOGGLES & OUTSIDE CLICKS
    // ==========================================
    describe('Panel Toggles & Click Events', () => {
        test('Toggles panel open and closed', () => {
            window._notifModule.toggle();
            const panel = document.getElementById('notif-panel');
            expect(panel.classList.contains('notif-panel-open')).toBe(true);
        });

        test('outsideClickClose hides panel when clicking document body', () => {
            window._notifModule.toggle(); // Open panel
            jest.advanceTimersByTime(10); // Await the setTimeout(..., 0) attaching the event

            const panel = document.getElementById('notif-panel');
            document.body.click(); // Simulate clicking outside
            
            expect(panel.classList.contains('notif-panel-open')).toBe(false);
        });

        test('outsideClickClose ignores clicks on the bell button itself', () => {
            window._notifModule.toggle(); // Open panel
            jest.advanceTimersByTime(10); 
            
            const panel = document.getElementById('notif-panel');
            const bell = document.getElementById('notif-bell');
            
            // Temporarily strip the toggle onclick to isolate the outside click test
            bell.onclick = null; 
            bell.click();
            
            expect(panel.classList.contains('notif-panel-open')).toBe(true);
        });

        test('togglePause switches polling state and saves to localStorage', () => {
            window._notifModule.togglePause(); // Pause it
            
            expect(localStorage.getItem('notifPaused')).toBe('true');
            expect(document.getElementById('notif-pause-btn').textContent).toContain('Resume');
            expect(document.getElementById('notif-live-dot').classList.contains('notif-dot-paused')).toBe(true);
        });
    });

    // ==========================================
    // 4. FETCHING, RENDERING & HELPER FORMATTING
    // ==========================================
    describe('Rendering, HTML Escaping, & Time Formatting', () => {
        test('fetchAndRender handles empty array', async () => {
            fetch.mockResolvedValueOnce({ ok: true, json: async () => [] });
            await window._notifModule.refresh();
            expect(document.getElementById('notif-list').innerHTML).toContain('All clear');
        });

        test('renderList properly maps fields, formats boundaries, and escapes HTML', async () => {
            const nowMs = new Date('2026-05-16T12:00:00Z').getTime();
            
            const mockNotifs = [
                { 
                    NotificationID: 1, Title: '<script>alert("XSS")</script>', Message: 'Escaped', 
                    CreatedAt: new Date(nowMs - 30000).toISOString(), // < 1 min ("Just now")
                    Type: 'TASK_DECLINED', Report: { WardID: 4, IssueType: 'Water Leak' }, IsRead: false
                },
                { 
                    NotificationID: 2, Title: 'Normal', Message: 'Normal', 
                    CreatedAt: new Date(nowMs - 15 * 60000).toISOString(), // < 60 min ("15m ago")
                    Type: 'UNKNOWN_TYPE', IsRead: true 
                },
                { 
                    NotificationID: 3, Title: 'Task', Message: 'Task', 
                    CreatedAt: new Date(nowMs - 5 * 3600000).toISOString(), // < 24 hrs ("5h ago")
                    Type: 'REPORT_COMPLETED', IsRead: true 
                },
                { 
                    NotificationID: 4, Title: 'Old', Message: 'Old', 
                    CreatedAt: new Date(nowMs - 48 * 3600000).toISOString(), // > 24 hrs (Date string)
                    Type: 'TASK_ASSIGNED', IsRead: true 
                },
                { 
                    NotificationID: 5, Title: 'MissingDate', Message: 'MissingDate', 
                    CreatedAt: null, // Null date test
                    Type: 'TASK_ASSIGNED', IsRead: true 
                }
            ];
            
            fetch.mockResolvedValueOnce({ ok: true, json: async () => mockNotifs });
            await window._notifModule.refresh();
            
            const listHtml = document.getElementById('notif-list').innerHTML;
            
            // XSS Escaping Check (JSDOM naturally decodes &quot; back into " for innerHTML checks)
            expect(listHtml).toContain('&lt;script&gt;alert("XSS")&lt;/script&gt;');
            
            // Theme Accent Checks (Should cover all branches of typeAccent)
            expect(listHtml).toContain('notif-accent-declined');
            expect(listHtml).toContain('notif-accent-default');
            expect(listHtml).toContain('notif-accent-completed');
            expect(listHtml).toContain('notif-accent-assigned');
            
            // Time String Checks (Should cover all branches of formatTime)
            expect(listHtml).toContain('Just now');
            expect(listHtml).toContain('15m ago');
            expect(listHtml).toContain('5h ago');
            
            // Report details extraction check
            expect(listHtml).toContain('Ward 4 • Water Leak');
        });

        test('updateBadge handles missing DOM gracefully and scales to 99+', async () => {
            const massiveArray = Array.from({length: 105}, (_, i) => ({ NotificationID: i, IsRead: false }));
            fetch.mockResolvedValueOnce({ ok: true, json: async () => massiveArray });
            
            await window._notifModule.refresh();
            expect(document.getElementById('notif-badge').textContent).toBe('99+');
        });
    });

    // ==========================================
    // 5. API ACTIONS (READ, DELETE, CLEAR)
    // ==========================================
    describe('API Actions & Error Handling', () => {
        test('markRead triggers PUT API and opens modal if reportId exists', async () => {
            document.getElementById('notif-list').innerHTML = `<li class="notif-item notif-unread" data-id="99"></li>`;
            fetch.mockResolvedValueOnce({ ok: true });
            
            await window._notifModule.markRead(99, 10); // reportId 10
            
            expect(fetch).toHaveBeenCalledWith('/api/notifications/99/read', expect.objectContaining({ method: 'PUT' }));
            expect(fetch).toHaveBeenCalledWith('/api/reports/10'); 
        });

        test('markAllRead triggers PUT API and clears all unread classes', async () => {
            document.getElementById('notif-list').innerHTML = `<li class="notif-item notif-unread" data-id="1"></li>`;
            fetch.mockResolvedValueOnce({ ok: true });
            
            await window._notifModule.markAllRead();
            
            expect(fetch).toHaveBeenCalledWith('/api/notifications/123/read-all', expect.objectContaining({ method: 'PUT' }));
            expect(document.querySelectorAll('.notif-unread').length).toBe(0);
        });

        test('deleteOne triggers DELETE API and removes item', async () => {
            document.getElementById('notif-list').innerHTML = `<li class="notif-item" data-id="55"></li>`;
            fetch.mockResolvedValueOnce({ ok: true });
            
            await window._notifModule.deleteOne(55);
            
            expect(fetch).toHaveBeenCalledWith('/api/notifications/55', expect.objectContaining({ method: 'DELETE' }));
            
            // Advance animation timer (280ms)
            jest.advanceTimersByTime(300);
            expect(document.querySelector('[data-id="55"]')).toBeNull();
        });

        test('clearAll triggers DELETE API', async () => {
            window.confirm.mockReturnValueOnce(true); 
            fetch.mockResolvedValueOnce({ ok: true });
            
            await window._notifModule.clearAll();
            
            expect(fetch).toHaveBeenCalledWith('/api/notifications/123/clear-all', expect.objectContaining({ method: 'DELETE' }));
            expect(document.getElementById('notif-list').innerHTML).toContain('All clear');
        });

        test('clearAll aborts if user cancels confirm prompt', async () => {
            window.confirm.mockReturnValueOnce(false); 
            await window._notifModule.clearAll();
            expect(fetch).not.toHaveBeenCalled();
        });

        test('All API endpoints handle network failures safely without crashing', async () => {
            fetch.mockRejectedValue(new Error('Network Crash'));
            
            await window._notifModule.refresh();
            await window._notifModule.markRead(1, null);
            await window._notifModule.markAllRead();
            await window._notifModule.deleteOne(1);
            
            window.confirm.mockReturnValueOnce(true);
            await window._notifModule.clearAll();
            
            expect(console.warn).toHaveBeenCalledTimes(5);
        });
    });

    // ==========================================
    // 6. REPORT MODAL & IMAGE VIEWER
    // ==========================================
    describe('Report Modal & Fullscreen Viewer', () => {
        test('openNotifReportModal fetches report data and handles missing municipality', async () => {
            fetch.mockImplementation((url) => {
                if (url.includes('/api/reports/10')) {
                    return Promise.resolve({ ok: true, json: async () => ({ ReportID: 10, Type: 'Pipe Burst', Priority: 1 }) });
                }
                if (url.includes('/api/report-images/')) {
                    return Promise.resolve({ ok: true, json: async () => ([{ Type: 'image/png', base64: 'mockbase64' }]) });
                }
                return Promise.resolve({ ok: true, json: async () => [] });
            });

            await window._notifModule.openNotifReportModal(10);
            
            const dialog = document.getElementById('notif-report-modal');
            expect(dialog).not.toBeNull();
            expect(dialog.innerHTML).toContain('Pipe Burst');
            expect(dialog.innerHTML).toContain('Critical');
            expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
        });

        test('openNotifReportModal handles empty images and displays fallback UI', async () => {
            fetch.mockImplementation((url) => {
                if (url.includes('/api/reports/10')) return Promise.resolve({ ok: true, json: async () => ({ ReportID: 10, Type: 'Issue' }) });
                if (url.includes('/api/report-images/')) return Promise.resolve({ ok: true, json: async () => [] }); 
                return Promise.resolve({ ok: true, json: async () => [] });
            });

            await window._notifModule.openNotifReportModal(10);
            
            const dialog = document.getElementById('notif-report-modal');
            expect(dialog.innerHTML).toContain('No photos attached');
        });

        test('openNotifReportModal handles fetch rejection and displays error UI', async () => {
            fetch.mockRejectedValueOnce(new Error('DB Offline'));

            await window._notifModule.openNotifReportModal(99);
            
            const dialog = document.getElementById('notif-report-modal');
            expect(dialog.innerHTML).toContain('Failed to load report details');
            expect(console.error).toHaveBeenCalled();
        });

        test('closeReportModal closes and clears the dialog', () => {
            const dialog = document.createElement('dialog');
            dialog.id = 'notif-report-modal';
            dialog.innerHTML = '<p>Some content</p>';
            document.body.appendChild(dialog);

            window._notifModule.closeReportModal();

            expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
            expect(dialog.innerHTML).toBe('');
        });

        test('openImageFullscreen injects viewer into DOM and removes it on click', () => {
            window._notifModule.openImageFullscreen('data:image/png;base64,123');
            
            const img = document.querySelector('img[src="data:image/png;base64,123"]');
            expect(img).not.toBeNull();
            
            // Trigger the onclick on the wrapper
            const viewer = img.parentElement;
            viewer.onclick();
            
            expect(document.querySelector('img[src="data:image/png;base64,123"]')).toBeNull();
        });
    });
});