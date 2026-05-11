/**
 * @jest-environment jsdom
 */

describe('AnalyticsHome Logic', () => {
    let originalGet;

    beforeAll(() => {
        // 🚨 Intercept URLSearchParams directly to fake the ?auth=admin parameter
        originalGet = URLSearchParams.prototype.get;
        URLSearchParams.prototype.get = jest.fn((key) => key === 'auth' ? 'admin' : null);
        window.alert = jest.fn();
    });

    afterAll(() => {
        // Restore standard behavior
        URLSearchParams.prototype.get = originalGet;
    });

    beforeEach(() => {
        jest.resetModules();
        localStorage.clear();
        document.body.innerHTML = `
            <a id="home-link"></a>
            <span id="home-link-text"></span>
        `;
    });

    test('Sets admin role and redirects properly', () => {
        require('./AnalyticsHome.js');
        document.dispatchEvent(new Event('DOMContentLoaded'));

        expect(localStorage.getItem('userRole')).toBe('admin');
        expect(document.getElementById('home-link-text').innerText).toBe('Return to Admin Portal');
    });
});