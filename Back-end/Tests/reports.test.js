const express = require('express');
const request = require('supertest');

// 1. MOCK NODEMAILER
const mockSendMail = jest.fn().mockResolvedValue(true);
jest.mock('nodemailer', () => ({
    createTransport: jest.fn().mockReturnValue({
        sendMail: mockSendMail
    })
}));

// 2. MOCK SEQUELIZE MODELS
const mockReport = {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
    hasMany: jest.fn(),
    increment: jest.fn(),
    reload: jest.fn()
};
const mockReportImage = { create: jest.fn(), findAll: jest.fn() };
const mockAllocation = { create: jest.fn(), findAll: jest.fn(), findOne: jest.fn(), destroy: jest.fn(), belongsTo: jest.fn() };
const mockNotification = { create: jest.fn() };
const mockSubscription = { findAll: jest.fn() };
const mockResident = { findByPk: jest.fn() };
const mockMunicipalWorker = { findByPk: jest.fn(), hasMany: jest.fn() };

jest.mock('../models', () => ({
    Report: mockReport,
    ReportImage: mockReportImage,
    Allocation: mockAllocation,
    Notification: mockNotification,
    Subscription: mockSubscription,
    Resident: mockResident,
    MunicipalWorker: mockMunicipalWorker,
    Op: { or: Symbol('or') }
}));

// 3. INITIALIZE EXPRESS APP
const reportsRouter = require('../routes/reports'); // Adjust this path if necessary
const app = express();
app.use(express.json({ limit: '10mb' })); 
app.use('/api/reports', reportsRouter);

describe('Reports API Router Tests', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
        // Mute expected console outputs for clean test logs
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    // ==========================================
    // BASIC GET & DELETE ROUTES
    // ==========================================
    describe('Standard GET & DELETE', () => {
        test('GET / fetches all reports', async () => {
            mockReport.findAll.mockResolvedValue([{ ReportID: 1, Type: 'Pothole' }]);
            const res = await request(app).get('/api/reports/');
            expect(res.status).toBe(200);
            expect(res.body[0].Type).toBe('Pothole');
        });

        test('GET /resident/:residentId fetches reports wrapper', async () => {
            mockReport.findAll.mockResolvedValue([{ ReportID: 2 }]);
            const res = await request(app).get('/api/reports/resident/5');
            expect(res.status).toBe(200);
            expect(res.body.reports[0].ReportID).toBe(2);
        });

        test('GET /:id fetches a single report', async () => {
            mockReport.findByPk.mockResolvedValue({ ReportID: 10 });
            const res = await request(app).get('/api/reports/10');
            expect(res.status).toBe(200);
            
            mockReport.findByPk.mockResolvedValue(null);
            const res404 = await request(app).get('/api/reports/99');
            expect(res404.status).toBe(404);
        });

        test('GET /ward/:wardId/:muniId fetches reports for specific ward', async () => {
            mockReport.findAll.mockResolvedValue([{ ReportID: 1, WardID: 10, MunicipalityID: 5 }]);
            const res = await request(app).get('/api/reports/ward/10/5');
            expect(res.status).toBe(200);
            expect(mockReport.findAll).toHaveBeenCalled();
        });

        test('DELETE /:id removes a report', async () => {
            mockReport.destroy.mockResolvedValue(1); // 1 row deleted
            const res = await request(app).delete('/api/reports/10');
            expect(res.status).toBe(200);

            mockReport.destroy.mockResolvedValue(0); // 0 rows deleted
            const res404 = await request(app).delete('/api/reports/99');
            expect(res404.status).toBe(404);
        });
    });

    // ==========================================
    // POST /: LOGGING A NEW REPORT
    // ==========================================
    describe('POST / - Create Report', () => {
        test('Logs report, creates image array, and sends emails', async () => {
            mockReport.create.mockResolvedValue({ ReportID: 1, WardID: 5, Type: 'Fire' });
            mockSubscription.findAll.mockResolvedValue([{ ResidentID: 10 }]);
            mockResident.findByPk.mockResolvedValue({ Email: 'test@resident.com' });
            mockReportImage.create.mockResolvedValue({});

            const payload = {
                Type: 'Fire',
                WardID: 5,
                Images: ['data:image/jpeg;base64,mocked_base64_string']
            };

            const res = await request(app).post('/api/reports/').send(payload);

            expect(res.status).toBe(201);
            expect(mockReportImage.create).toHaveBeenCalled();
            expect(mockNotification.create).toHaveBeenCalledTimes(2); // 1 for admin, 1 for resident
            expect(mockSendMail).toHaveBeenCalledTimes(2); // 1 for admin, 1 for resident
        });

        test('Logs report handles single image string gracefully', async () => {
            mockReport.create.mockResolvedValue({ ReportID: 1, WardID: 5, Type: 'Pothole' });
            mockSubscription.findAll.mockResolvedValue([]);
            
            const payload = { Type: 'Pothole', Image: 'data:image/png;base64,single_string_mock' };
            const res = await request(app).post('/api/reports/').send(payload);

            expect(res.status).toBe(201);
            expect(mockReportImage.create).toHaveBeenCalledWith(expect.objectContaining({ Type: 'image/png' }));
        });

        test('Skips emails if x-notif-paused header is true', async () => {
            mockReport.create.mockResolvedValue({ ReportID: 1, WardID: 5, Type: 'Fire' });
            mockSubscription.findAll.mockResolvedValue([{ ResidentID: 10 }]);
            mockResident.findByPk.mockResolvedValue({ Email: 'test@resident.com' });

            const res = await request(app)
                .post('/api/reports/')
                .set('x-notif-paused', 'true')
                .send({ Type: 'Fire' });

            expect(res.status).toBe(201);
            expect(mockNotification.create).toHaveBeenCalled(); // Notifications still happen
            expect(mockSendMail).not.toHaveBeenCalled(); // Emails skipped
        });
        
        test('Handles backend errors safely', async () => {
            mockReport.create.mockRejectedValue(new Error('DB Crash'));
            const res = await request(app).post('/api/reports/').send({});
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Failed to log report');
        });
    });

    // ==========================================
    // PUT STATUS & PROGRESS UPDATES
    // ==========================================
    describe('PUT /:id/status', () => {
        test('Resolves report and sends completion emails', async () => {
            mockReport.update.mockResolvedValue([1]); // 1 row updated
            mockReport.findByPk.mockResolvedValue({ ReportID: 1, Type: 'Leak', WardID: 4 });
            mockSubscription.findAll.mockResolvedValue([{ ResidentID: 10 }]);
            mockResident.findByPk.mockResolvedValue({ Email: 'test@resident.com' });

            const res = await request(app)
                .put('/api/reports/1/status')
                .send({ Progress: 'Resolved' });

            expect(res.status).toBe(200);
            expect(mockReport.update).toHaveBeenCalledWith(
                expect.objectContaining({ Progress: 'Resolved' }),
                expect.anything()
            );
            // Email should contain success keywords
            expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({ subject: expect.stringContaining('✅ Report #1 Completed') }));
        });

        test('Updates mid-progress without resolving', async () => {
            mockReport.update.mockResolvedValue([1]); 
            mockReport.findByPk.mockResolvedValue({ ReportID: 1, Type: 'Leak', WardID: 4 });
            mockSubscription.findAll.mockResolvedValue([]);

            const res = await request(app)
                .put('/api/reports/1/status')
                .send({ Progress: 'Inspecting' });

            expect(res.status).toBe(200);
            expect(mockReport.update).toHaveBeenCalledWith(
                expect.objectContaining({ Progress: 'Inspecting' }),
                expect.anything()
            );
        });

        test('Returns 404 if report not found', async () => {
            mockReport.update.mockResolvedValue([0]);
            const res = await request(app).put('/api/reports/99/status').send({ Progress: 'Active' });
            expect(res.status).toBe(404);
        });
    });

    // ==========================================
    // ASSIGNMENTS, CLAIMS & WORKER ROUTES
    // ==========================================
    describe('Assignments & Claims', () => {
        test('POST /:id/assign allocates task and notifies', async () => {
            mockReport.findByPk.mockResolvedValue({ ReportID: 1, Type: 'Leak', WardID: 2 });
            mockMunicipalWorker.findByPk.mockResolvedValue({ Email: 'worker@muni.gov' });
            mockSubscription.findAll.mockResolvedValue([]);

            const res = await request(app).post('/api/reports/1/assign').send({ EmployeeID: 5 });
            
            expect(res.status).toBe(200);
            expect(mockAllocation.create).toHaveBeenCalledWith({ ReportID: '1', EmployeeID: 5 });
            expect(mockReport.update).toHaveBeenCalled();
            expect(mockSendMail).toHaveBeenCalled(); // Emails worker
        });

        test('PUT /:id/decline destroys allocation and notifies admin', async () => {
            const res = await request(app)
                .put('/api/reports/1/decline')
                .send({ reason: 'No tools', workerName: 'Bob' });
            
            expect(res.status).toBe(200);
            expect(mockAllocation.destroy).toHaveBeenCalled();
            expect(mockReport.update).toHaveBeenCalled();
            expect(mockSendMail).toHaveBeenCalled(); // Emails admin
        });

        test('PUT /:id/accept updates status to In Progress', async () => {
            mockReport.update.mockResolvedValue([1]);
            const res = await request(app).put('/api/reports/1/accept');
            expect(res.status).toBe(200);
            expect(res.body.message).toContain('accepted');
        });

        test('GET /assigned/:workerId fetches full reports via allocations', async () => {
            mockAllocation.findAll.mockResolvedValue([{ ReportID: 10 }]);
            mockReport.findAll.mockResolvedValue([{ ReportID: 10, Type: 'Pipe' }]);
            
            const res = await request(app).get('/api/reports/assigned/W-01');
            expect(res.status).toBe(200);
            expect(res.body[0].Type).toBe('Pipe');
        });
    });

    // ==========================================
    // ADMIN & CLAIMING ROUTES (Added for Coverage)
    // ==========================================
    describe('Admin & Claiming Routes (Added for Coverage)', () => {
        test('GET /available/unclaimed fetches pending reports', async () => {
            mockReport.findAll.mockResolvedValue([{ ReportID: 1, Status: 'Pending' }]);
            const res = await request(app).get('/api/reports/available/unclaimed');
            expect(res.status).toBe(200);
            expect(mockReport.findAll).toHaveBeenCalledWith({ where: { Status: 'Pending' } });
        });

        test('POST /:id/claim creates allocation and updates status', async () => {
            mockAllocation.create.mockResolvedValue({});
            mockReport.update.mockResolvedValue([1]);
            const res = await request(app).post('/api/reports/1/claim').send({ EmployeeID: 10 });
            expect(res.status).toBe(201);
            expect(mockAllocation.create).toHaveBeenCalledWith({ ReportID: '1', EmployeeID: 10 });
            expect(mockReport.update).toHaveBeenCalledWith(
                { Status: 'In Progress', Progress: 'Work Started' },
                { where: { ReportID: '1' } }
            );
        });

        test('GET /admin/tracker fetches allocations with includes', async () => {
            mockAllocation.findAll.mockResolvedValue([{ ReportID: 1 }]);
            const res = await request(app).get('/api/reports/admin/tracker');
            expect(res.status).toBe(200);
            expect(mockAllocation.findAll).toHaveBeenCalled();
        });

        test('PUT /:id/priority updates report priority', async () => {
            mockReport.update.mockResolvedValue([1]);
            const res = await request(app).put('/api/reports/1/priority').send({ Priority: 1 });
            expect(res.status).toBe(200);
            expect(mockReport.update).toHaveBeenCalledWith({ Priority: 1 }, { where: { ReportID: '1' } });
        });

        test('PUT /:id/edit updates report details', async () => {
            mockReport.update.mockResolvedValue([1]);
            const res = await request(app).put('/api/reports/1/edit').send({ Type: 'Water', Brief: 'Leak' });
            expect(res.status).toBe(200);
            
            mockReport.update.mockResolvedValue([0]); // test 404
            const res404 = await request(app).put('/api/reports/99/edit').send({ Type: 'Water' });
            expect(res404.status).toBe(404);
        });
    });

    // ==========================================
    // RATINGS & FREQUENCY (BUMPS)
    // ==========================================
    describe('Ratings & Bumps', () => {
        test('PUT /:id/Rating validates 1-5 correctly', async () => {
            const resInvalidHigh = await request(app).put('/api/reports/1/Rating').send({ rating: 6 });
            expect(resInvalidHigh.status).toBe(400);

            const resInvalidLow = await request(app).put('/api/reports/1/Rating').send({ rating: 0 });
            expect(resInvalidLow.status).toBe(400);

            mockReport.update.mockResolvedValue([1]);
            const resValid = await request(app).put('/api/reports/1/Rating').send({ rating: 5 });
            expect(resValid.status).toBe(200);
        });

        test('PUT /:id/bump increments frequency and reloads', async () => {
            const mockIncrement = jest.fn();
            const mockReload = jest.fn().mockImplementation(function() { this.Frequency = 2; });
            
            mockReport.findByPk.mockResolvedValue({
                ReportID: 1, Frequency: 1, increment: mockIncrement, reload: mockReload
            });

            const res = await request(app).put('/api/reports/1/bump');
            expect(res.status).toBe(200);
            expect(mockIncrement).toHaveBeenCalledWith('Frequency', { by: 1 });
            expect(mockReload).toHaveBeenCalled();
            expect(res.body.newFrequency).toBe(2);
        });
    });

    // ==========================================
    // IMAGE UPLOADS & FETCHES
    // ==========================================
    describe('Image Handling', () => {
        test('POST /report/:reportId uploads new image safely', async () => {
            mockReport.findByPk.mockResolvedValue({ ReportID: 1 });
            mockReportImage.create.mockResolvedValue({ ImageID: 99 });

            const payload = { imageBase64: 'data:image/png;base64,iVBORw0KGgoAAA' };
            const res = await request(app).post('/api/reports/report/1').send(payload);

            expect(res.status).toBe(201);
            expect(mockReportImage.create).toHaveBeenCalledWith(expect.objectContaining({ Type: 'image/png' }));
        });

        test('POST /report/:reportId rejects bad formats', async () => {
            mockReport.findByPk.mockResolvedValue({ ReportID: 1 });
            const res = await request(app).post('/api/reports/report/1').send({ Image: 'not_a_base64_string' });
            expect(res.status).toBe(400);
        });

        test('GET /report/:reportId translates Buffers to base64', async () => {
            mockReportImage.findAll.mockResolvedValue([
                { ImageID: 1, Type: 'image/jpeg', Image: Buffer.from('test') }
            ]);

            const res = await request(app).get('/api/reports/report/1');
            expect(res.status).toBe(200);
            expect(res.body[0].base64).toBeDefined(); // Buffer translates back to text securely
        });
    });

    // ==========================================
    // WORKER EDIT DETAILS
    // ==========================================
    describe('PUT /:id/worker-edit', () => {
        test('Allows edit if worker is allocated', async () => {
            mockAllocation.findOne.mockResolvedValue({ EmployeeID: 5 });
            
            const mockUpdate = jest.fn();
            mockReport.findByPk.mockResolvedValue({ Type: 'Old', update: mockUpdate });

            const res = await request(app).put('/api/reports/1/worker-edit').send({ workerId: 5, Type: 'New' });
            
            expect(res.status).toBe(200);
            expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ Type: 'New' }));
        });

        test('Forbids edit if worker is not allocated', async () => {
            mockAllocation.findOne.mockResolvedValue(null);
            
            const res = await request(app).put('/api/reports/1/worker-edit').send({ workerId: 5 });
            expect(res.status).toBe(403);
            expect(res.body.message).toContain('Forbidden');
        });
    });
});