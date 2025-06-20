document.addEventListener('DOMContentLoaded', function() {
    // Drawer functionality
    const drawerToggle = document.getElementById('drawer-toggle');
    const drawerOverlay = document.querySelector('.drawer-overlay');
    const drawerSide = document.querySelector('.drawer-side');

    // Close drawer when clicking outside
    drawerOverlay.addEventListener('click', () => {
        drawerToggle.checked = false;
    });

    // Close drawer when pressing Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && drawerToggle.checked) {
            drawerToggle.checked = false;
        }
    });

    // Update user info in drawer
    function updateUserInfo() {
        const userAvatar = document.querySelector('.avatar.placeholder span');
        const userName = document.querySelector('.drawer-side h3');
        const userEmail = document.querySelector('.drawer-side p');

        // Get user data from session
        fetch('/api/user')
            .then(response => response.json())
            .then(data => {
                if (data.user) {
                    // Update avatar initials
                    const initials = data.user.username
                        .split(' ')
                        .map(word => word[0])
                        .join('')
                        .toUpperCase();
                    userAvatar.textContent = initials;

                    // Update name and email
                    userName.textContent = data.user.username;
                    userEmail.textContent = data.user.email;
                }
            })
            .catch(error => console.error('Error fetching user data:', error));
    }

    // Initialize dashboard
    function initDashboard() {
        // Update user info
        updateUserInfo();

        // Add active class to current menu item
        const currentPath = window.location.pathname;
        const menuItems = document.querySelectorAll('.drawer-side .menu li a');
        menuItems.forEach(item => {
            if (item.getAttribute('href') === currentPath) {
                item.classList.add('active');
            }
        });

        // Handle logout
        const logoutButton = document.querySelector('a[href="/logout"]');
        if (logoutButton) {
            logoutButton.addEventListener('click', (e) => {
                e.preventDefault();
                if (confirm('Are you sure you want to logout?')) {
                    window.location.href = '/logout';
                }
            });
        }
    }

    // Initialize dashboard
    initDashboard();

    // Add smooth transitions
    document.body.classList.add('transition-all', 'duration-300');

    // Handle responsive behavior
    function handleResponsive() {
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
            drawerSide.classList.add('w-full');
        } else {
            drawerSide.classList.remove('w-full');
        }
    }

    // Initial responsive check
    handleResponsive();

    // Update on window resize
    window.addEventListener('resize', handleResponsive);
}); 