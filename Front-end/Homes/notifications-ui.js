
(() => {
    // Config 
    const POLL_INTERVAL_MS = 30_000; // Poll every 30 seconds
    let pollTimer = null;
    let isPaused = false;
    let currentRecipientId = null;

    //Bootstrap: runs after DOM is ready 
    function init() {
    const role = localStorage.getItem('role');
    const workerId = localStorage.getItem('workerId');
    const residentId = localStorage.getItem('residentId');

    if (role === 'admin') {
        currentRecipientId = 'admin';
    } else if (role === 'worker' && workerId) {
        currentRecipientId = workerId;
    } else if (role === 'resident' && residentId) {
        currentRecipientId = residentId;
    } else {
        return;
    }

    // Restore paused state from previous session
    isPaused = localStorage.getItem('notifPaused') === 'true';

    injectStyles();
    renderNotificationShell();

    // Sync the button state if paused
    setTimeout(() => {
        const btn = document.getElementById('notif-pause-btn');
        const dot = document.getElementById('notif-live-dot');
        if (isPaused) {
            if (btn) btn.textContent = '▶ Resume';
            if (dot) dot.classList.add('notif-dot-paused');
        }
    }, 100);

    fetchAndRender();
    startPolling();
}

    //Polling
    function startPolling() {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = setInterval(() => {
            if (!isPaused) fetchAndRender();
        }, POLL_INTERVAL_MS);
    }

    function stopPolling() {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    // Fetch notifications from backend 
    async function fetchAndRender() {
        try {
            const res = await fetch(`/api/notifications/${currentRecipientId}`);
            if (!res.ok) return;
            const notifications = await res.json();
            renderList(notifications);
            updateBadge(notifications.filter(n => !n.IsRead).length);
        } catch (err) {
            console.warn('[Notifications] Fetch failed:', err.message);
        }
    }

    // Render the notification list 
    function renderList(notifications) {
        const list = document.getElementById('notif-list');
        if (!list) return;

        if (notifications.length === 0) {
            list.innerHTML = `
                <li class="notif-empty">
                    <span class="notif-empty-icon">◎</span>
                    <p>All clear — no alerts</p>
                </li>`;
            return;
        }

        list.innerHTML = notifications.map(n => {
            const time = formatTime(n.CreatedAt);
            const unreadClass = n.IsRead ? '' : 'notif-unread';
            const icon = typeIcon(n.Type);
            const accentClass = typeAccent(n.Type);
            
            // Extract ward ID and issue from the related report
            const wardId = n.Report?.WardID ? `Ward ${n.Report.WardID}` : '';
            const issue = n.Report?.IssueType || '';
            const details = [wardId, issue].filter(Boolean).join(' • ');

            return `
            <li class="notif-item ${unreadClass}" data-id="${n.NotificationID}">
                <div class="notif-accent ${accentClass}"></div>
                <div class="notif-icon-wrap ${accentClass}">
                    <span>${icon}</span>
                </div>
                <div class="notif-body" onclick="window._notifModule.markRead(${n.NotificationID}, ${n.ReportID || 'null'})">
                    <p class="notif-title">${escHtml(n.Title)}</p>
                    ${details ? `<p class="notif-details" style="font-size:0.85em;color:#aaa;margin:4px 0;">${escHtml(details)}</p>` : ''}
                    <p class="notif-msg">${escHtml(n.Message)}</p>
                    <p class="notif-time">${time}</p>
                </div>
                <button class="notif-delete-btn" 
                        onclick="window._notifModule.deleteOne(${n.NotificationID})"
                        title="Dismiss">✕</button>
            </li>`;
        }).join('');
    }

    function openImageFullscreen(src) {
    const viewer = document.createElement('div');
    viewer.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.97);display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
    viewer.innerHTML = `<img src="${src}" style="max-width:95vw;max-height:95vh;object-fit:contain;border-radius:8px;" />`;
    viewer.onclick = () => viewer.remove();
    document.body.appendChild(viewer);
}

    // Badge count
    function updateBadge(count) {
        const badge = document.getElementById('notif-badge');
        if (!badge) return;
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.classList.remove('notif-badge-hidden');
        } else {
            badge.classList.add('notif-badge-hidden');
        }
    }

    // Toggle panel open/close 
    function togglePanel() {
        const panel = document.getElementById('notif-panel');
        if (!panel) return;
        const isOpen = panel.classList.toggle('notif-panel-open');

        if (isOpen) {
            fetchAndRender(); // Always fresh when opened
            // Close when clicking outside
            setTimeout(() => {
                document.addEventListener('click', outsideClickClose, { once: true });
            }, 0);
        }
    }

    function outsideClickClose(e) {
        const panel = document.getElementById('notif-panel');
        const bell = document.getElementById('notif-bell');
        if (panel && !panel.contains(e.target) && e.target !== bell) {
            panel.classList.remove('notif-panel-open');
        }
    }

    // Mark single as read 
    async function markRead(notifId, reportId) {
    try {
        await fetch(`/api/notifications/${notifId}/read`, { method: 'PUT' });
        const item = document.querySelector(`[data-id="${notifId}"]`);
        if (item) item.classList.remove('notif-unread');
        const unreadCount = document.querySelectorAll('.notif-unread').length;
        updateBadge(unreadCount);

        // If this notification links to a report, open the detail modal
        if (reportId) {
            openNotifReportModal(reportId);
        }
    } catch (err) {
        console.warn('[Notifications] markRead failed:', err);
    }
}

    // Mark all read 
    async function markAllRead() {
        try {
            await fetch(`/api/notifications/${currentRecipientId}/read-all`, { method: 'PUT' });
            document.querySelectorAll('.notif-unread').forEach(el => el.classList.remove('notif-unread'));
            updateBadge(0);
        } catch (err) {
            console.warn('[Notifications] markAllRead failed:', err);
        }
    }

    // Delete one notification 
    async function deleteOne(notifId) {
        try {
            await fetch(`/api/notifications/${notifId}`, { method: 'DELETE' });
            const item = document.querySelector(`[data-id="${notifId}"]`);
            if (item) {
                item.classList.add('notif-item-exit');
                setTimeout(() => {
                    item.remove();
                    const remaining = document.querySelectorAll('.notif-item').length;
                    if (remaining === 0) renderList([]);
                    const unread = document.querySelectorAll('.notif-unread').length;
                    updateBadge(unread);
                }, 280);
            }
        } catch (err) {
            console.warn('[Notifications] deleteOne failed:', err);
        }
    }

    // Clear all notifications 
    async function clearAll() {
        if (!confirm('Clear all notifications? This cannot be undone.')) return;
        try {
            await fetch(`/api/notifications/${currentRecipientId}/clear-all`, { method: 'DELETE' });
            renderList([]);
            updateBadge(0);
        } catch (err) {
            console.warn('[Notifications] clearAll failed:', err);
        }
    }

    //  Pause / Resume polling 
    function togglePause() {
    isPaused = !isPaused;
    // Save pause state so other pages and the backend know
    localStorage.setItem('notifPaused', isPaused ? 'true' : 'false');
    
    const btn = document.getElementById('notif-pause-btn');
    if (btn) {
        btn.textContent = isPaused ? '▶ Resume' : '⏸ Pause';
        btn.title = isPaused ? 'Resume live alerts' : 'Pause live alerts';
    }
    const indicator = document.getElementById('notif-live-dot');
    if (indicator) indicator.classList.toggle('notif-dot-paused', isPaused);
}

  function renderNotificationShell() {
    // Remove old notification elements if present
    const oldDropdown = document.getElementById('notification-dropdown');
    if (oldDropdown) oldDropdown.remove();
    const oldBell = document.querySelector('button[onclick="toggleNotifications()"]');
    if (oldBell) oldBell.remove();

    // Inject the panel into the existing #notif-shell anchor in the HTML
    const anchor = document.getElementById('notif-shell');
    if (!anchor) {
        console.warn('[Notifications] No #notif-shell element found in HTML.');
        return;
    }

    anchor.innerHTML = `
        <button id="notif-bell" class="notif-bell-btn" onclick="window._notifModule.toggle()" 
                title="Notifications" aria-label="Open notifications">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span id="notif-badge" class="notif-badge notif-badge-hidden">0</span>
        </button>

        <div id="notif-panel" class="notif-panel" role="dialog" aria-label="Notifications">
            <header class="notif-header">
                <div class="notif-header-left">
                    <span id="notif-live-dot" class="notif-live-dot" title="Live alerts active"></span>
                    <h3 class="notif-heading">Alerts</h3>
                </div>
                <div class="notif-header-actions">
                    <button id="notif-pause-btn" class="notif-action-btn" 
                            onclick="window._notifModule.togglePause()" title="Pause live alerts">
                        ⏸ Pause
                    </button>
                    <button class="notif-action-btn" 
                            onclick="window._notifModule.markAllRead()" title="Mark all as read">
                        ✓ Read all
                    </button>
                    <button class="notif-action-btn notif-danger-btn" 
                            onclick="window._notifModule.clearAll()" title="Delete all">
                        ✕ Clear all
                    </button>
                </div>
            </header>

            <ul id="notif-list" class="notif-list">
                <li class="notif-empty">
                    <span class="notif-empty-icon">◎</span>
                    <p>Loading alerts...</p>
                </li>
            </ul>

            <footer class="notif-footer">
                <span class="notif-footer-text">Syncing every 30s</span>
            </footer>
        </div>
    `;
}

    //  CSS injection 
    function injectStyles() {
        if (document.getElementById('notif-styles')) return;
        const style = document.createElement('style');
        style.id = 'notif-styles';
        style.textContent = `
            /* ── Shell & Bell ── */
            .notif-shell {
                position: relative;
                display: flex;
                align-items: center;
            }

            .notif-bell-btn {
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 40px;
                height: 40px;
                border-radius: 10px;
                border: 1px solid rgba(255,255,255,0.07);
                background: rgba(255,255,255,0.04);
                color: #a3a3a3;
                cursor: pointer;
                transition: background 0.2s, color 0.2s, border-color 0.2s;
            }
            .notif-bell-btn:hover {
                background: rgba(255,183,125,0.12);
                color: #ffb77d;
                border-color: rgba(255,183,125,0.3);
            }

            /* ── Unread Badge ── */
            .notif-badge {
                position: absolute;
                top: 4px;
                right: 4px;
                min-width: 16px;
                height: 16px;
                padding: 0 4px;
                border-radius: 99px;
                background: #ff8c00;
                color: #000;
                font-size: 9px;
                font-weight: 900;
                line-height: 16px;
                text-align: center;
                border: 2px solid #131313;
                transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            .notif-badge-hidden {
                transform: scale(0);
                pointer-events: none;
            }

            /* ── Panel ── */
            .notif-panel {
                position: absolute;
                top: calc(100% + 12px);
                right: 0;
                width: 380px;
                max-height: 520px;
                background: #1a1a1a;
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 16px;
                box-shadow: 0 24px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,183,125,0.06);
                overflow: hidden;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                opacity: 0;
                transform: translateY(-8px) scale(0.97);
                pointer-events: none;
                transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
                transform-origin: top right;
            }
            .notif-panel-open {
                opacity: 1;
                transform: translateY(0) scale(1);
                pointer-events: all;
            }

            /* ── Header ── */
            .notif-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 14px 16px 10px;
                border-bottom: 1px solid rgba(255,255,255,0.06);
                background: rgba(255,255,255,0.02);
                gap: 8px;
                flex-wrap: wrap;
            }
            .notif-header-left {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .notif-heading {
                font-size: 11px;
                font-weight: 900;
                text-transform: uppercase;
                letter-spacing: 0.15em;
                color: #e2e2e2;
                margin: 0;
            }

            /* ── Live dot ── */
            .notif-live-dot {
                width: 7px;
                height: 7px;
                border-radius: 50%;
                background: #4ade80;
                box-shadow: 0 0 6px #4ade80;
                animation: notif-pulse 2s ease-in-out infinite;
                flex-shrink: 0;
            }
            .notif-dot-paused {
                background: #6b7280;
                box-shadow: none;
                animation: none;
            }
            @keyframes notif-pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.4; }
            }

            /* ── Header action buttons ── */
            .notif-header-actions {
                display: flex;
                gap: 4px;
                flex-wrap: wrap;
            }
            .notif-action-btn {
                font-size: 9px;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.08em;
                padding: 4px 8px;
                border-radius: 6px;
                border: 1px solid rgba(255,255,255,0.08);
                background: rgba(255,255,255,0.04);
                color: #a3a3a3;
                cursor: pointer;
                transition: all 0.15s;
                white-space: nowrap;
            }
            .notif-action-btn:hover {
                background: rgba(255,255,255,0.1);
                color: #e2e2e2;
                border-color: rgba(255,255,255,0.15);
            }
            .notif-danger-btn:hover {
                background: rgba(220, 38, 38, 0.2);
                color: #fca5a5;
                border-color: rgba(220,38,38,0.4);
            }

            /* ── List ── */
            .notif-list {
                list-style: none;
                margin: 0;
                padding: 6px;
                overflow-y: auto;
                flex: 1;
                scrollbar-width: thin;
                scrollbar-color: rgba(255,255,255,0.1) transparent;
            }

            /* ── Empty state ── */
            .notif-empty {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 48px 24px;
                gap: 10px;
                color: #4b5563;
            }
            .notif-empty-icon {
                font-size: 28px;
                opacity: 0.4;
            }
            .notif-empty p {
                font-size: 10px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.15em;
                margin: 0;
            }

            /* ── Individual item ── */
            .notif-item {
                display: flex;
                align-items: flex-start;
                gap: 10px;
                padding: 10px 10px 10px 6px;
                border-radius: 10px;
                margin-bottom: 3px;
                position: relative;
                cursor: default;
                transition: background 0.15s;
                overflow: hidden;
            }
            .notif-item:hover {
                background: rgba(255,255,255,0.04);
            }
            .notif-unread {
                background: rgba(255,183,125,0.05);
            }
            .notif-unread .notif-title {
                color: #ffb77d !important;
            }

            /* Exit animation */
            .notif-item-exit {
                animation: notif-exit 0.28s ease forwards;
            }
            @keyframes notif-exit {
                to { opacity: 0; transform: translateX(20px); max-height: 0; margin: 0; padding: 0; }
            }

            /* ── Left accent bar ── */
            .notif-accent {
                position: absolute;
                left: 0;
                top: 8px;
                bottom: 8px;
                width: 2px;
                border-radius: 2px;
            }

            /* ── Type icon ── */
            .notif-icon-wrap {
                width: 30px;
                height: 30px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 13px;
                flex-shrink: 0;
                margin-left: 8px;
            }

            /* ── Accent colours by type ── */
            .notif-accent-declined { background: #ef4444; }
            .notif-accent-new-report { background: #ff8c00; }
            .notif-accent-assigned { background: #22d3ee; }
            .notif-accent-default { background: #6b7280; }
            .notif-accent-completed { background: #4ade80; }


            .notif-icon-declined { background: rgba(239,68,68,0.12); color: #fca5a5; }
            .notif-icon-new-report { background: rgba(255,140,0,0.12); color: #ffb77d; }
            .notif-icon-assigned { background: rgba(34,211,238,0.12); color: #7dd3fc; }
            .notif-icon-default { background: rgba(107,114,128,0.12); color: #9ca3af; }
            .notif-icon-completed { background: rgba(74,222,128,0.12); color: #4ade80; }

            /* ── Body text ── */
            .notif-body {
                flex: 1;
                min-width: 0;
                cursor: pointer;
            }
            .notif-title {
                font-size: 11px;
                font-weight: 800;
                color: #d4d4d4;
                margin: 0 0 3px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .notif-msg {
                font-size: 10px;
                color: #737373;
                margin: 0 0 4px;
                line-height: 1.5;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }
            .notif-time {
                font-size: 9px;
                color: #4b5563;
                margin: 0;
                font-weight: 600;
                letter-spacing: 0.05em;
                text-transform: uppercase;
            }

            /* ── Delete button ── */
            .notif-delete-btn {
                flex-shrink: 0;
                width: 22px;
                height: 22px;
                border-radius: 6px;
                border: 1px solid transparent;
                background: transparent;
                color: #4b5563;
                font-size: 10px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.15s;
                margin-top: 2px;
            }
            .notif-delete-btn:hover {
                background: rgba(220,38,38,0.15);
                color: #fca5a5;
                border-color: rgba(220,38,38,0.3);
            }

            /* ── Footer ── */
            .notif-footer {
                padding: 8px 16px;
                border-top: 1px solid rgba(255,255,255,0.05);
                background: rgba(0,0,0,0.2);
            }
            .notif-footer-text {
                font-size: 9px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.1em;
                color: #374151;
            }

            /* ── Toast popup (fires on new notification) ── */
            .notif-toast {
                position: fixed;
                bottom: 24px;
                right: 24px;
                width: 320px;
                background: #1f1f1f;
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 14px;
                padding: 14px 16px;
                display: flex;
                align-items: flex-start;
                gap: 12px;
                box-shadow: 0 16px 40px rgba(0,0,0,0.6);
                z-index: 99999;
                animation: notif-toast-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
            }
            .notif-toast-exit {
                animation: notif-toast-out 0.3s ease forwards;
            }
            @keyframes notif-toast-in {
                from { opacity: 0; transform: translateY(20px) scale(0.95); }
                to   { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes notif-toast-out {
                to { opacity: 0; transform: translateY(10px); }
            }
            .notif-toast-icon {
                font-size: 18px;
                flex-shrink: 0;
                margin-top: 1px;
            }
            .notif-toast-title {
                font-size: 11px;
                font-weight: 800;
                color: #e2e2e2;
                margin: 0 0 3px;
            }
            .notif-toast-msg {
                font-size: 10px;
                color: #737373;
                margin: 0;
                line-height: 1.4;
            }
            .notif-toast-close {
                position: absolute;
                top: 10px;
                right: 12px;
                background: none;
                border: none;
                color: #4b5563;
                font-size: 12px;
                cursor: pointer;
                padding: 2px;
            }
            .notif-toast-close:hover { color: #e2e2e2; }
        `;
        document.head.appendChild(style);
    }

    // Toast popup for real-time feel
    let lastKnownIds = new Set();
    let isFirstFetch = true;

    async function fetchAndRender() {
        try {
            const res = await fetch(`/api/notifications/${currentRecipientId}`);
            if (!res.ok) return;
            const notifications = await res.json();

            // Show toast for any brand-new notification since last poll
            if (!isFirstFetch && !isPaused) {
                notifications.forEach(n => {
                    if (!lastKnownIds.has(n.NotificationID) && !n.IsRead) {
                        showToast(n);
                    }
                });
            }
            lastKnownIds = new Set(notifications.map(n => n.NotificationID));
            isFirstFetch = false;

            renderList(notifications);
            updateBadge(notifications.filter(n => !n.IsRead).length);
        } catch (err) {
            console.warn('[Notifications] Fetch failed:', err.message);
        }
    }

    function showToast(notification) {
        const toast = document.createElement('div');
        toast.className = 'notif-toast';
        toast.innerHTML = `
            <div class="notif-toast-icon">${typeIcon(notification.Type)}</div>
            <div>
                <p class="notif-toast-title">${escHtml(notification.Title)}</p>
                <p class="notif-toast-msg">${escHtml(notification.Message)}</p>
            </div>
            <button class="notif-toast-close" onclick="this.closest('.notif-toast').remove()">✕</button>
        `;
        document.body.appendChild(toast);

        // Auto-dismiss after 6 seconds
        setTimeout(() => {
            toast.classList.add('notif-toast-exit');
            setTimeout(() => toast.remove(), 300);
        }, 6000);
    }

    //  Helpers 
    function typeIcon(type) {
        const icons = {
            'TASK_DECLINED': '⚠',
            'NEW_REPORT':    '📋',
            'TASK_ASSIGNED': '📌',
            'REPORT_COMPLETED':  '✅',
        };
        return icons[type] || '🔔';
    }

    function typeAccent(type) {
        const map = {
            'TASK_DECLINED': 'notif-accent-declined notif-icon-declined',
            'NEW_REPORT':    'notif-accent-new-report notif-icon-new-report',
            'TASK_ASSIGNED': 'notif-accent-assigned notif-icon-assigned',
            'REPORT_COMPLETED': 'notif-accent-completed notif-icon-completed',
        };
        return map[type] || 'notif-accent-default notif-icon-default';
    }

    function formatTime(iso) {
        if (!iso) return '';
        const date = new Date(iso);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHrs = Math.floor(diffMins / 60);
        if (diffHrs < 24) return `${diffHrs}h ago`;
        return date.toLocaleDateString();
    }

    function escHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    async function openNotifReportModal(reportId) {
    // Close the notification panel first
    const panel = document.getElementById('notif-panel');
    if (panel) panel.classList.remove('notif-panel-open');

    // Create dialog if it doesn't exist
    let dialog = document.getElementById('notif-report-modal');
    if (!dialog) {
        dialog = document.createElement('dialog');
        dialog.id = 'notif-report-modal';
        // Add minimal reset styles for the <dialog> element itself
        dialog.style.cssText = 'border:none; background:transparent; padding:0; margin:0; width:100vw; height:100vh; max-width:none; max-height:none;';
        document.body.appendChild(dialog);
    }

    // Show native dialog backdrop
    dialog.showModal();

    // Show loading state
    dialog.innerHTML = `
        <section style="position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.92);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:24px;">
            <div style="background:#1a1a1a;border:1px solid rgba(255,255,255,0.08);border-radius:20px;width:100%;max-width:680px;padding:40px;">
                <p style="color:#737373;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;text-align:center;">Loading report details...</p>
            </div>
        </section>`;

    try {
        const [reportRes, imagesRes] = await Promise.all([
            fetch(`/api/reports/${reportId}`),
            fetch(`/api/report-images/report/${reportId}`)
        ]);

        const report = await reportRes.json();
        const images = await imagesRes.json();

        const priorityMap = { 1: { text: 'Critical', color: '#ef4444' }, 2: { text: 'High', color: '#f97316' }, 3: { text: 'Routine', color: '#3b82f6' } };
        const priority = priorityMap[report.Priority] || priorityMap[3];

        // Semantic Gallery using <figure> and <section>
        const galleryHtml = images.length > 0 ? `
            <section aria-label="Attached Evidence" style="margin-top:24px;">
                <header>
                    <p style="font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.15em;color:#737373;margin-bottom:12px;">
                        Attached Evidence (${images.length} photo${images.length > 1 ? 's' : ''})
                    </p>
                </header>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;">
                    ${images.map(img => `
                        <figure style="margin:0;border-radius:10px;overflow:hidden;aspect-ratio:1;background:#111;border:1px solid rgba(255,255,255,0.06);cursor:pointer;" 
                                onclick="window._notifModule.openImageFullscreen('data:${img.Type};base64,${img.base64}')">
                            <img src="data:${img.Type};base64,${img.base64}" 
                                 style="width:100%;height:100%;object-fit:cover;" 
                                 alt="Evidence for report #${report.ReportID}" />
                        </figure>
                    `).join('')}
                </div>
            </section>` : `
            <aside style="margin-top:24px;padding:20px;border:1px dashed rgba(255,255,255,0.08);border-radius:10px;text-align:center;">
                <p style="font-size:10px;color:#4b5563;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;">No photos attached</p>
            </aside>`;

        dialog.innerHTML = `
            <section style="position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.92);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:24px;">
                <article style="background:#1a1a1a;border:1px solid rgba(255,255,255,0.08);border-radius:20px;width:100%;max-width:680px;max-height:90vh;overflow-y:auto;padding:40px;position:relative;">
                    
                    <header>
                        <button onclick="window._notifModule.closeReportModal()" 
                                aria-label="Close modal"
                                style="position:absolute;top:16px;right:16px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#9ca3af;width:32px;height:32px;cursor:pointer;">
                            ✕
                        </button>
                        <p style="font-size:10px;font-family:monospace;color:#ff8c00;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 6px;">Report #${report.ReportID}</p>
                        <h2 style="font-size:28px;font-weight:900;color:#e2e2e2;margin:0 0 8px;letter-spacing:-0.02em;">${report.Type}</h2>
                        
                        <nav style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                            <mark style="padding:3px 10px;border-radius:6px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);font-size:10px;font-weight:800;text-transform:uppercase;color:#a3a3a3;">
                                Ward ${report.WardID || 'N/A'}
                            </mark>
                            <mark style="padding:3px 10px;border-radius:6px;font-size:10px;font-weight:800;text-transform:uppercase;color:${priority.color};background:${priority.color}20;border:1px solid ${priority.color}40;">
                                ${priority.text}
                            </mark>
                            <mark style="padding:3px 10px;border-radius:6px;background:rgba(255,140,0,0.1);border:1px solid rgba(255,140,0,0.3);font-size:10px;font-weight:800;text-transform:uppercase;color:#ff8c00;">
                                ${report.Progress || 'Pending'}
                            </mark>
                        </nav>
                    </header>

                    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:24px 0;">

                    <section aria-labelledby="briefing-title">
                        <h3 id="briefing-title" style="font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.15em;color:#737373;margin-bottom:8px;">Situation Briefing</h3>
                        <p style="color:#d4d4d4;font-size:14px;line-height:1.7;margin:0;">${report.Brief || 'No additional briefing provided.'}</p>
                    </section>

                    <footer style="margin-top:24px;">
                        <dl style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;padding:16px;background:rgba(255,255,255,0.02);border-radius:12px;border:1px solid rgba(255,255,255,0.05);margin:0 0 24px 0;">
                            <div>
                                <dt style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.12em;color:#4b5563;margin-bottom:4px;">Location</dt>
                                <dd style="font-size:13px;font-weight:700;color:#e2e2e2;margin:0;">Ward ${report.WardID || 'N/A'}</dd>
                            </div>
                            <div>
                                <dt style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.12em;color:#4b5563;margin-bottom:4px;">Logged</dt>
                                <dd style="font-size:13px;font-weight:700;color:#e2e2e2;margin:0;">${report.CreatedAt ? new Date(report.CreatedAt).toLocaleDateString() : 'N/A'}</dd>
                            </div>
                            <div>
                                <dt style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.12em;color:#4b5563;margin-bottom:4px;">Resolved</dt>
                                <dd style="font-size:13px;font-weight:700;color:#e2e2e2;margin:0;">${report.DateFulfilled ? new Date(report.DateFulfilled).toLocaleDateString() : '—'}</dd>
                            </div>
                        </dl>

                        ${galleryHtml}

                        <div style="margin-top:28px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.06);">
                            <button onclick="window._notifModule.closeReportModal()" 
                                    style="width:100%;padding:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;color:#9ca3af;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.15em;cursor:pointer;">
                                Close
                            </button>
                        </div>
                    </footer>
                </article>
            </section>`;

    } catch (err) {
        console.error('[Notif Modal] Error:', err);
        dialog.innerHTML = `
            <section style="position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;">
                <article style="background:#1a1a1a;border-radius:16px;padding:40px;text-align:center;">
                    <h2 style="color:#ef4444;font-size:12px;font-weight:700;text-transform:uppercase;">Error</h2>
                    <p style="color:#9ca3af; margin-top:8px;">Failed to load report details</p>
                    <button onclick="window._notifModule.closeReportModal()" style="margin-top:16px;padding:10px 24px;background:#333;border:none;border-radius:8px;color:#e2e2e2;cursor:pointer;">Close</button>
                </article>
            </section>`;
    }
}

function closeReportModal() {
    const dialog = document.getElementById('notif-report-modal');
    if (dialog) {
        dialog.close(); // Close the native dialog
        dialog.innerHTML = '';
    }
}

    // Public API 
    window._notifModule = {
        toggle: togglePanel,
        markRead,
        markAllRead,
        deleteOne,
        clearAll,
        togglePause,
        refresh: fetchAndRender,
        stop: stopPolling,
        openNotifReportModal,   
        closeReportModal,       
        openImageFullscreen 
    };

    // Start 
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();