const socket = window.io ? window.io() : (typeof io !== 'undefined' ? io() : null);

if (socket && typeof window.CURRENT_USER_ID !== 'undefined') {
    socket.emit('user_online', window.CURRENT_USER_ID);

    socket.on('update_badge', function(data) {
        if (data.type === 'notifications') {
            toggleBadge('notifications', data.value);
        } else if (data.type === 'chats') {
            toggleBadge('chats', data.value);
        }
    });
}

function toggleBadge(type, show) {
    let selector = '';
    if (type === 'notifications') selector = 'a[href="/notifications"] .menu-badge-dot';
    if (type === 'chats') selector = 'a[href="/chat"] .menu-badge-dot';

    let badge = document.querySelector(selector);
    if (show) {
        if (!badge) {
            const menuLink = document.querySelector(`a[href="/${type}"]`);
            if (menuLink) {
                const dot = document.createElement('span');
                dot.className = 'menu-badge-dot';
                menuLink.insertBefore(dot, menuLink.childNodes[menuLink.childNodes.length - 1]);
            }
        }
    } else {
        if (badge) badge.remove();
    }
} 