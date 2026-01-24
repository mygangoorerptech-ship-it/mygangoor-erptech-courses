// Standalone Notification Bell for Static HTML Pages
(function() {
    'use strict';

    let notificationItems = [];
    let unreadCount = 0;
    let isOpen = false;

    // Create the notification bell button
    function createBellButton() {
        const bell = document.createElement('div');
        bell.id = 'notification-bell-button';
        bell.innerHTML = `
            <button id="bell-btn" style="position: fixed; bottom: 90px; right: 20px; z-index: 9998; 
                width: 48px; height: 48px; border-radius: 50%; border: 1px solid #d1d5db; 
                background: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); cursor: pointer;
                transition: all 0.2s; display: flex; align-items: center; justify-content: center;
                animation: pulse 2s infinite;" title="Notifications">
                <i class="fas fa-bell" style="font-size: 20px; color: #333;"></i>
                <span id="bell-badge" style="position: absolute; top: -2px; right: -2px; 
                    display: none; min-width: 20px; height: 20px; padding: 0 4px; 
                    background: #ef4444; color: white; border-radius: 10px; font-size: 10px; 
                    font-weight: bold; display: flex; align-items: center; justify-content: center;">0</span>
            </button>
            <style>
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }
                #bell-btn:hover { background: #f9fafb; }
                #bell-btn:active { background: #f3f4f6; }
            </style>
        `;
        return bell;
    }

    // Create the dropdown panel
    function createDropdown() {
        const panel = document.createElement('div');
        panel.id = 'notification-dropdown';
        panel.style.cssText = `
            position: fixed; bottom: 150px; right: 20px; width: 320px; 
            max-width: calc(100vw - 40px); max-height: 400px; border-radius: 16px;
            border: 1px solid #e5e7eb; background: white; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
            z-index: 9999; display: none; flex-direction: column; overflow: hidden;
        `;
        panel.innerHTML = `
            <div id="notif-content" style="overflow-y: auto; padding: 8px;">
                <div style="padding: 16px; text-align: center; color: #6b7280; font-size: 14px;">
                    Loading notifications...
                </div>
            </div>
        `;
        return panel;
    }

    // Create backdrop
    function createBackdrop() {
        const backdrop = document.createElement('div');
        backdrop.id = 'notification-backdrop';
        backdrop.style.cssText = `
            position: fixed; inset: 0; z-index: 9996; display: none;
        `;
        backdrop.addEventListener('click', closeNotifications);
        return backdrop;
    }

    // Fetch notifications
    function fetchNotifications() {
        return fetch('/api/notifications/list?unreadOnly=true&limit=20', {
            credentials: 'include'
        })
        .then(res => res.json())
        .then(data => {
            if (Array.isArray(data)) {
                notificationItems = data;
                unreadCount = data.filter(it => !it.readAt).length;
                updateBell();
                renderNotifications();
            }
        })
        .catch(err => console.error('Failed to fetch notifications:', err));
    }

    // Update bell badge
    function updateBell() {
        const badge = document.getElementById('bell-badge');
        const btn = document.getElementById('bell-btn');
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
            badge.style.display = 'flex';
            if (btn) {
                btn.style.animation = 'pulse 2s infinite';
            }
        } else {
            badge.style.display = 'none';
            if (btn) {
                btn.style.animation = 'none';
            }
        }
    }

    // Render notifications in dropdown
    function renderNotifications() {
        const content = document.getElementById('notif-content');
        if (!content) return;

        if (notificationItems.length === 0) {
            content.innerHTML = `
                <div style="padding: 16px; text-align: center; color: #6b7280; font-size: 14px;">
                    No new reminders
                </div>
            `;
            return;
        }

        content.innerHTML = notificationItems.map(it => `
            <div style="padding: 12px; border-bottom: 1px solid #f3f4f6;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                    <div style="flex: 1;">
                        <div style="font-size: 14px; font-weight: 600; color: #111827; margin-bottom: 4px;">
                            ${escapeHtml(it.title)}
                        </div>
                        <div style="font-size: 14px; color: #4b5563; margin-bottom: 8px;">
                            ${escapeHtml(it.body)}
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button onclick="handleNotificationClick('${it._id}', ${JSON.stringify(it).replace(/"/g, '&quot;')})" 
                                style="display: inline-flex; align-items: center; border-radius: 8px; 
                                border: 1px solid #d1d5db; padding: 4px 8px; font-size: 12px; 
                                font-weight: 500; cursor: pointer; background: white;"
                                onmouseover="this.style.background='#f9fafb'" 
                                onmouseout="this.style.background='white'">
                                Open
                            </button>
                            <button onclick="handleNotificationDismiss('${it._id}')" 
                                style="display: inline-flex; align-items: center; border-radius: 8px; 
                                border: 1px solid #d1d5db; padding: 4px 8px; font-size: 12px; 
                                font-weight: 500; cursor: pointer; background: white;"
                                onmouseover="this.style.background='#f9fafb'" 
                                onmouseout="this.style.background='white'">
                                Dismiss
                            </button>
                        </div>
                    </div>
                    ${!it.readAt ? '<span style="margin-top: 2px; height: 8px; width: 8px; border-radius: 4px; background: #3b82f6;"></span>' : ''}
                </div>
            </div>
        `).join('');
    }

    // Escape HTML to prevent XSS
    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, m => map[m]);
    }

    // Toggle notifications
    function toggleNotifications() {
        isOpen = !isOpen;
        const dropdown = document.getElementById('notification-dropdown');
        const backdrop = document.getElementById('notification-backdrop');
        if (isOpen) {
            dropdown.style.display = 'flex';
            backdrop.style.display = 'block';
        } else {
            dropdown.style.display = 'none';
            backdrop.style.display = 'none';
        }
    }

    function closeNotifications() {
        isOpen = false;
        const dropdown = document.getElementById('notification-dropdown');
        const backdrop = document.getElementById('notification-backdrop');
        dropdown.style.display = 'none';
        backdrop.style.display = 'none';
    }

    // Global handlers
    window.handleNotificationClick = function(id, item) {
        fetch(`/api/notifications/${id}/read`, {
            method: 'POST',
            credentials: 'include'
        })
        .then(() => {
            if (item.data && item.data.courseId) {
                window.location.href = `/courses/${item.data.courseId}`;
            } else if (item.type === 'certificate_available' && item.data.progressId) {
                window.location.href = `/courses/${item.data.courseId || ''}`;
            }
        })
        .catch(err => console.error('Failed to mark read:', err));
        closeNotifications();
    };

    window.handleNotificationDismiss = function(id) {
        fetch(`/api/notifications/${id}/dismiss`, {
            method: 'POST',
            credentials: 'include'
        })
        .then(() => fetchNotifications())
        .catch(err => console.error('Failed to dismiss:', err));
    };

    // Initialize
    function init() {
        const mountPoint = document.getElementById('notification-bell-mount');
        if (!mountPoint) {
            console.log('Notification bell mount point not found');
            return;
        }

        const bell = createBellButton();
        const dropdown = createDropdown();
        const backdrop = createBackdrop();

        document.body.appendChild(bell);
        document.body.appendChild(backdrop);
        document.body.appendChild(dropdown);

        const btn = document.getElementById('bell-btn');
        if (btn) {
            btn.addEventListener('click', toggleNotifications);
        }

        // Fetch notifications on load
        fetchNotifications();

        // Poll for updates every minute
        setInterval(fetchNotifications, 60000);

        console.log('Notification bell initialized');
    }

    // Wait for DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
