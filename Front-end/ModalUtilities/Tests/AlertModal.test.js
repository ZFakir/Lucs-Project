/**
 * @jest-environment jsdom
 */

const { AlertModal } = require('../AlertModal.js'); // Adjust the path if necessary

describe('AlertModal', () => {
    let alertModal;

    beforeAll(() => {
        // JSDOM does not natively implement HTMLDialogElement methods, so we mock them
        HTMLDialogElement.prototype.showModal = jest.fn();
        HTMLDialogElement.prototype.close = jest.fn();
    });

    beforeEach(() => {
        // Clean up the DOM and reset mocks before each test
        document.body.innerHTML = '';
        jest.clearAllMocks();
    });

    describe('Initialization', () => {
        it('should dynamically create the dialog element if it does not exist', () => {
            alertModal = new AlertModal();
            const dialog = document.getElementById('custom-modal');
            
            expect(dialog).not.toBeNull();
            expect(dialog.tagName).toBe('DIALOG');
            expect(dialog.querySelector('#modal-title')).not.toBeNull();
            expect(dialog.querySelector('#modal-message')).not.toBeNull();
            expect(dialog.querySelector('#modal-actions')).not.toBeNull();
            expect(dialog.className).toContain('backdrop:backdrop-blur-sm');
        });

        it('should reuse the existing dialog element if it is already in the DOM', () => {
            // Inject a pre-existing dialog into the DOM
            document.body.innerHTML = '<dialog id="custom-modal"><div id="existing-content"></div></dialog>';
            
            alertModal = new AlertModal();
            const dialog = document.getElementById('custom-modal');
            
            // It should not overwrite the existing HTML or create a second dialog
            expect(dialog.querySelector('#existing-content')).not.toBeNull();
            expect(document.querySelectorAll('dialog').length).toBe(1);
        });

        it('should respect custom dialog IDs passed to the constructor', () => {
            alertModal = new AlertModal('my-special-modal');
            const dialog = document.getElementById('my-special-modal');
            
            expect(dialog).not.toBeNull();
        });
    });

    describe('show() method', () => {
        beforeEach(() => {
            alertModal = new AlertModal();
        });

        it('should display the correct title and message in the DOM', () => {
            alertModal.show('Test Title', 'Test Message');
            
            expect(document.getElementById('modal-title').textContent).toBe('Test Title');
            expect(document.getElementById('modal-message').textContent).toBe('Test Message');
            expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledTimes(1);
        });

        describe('Type: alert (default)', () => {
            it('should render the "Got it" button and resolve to true when clicked', async () => {
                const promise = alertModal.show('Notice', 'Operation completed.');
                
                const okButton = document.getElementById('modal-ok');
                expect(okButton).not.toBeNull();
                expect(okButton.textContent).toBe('Got it');
                
                // Simulate the user clicking the "Got it" button
                okButton.click();
                
                const result = await promise;
                expect(result).toBe(true);
                expect(HTMLDialogElement.prototype.close).toHaveBeenCalledTimes(1);
            });

            it('should apply red styling if the title is exactly "error" (case-insensitive)', () => {
                alertModal.show('Error', 'Something went wrong');
                const titleEl = document.getElementById('modal-title');
                
                expect(titleEl.className).toContain('text-red-500');
            });

            it('should apply primary styling if the title is not an error', () => {
                alertModal.show('Success', 'Everything is fine');
                const titleEl = document.getElementById('modal-title');
                
                expect(titleEl.className).toContain('text-primary');
            });
        });

        describe('Type: confirm', () => {
            it('should render "Cancel" and "Confirm" buttons instead of "Got it"', () => {
                alertModal.show('Warning', 'Are you sure?', 'confirm');
                
                expect(document.getElementById('modal-cancel')).not.toBeNull();
                expect(document.getElementById('modal-confirm')).not.toBeNull();
                expect(document.getElementById('modal-ok')).toBeNull(); // Should not exist
            });

            it('should resolve to true and close the dialog when Confirm is clicked', async () => {
                const promise = alertModal.show('Warning', 'Are you sure?', 'confirm');
                
                document.getElementById('modal-confirm').click();
                
                const result = await promise;
                expect(result).toBe(true);
                expect(HTMLDialogElement.prototype.close).toHaveBeenCalledTimes(1);
            });

            it('should resolve to false and close the dialog when Cancel is clicked', async () => {
                const promise = alertModal.show('Warning', 'Are you sure?', 'confirm');
                
                document.getElementById('modal-cancel').click();
                
                const result = await promise;
                expect(result).toBe(false);
                expect(HTMLDialogElement.prototype.close).toHaveBeenCalledTimes(1);
            });

            it('should apply red warning text styling to the title when in confirm mode', () => {
                alertModal.show('Warning', 'Are you sure?', 'confirm');
                const titleEl = document.getElementById('modal-title');
                
                expect(titleEl.className).toContain('text-red-400');
            });
        });
    });
});