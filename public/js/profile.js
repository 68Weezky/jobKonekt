document.addEventListener('DOMContentLoaded', function() {
    // Profile form submission
    document.getElementById('profileForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const msg = document.getElementById('profileMessage');
        try {
            const res = await fetch('/profile', {
                method: 'POST',
                body: formData
            });
            const result = await res.json();
            
            if (result.success) {
                msg.textContent = 'Profile updated successfully!';
                msg.style.color = 'green';
                setTimeout(() => window.location.reload(), 1000);
            } else {
                throw new Error(result.error || 'Update failed');
            }
        } catch (error) {
            msg.textContent = error.message;
            msg.style.color = 'red';
        }
    });

    // Drawer functionality
    const drawerToggle = document.getElementById('drawer-toggle');
    const drawerOverlay = document.querySelector('.drawer-overlay');

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
}); 