const request = require('supertest');
const express = require('express');
const allocationRouter = require('../routes/allocations'); // Adjust path as needed
const { Allocation } = require('../models');

// Mock the Sequelize models
jest.mock('../models', () => ({
  Allocation: {
    findAll: jest.fn(),
    create: jest.fn(),
    destroy: jest.fn(),
  },
  Report: {},
  MunicipalWorker: {}
}));

const app = express();
app.use(express.json());
app.use('/allocations', allocationRouter);

describe('Allocations API Endpoints', () => {
  
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /allocations', () => {
    it('should fetch all allocations successfully', async () => {
      const mockData = [{ AllocationID: 1, ReportID: 10, EmployeeID: 5 }];
      Allocation.findAll.mockResolvedValue(mockData);

      const res = await request(app).get('/allocations');

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(mockData);
      expect(Allocation.findAll).toHaveBeenCalledTimes(1);
    });

    it('should return 500 if there is a server error', async () => {
      Allocation.findAll.mockRejectedValue(new Error('Database Error'));

      const res = await request(app).get('/allocations');

      expect(res.statusCode).toBe(500);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /allocations/worker/:workerId', () => {
    it('should fetch tasks for a specific worker', async () => {
      Allocation.findAll.mockResolvedValue([{ AllocationID: 1, EmployeeID: 'W123' }]);

      const res = await request(app).get('/allocations/worker/W123');

      expect(res.statusCode).toBe(200);
      expect(Allocation.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: { EmployeeID: 'W123' }
      }));
    });
    it('should return 500 if there is a server error fetching worker tasks', async () => {
      Allocation.findAll.mockRejectedValue(new Error('Database Error'));
      const res = await request(app).get('/allocations/worker/W123');
      
      expect(res.statusCode).toBe(500);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /allocations/report/:reportId', () => {
    it('should fetch workers assigned to a specific report', async () => {
      const mockData = [{ AllocationID: 2, ReportID: '10', EmployeeID: 'W1' }];
      Allocation.findAll.mockResolvedValue(mockData);

      const res = await request(app).get('/allocations/report/10');

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(mockData);
      expect(Allocation.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: { ReportID: '10' }
      }));
    });

    it('should return 500 if there is a server error fetching report allocations', async () => {
      Allocation.findAll.mockRejectedValue(new Error('Database Error'));
      const res = await request(app).get('/allocations/report/10');
      
      expect(res.statusCode).toBe(500);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /allocations', () => {
    it('should assign a worker to a report', async () => {
      const newEntry = { ReportID: 101, EmployeeID: 50 };
      Allocation.create.mockResolvedValue({ id: 1, ...newEntry }); //pretend to return a new id of 1 and the new entry

      const res = await request(app)
        .post('/allocations')
        .send(newEntry);

      expect(res.statusCode).toBe(201);
      expect(res.body.message).toBe("Worker successfully assigned to task!");
      expect(Allocation.create).toHaveBeenCalledWith(newEntry);
    });

    it('should return 400 if creation fails (validation error)', async () => {
      Allocation.create.mockRejectedValue(new Error('Validation failed'));

      const res = await request(app)
        .post('/allocations')
        .send({});

      expect(res.statusCode).toBe(400);
    });
  });

  describe('DELETE /allocations/:id', () => {
    it('should unassign a worker successfully', async () => {
      Allocation.destroy.mockResolvedValue(1); // 1 row deleted

      const res = await request(app).delete('/allocations/99');

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe('Worker unassigned successfully');
    });

    it('should return 500 if there is a server error during deletion', async () => {
      Allocation.destroy.mockRejectedValue(new Error('Database Error'));
      
      const res = await request(app).delete('/allocations/99');
      
      expect(res.statusCode).toBe(500);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 404 if allocation does not exist', async () => {
      Allocation.destroy.mockResolvedValue(0); // 0 rows deleted

      const res = await request(app).delete('/allocations/99');

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe('Allocation not found');
    });
  });
});