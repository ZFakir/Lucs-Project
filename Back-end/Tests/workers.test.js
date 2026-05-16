const request = require('supertest');
const express = require('express');
const workerRouter = require('../routes/workers'); // Adjust path as needed
const { MunicipalWorker } = require('../models');

// 1. Mock the Sequelize Model
jest.mock('../models', () => ({
    MunicipalWorker: {
        findAll: jest.fn(),
        create: jest.fn(),
        findByPk: jest.fn(),
        destroy: jest.fn(),
        findOne: jest.fn(),
        update: jest.fn(),
    }
}));

// 2. Mock the external verifyGoogleToken function
// Assuming it's defined in the same file or imported; we mock it globally for the route
global.verifyGoogleToken = jest.fn();

const app = express();
app.use(express.json());
app.use('/workers', workerRouter);

describe('MunicipalWorker API Endpoints', () => {

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /workers', () => {
        it('should return all workers', async () => {
            const mockWorkers = [{ EmployeeID: 1, Name: 'John Doe' }];
            MunicipalWorker.findAll.mockResolvedValue(mockWorkers);

            const res = await request(app).get('/workers');

            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual(mockWorkers);
        });
    });

    describe('POST /workers', () => {
        it('should create a new worker (sign-up)', async () => {
            const newWorker = { Name: 'Jane Smith', email: 'jane@municipality.gov' };
            MunicipalWorker.create.mockResolvedValue({ EmployeeID: 2, ...newWorker });

            const res = await request(app).post('/workers').send(newWorker);

            expect(res.statusCode).toBe(201);
            expect(res.body.EmployeeID).toBe(2);
        });

        it('should return 400 if creation fails', async () => {
            MunicipalWorker.create.mockRejectedValue(new Error('Validation error'));
            const res = await request(app).post('/workers').send({});
            expect(res.statusCode).toBe(400);
        });
    });

    describe('GET /workers/:id', () => {
        it('should return a worker by ID', async () => {
            MunicipalWorker.findByPk.mockResolvedValue({ EmployeeID: 1, Name: 'John' });
            const res = await request(app).get('/workers/1');
            expect(res.statusCode).toBe(200);
        });

        it('should return 404 if worker not found', async () => {
            MunicipalWorker.findByPk.mockResolvedValue(null);
            const res = await request(app).get('/workers/99');
            expect(res.statusCode).toBe(404);
        });
    });

    // --- Tests for GET /workers/active ---
    describe('GET /workers/active', () => {
        it('should fetch all active workers', async () => {
            MunicipalWorker.findAll.mockResolvedValue([{ EmployeeID: 2, Validated: true }]);
            const res = await request(app).get('/workers/active');
            expect(res.statusCode).toBe(200);
        });
    });

    // --- Tests for PUT /workers/invalidate/:id ---
    describe('PUT /workers/invalidate/:employeeId', () => {
        it('should disable a worker account if admin email is correct', async () => {
            MunicipalWorker.update.mockResolvedValue([1]);
            const res = await request(app)
                .put('/workers/invalidate/1')
                .send({ adminEmail: "2820314@students.wits.ac.za" });
            
            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe("Account disabled.");
        });

        it('should return 403 if admin email is wrong', async () => {
            const res = await request(app)
                .put('/workers/invalidate/1')
                .send({ adminEmail: "wrong@wits.ac.za" });
            
            expect(res.statusCode).toBe(403);
            expect(res.body.message).toBe("Admin access only.");
        });

        it('should return 404 if worker not found', async () => {
            MunicipalWorker.update.mockResolvedValue([0]);
            const res = await request(app)
                .put('/workers/invalidate/99')
                .send({ adminEmail: "2820314@students.wits.ac.za" });
            expect(res.statusCode).toBe(404);
        });
    });

    describe('PUT /workers/invalidate/:employeeId Extra Coverage', () => {
        it('should return 404 if worker to invalidate does not exist', async () => {
            MunicipalWorker.update.mockResolvedValue([0]); // 0 rows updated
            const res = await request(app)
                .put('/workers/invalidate/999')
                .send({ adminEmail: '2820314@students.wits.ac.za' });
            
            expect(res.statusCode).toBe(404);
            expect(res.body.message).toBe("Worker not found.");
        });

        it('should cover the catch block for invalidate', async () => {
            MunicipalWorker.update.mockRejectedValue(new Error('Invalidate Crash'));
            const res = await request(app)
                .put('/workers/invalidate/1')
                .send({ adminEmail: '2820314@students.wits.ac.za' });
            
            expect(res.statusCode).toBe(500);
        });
    });

    // --- Tests for PUT /workers/validate/:id ---
    describe('PUT /workers/validate/:employeeId', () => {
        it('should validate a worker successfully', async () => {
            MunicipalWorker.update.mockResolvedValue([1]);
            const res = await request(app).put('/workers/validate/1');
            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe("Worker validated successfully!");
        });

        it('should return 500 if update fails', async () => {
            MunicipalWorker.update.mockRejectedValue(new Error("Server Error"));
            const res = await request(app).put('/workers/validate/1');
            expect(res.statusCode).toBe(500);
        });
    });

    describe('DELETE /workers/:id', () => {
        it('should delete a worker successfully', async () => {
            MunicipalWorker.destroy.mockResolvedValue(1); // 1 row deleted
            const res = await request(app).delete('/workers/1');
            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Worker deleted successfully');
        });
    });

    describe('POST /workers/login', () => {
        const mockGoogleToken = 'fake-token';

        it('should login successfully for a valid, validated worker', async () => {
            // Mock Google verification
            global.verifyGoogleToken.mockResolvedValue({ email: 'test@gov.com' });
            // Mock DB find
            MunicipalWorker.findOne.mockResolvedValue({
                email: 'test@gov.com',
                Blacklisted: false,
                Validated: true
            });

            const res = await request(app)
                .post('/workers/login')
                .send({ googleToken: mockGoogleToken });

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Login successful!');
        });

        it('should return 403 if worker is blacklisted', async () => {
            global.verifyGoogleToken.mockResolvedValue({ email: 'bad@gov.com' });
            MunicipalWorker.findOne.mockResolvedValue({
                email: 'bad@gov.com',
                Blacklisted: true,
                Validated: true
            });

            const res = await request(app)
                .post('/workers/login')
                .send({ googleToken: mockGoogleToken });

            expect(res.statusCode).toBe(403);
            expect(res.body.message).toContain('blacklisted');
        });

        it('should return 403 if worker is not yet validated', async () => {
            global.verifyGoogleToken.mockResolvedValue({ email: 'new@gov.com' });
            MunicipalWorker.findOne.mockResolvedValue({
                email: 'new@gov.com',
                Blacklisted: false,
                Validated: false
            });

            const res = await request(app)
                .post('/workers/login')
                .send({ googleToken: mockGoogleToken });

            expect(res.statusCode).toBe(403);
            expect(res.body.message).toContain('pending validation');
        });
    });

    // ==========================================
    // EXTRA COVERAGE: MISSING ERROR BRANCHES
    // ==========================================
    describe('Missing Error & Branch Coverage', () => {
        it('GET /workers should return 500 on server error', async () => {
            MunicipalWorker.findAll.mockRejectedValue(new Error('DB Error'));
            const res = await request(app).get('/workers');
            expect(res.statusCode).toBe(500);
        });

        it('GET /workers/:id should return 500 on server error', async () => {
            MunicipalWorker.findByPk.mockRejectedValue(new Error('DB Error'));
            const res = await request(app).get('/workers/1');
            expect(res.statusCode).toBe(500);
        });

        it('GET /workers/active should return 500 on server error', async () => {
            MunicipalWorker.findAll.mockRejectedValue(new Error('DB Error'));
            const res = await request(app).get('/workers/active');
            expect(res.statusCode).toBe(500);
        });

        it('PUT /workers/validate/:employeeId should return 404 if not found', async () => {
            MunicipalWorker.update.mockResolvedValue([0]);
            const res = await request(app).put('/workers/validate/99');
            expect(res.statusCode).toBe(404);
        });

        it('DELETE /workers/:id should return 404 if not found', async () => {
            MunicipalWorker.destroy.mockResolvedValue(0);
            const res = await request(app).delete('/workers/99');
            expect(res.statusCode).toBe(404);
        });

        it('DELETE /workers/:id should return 500 on server error', async () => {
            MunicipalWorker.destroy.mockRejectedValue(new Error('DB Error'));
            const res = await request(app).delete('/workers/99');
            expect(res.statusCode).toBe(500);
        });

        it('POST /workers/login should return 404 if worker not found', async () => {
            MunicipalWorker.findOne.mockResolvedValue(null);
            const res = await request(app).post('/workers/login').send({});
            expect(res.statusCode).toBe(404);
        });

        it('POST /workers/login should return 500 on server error', async () => {
            MunicipalWorker.findOne.mockRejectedValue(new Error('DB Error'));
            const res = await request(app).post('/workers/login').send({});
            expect(res.statusCode).toBe(500);
        });
    });

    // ==========================================
    // EXTRA COVERAGE: PENDING WORKERS
    // ==========================================
    describe('GET /workers/pending', () => {
        it('should fetch all non-validated workers', async () => {
            MunicipalWorker.findAll.mockResolvedValue([{ EmployeeID: 3, Validated: false }]);
            const res = await request(app).get('/workers/pending');
            expect(res.statusCode).toBe(200);
        });

        it('should return 500 on server error', async () => {
            MunicipalWorker.findAll.mockRejectedValue(new Error('DB Error'));
            const res = await request(app).get('/workers/pending');
            expect(res.statusCode).toBe(500);
        });
    });

    // ==========================================
    // EXTRA COVERAGE: PROFILE ENDPOINTS
    // ==========================================
    describe('Profile Endpoints', () => {
        it('GET /workers/:id/profile should return profile with base64 image', async () => {
            MunicipalWorker.findByPk.mockResolvedValue({
                toJSON: () => ({ EmployeeID: 1, ProfilePicture: Buffer.from('testdata') })
            });
            const res = await request(app).get('/workers/1/profile');
            expect(res.statusCode).toBe(200);
            expect(res.body.ProfilePicture).toContain('data:image/jpeg;base64,');
        });

        it('GET /workers/:id/profile should return 404 if not found', async () => {
            MunicipalWorker.findByPk.mockResolvedValue(null);
            const res = await request(app).get('/workers/99/profile');
            expect(res.statusCode).toBe(404);
        });

        it('GET /workers/:id/profile should return 500 on error', async () => {
            MunicipalWorker.findByPk.mockRejectedValue(new Error('DB Error'));
            const res = await request(app).get('/workers/1/profile');
            expect(res.statusCode).toBe(500);
        });

        it('PUT /workers/:id/profile should update profile and parse base64 picture', async () => {
            MunicipalWorker.update.mockResolvedValue([1]);
            const res = await request(app)
                .put('/workers/1/profile')
                .send({ ProfilePicture: 'data:image/jpeg;base64,dGVzdA==' });
            expect(res.statusCode).toBe(200);
        });

        it('PUT /workers/:id/profile should return 404 if not found', async () => {
            MunicipalWorker.update.mockResolvedValue([0]);
            const res = await request(app).put('/workers/99/profile').send({});
            expect(res.statusCode).toBe(404);
        });

        it('PUT /workers/:id/profile should return 500 on error', async () => {
            MunicipalWorker.update.mockRejectedValue(new Error('DB Error'));
            const res = await request(app).put('/workers/1/profile').send({});
            expect(res.statusCode).toBe(500);
        });
    });
});