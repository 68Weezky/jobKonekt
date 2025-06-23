document.addEventListener('DOMContentLoaded', function() {
    // Drawer functionality
    const drawerToggle = document.getElementById('drawer-toggle');
    const drawerOverlay = document.querySelector('.drawer-overlay');
    const drawerSide = document.querySelector('.drawer-side');

    // Close drawer when clicking outside
    if (drawerOverlay && drawerToggle) {
        drawerOverlay.addEventListener('click', () => {
            drawerToggle.checked = false;
        });
    }

    // Close drawer when pressing Escape key
    if (drawerToggle) {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && drawerToggle.checked) {
                drawerToggle.checked = false;
            }
        });
    }

    // Update user info in drawer
    function updateUserInfo() {
        const userAvatar = document.querySelector('.avatar.placeholder span');
        const userName = document.querySelector('.drawer-side h3');
        const userEmail = document.querySelector('.drawer-side p');

        // Example: Fix for event listener error
        const someElement = document.getElementById('some-id');
        if (someElement) {
            someElement.addEventListener('click', function() {
                // ...
            });
        }

        // Remove or comment out fetch to /api/user
        // fetch('/api/user')
        //   .then(res => res.json())
        //   .then(data => { /* ... */ })
        //   .catch(err => console.error('Error fetching user data:', err));
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
    if (drawerSide) handleResponsive();

    // Update on window resize
    window.addEventListener('resize', function() {
        if (drawerSide) handleResponsive();
    });

    const slides = document.querySelectorAll('#dashboard-carousel .carousel-slide');
    const indicators = document.querySelectorAll('#dashboard-carousel .carousel-indicator');
    const prevBtn = document.getElementById('carousel-prev');
    const nextBtn = document.getElementById('carousel-next');
    let current = 0;
    let interval = null;

    function showSlide(idx) {
        slides.forEach((slide, i) => {
            slide.classList.toggle('active', i === idx);
            slide.style.opacity = i === idx ? '1' : '0';
        });
        indicators.forEach((ind, i) => {
            ind.classList.toggle('active', i === idx);
        });
        current = idx;
    }

    function nextSlide() {
        showSlide((current + 1) % slides.length);
    }

    function prevSlide() {
        showSlide((current - 1 + slides.length) % slides.length);
    }

    function startAuto() {
        if (interval) clearInterval(interval);
        interval = setInterval(nextSlide, 5000);
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            prevSlide();
            startAuto();
        });
    }
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            nextSlide();
            startAuto();
        });
    }
    if (indicators.length > 0) {
        indicators.forEach((ind, i) => {
            ind.addEventListener('click', () => {
                showSlide(i);
                startAuto();
            });
        });
    }

    if (slides.length > 0) {
        showSlide(0);
        startAuto();
    }
}); 