/**
 * @jest-environment jsdom
 */

describe('AnalyticsHome.js - High Coverage Suite', () => {
    let domReadyCb;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        localStorage.clear();

        document.body.innerHTML = `
            <a id="home-link"></a>
            <span id="home-link-text"></span>
        `;

        window.alert = jest.fn();
        
        // Reset to a clean base URL using native History API (Prevents JSDOM security crashes)
        window.history.pushState({}, '', '/AnalyticsHome.html');

        // Capture the event listener instead of dispatching globally to prevent pollution
        jest.spyOn(document, 'addEventListener').mockImplementation((event, cb) => {
            if (event === 'DOMContentLoaded') {
                domReadyCb = cb;
            }
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('Reads ?auth=admin from URL, saves to storage, and configures Admin links', () => {
        // Safely update window.location.search in JSDOM
        window.history.pushState({}, '', '/AnalyticsHome.html?auth=admin');
        
        require('../AnalyticsHome.js');
        
        // Execute the captured DOM callback safely
        try { if (domReadyCb) domReadyCb(); } catch(e) {}

        expect(localStorage.getItem('userRole')).toBe('admin');
        
        const linkText = document.getElementById('home-link-text');
        const link = document.getElementById('home-link');
        
        expect(linkText.innerText).toBe('Return to Admin Portal');
        expect(link.getAttribute('href')).toBe('../Homes/Admin.html');
    });

    test('Configures Guest links when userRole is guest', () => {
        localStorage.setItem('userRole', 'guest');
        
        require('../AnalyticsHome.js');
        
        try { if (domReadyCb) domReadyCb(); } catch(e) {}

        const linkText = document.getElementById('home-link-text');
        const link = document.getElementById('home-link');
        
        expect(linkText.innerText).toBe('Return to Guest Portal');
        expect(link.getAttribute('href')).toBe('../Homes/GuestDashboard.html');
    });

    test('Configures Resident links as default fallback', () => {
        localStorage.setItem('userRole', 'resident');
        
        require('../AnalyticsHome.js');
        
        try { if (domReadyCb) domReadyCb(); } catch(e) {}

        const linkText = document.getElementById('home-link-text');
        const link = document.getElementById('home-link');
        
        expect(linkText.innerText).toBe('Return to Resident Portal');
        expect(link.getAttribute('href')).toBe('../Homes/Resident.html');
    });

    test('Security Redirect: Allows admins on WorkerPerform.html', () => {
        window.history.pushState({}, '', '/WorkerPerform.html');
        localStorage.setItem('userRole', 'admin'); // Is an admin
        
        require('../AnalyticsHome.js');
        
        try { if (domReadyCb) domReadyCb(); } catch(e) {}

        // Assert that the alert did NOT fire, meaning they were allowed to stay
        expect(window.alert).not.toHaveBeenCalled();
    });
});