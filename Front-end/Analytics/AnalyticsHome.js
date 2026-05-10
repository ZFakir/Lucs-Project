document.addEventListener('DOMContentLoaded', () => {
    // 1. Check the URL for the "auth" key first
    const urlParams = new URLSearchParams(window.location.search);
    const authRole = urlParams.get('auth');

    // If 'admin' is in the URL, save it to storage immediately
    if (authRole === 'admin') {
        localStorage.setItem('userRole', 'admin');
    }

    // 2. Now grab the role from storage (whether it was already there or just added)
    const userRole = localStorage.getItem('userRole'); 
    
    const homeLink = document.getElementById('home-link');
    const homeLinkText = document.getElementById('home-link-text');

    if (homeLink && homeLinkText) {
        // 3. Adjust destination based on role
        if (userRole === 'admin') {
            homeLink.href = '../Homes/Admin.html';
            homeLinkText.innerText = 'Return to Admin Portal';
            homeLinkText.style.fontSize = '20px';
        } else if (userRole === 'guest') {
            homeLink.href = '../Homes/GuestDashboard.html';
            homeLinkText.innerText = 'Return to Guest Portal';
            homeLinkText.style.fontSize = '20px';
        } else {
            homeLink.href = '../Homes/Resident.html';
            homeLinkText.innerText = 'Return to Resident Portal';
            homeLinkText.style.fontSize = '20px';
        }  
    }

    // 4. Security Redirect
    const path = window.location.pathname;
    if (path.includes('WorkerPerform.html') && userRole !== 'admin') {
        alert("Access Denied: Admin privileges required.");
        // Kick them back to the resident side
        window.location.href = '../Homes/Resident.html';
    }
});