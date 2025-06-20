document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('serviceSearch');
    const roleRadios = document.querySelectorAll('input[name="roleFilter"]');
    const cards = document.querySelectorAll('.service-card');

    function filterCards() {
        const searchValue = searchInput.value.trim().toLowerCase();
        const selectedRole = document.querySelector('input[name="roleFilter"]:checked').value;

        cards.forEach(card => {
            const cardRole = card.getAttribute('data-role');
            const cardArea = card.getAttribute('data-area');
            // Only filter by area (not name)
            const matchesArea = !searchValue || cardArea.includes(searchValue);
            const matchesRole = selectedRole === 'all' || cardRole === selectedRole;
            if (matchesArea && matchesRole) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    }

    searchInput.addEventListener('input', filterCards);
    roleRadios.forEach(radio => radio.addEventListener('change', filterCards));
}); 