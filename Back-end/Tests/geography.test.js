const request = require('supertest');
const express = require('express');
const geographyRouter = require('../routes/geography'); // Adjust this path if your route file has a different name
const { Province, Municipality, Ward, Resident } = require('../models');

// Mock the Sequelize models
jest.mock('../models', () => ({
    Province: {
        findAll: jest.fn(),
    },
    Municipality: {
        findAll: jest.fn(),
        findByPk: jest.fn(),
    },
    Ward: {
        findAll: jest.fn(),
        findByPk: jest.fn(),
        findOne: jest.fn(),
    },
    Resident: {}
}));

const app = express();
app.use(express.json());
app.use('/geo', geographyRouter);

describe('Geography API Endpoints', () => {

    afterEach(() => {
        jest.clearAllMocks();
    });

    // ==========================================
    // PROVINCE ROUTES
    // ==========================================
    describe('GET /geo/provinces', () => {
        it('should fetch all provinces successfully', async () => {
            const mockProvinces = [{ ProvinceID: 1, ProvinceName: 'Gauteng' }];
            Province.findAll.mockResolvedValue(mockProvinces);

            const res = await request(app).get('/geo/provinces');
            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual(mockProvinces);
        });

        it('should return 500 on server error', async () => {
            Province.findAll.mockRejectedValue(new Error('DB crash'));
            const res = await request(app).get('/geo/provinces');
            expect(res.statusCode).toBe(500);
            expect(res.body).toHaveProperty('error');
        });
    });

    describe('GET /geo/provinces/:id/municipalities', () => {
        it('should fetch all municipalities within a specific province', async () => {
            const mockMunis = [{ MunicipalityID: 1, ProvinceID: 1 }];
            Municipality.findAll.mockResolvedValue(mockMunis);

            const res = await request(app).get('/geo/provinces/1/municipalities');
            expect(res.statusCode).toBe(200);
            expect(Municipality.findAll).toHaveBeenCalledWith({ where: { ProvinceID: '1' } });
        });

        it('should return 500 on server error', async () => {
            Municipality.findAll.mockRejectedValue(new Error('DB crash'));
            const res = await request(app).get('/geo/provinces/1/municipalities');
            expect(res.statusCode).toBe(500);
        });
    });

    // ==========================================
    // MUNICIPALITY ROUTES
    // ==========================================
    describe('GET /geo/municpalities', () => { // Note: using your exact route spelling (municpalities)
        it('should fetch all municipalities', async () => {
            Municipality.findAll.mockResolvedValue([{ MunicipalityID: 1 }]);
            const res = await request(app).get('/geo/municpalities');
            expect(res.statusCode).toBe(200);
        });

        it('should return 500 on server error', async () => {
            Municipality.findAll.mockRejectedValue(new Error('DB crash'));
            const res = await request(app).get('/geo/municpalities');
            expect(res.statusCode).toBe(500);
        });
    });

    describe('GET /geo/municipalities/:id/wards', () => {
        it('should fetch all wards within a specific municipality', async () => {
            Ward.findAll.mockResolvedValue([{ WardID: 1, MunicipalityID: 1 }]);
            const res = await request(app).get('/geo/municipalities/1/wards');
            expect(res.statusCode).toBe(200);
            expect(Ward.findAll).toHaveBeenCalledWith({ where: { MunicipalityID: '1' } });
        });

        it('should return 500 on server error', async () => {
            Ward.findAll.mockRejectedValue(new Error('DB crash'));
            const res = await request(app).get('/geo/municipalities/1/wards');
            expect(res.statusCode).toBe(500);
        });
    });

    describe('GET /geo/municipalities/:id', () => {
        it('should fetch a specific municipality by ID', async () => {
            Municipality.findByPk.mockResolvedValue({ MunicipalityID: 1 });
            const res = await request(app).get('/geo/municipalities/1');
            expect(res.statusCode).toBe(200);
        });

        it('should return 404 if municipality not found', async () => {
            Municipality.findByPk.mockResolvedValue(null);
            const res = await request(app).get('/geo/municipalities/99');
            expect(res.statusCode).toBe(404);
        });

        it('should return 500 on server error', async () => {
            Municipality.findByPk.mockRejectedValue(new Error('DB crash'));
            const res = await request(app).get('/geo/municipalities/1');
            expect(res.statusCode).toBe(500);
        });
    });

    // ==========================================
    // WARD ROUTES
    // ==========================================
    describe('GET /geo/wards', () => {
        it('should fetch all wards', async () => {
            Ward.findAll.mockResolvedValue([{ WardID: 1 }]);
            const res = await request(app).get('/geo/wards');
            expect(res.statusCode).toBe(200);
        });

        it('should return 500 on server error', async () => {
            Ward.findAll.mockRejectedValue(new Error('DB crash'));
            const res = await request(app).get('/geo/wards');
            expect(res.statusCode).toBe(500);
        });
    });

    describe('GET /geo/wards/:id', () => {
        it('should fetch a specific ward by ID', async () => {
            Ward.findByPk.mockResolvedValue({ WardID: 1 });
            const res = await request(app).get('/geo/wards/1');
            expect(res.statusCode).toBe(200);
        });

        it('should return 404 if ward not found', async () => {
            Ward.findByPk.mockResolvedValue(null);
            const res = await request(app).get('/geo/wards/99');
            expect(res.statusCode).toBe(404);
        });

        it('should return 500 on server error', async () => {
            Ward.findByPk.mockRejectedValue(new Error('DB crash'));
            const res = await request(app).get('/geo/wards/1');
            expect(res.statusCode).toBe(500);
        });
    });

    describe('GET /geo/wards/:muniId/:wardId', () => {
        it('should fetch a specific composite ward', async () => {
            Ward.findOne.mockResolvedValue({ WardID: 1, MunicipalityID: 1 });
            const res = await request(app).get('/geo/wards/1/1');
            expect(res.statusCode).toBe(200);
            expect(Ward.findOne).toHaveBeenCalledWith(expect.objectContaining({
                where: { WardID: '1', MunicipalityID: '1' }
            }));
        });

        it('should return 404 if composite ward not found', async () => {
            Ward.findOne.mockResolvedValue(null);
            const res = await request(app).get('/geo/wards/99/99');
            expect(res.statusCode).toBe(404);
        });

        it('should return 500 on server error', async () => {
            Ward.findOne.mockRejectedValue(new Error('DB crash'));
            const res = await request(app).get('/geo/wards/1/1');
            expect(res.statusCode).toBe(500);
        });
    });

    describe('GET /geo/wards/:muniId/:wardId/subscribers', () => {
        it('should fetch subscribers for a ward', async () => {
            const mockData = {
                WardID: 1,
                Residents: [{ ResidentID: 1, Name: 'Test Resident' }]
            };
            Ward.findOne.mockResolvedValue(mockData);

            const res = await request(app).get('/geo/wards/1/1/subscribers');
            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual(mockData.Residents);
        });

        it('should return 404 if ward with subscribers not found', async () => {
            Ward.findOne.mockResolvedValue(null);
            const res = await request(app).get('/geo/wards/99/99/subscribers');
            expect(res.statusCode).toBe(404);
        });

        it('should return 500 on server error', async () => {
            Ward.findOne.mockRejectedValue(new Error('DB crash'));
            const res = await request(app).get('/geo/wards/1/1/subscribers');
            expect(res.statusCode).toBe(500);
        });
    });
});