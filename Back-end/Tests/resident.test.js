const request = require('supertest');
const express = require('express');
const { Op } = require('sequelize');
const residentsRouter = require('../routes/residents'); // Adjust path as needed
const { Resident, Ward, Subscription } = require('../models');

// Mock Sequelize Models 
jest.mock('../models', () => ({
    Resident: {
        findAll: jest.fn(),
        create: jest.fn(),
        findByPk: jest.fn(),
        update: jest.fn(),
    },
    Ward: {},
    Subscription: {
        findAll: jest.fn(),
        create: jest.fn(),
        destroy: jest.fn(),
    },
}));

// Mock Sequelize Op so the router import doesn't break
jest.mock('sequelize', () => ({
    Op: { col: jest.fn((col) => col) },
}));

const app = express();
app.use(express.json());
app.use('/residents', residentsRouter);

describe('Residents API Endpoints', () => {

    afterEach(() => {
        jest.clearAllMocks();
    });

    // GET /residents 
    describe('GET /residents', () => {
        it('should return all residents with status 200', async () => {
            const mockResidents = [
                { ResidentID: 1, Username: 'alice', Email: 'alice@example.com' },
                { ResidentID: 2, Username: 'bob',   Email: 'bob@example.com'   },
            ];
            Resident.findAll.mockResolvedValue(mockResidents);

            const res = await request(app).get('/residents');

            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual(mockResidents);
            expect(Resident.findAll).toHaveBeenCalledTimes(1);
        });

        it('should return 500 when the database throws', async () => {
            Resident.findAll.mockRejectedValue(new Error('DB connection lost'));

            const res = await request(app).get('/residents');

            expect(res.statusCode).toBe(500);
            expect(res.body.error).toBe('DB connection lost');
        });
    });

    // POST /residents 
    describe('POST /residents', () => {
        it('should create a new resident and return 201', async () => {
            const payload = { Username: 'charlie', Email: 'charlie@example.com', Password: 'secret' };
            Resident.create.mockResolvedValue({ ResidentID: 3, ...payload });

            const res = await request(app).post('/residents').send(payload);

            expect(res.statusCode).toBe(201);
            expect(res.body.ResidentID).toBe(3);
            expect(res.body.Username).toBe('charlie');
        });

        it('should return 400 when creation fails (e.g. validation error)', async () => {
            Resident.create.mockRejectedValue(new Error('Validation error: Email cannot be null'));

            const res = await request(app).post('/residents').send({});

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toContain('Validation error');
        });
    });

    // GET /residents/:id/subscriptions 
    describe('GET /residents/:id/subscriptions', () => {
        it('should return subscriptions with ward data for a resident', async () => {
            const mockSubs = [
                { SubscriptionID: 10, ResidentID: 1, WardID: 5, MunicipalityID: 2, Ward: { WardID: 5, Name: 'Ward A' } },
            ];
            Subscription.findAll.mockResolvedValue(mockSubs);

            const res = await request(app).get('/residents/1/subscriptions');

            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual(mockSubs);
            expect(Subscription.findAll).toHaveBeenCalledWith(
                expect.objectContaining({ where: { ResidentID: '1' } })
            );
        });

        it('should return an empty array when the resident has no subscriptions', async () => {
            Subscription.findAll.mockResolvedValue([]);

            const res = await request(app).get('/residents/99/subscriptions');

            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual([]);
        });

        it('should return 500 when the database throws', async () => {
            Subscription.findAll.mockRejectedValue(new Error('Query failed'));

            const res = await request(app).get('/residents/1/subscriptions');

            expect(res.statusCode).toBe(500);
            expect(res.body.error).toBe('Query failed');
        });
    });

    //  POST /residents/subscribe 
    describe('POST /residents/subscribe', () => {
        const validPayload = { ResidentID: 1, WardID: 5, MunicipalityID: 2 };

        it('should create a subscription and return 201', async () => {
            Subscription.create.mockResolvedValue({ SubscriptionID: 20, ...validPayload });

            const res = await request(app).post('/residents/subscribe').send(validPayload);

            expect(res.statusCode).toBe(201);
            expect(res.body.ResidentID).toBe(1);
            expect(Subscription.create).toHaveBeenCalledWith(validPayload);
        });

        it('should return 400 when ResidentID is missing', async () => {
            const res = await request(app)
                .post('/residents/subscribe')
                .send({ WardID: 5, MunicipalityID: 2 }); // no ResidentID

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Missing required subscription data.');
        });

        it('should return 400 when WardID is missing', async () => {
            const res = await request(app)
                .post('/residents/subscribe')
                .send({ ResidentID: 1, MunicipalityID: 2 });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Missing required subscription data.');
        });

        it('should return 400 when MunicipalityID is missing', async () => {
            const res = await request(app)
                .post('/residents/subscribe')
                .send({ ResidentID: 1, WardID: 5 });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Missing required subscription data.');
        });

        it('should return 500 when the database throws', async () => {
            Subscription.create.mockRejectedValue(new Error('DB error'));

            const res = await request(app).post('/residents/subscribe').send(validPayload);

            expect(res.statusCode).toBe(500);
            expect(res.body.error).toBe('DB error');
        });
    });

    //  DELETE /residents/unsubscribe 
    describe('DELETE /residents/unsubscribe', () => {
        const validPayload = { ResidentID: 1, WardID: 5, MunicipalityID: 2 };

        it('should unsubscribe successfully and return 200', async () => {
            Subscription.destroy.mockResolvedValue(1); // 1 row deleted

            const res = await request(app).delete('/residents/unsubscribe').send(validPayload);

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Unsubscribed successfully.');
        });

        it('should return 404 when the subscription does not exist', async () => {
            Subscription.destroy.mockResolvedValue(0); // no rows deleted

            const res = await request(app).delete('/residents/unsubscribe').send(validPayload);

            expect(res.statusCode).toBe(404);
            expect(res.body.error).toBe('Subscription not found.');
        });

        it('should return 500 when the database throws', async () => {
            Subscription.destroy.mockRejectedValue(new Error('DB crash'));

            const res = await request(app).delete('/residents/unsubscribe').send(validPayload);

            expect(res.statusCode).toBe(500);
            expect(res.body.error).toBe('DB crash');
        });
    });

    // GET /residents/:id/profile 
    describe('GET /residents/:id/profile', () => {
        it('should return the resident profile', async () => {
            const mockResident = {
                ResidentID: 1,
                Username: 'alice',
                Email: 'alice@example.com',
                CellphoneNumber: '0821234567',
                ProfilePicture: 'data:image/jpeg;base64,abc123',
                toJSON: function () { return { ...this, toJSON: undefined }; },
            };
            Resident.findByPk.mockResolvedValue(mockResident);

            const res = await request(app).get('/residents/1/profile');

            expect(res.statusCode).toBe(200);
            expect(res.body.Username).toBe('alice');
            expect(res.body.Email).toBe('alice@example.com');
        });

        it('should return 404 when resident does not exist', async () => {
            Resident.findByPk.mockResolvedValue(null);

            const res = await request(app).get('/residents/99/profile');

            expect(res.statusCode).toBe(404);
            expect(res.body.message).toBe('Resident not found');
        });

        it('should return 500 when the database throws', async () => {
            Resident.findByPk.mockRejectedValue(new Error('DB error'));

            const res = await request(app).get('/residents/1/profile');

            expect(res.statusCode).toBe(500);
        });
    });

    // PUT /residents/:id/profile 
    describe('PUT /residents/:id/profile', () => {
        it('should update profile successfully', async () => {
            Resident.update.mockResolvedValue([1]);

            const res = await request(app)
                .put('/residents/1/profile')
                .send({ Username: 'alice2', Email: 'alice2@example.com', CellphoneNumber: '0829998888' });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Profile updated successfully');
        });

        it('should update profile with a base64 profile picture', async () => {
            Resident.update.mockResolvedValue([1]);

            const res = await request(app)
                .put('/residents/1/profile')
                .send({
                    Username: 'alice',
                    ProfilePicture: 'data:image/jpeg;base64,/9j/4AAQSkZJRgAB'
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should return 404 when the resident does not exist', async () => {
            Resident.update.mockResolvedValue([0]);

            const res = await request(app)
                .put('/residents/99/profile')
                .send({ Username: 'ghost' });

            expect(res.statusCode).toBe(404);
            expect(res.body.message).toBe('Resident not found');
        });

        it('should return 500 when the database throws', async () => {
            Resident.update.mockRejectedValue(new Error('Update failed'));

            const res = await request(app)
                .put('/residents/1/profile')
                .send({ Username: 'alice' });

            expect(res.statusCode).toBe(500);
        });
    });
});