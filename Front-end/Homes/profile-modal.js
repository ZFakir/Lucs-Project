// profile-modal.js
import { withHammerLoader } from "./loaderUtils";

(() => {
    // Inject styles
    function injectStyles() {
        if (document.getElementById('profile-modal-styles')) return;
        const style = document.createElement('style');
        style.id = 'profile-modal-styles';
        style.textContent = `
            .pm-overlay {
                position: fixed; inset: 0; z-index: 99999;
                background: rgba(0,0,0,0.85);
                backdrop-filter: blur(8px);
                display: flex; align-items: center; justify-content: center;
                padding: 24px;
                opacity: 0; transition: opacity 0.2s ease;
                pointer-events: none;
            }
            .pm-overlay.pm-open {
                opacity: 1; pointer-events: all;
            }
            .pm-card {
                background: #1a1a1a;
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 20px;
                width: 100%; max-width: 480px;
                max-height: 90vh; overflow-y: auto;
                padding: 36px;
                transform: translateY(12px) scale(0.97);
                transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1);
                position: relative;
            }
            .pm-overlay.pm-open .pm-card {
                transform: translateY(0) scale(1);
            }
            .pm-avatar-wrap {
                display: flex; flex-direction: column; align-items: center;
                gap: 12px; margin-bottom: 28px;
            }
            .pm-avatar {
                width: 96px; height: 96px; border-radius: 50%;
                object-fit: cover;
                border: 3px solid #ff8c00;
                cursor: pointer;
                transition: opacity 0.2s;
            }
            .pm-avatar:hover { opacity: 0.8; }
            .pm-avatar-hint {
                font-size: 9px; font-weight: 800; text-transform: uppercase;
                letter-spacing: 0.12em; color: #4b5563;
            }
            .pm-title {
                font-size: 22px; font-weight: 900; color: #e2e2e2;
                letter-spacing: -0.02em; margin: 0 0 4px;
            }
            .pm-subtitle {
                font-size: 10px; font-weight: 700; text-transform: uppercase;
                letter-spacing: 0.12em; color: #4b5563; margin-bottom: 24px;
            }
            .pm-divider {
                border: none; border-top: 1px solid rgba(255,255,255,0.06);
                margin: 0 0 24px;
            }
            .pm-field { margin-bottom: 18px; }
            .pm-label {
                display: block; font-size: 9px; font-weight: 900;
                text-transform: uppercase; letter-spacing: 0.14em;
                color: #737373; margin-bottom: 6px;
            }
            .pm-input {
                width: 100%; background: rgba(255,255,255,0.04);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 10px; padding: 12px 14px;
                color: #e2e2e2; font-size: 13px; font-family: inherit;
                outline: none; transition: border-color 0.15s;
                box-sizing: border-box;
            }
            .pm-input:focus { border-color: #ff8c00; }
            .pm-input:disabled {
                opacity: 0.4; cursor: not-allowed;
            }
            .pm-input-hint {
                font-size: 9px; color: #4b5563; margin-top: 4px;
                font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em;
            }
            .pm-footer {
                display: flex; gap: 10px; margin-top: 28px;
                padding-top: 20px;
                border-top: 1px solid rgba(255,255,255,0.06);
            }
            .pm-btn-save {
                flex: 1; padding: 14px;
                background: #ff8c00; color: #000;
                border: none; border-radius: 10px;
                font-size: 10px; font-weight: 900;
                text-transform: uppercase; letter-spacing: 0.14em;
                cursor: pointer; transition: background 0.15s;
            }
            .pm-btn-save:hover { background: #ffb77d; }
            .pm-btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
            .pm-btn-cancel {
                padding: 14px 20px;
                background: rgba(255,255,255,0.04);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 10px; color: #9ca3af;
                font-size: 10px; font-weight: 900;
                text-transform: uppercase; letter-spacing: 0.14em;
                cursor: pointer; transition: all 0.15s;
            }
            .pm-btn-cancel:hover { background: rgba(255,255,255,0.08); color: #e2e2e2; }
            .pm-close {
                position: absolute; top: 16px; right: 16px;
                background: rgba(255,255,255,0.06);
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 8px; color: #9ca3af;
                width: 32px; height: 32px;
                cursor: pointer; font-size: 14px;
                display: flex; align-items: center; justify-content: center;
                transition: all 0.15s;
            }
            .pm-close:hover { color: #e2e2e2; background: rgba(255,255,255,0.12); }
            .pm-toast {
                position: fixed; bottom: 24px; left: 50%;
                transform: translateX(-50%) translateY(10px);
                background: #1f1f1f; border: 1px solid rgba(255,255,255,0.1);
                border-radius: 12px; padding: 12px 20px;
                font-size: 11px; font-weight: 800;
                text-transform: uppercase; letter-spacing: 0.1em;
                color: #e2e2e2; z-index: 999999;
                animation: pm-toast-in 0.3s ease forwards;
            }
            .pm-toast.pm-toast-success { border-color: rgba(74,222,128,0.3); color: #4ade80; }
            .pm-toast.pm-toast-error { border-color: rgba(239,68,68,0.3); color: #fca5a5; }
            @keyframes pm-toast-in {
                from { opacity: 0; transform: translateX(-50%) translateY(10px); }
                to   { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
        `;
        document.head.appendChild(style);
    }

    // State
    let overlay = null;
    let currentProfilePic = null;
    let newProfilePicBase64 = null;

    //  Detect role and ID 
    function getIdentity() {
        const role = localStorage.getItem('role');
        const workerId = localStorage.getItem('workerId');
        const residentId = localStorage.getItem('residentId');

        if (role === 'admin' || role === 'worker') {
            return { type: 'worker', id: workerId };
        } else if (residentId) {
            return { type: 'resident', id: residentId };
        }
        return null;
    }

    //  Fetch profile data 
    async function fetchProfile(identity) {
        const url = identity.type === 'worker'
            ? `/api/workers/${identity.id}/profile`
            : `/api/residents/${identity.id}/profile`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch profile');
        return res.json();
    }

    //  Save profile 
    async function saveProfile(identity, data) {
        await withHammerLoader(async () => {
            const url = identity.type === 'worker'
                ? `/api/workers/${identity.id}/profile`
                : `/api/residents/${identity.id}/profile`;
            const res = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to save profile');
            return res.json();
        });
    }

    // Show toast 
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `pm-toast pm-toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // Open modal 
    async function openProfileModal() {
        const identity = getIdentity();
        if (!identity || !identity.id) {
            showToast('Not logged in', 'error');
            return;
        }

        injectStyles();

        // Create overlay
        overlay = document.createElement('div');
        overlay.className = 'pm-overlay';
        overlay.innerHTML = `
            <div class="pm-card">
                <button class="pm-close" onclick="window._profileModal.close()">✕</button>
                <div class="pm-avatar-wrap">
                    <img id="pm-avatar-img" class="pm-avatar" src="" alt="Profile picture" 
                         onclick="document.getElementById('pm-pic-input').click()" 
                         title="Click to change photo"/>
                    <input type="file" id="pm-pic-input" accept="image/*" style="display:none"/>
                    <span class="pm-avatar-hint">Click photo to change</span>
                </div>
                <h2 class="pm-title" id="pm-display-name">Loading...</h2>
                <p class="pm-subtitle" id="pm-display-sub">—</p>
                <hr class="pm-divider">
                <div id="pm-fields"></div>
                <div class="pm-footer">
                    <button class="pm-btn-save" id="pm-save-btn" onclick="window._profileModal.save()">
                        Save Changes
                    </button>
                    <button class="pm-btn-cancel" onclick="window._profileModal.close()">Cancel</button>
                </div>
            </div>`;

        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('pm-open'));

        // Close on backdrop click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });

        // Load profile
        try {
            const profile = await fetchProfile(identity);
            populateModal(profile, identity);

            // Profile pic file input
            document.getElementById('pm-pic-input').addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    newProfilePicBase64 = ev.target.result;
                    document.getElementById('pm-avatar-img').src = newProfilePicBase64;
                };
                reader.readAsDataURL(file);
            });

        } catch (err) {
            document.getElementById('pm-fields').innerHTML = `
                <p style="color:#fca5a5;font-size:11px;text-align:center;">Failed to load profile</p>`;
        }
    }

    // Populate fields based on role 
    function populateModal(profile, identity) {
        // Avatar
        const avatarImg = document.getElementById('pm-avatar-img');
        if (profile.ProfilePicture) {
            avatarImg.src = profile.ProfilePicture;
            currentProfilePic = profile.ProfilePicture;
        } else {
            const name = profile.FirstName
                ? `${profile.FirstName}+${profile.LastName}`
                : profile.Username || 'User';
            avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=353535&color=FF8C00&bold=true&size=128`;
        }

        // Name and subtitle
        if (identity.type === 'worker') {
            document.getElementById('pm-display-name').textContent =
                `${profile.FirstName || ''} ${profile.LastName || ''}`.trim() || 'Worker';
            document.getElementById('pm-display-sub').textContent = `Employee ID: ${profile.EmployeeID}`;
        } else {
            document.getElementById('pm-display-name').textContent = profile.Username || 'Resident';
            document.getElementById('pm-display-sub').textContent = `Resident ID: ${profile.ResidentID}`;
        }

        // Fields
        const fieldsEl = document.getElementById('pm-fields');

        if (identity.type === 'worker') {
            fieldsEl.innerHTML = `
                <div class="pm-field">
                    <label class="pm-label">First Name</label>
                    <input class="pm-input" id="pm-firstname" type="text" value="${profile.FirstName || ''}" placeholder="First name"/>
                </div>
                <div class="pm-field">
                    <label class="pm-label">Last Name</label>
                    <input class="pm-input" id="pm-lastname" type="text" value="${profile.LastName || ''}" placeholder="Last name"/>
                </div>
                <div class="pm-field">
                <label class="pm-label">Email Address</label>
                <input class="pm-input" id="pm-email" type="email" value="${profile.Email || ''}" placeholder="email@example.com"/>
                <p class="pm-input-hint">⚠ This changes your notification email only — your Google login is unchanged</p>
                </div>
                <div class="pm-field">
                    <label class="pm-label">Cell Number</label>
                    <input class="pm-input" id="pm-cell" type="tel" value="${profile.Cell || ''}" placeholder="+27 000 000 0000"/>
                </div>`;
        } else {
            fieldsEl.innerHTML = `
                <div class="pm-field">
                    <label class="pm-label">Username</label>
                    <input class="pm-input" id="pm-username" type="text" value="${profile.Username || ''}" placeholder="Your display name"/>
                </div>
                <div class="pm-field">
                 <label class="pm-label">Email Address</label>
                <input class="pm-input" id="pm-email" type="email" value="${profile.Email || ''}" placeholder="email@example.com"/>
                <p class="pm-input-hint">⚠ This changes your notification email only — your Google login is unchanged</p>
                </div>
                <div class="pm-field">
                    <label class="pm-label">Cell Number</label>
                    <input class="pm-input" id="pm-cell" type="tel" value="${profile.CellphoneNumber || ''}" placeholder="+27 000 000 0000"/>
                </div>`;
        }
    }

    // Save 
    async function saveChanges() {
        await withHammerLoader (async () => {
        const identity = getIdentity();
        const saveBtn = document.getElementById('pm-save-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
            let data = {};

            if (identity.type === 'worker') {
                data = {
                    FirstName: document.getElementById('pm-firstname').value.trim(),
                    LastName: document.getElementById('pm-lastname').value.trim(),
                    Email: document.getElementById('pm-email').value.trim(),
                    Cell: document.getElementById('pm-cell').value.trim(),
                };
            } else {
                data = {
                    Username: document.getElementById('pm-username').value.trim(),
                    Email: document.getElementById('pm-email').value.trim(),
                    CellphoneNumber: document.getElementById('pm-cell').value.trim(),
                };
            }

            if (newProfilePicBase64) {
                data.ProfilePicture = newProfilePicBase64;
            }

            await saveProfile(identity, data);

            // Update localStorage name if worker
            if (identity.type === 'worker' && data.FirstName) {
                localStorage.setItem('workerName', data.FirstName);
            }

            showToast('Profile updated successfully', 'success');
            closeModal();

            // Refresh the profile pic in the header if it changed
            if (newProfilePicBase64) {
                const headerImg = document.querySelector('header img[alt="User profile photo"], header img[alt="Admin Profile Avatar"]');
                if (headerImg) headerImg.src = newProfilePicBase64;
            }

        } catch (err) {
            showToast('Failed to save — try again', 'error');
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Changes';
        }
        
    });
}

    // Close 
    function closeModal() {
        if (!overlay) return;
        overlay.classList.remove('pm-open');
        setTimeout(() => {
            overlay.remove();
            overlay = null;
            newProfilePicBase64 = null;
        }, 200);
    }

    // Public API 
    window._profileModal = {
        open: openProfileModal,
        close: closeModal,
        save: saveChanges
    };

    //  Auto-wire profile picture clicks in headers 
    function wireProfileTriggers() {
    // Check for specifically identified profile images
    const triggers = [
        document.getElementById('admin-profile-pic'),
        document.querySelector('figure img[alt="User profile photo"]'),
        document.querySelector('figure img[alt="Admin Profile Avatar"]')
    ];

    triggers.forEach(img => {
        if (img) {
            img.style.cursor = 'pointer';
            img.title = 'Edit Profile';
            // Use the parent figure or the image itself as the click trigger
            img.parentElement.addEventListener('click', openProfileModal);
        }
    });
}

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wireProfileTriggers);
    } else {
        wireProfileTriggers();
    }
})();


// EXPORTS FOR JEST TESTING
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {}; 
}