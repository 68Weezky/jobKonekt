document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('serviceRequestForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const msg = document.getElementById('serviceRequestMessage');
        try {
            const res = await fetch('/servicerequest', {
                method: 'POST',
                body: new URLSearchParams([...formData])
            });
            const result = await res.json();
            if (result.success) {
                msg.textContent = 'Service request submitted successfully!';
                msg.style.color = 'green';
                form.reset();
            } else {
                throw new Error(result.error || 'Submission failed');
            }
        } catch (error) {
            msg.textContent = error.message;
            msg.style.color = 'red';
        }
    });
}); 