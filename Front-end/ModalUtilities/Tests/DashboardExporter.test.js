/**
 * @jest-environment jsdom
 */

const { DashboardExporter } = require('../DashboardExporter.js');
// --- 1. MOCK EXTERNAL LIBRARY (html2pdf) ---
// We use a variable to capture the resolve callback so we can trigger it manually
let resolvePdf;

const mockHtml2Pdf = {
    set: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    save: jest.fn().mockReturnThis(),
    then: jest.fn().mockImplementation((callback) => {
        // Capture the callback instead of running it immediately
        resolvePdf = callback; 
        return { 
            catch: jest.fn().mockImplementation((errorCallback) => {
                // Store error callback if needed, but we focus on success for the race condition
                return { finally: jest.fn() };
            }) 
        };
    }),
};

global.html2pdf = jest.fn(() => mockHtml2Pdf);

// Mock window.scrollTo since JSDOM does not implement it
global.scrollTo = jest.fn();


describe('DashboardExporter Component Tests', () => {
    let exporter;
    const buttonId = 'export-btn';
    const targetId = 'main-content';

    beforeEach(() => {
        jest.clearAllMocks();
        resolvePdf = null;

        // Setup DOM for Lucs-Project dashboard structure
        document.body.innerHTML = `
            <button id="${buttonId}">Export PDF</button>
            <main id="${targetId}">
                <div id="map" style="display: block;"></div>
                <div id="pdf-region-panel" class="hidden" style="display: none;"></div>
            </main>
        `;
        
        exporter = new DashboardExporter(buttonId, `#${targetId}`, 'Test_Report');
    });

    describe('PDF Generation Logic', () => {
        test('should show "Generating..." state and then revert on success', async () => {
            const btn = document.getElementById(buttonId);
            const originalText = btn.innerHTML;

            // 1. Trigger generation
            exporter.generatePDF();

            // 2. VERIFY INTERMEDIATE STATE: Should be showing the spinner
            expect(btn.innerHTML).toContain('Generating...');

            // 3. Trigger the deferred resolve
            if (resolvePdf) resolvePdf();

            // 4. VERIFY FINAL STATE: Should be back to original text
            expect(btn.innerHTML).toBe(originalText);
            expect(global.scrollTo).toHaveBeenCalled();
        });

        test('should call html2pdf with correct configuration', () => {
            exporter.generatePDF();

            expect(global.html2pdf).toHaveBeenCalled();
            expect(mockHtml2Pdf.set).toHaveBeenCalledWith(expect.objectContaining({
                filename: expect.stringContaining('Test_Report'),
                html2canvas: expect.objectContaining({ backgroundColor: '#131313' })
            }));
        });

        test('should modify the cloned document in onclone callback', () => {
            exporter.generatePDF();
            
            const options = mockHtml2Pdf.set.mock.calls[0][0];
            const onclone = options.html2canvas.onclone;

            const fakeClonedDoc = {
                getElementById: jest.fn((id) => {
                    if (id === 'map') return { style: {} };
                    if (id === 'pdf-region-panel') return { style: {}, classList: { remove: jest.fn() } };
                    return null;
                })
            };

            onclone(fakeClonedDoc);

            expect(fakeClonedDoc.getElementById).toHaveBeenCalledWith('map');
            expect(fakeClonedDoc.getElementById).toHaveBeenCalledWith('pdf-region-panel');
        });
    });

    describe('Error Handling', () => {
        test('should restore button text even if PDF generation fails', () => {
            // Re-mock then/catch for a failure scenario
            mockHtml2Pdf.then.mockImplementationOnce(() => ({
                catch: jest.fn((errorCallback) => {
                    errorCallback(new Error("PDF Engine Failure"));
                })
            }));

            const btn = document.getElementById(buttonId);
            exporter.generatePDF();

            // Should revert even on error
            expect(btn.innerHTML).toContain('Export PDF');
        });
    });
});