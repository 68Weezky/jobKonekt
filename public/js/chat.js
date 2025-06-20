document.addEventListener('DOMContentLoaded', function() {
    // Chat user drawer toggle for small screens
    const chatDrawerToggle = document.getElementById('chat-userlist-drawer');
    const chatUserDrawer = document.getElementById('chatUserDrawer');
    if (chatDrawerToggle && chatUserDrawer) {
        chatDrawerToggle.addEventListener('change', function() {
            if (chatDrawerToggle.checked) {
                chatUserDrawer.style.display = 'block';
            } else {
                chatUserDrawer.style.display = 'none';
            }
        });
        // Hide drawer when clicking outside (overlay)
        document.querySelectorAll('.drawer-overlay').forEach(el => {
            el.addEventListener('click', () => {
                chatDrawerToggle.checked = false;
                chatUserDrawer.style.display = 'none';
            });
        });
        // On large screens, always show
        function handleResize() {
            if (window.innerWidth >= 768) {
                chatUserDrawer.style.display = 'block';
            } else if (!chatDrawerToggle.checked) {
                chatUserDrawer.style.display = 'none';
            }
        }
        window.addEventListener('resize', handleResize);
        handleResize();
    }

    // Existing chat message logic
    const chatForm = document.getElementById('chatForm');
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    if (chatForm) {
        chatForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const formData = new FormData(chatForm);
            const res = await fetch('/chat', {
                method: 'POST',
                body: new URLSearchParams([...formData])
            });
            if (res.ok) {
                chatInput.value = '';
                await reloadMessages();
            }
        });
    }
    async function reloadMessages() {
        const url = window.location.pathname;
        const res = await fetch(url + '/messages');
        if (res.ok) {
            const data = await res.json();
            chatMessages.innerHTML = '';
            if (data.messages && data.messages.length > 0) {
                data.messages.forEach(msg => {
                    const div = document.createElement('div');
                    div.className = 'mb-2 ' + (msg.sender_id === data.user_id ? 'text-right' : 'text-left');
                    div.innerHTML = `<span class="inline-block px-3 py-1 rounded ${msg.sender_id === data.user_id ? 'bg-blue-200' : 'bg-gray-200'}">${msg.message}</span> <span class="text-xs text-gray-400 ml-2">${new Date(msg.created_at).toLocaleTimeString()}</span>`;
                    chatMessages.appendChild(div);
                });
            } else {
                chatMessages.innerHTML = '<div class="text-gray-400 text-center">No messages yet.</div>';
            }
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    const socket = io();
    socket.emit('user_online', window.CURRENT_USER_ID);

    if (window.RECEIVER_ID && window.RECEIVER_ID !== null) {
        // Mark messages as read on load
        socket.emit('read_messages', { fromUserId: window.RECEIVER_ID, toUserId: window.CURRENT_USER_ID });
    }

    // Send message via Socket.IO
    if (chatForm) {
        chatForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const message = chatInput.value;
            if (!message.trim()) return;
            socket.emit('send_message', {
                sender_id: window.CURRENT_USER_ID,
                receiver_id: window.RECEIVER_ID,
                message
            });
            // Optimistically add to UI
            addMessageToUI({ sender_id: window.CURRENT_USER_ID, message, created_at: new Date(), is_read: false });
            chatInput.value = '';
        });
    }

    // Listen for new messages
    socket.on('receive_message', function(data) {
        if (String(data.sender_id) === String(window.RECEIVER_ID)) {
            addMessageToUI({ sender_id: data.sender_id, message: data.message, created_at: new Date(), is_read: false });
            // Mark as read
            socket.emit('read_messages', { fromUserId: window.RECEIVER_ID, toUserId: window.CURRENT_USER_ID });
        }
    });

    // Listen for read receipts
    socket.on('messages_read', function(data) {
        // Update all sent messages in UI to show as read
        document.querySelectorAll('.chat-bubble-sent .msg-status').forEach(el => {
            el.classList.remove('msg-status-delivered');
            el.classList.add('msg-status-read');
        });
    });

    // Listen for online status updates
    socket.on('update_online', function(onlineUserIds) {
        // If RECEIVER_ID is in onlineUserIds, update the online indicator
        const onlineDot = document.querySelector('.online-dot');
        const onlineText = document.querySelector('.chat-header-user .text-green-600');
        if (onlineDot && onlineText) {
            if (onlineUserIds.includes(String(window.RECEIVER_ID))) {
                onlineDot.style.background = '#22c55e';
                onlineText.textContent = 'Online';
            } else {
                onlineDot.style.background = '#a1a1aa';
                onlineText.textContent = 'Offline';
            }
        }
    });

    function addMessageToUI(msg) {
        // Create a new message bubble and append to chatMessages
        const div = document.createElement('div');
        div.className = 'flex ' + (msg.sender_id == window.CURRENT_USER_ID ? 'justify-end' : 'justify-start');
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble ' + (msg.sender_id == window.CURRENT_USER_ID ? 'chat-bubble-sent' : 'chat-bubble-received') + ' chat-bubble-animate';
        const content = document.createElement('span');
        content.className = 'msg-content';
        content.innerHTML = msg.message;
        bubble.appendChild(content);
        const meta = document.createElement('div');
        meta.className = 'flex items-center justify-end gap-1 mt-1 text-xs';
        const time = document.createElement('span');
        time.className = 'text-gray-300';
        time.textContent = (new Date(msg.created_at)).toLocaleTimeString();
        meta.appendChild(time);
        if (msg.sender_id == window.CURRENT_USER_ID) {
            const status = document.createElement('span');
            status.className = 'msg-status msg-status-delivered';
            status.title = 'Delivered';
            status.innerHTML = '&#10003;&#10003;';
            meta.appendChild(status);
        }
        bubble.appendChild(meta);
        div.appendChild(bubble);
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    const notificationList = document.getElementById('notification-list');
    if (typeof socket !== 'undefined' && notificationList) {
        socket.on('service_request_notification', function(data) {
            const li = document.createElement('li');
            li.innerHTML = `
                <div>
                    <span class="font-bold">${data.from}</span> requested your service: <span class="font-semibold">${data.professional_required}</span>
                    <div class="text-xs text-gray-500">${data.job_description}</div>
                    <div class="text-xs text-gray-400">When: ${new Date(data.service_time).toLocaleString()}</div>
                </div>
            `;
            notificationList.prepend(li);
        });
    }
}); 