/**
 * @jest-environment jsdom
 */

const { DashboardExporter } = require('../DashboardExporter.js');

// --- 1. MOCK EXTERNAL LIBRARY (html2pdf) ---
/**
 * We create a "Fluent Interface" mock.
 * This allows us to chain methods
 */
let resolvePdf; // Variable to hold the promise resolution function for testing race conditions

const mockHtml2Pdf = {
    // mockReturnThis() allows for method chaining: html2pdf().set().from()...
    set: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    save: jest.fn().mockReturnThis(),
    then: jest.fn().mockImplementation((callback) => {
        /**
         * PDF generation is asynchronous. Instead of resolving immediately, we store the
         * callback in 'resolvePdf'. This lets us verify the "Generating..." UI state 
         * before manually triggering the completion of the PDF.
         */
        resolvePdf = callback; 
        return { 
            catch: jest.fn().mockImplementation((errorCallback) => {
                return { finally: jest.fn() };
            }) 
        };
    }),
};

// Assign the mock to the global window object
global.html2pdf = jest.fn(() => mockHtml2Pdf);

// Mock window.scrollTo because JSDOM (Jest's browser simulation) doesn't implement scrolling
global.scrollTo = jest.fn();

describe('DashboardExporter Component Tests', () => {
    let exporter;
    const buttonId = 'export-btn';
    const targetId = 'main-content';

    beforeEach(() => {
        // Clear all mock call histories before each test to prevent interference
        jest.clearAllMocks();
        resolvePdf = null;

        /**
         * SETUP MOCK DOM:
         * We recreate the specific HTML structure the Exporter expects:
         * 1. A trigger button
         * 2. A main content area containing elements that need to be hidden (maps) or shown (panels)
         */
        document.body.innerHTML = `
            <button id="${buttonId}">Export PDF</button>
            <main id="${targetId}">
                <div id="map" style="display: block;"></div>
                <div id="pdf-region-panel" class="hidden" style="display: none;"></div>
            </main>
        `;
        
        // Initialize the class instance
        exporter = new DashboardExporter(buttonId, `#${targetId}`, 'Test_Report');
    });

    describe('PDF Generation Logic', () => {
        test('should show "Generating..." state and then revert on success', async () => {
            const btn = document.getElementById(buttonId);
            const originalText = btn.innerHTML;

            // 1. Trigger the PDF generation process
            exporter.generatePDF();

            // 2. VERIFY INTERMEDIATE UI STATE: 
            // The button should now show the loading spinner/text to provide user feedback.
            expect(btn.innerHTML).toContain('Generating...');

            // 3. SIMULATE COMPLETION: 
            // Manually trigger the .then() callback we captured earlier.
            if (resolvePdf) resolvePdf();

            // 4. VERIFY FINAL UI STATE: 
            // The button text should be restored and the window should have scrolled to the top.
            expect(btn.innerHTML).toBe(originalText);
            expect(global.scrollTo).toHaveBeenCalled();
        });

        test('should call html2pdf with correct configuration', () => {
            exporter.generatePDF();

            // Verify that the external library was called
            expect(global.html2pdf).toHaveBeenCalled();
            
            // Verify our configuration: Filename prefix and the dark-mode background color
            expect(mockHtml2Pdf.set).toHaveBeenCalledWith(expect.objectContaining({
                filename: expect.stringContaining('Test_Report'),
                html2canvas: expect.objectContaining({ backgroundColor: '#131313' })
            }));
        });

        test('should modify the cloned document in onclone callback', () => {
            /**
             * The 'onclone' feature is critical. html2pdf creates a hidden copy of the page.
             * We modify that copy (hiding nav/maps) so the user's live screen doesn't flicker.
             */
            exporter.generatePDF();
            
            // Extract the onclone function from the mock calls
            const options = mockHtml2Pdf.set.mock.calls[0][0];
            const onclone = options.html2canvas.onclone;

            // Create a fake cloned document to simulate the library's internal behavior
            const fakeClonedDoc = {
                getElementById: jest.fn((id) => {
                    if (id === 'map') return { style: {} };
                    if (id === 'ward-map') return { style: {} };
                    if (id === 'pdf-region-ward') return { style: {} };
                    if (id === 'pdf-region-panel') return { style: {}, classList: { remove: jest.fn() } };
                    return null;
                }),
                querySelector: jest.fn((selector) => {
                    if (selector === 'nav') return { style: {} };
                    return null;
                })
            };

            // Execute the cleanup logic on our fake document
            onclone(fakeClonedDoc);

            // Assert that the cleanup logic attempted to find the navigation and map elements
            expect(fakeClonedDoc.getElementById).toHaveBeenCalledWith('map');
            expect(fakeClonedDoc.querySelector).toHaveBeenCalledWith('nav');
        });
    });

    describe('Error Handling', () => {
        test('should restore button text even if PDF generation fails', () => {
            /**
             * ROBUSTNESS TEST:
             * If the PDF library crashes (e.g., out of memory), the UI must not get stuck
             * in the "Generating..." state. It should revert so the user can try again.
             */
            mockHtml2Pdf.then.mockImplementationOnce(() => ({
                catch: jest.fn((errorCallback) => {
                    errorCallback(new Error("PDF Engine Failure"));
                })
            }));

            const btn = document.getElementById(buttonId);
            exporter.generatePDF();

            // Verify the button reverted to original text despite the simulated error
            expect(btn.innerHTML).toContain('Export PDF');
        });
    });
});