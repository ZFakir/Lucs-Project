const request = require('supertest');
const express = require('express');
const grievanceRouter = require('../routes/grievances'); // Adjust path as needed
const { Grievance } = require('../models');

// Mock the Sequelize models
jest.mock('../models', () => ({
    Grievance: {
        findAll: jest.fn(),
        findByPk: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        destroy: jest.fn(),
    },
    Resident: {},
    Municipality: {}
}));

const app = express();
app.use(express.json());
app.use('/grievances', grievanceRouter);

describe('Grievance API Endpoints', () => {

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /grievances', () => {
        it('should fetch all grievances', async () => {
            const mockGrievances = [{ GrievanceID: 1, Description: 'Pothole issue' }];
            Grievance.findAll.mockResolvedValue(mockGrievances);

            const res = await request(app).get('/grievances');

            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual(mockGrievances);
        });

        it('should return 500 on server error', async () => {
            Grievance.findAll.mockRejectedValue(new Error('Database connectivity issue'));
            const res = await request(app).get('/grievances');
            expect(res.statusCode).toBe(500);
            expect(res.body).toHaveProperty('error');
        });
    });

    describe('GET /grievances/resident/:residentId', () => {
        it('should fetch grievances for a specific resident', async () => {
            Grievance.findAll.mockResolvedValue([{ GrievanceID: 1, ResidentID: 'R101' }]);

            const res = await request(app).get('/grievances/resident/R101');

            expect(res.statusCode).toBe(200);
            expect(Grievance.findAll).toHaveBeenCalledWith({
                where: { ResidentID: 'R101' }
            });
        });

        it('should return 500 on server error', async () => {
            Grievance.findAll.mockRejectedValue(new Error('Database error'));
            const res = await request(app).get('/grievances/resident/R101');
            expect(res.statusCode).toBe(500);
            expect(res.body).toHaveProperty('error');
        });
    });

    describe('GET /grievances/municipality/:municipalId', () => {
        it('should fetch grievances for a specific municipality', async () => {
            Grievance.findAll.mockResolvedValue([{ GrievanceID: 2, MunicipalID: 'M1' }]);

            const res = await request(app).get('/grievances/municipality/M1');

            expect(res.statusCode).toBe(200);
            expect(Grievance.findAll).toHaveBeenCalledWith({
                where: { MunicipalID: 'M1' }
            });
        });

        it('should return 500 on server error', async () => {
            Grievance.findAll.mockRejectedValue(new Error('Database error'));
            const res = await request(app).get('/grievances/municipality/M1');
            expect(res.statusCode).toBe(500);
            expect(res.body).toHaveProperty('error');
        });
    });

    describe('GET /grievances/:id', () => {
        it('should return a single grievance by ID', async () => {
            const mockGrievance = { GrievanceID: 5, Description: 'Water leak' };
            Grievance.findByPk.mockResolvedValue(mockGrievance);

            const res = await request(app).get('/grievances/5');

            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual(mockGrievance);
        });

        it('should return 404 if grievance is not found', async () => {
            Grievance.findByPk.mockResolvedValue(null);
            const res = await request(app).get('/grievances/999');
            expect(res.statusCode).toBe(404);
            expect(res.body.message).toBe('Grievance not found');
        });
    });

    describe('POST /grievances', () => {
        it('should submit a new grievance successfully', async () => {
            const newPayload = { ResidentID: 1, Description: 'Electricity outage' };
            Grievance.create.mockResolvedValue({ GrievanceID: 10, ...newPayload });

            const res = await request(app)
                .post('/grievances')
                .send(newPayload);

            expect(res.statusCode).toBe(201);
            expect(res.body.message).toBe("Grievance submitted successfully!");
            expect(Grievance.create).toHaveBeenCalledWith(newPayload);
        });

        it('should return 400 if validation fails', async () => {
            Grievance.create.mockRejectedValue(new Error('Description is required'));
            const res = await request(app).post('/grievances').send({});
            expect(res.statusCode).toBe(400);
        });
    });

    describe('PUT /grievances/:id/resolve', () => {
        it('should mark a grievance as resolved', async () => {
            Grievance.update.mockResolvedValue([1]); // Sequelize update returns array with count

            const res = await request(app).put('/grievances/5/resolve');

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Grievance marked as resolved successfully');
            expect(Grievance.update).toHaveBeenCalledWith(
                { Resolved: true },
                { where: { GrievanceID: '5' } }
            );
        });

        it('should return 500 on server error', async () => {
            Grievance.update.mockRejectedValue(new Error('Database error'));
            const res = await request(app).put('/grievances/5/resolve');
            expect(res.statusCode).toBe(500);
            expect(res.body).toHaveProperty('error');
        });

        it('should return 404 if trying to resolve a non-existent grievance', async () => {
            Grievance.update.mockResolvedValue([0]);
            const res = await request(app).put('/grievances/999/resolve');
            expect(res.statusCode).toBe(404);
        });
    });

    describe('DELETE /grievances/:id', () => {
        it('should delete a grievance successfully', async () => {
            Grievance.destroy.mockResolvedValue(1);

            const res = await request(app).delete('/grievances/10');

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('Grievance deleted successfully');
        });

        it('should return 500 on server error', async () => {
            Grievance.destroy.mockRejectedValue(new Error('Database error'));
            const res = await request(app).delete('/grievances/10');
            expect(res.statusCode).toBe(500);
            expect(res.body).toHaveProperty('error');
        });

        it('should return 404 if delete target is not found', async () => {
            Grievance.destroy.mockResolvedValue(0);
            const res = await request(app).delete('/grievances/10');
            expect(res.statusCode).toBe(404);
        });
    });
});