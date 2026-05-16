const request = require('supertest');
const express = require('express');
const reportImageRouter = require('../routes/reportImages'); // Adjust path as needed
const { ReportImage, Report } = require('../models');

// Mock the Sequelize models
jest.mock('../models', () => ({
    ReportImage: {
        findAll: jest.fn(),
        findByPk: jest.fn(),
        create: jest.fn(),
        destroy: jest.fn(),
    },
    Report: {
        findByPk: jest.fn(),
    }
}));

const app = express();
app.use(express.json({ limit: '50mb' })); // Allow large base64 payloads
app.use('/report-images', reportImageRouter);

describe('ReportImages API Endpoints', () => {

    afterEach(() => {
        jest.clearAllMocks();
    });

    // ==========================================
    // GET /report-images/report/:reportId
    // ==========================================
    describe('GET /report-images/report/:reportId', () => {
        it('should return all formatted images for a specific report', async () => {
            const mockImages = [
                {
                    toJSON: () => ({ ImageID: 1, Type: 'image/jpeg', Image: Buffer.from('fake-image-data') })
                }
            ];
            ReportImage.findAll.mockResolvedValue(mockImages);

            const res = await request(app).get('/report-images/report/10');

            expect(res.statusCode).toBe(200);
            expect(res.body[0]).toHaveProperty('base64');
            expect(ReportImage.findAll).toHaveBeenCalledWith({ where: { ReportID: '10' } });
        });

        it('should return 404 if no images are found', async () => {
            ReportImage.findAll.mockResolvedValue([]);
            const res = await request(app).get('/report-images/report/10');
            expect(res.statusCode).toBe(404);
            expect(res.body.message).toBe('No images found for this report.');
        });

        it('should return 500 on server error', async () => {
            ReportImage.findAll.mockRejectedValue(new Error('DB crash'));
            const res = await request(app).get('/report-images/report/10');
            expect(res.statusCode).toBe(500);
            expect(res.body).toHaveProperty('error');
        });
    });

    // ==========================================
    // DELETE /report-images/:imageId
    // ==========================================
    describe('DELETE /report-images/:imageId', () => {
        it('should delete an image successfully', async () => {
            ReportImage.destroy.mockResolvedValue(1); // 1 row deleted

            const res = await request(app).delete('/report-images/5');

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should return 404 if image does not exist', async () => {
            ReportImage.destroy.mockResolvedValue(0);
            const res = await request(app).delete('/report-images/99');
            expect(res.statusCode).toBe(404);
            expect(res.body.message).toBe('Image not found');
        });

        it('should return 500 on server error', async () => {
            ReportImage.destroy.mockRejectedValue(new Error('DB crash'));
            const res = await request(app).delete('/report-images/5');
            expect(res.statusCode).toBe(500);
        });
    });

    // ==========================================
    // GET /report-images/:id
    // ==========================================
    describe('GET /report-images/:id', () => {
        it('should fetch a single image by ID', async () => {
            ReportImage.findByPk.mockResolvedValue({ ImageID: 1, Type: 'image/png' });
            const res = await request(app).get('/report-images/1');
            expect(res.statusCode).toBe(200);
            expect(res.body.Type).toBe('image/png');
        });

        it('should return 404 if image is not found', async () => {
            ReportImage.findByPk.mockResolvedValue(null);
            const res = await request(app).get('/report-images/99');
            expect(res.statusCode).toBe(404);
        });

        it('should return 500 on server error', async () => {
            ReportImage.findByPk.mockRejectedValue(new Error('DB crash'));
            const res = await request(app).get('/report-images/1');
            expect(res.statusCode).toBe(500);
        });
    });

    // ==========================================
    // POST /report-images/report/:reportId
    // ==========================================
    describe('POST /report-images/report/:reportId', () => {
        it('should successfully parse and save a full data URI string with worker tag', async () => {
            Report.findByPk.mockResolvedValue({ ReportID: 10 }); // Report exists
            ReportImage.create.mockResolvedValue({ ImageID: 100 }); 

            const payload = { Image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAE' };
            const res = await request(app).post('/report-images/report/10').send(payload);

            expect(res.statusCode).toBe(201);
            expect(res.body.message).toBe('Image uploaded successfully!');
            expect(res.body.image.ImageID).toBe(100);
            expect(ReportImage.create).toHaveBeenCalledWith(expect.objectContaining({
                Type: 'image/png;role=worker'
            }));
        });

        it('should successfully parse and save a raw base64 string with worker tag fallback', async () => {
            Report.findByPk.mockResolvedValue({ ReportID: 10 }); 
            ReportImage.create.mockResolvedValue({ ImageID: 101 });

            const payload = { Image: 'iVBORw0KGgoAAAANSUhEUgAAAAE' }; // No data: prefix
            const res = await request(app).post('/report-images/report/10').send(payload);

            expect(res.statusCode).toBe(201);
            expect(ReportImage.create).toHaveBeenCalledWith(expect.objectContaining({
                Type: 'image/jpeg;role=worker' // Checks the fallback MIME type
            }));
        });

        it('should return 404 if the target report does not exist', async () => {
            Report.findByPk.mockResolvedValue(null); 

            const res = await request(app).post('/report-images/report/99').send({ Image: 'base64data' });
            
            expect(res.statusCode).toBe(404);
            expect(res.body.message).toContain('Report not found');
        });

        it('should return 400 if image data is completely missing or invalid', async () => {
            Report.findByPk.mockResolvedValue({ ReportID: 10 }); 

            const res = await request(app).post('/report-images/report/10').send({}); // Empty body
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('No valid image data provided.');
        });

        it('should return 500 on server error during upload', async () => {
            Report.findByPk.mockResolvedValue({ ReportID: 10 }); 
            ReportImage.create.mockRejectedValue(new Error('DB space full'));

            const res = await request(app).post('/report-images/report/10').send({ Image: 'base64data' });
            
            expect(res.statusCode).toBe(500);
            expect(res.body).toHaveProperty('error');
        });
    });
});