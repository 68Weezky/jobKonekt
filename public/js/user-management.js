// Debug flag
const debug = true;

function log(message) {
    if (debug) console.log(message);
}

// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    log('DOM Content Loaded');
    
    // Get DOM elements
    const banModal = document.getElementById('banModal');
    const banForm = document.getElementById('banForm');
    const banCancel = document.getElementById('banCancel');
    const modalContent = banModal.querySelector('.relative');
    
    // Check if elements exist
    if (!banModal || !banForm || !banCancel) {
        console.error('Could not find required elements:', {
            modal: !!banModal,
            form: !!banForm,
            cancel: !!banCancel
        });
        return;
    }

    // Add click handlers to all ban buttons
    const banButtons = document.querySelectorAll('.ban-btn');
    log(`Found ${banButtons.length} ban buttons`);
    
    banButtons.forEach(btn => {
        // Add hover effect
        btn.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.05)';
            this.style.transition = 'transform 0.2s';
        });
        
        btn.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
        });

        // Handle click
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            log('Ban button clicked');
            
            // Visual feedback
            this.classList.add('opacity-75');
            
            const userId = this.getAttribute('data-user-id');
            const username = this.getAttribute('data-username');
            
            log(`Banning user: ${username} (ID: ${userId})`);
            
            document.getElementById('banUserId').value = userId;
            document.getElementById('banUsername').textContent = username;
            
            // Show modal
            banModal.classList.add('modal-open');
            modalContent.classList.add('modal-content');
            
            log('Modal should be visible now');
        });
    });

    // Hide modal function
    function hideModal() {
        banModal.classList.remove('modal-open');
        modalContent.classList.remove('modal-content');
        // Reset button states
        document.querySelectorAll('.ban-btn').forEach(btn => {
            btn.classList.remove('opacity-75');
        });
    }

    // Hide modal when clicking cancel
    banCancel.addEventListener('click', function() {
        log('Cancel clicked');
        hideModal();
    });

    // Hide modal when clicking outside
    banModal.addEventListener('click', function(e) {
        if (e.target === banModal || e.target.classList.contains('absolute')) {
            log('Clicked outside modal');
            hideModal();
        }
    });

    // Handle form submission
    banForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        log('Form submitted');
        
        const submitBtn = this.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Banning...';
        
        const userId = document.getElementById('banUserId').value;
        const duration = document.getElementById('banDuration').value;
        
        log(`Submitting ban request: User ID ${userId}, Duration: ${duration}h`);
        
        try {
            const response = await fetch('/ban-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: userId,
                    duration: duration
                })
            });

            log('Response received:', response.status);

            if (response.ok) {
                log('Ban successful, reloading page');
                window.location.reload();
            } else {
                const error = await response.text();
                console.error('Ban failed:', error);
                alert('Failed to ban user: ' + error);
                submitBtn.disabled = false;
                submitBtn.textContent = 'Ban User';
            }
        } catch (error) {
            console.error('Error during ban:', error);
            alert('Failed to ban user: ' + error.message);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Ban User';
        }
    });
});

// Add this at the end to verify the script loaded
console.log('Ban management script loaded'); 