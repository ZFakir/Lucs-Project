/**
 * @jest-environment jsdom
 */

const { CivicModal } = require('../CivicModal.js');
global.fetch = jest.fn();
// JSDOM doesn't implement <dialog> methods, so we mock them
HTMLDialogElement.prototype.showModal = jest.fn();
HTMLDialogElement.prototype.close = jest.fn();

// Mocking URL.createObjectURL for the buffer-to-blob logic
global.URL.createObjectURL = jest.fn(() => 'mock-blob-url');


describe('CivicModal Component Tests', () => {
    let modal;
    const modalId = 'civic-reusable-modal';

    beforeEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = ''; // Fresh DOM
        modal = new CivicModal();
    });

    describe('Initialization', () => {
        test('should create and append the dialog to the body', () => {
            const dialog = document.getElementById(modalId);
            expect(dialog).not.toBeNull();
            expect(dialog.tagName).toBe('DIALOG');
        });

        test('should not recreate the dialog if it already exists', () => {
            const firstDialog = modal.dialog;
            new CivicModal(); // Call second time
            const secondDialog = document.getElementById(modalId);
            expect(firstDialog).toBe(secondDialog);
        });
    });

    describe('UI Logic: getBadgeHTML', () => {
        test('returns green/neutral badge for Resolved', () => {
            const html = modal.getBadgeHTML('Resolved');
            expect(html).toContain('Resolved');
            expect(html).toContain('bg-surface-container-highest');
        });

        test('returns orange badge for In Progress', () => {
            const html = modal.getBadgeHTML('In Progress');
            expect(html).toContain('In Progress');
            expect(html).toContain('bg-[#FF8C00]/20');
        });

        test('returns solid orange badge for Active/Default', () => {
            const html = modal.getBadgeHTML('New Issue');
            expect(html).toContain('Active');
            expect(html).toContain('bg-[#FF8C00]');
        });
    });

    describe('Async Logic: open()', () => {
        const mockData = {
            id: 1,
            type: 'Water Leak',
            description: 'Pipe burst on 3rd Ave',
            date: '2026-05-07',
            status: 'In Progress',
            ward: '14',
            municipality: 'City of Joburg',
            workers: [{ Name: 'John Smith', EmployeeID: 'W-99' }]
        };

        test('populates text fields correctly and opens dialog', async () => {
            fetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue([])
            });

            await modal.open(mockData);

            expect(document.getElementById(`${modalId}-title`).textContent).toBe('Water Leak');
            expect(document.getElementById(`${modalId}-desc`).textContent).toBe('Pipe burst on 3rd Ave');
            expect(document.getElementById(`${modalId}-ward`).textContent).toBe('Ward 14');
            expect(modal.dialog.showModal).toHaveBeenCalled();
        });

        test('fetches and renders base64 images', async () => {
            const mockImages = [{ base64: 'abc', Type: 'image/png' }];
            fetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue(mockImages)
            });

            await modal.open(mockData);

            const carousel = document.getElementById(`${modalId}-carousel`);
            const img = carousel.querySelector('img');
            expect(img.src).toContain('data:image/png;base64,abc');
        });

        test('renders personnel section when workers are provided', async () => {
            fetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue([])
            });

            await modal.open(mockData);

            const section = document.getElementById(`${modalId}-personnel-section`);
            const workersList = document.getElementById(`${modalId}-workers`);
            
            expect(section.classList.contains('hidden')).toBe(false);
            expect(workersList.innerHTML).toContain('John Smith');
            expect(workersList.innerHTML).toContain('W-99');
        });

        test('hides personnel section if workers data is undefined', async () => {
            fetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue([])
            });

            const dataNoWorkers = { ...mockData, workers: undefined };
            await modal.open(dataNoWorkers);

            const section = document.getElementById(`${modalId}-personnel-section`);
            expect(section.classList.contains('hidden')).toBe(true);
        });
    });

    describe('Carousel Navigation', () => {
        test('next button triggers scrollBy', () => {
            const carousel = document.getElementById(`${modalId}-carousel`);
            // Mock scrollBy since JSDOM doesn't support it
            carousel.scrollBy = jest.fn();
            
            const nextBtn = document.getElementById(`${modalId}-next`);
            nextBtn.click();
            
            expect(carousel.scrollBy).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
        });
    });
});