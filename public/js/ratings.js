document.addEventListener('DOMContentLoaded', function() {
    const stars = document.querySelectorAll('#starRating .star');
    const ratingValue = document.getElementById('ratingValue');
    const reviewGroup = document.getElementById('reviewGroup');
    let selected = 0;

    stars.forEach(star => {
        star.addEventListener('mouseenter', function() {
            const val = parseInt(this.getAttribute('data-value'));
            highlightStars(val);
            setHovered(val);
        });
        star.addEventListener('mouseleave', function() {
            highlightStars(selected);
            setHovered(0);
        });
        star.addEventListener('click', function() {
            selected = parseInt(this.getAttribute('data-value'));
            ratingValue.value = selected;
            highlightStars(selected);
            if (selected > 0) {
                reviewGroup.style.display = '';
            } else {
                reviewGroup.style.display = 'none';
            }
        });
    });

    function highlightStars(count) {
        stars.forEach((star, idx) => {
            if (idx < count) {
                star.classList.add('selected');
                star.classList.remove('fa-regular');
                star.classList.add('fa-solid');
            } else {
                star.classList.remove('selected');
                star.classList.remove('fa-solid');
                star.classList.add('fa-regular');
            }
        });
    }
    function setHovered(count) {
        stars.forEach((star, idx) => {
            if (idx < count) {
                star.classList.add('hovered');
            } else {
                star.classList.remove('hovered');
            }
        });
    }

    document.getElementById('ratingForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const msg = document.getElementById('ratingMessage');
        if (parseInt(formData.get('rating')) < 1) {
            msg.textContent = 'Please select a rating.';
            msg.style.color = 'red';
            return;
        }
        try {
            const res = await fetch('/ratings', {
                method: 'POST',
                body: new URLSearchParams([...formData])
            });
            const result = await res.json();
            if (result.success) {
                msg.textContent = 'Thank you for your rating!';
                msg.style.color = 'green';
                form.reset();
                highlightStars(0);
                setHovered(0);
                reviewGroup.style.display = 'none';
                selected = 0;
            } else {
                throw new Error(result.error || 'Submission failed');
            }
        } catch (error) {
            msg.textContent = error.message;
            msg.style.color = 'red';
        }
    });
}); 