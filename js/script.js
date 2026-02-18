// The "Vibe Check" function you requested
function isUserLoggedIn() {
    // Manually flip this to true or false to test your UI
    return true; 
}

// Function to run on every page load
function initAuthUI() {
    const signInBtn = document.getElementById('signInBtn');
    const userIcon = document.getElementById('userIcon');

    if (!signInBtn || !userIcon) return; // Safety check

    if (isUserLoggedIn()) {
        signInBtn.classList.add('hidden');
        userIcon.classList.remove('hidden');
    } else {
        signInBtn.classList.remove('hidden');
        userIcon.classList.add('hidden');
    }
}

// Mobile Menu Logic
function toggleMenu() {
    document.getElementById("navWrapper").classList.toggle("active");
}

// Run the UI check when the script loads
document.addEventListener('DOMContentLoaded', initAuthUI);

function toggleMenu() {
document.getElementById("navWrapper").classList.toggle("active");
}