/**
 * @jest-environment jsdom
 */

global.fetch = jest.fn();

// Safely mock HTML dialog methods to prevent JSDOM missing-implementation errors
HTMLDialogElement.prototype.showModal = jest.fn();
HTMLDialogElement.prototype.close = jest.fn();

describe('Notifications UI Logic - High Coverage', () => {
    
    beforeEach(() => {
        jest.resetModules();
        jest.useFakeTimers(); // Prevent the 30s setInterval from hanging Jest
        
        localStorage.clear();
        localStorage.setItem('role', 'resident');
        localStorage.setItem('residentId', '123');
        
        document.body.innerHTML = `<div id="notif-shell"></div>`;
        
        // Mute console warnings/errors for intentional failure tests
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        window.confirm = jest.fn(() => true);

        // Default empty fetch response
        fetch.mockResolvedValue({ ok: true, json: async () => [] });
        
        require('./notifications-ui.js');
        document.dispatchEvent(new Event('DOMContentLoaded'));
        
        // Advance timers to clear the 100ms setup timeout in init()
        jest.advanceTimersByTime(150);
    });

    afterEach(() => {
        // Stop the polling interval so it doesn't leak into other tests
        if (window._notifModule) {
            window._notifModule.stop();
        }
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    // --- EXISTING TESTS (Enhanced) ---

    test('Initializes and renders notification shell', () => {
        const bell = document.getElementById('notif-bell');
        expect(bell).not.toBeNull();
        expect(window._notifModule).toBeDefined();
    });
    
    test('Toggles panel open and closed', () => {
        window._notifModule.toggle();
        const panel = document.getElementById('notif-panel');
        expect(panel.classList.contains('notif-panel-open')).toBe(true);
    });

    // --- NEW HIGH-COVERAGE TESTS ---

    test('fetchAndRender populates list and updates badge', async () => {
        const mockNotifs = [
            { NotificationID: 1, Type: 'NEW_REPORT', Title: 'Pothole Alert', Message: 'Watch out', IsRead: false, CreatedAt: '2026-05-10T10:00:00Z' }
        ];
        fetch.mockResolvedValueOnce({ ok: true, json: async () => mockNotifs });
        
        await window._notifModule.refresh();
        
        const list = document.getElementById('notif-list');
        const badge = document.getElementById('notif-badge');
        
        expect(list.innerHTML).toContain('Pothole Alert');
        expect(badge.textContent).toBe('1');
        expect(badge.classList.contains('notif-badge-hidden')).toBe(false);
    });

    test('togglePause switches polling state and saves to localStorage', () => {
        window._notifModule.togglePause(); // Pause it
        
        expect(localStorage.getItem('notifPaused')).toBe('true');
        expect(document.getElementById('notif-pause-btn').textContent).toContain('Resume');
        expect(document.getElementById('notif-live-dot').classList.contains('notif-dot-paused')).toBe(true);
    });

    test('markRead triggers PUT API and updates UI', async () => {
        // Setup initial list
        document.getElementById('notif-list').innerHTML = `<li class="notif-item notif-unread" data-id="99"></li>`;
        
        fetch.mockResolvedValueOnce({ ok: true });
        
        await window._notifModule.markRead(99, null);
        
        expect(fetch).toHaveBeenCalledWith('/api/notifications/99/read', expect.objectContaining({ method: 'PUT' }));
        const item = document.querySelector('[data-id="99"]');
        expect(item.classList.contains('notif-unread')).toBe(false);
    });

    test('markAllRead triggers PUT API and clears all unread classes', async () => {
        document.getElementById('notif-list').innerHTML = `
            <li class="notif-item notif-unread" data-id="1"></li>
            <li class="notif-item notif-unread" data-id="2"></li>
        `;
        
        fetch.mockResolvedValueOnce({ ok: true });
        
        await window._notifModule.markAllRead();
        
        expect(fetch).toHaveBeenCalledWith('/api/notifications/123/read-all', expect.objectContaining({ method: 'PUT' }));
        const unreadItems = document.querySelectorAll('.notif-unread');
        expect(unreadItems.length).toBe(0);
    });

    test('deleteOne triggers DELETE API and starts exit animation', async () => {
        document.getElementById('notif-list').innerHTML = `<li class="notif-item" data-id="55"></li>`;
        
        fetch.mockResolvedValueOnce({ ok: true });
        
        await window._notifModule.deleteOne(55);
        
        expect(fetch).toHaveBeenCalledWith('/api/notifications/55', expect.objectContaining({ method: 'DELETE' }));
        const item = document.querySelector('[data-id="55"]');
        expect(item.classList.contains('notif-item-exit')).toBe(true);
    });

    test('clearAll triggers DELETE API and empties list', async () => {
        window.confirm = jest.fn(() => true); // User clicks OK
        fetch.mockResolvedValueOnce({ ok: true });
        
        await window._notifModule.clearAll();
        
        expect(fetch).toHaveBeenCalledWith('/api/notifications/123/clear-all', expect.objectContaining({ method: 'DELETE' }));
        const list = document.getElementById('notif-list');
        expect(list.innerHTML).toContain('All clear');
    });

    test('openNotifReportModal fetches report data and creates dialog safely', async () => {
        // Provide mock responses for the parallel fetches inside the modal
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

    test('closeReportModal closes and clears the dialog', () => {
        // Create a mock dialog in the DOM
        const dialog = document.createElement('dialog');
        dialog.id = 'notif-report-modal';
        dialog.innerHTML = '<p>Some content</p>';
        document.body.appendChild(dialog);

        window._notifModule.closeReportModal();

        expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
        expect(dialog.innerHTML).toBe('');
    });

    test('openImageFullscreen injects viewer into DOM', () => {
        window._notifModule.openImageFullscreen('data:image/png;base64,123');
        
        // Find the injected image tag
        const img = document.querySelector('img[src="data:image/png;base64,123"]');
        expect(img).not.toBeNull();
        
        // Test clicking it removes it
        img.parentElement.click();
        expect(document.querySelector('img[src="data:image/png;base64,123"]')).toBeNull();
    });
});