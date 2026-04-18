const express=require('express');
const router=express.Router();
const {Report, ReportImage, Allocation}=require('../models');

//GET: FEtch ALL reports (Useful for the Municipal Dashboard)
router.get('/',async (req,res)=>{
    try{
        const reports=await Report.findAll();
        res.json(reports);
    }catch (err){
        console.error(err);
        res.status(500).json({error:err.message});
    }
});

//GET: Fetch all reports for a SPECIFIC Resident
router.get('/resident/:residentId', async (req,res)=>{
    try{
        const residentReports=await Report.findAll({where:{ResidentID:req.params.residentId}});
        res.json(residentReports);
    }catch (err){
        console.error(err);
        res.status(500).json({error:err.message});
    }
});

//POST: Log a new report/fault
router.post('/', async (req,res)=>{
    try{
        const newReport=await Report.create(req.body);
        res.status(201).json({message:"Report logged successfully", report:newReport});
    }catch (err){
        console.error(err);
        res.status(400).json({error:err.message});
    }
});

//GET: Fetch a single report by its exact ID
router.get('/:id', async (req,res)=>{
    try{
        const report =await Report.findByPk(req.params.id);
        if (!report){
            return res.status(404).json({message:'Report not found'});
        }
        res.json(report);
    }catch (err){
        console.error(err);
        res.status(500).json({error:err.message});
    }
});

//PUT: Update the status of a report (Used by workers when when fixing a fault)
router.put('/:id/status', async(req,res)=>{
    try{
        //Extract the fields the worker wants to update
        const {Status, Progress, DateFulfilled}=req.body;

        const [updatedRows]=await Report.update({Status, Progress, DateFulfilled},{where:{ReportID:req.params.id}});
        if (updatedRows===0) {
            return res.status(404).json({message:'Report not found'});
        }
        res.status(200).json({message:'Report status updated successfully'});
    }catch (err){
        console.error(err);
        res.status(500).json({error:err.message});
    }
});

//DELETE: Remove a report by its ID (Used for testing purposes)
router.delete('/:id', async (req,res)=>{
    try{
        const deleted=await Report.destroy({where:{ReportID:req.params.id}});
        if (deleted===0){
            return res.status(404).json({message:'Report not found'});
        }
        res.status(200).json({message:'Report deleted successfully'});
    }catch (err){
        console.error(err);
        res.status(500).json({error:err.message});
    }
});

// Luc stuff. its for claiming reports for workers.
// A. GET: Fetch reports that have no allocation yet
router.get('/available/unclaimed', async (req, res) => {
    try {
        const unclaimed = await Report.findAll({
            where: { Status: 'Pending' }
        });
        res.json(unclaimed);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// B. POST: Create the link between Worker and Report
router.post('/:id/claim', async (req, res) => {
    try {
        const { EmployeeID } = req.body;
        const ReportID = req.params.id;

        // 1. Create the Allocation entry
        await Allocation.create({ ReportID, EmployeeID });

        // 2. Update Report status
        await Report.update(
            { Status: 'In Progress', Progress: 'Work Started' },
            { where: { ReportID } }
        );

        res.status(201).json({ message: "Task successfully claimed" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST: Admin assigns a report to a worker
router.post('/:id/assign', async (req, res) => {
    try {
        const { EmployeeID } = req.body;
        const ReportID = req.params.id;

        // 1. Create the link in the Allocation table
        await Allocation.create({ 
            ReportID: ReportID, 
            EmployeeID: EmployeeID 
        });

        // 2. Update the report status so the worker can see it
        await Report.update(
            { Status: 'Assigned', Progress: 'Assigned to Field Staff' },
            { where: { ReportID: ReportID } }
        );

        res.status(200).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET: Fetch reports assigned to a specific worker
router.get('/assigned/:workerId', async (req, res) => {
    try {
        const { workerId } = req.params;

        // Find all allocations for this worker and include the Report details
        const assignments = await Allocation.findAll({
            where: { EmployeeID: workerId }
        });

        // Get the IDs of the reports assigned to this worker
        const reportIds = assignments.map(a => a.ReportID);

        // Fetch the actual reports
        const reports = await Report.findAll({
            where: {
                ReportID: reportIds,
                Status: ['Assigned', 'In Progress'] // Only show active jobs
            }
        });

        res.json(reports);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET: Fetch all reports for a specific Ward
// GET: Fetch all reports for a specific Ward
router.get('/ward/:wardId', async (req, res) => {
    try {
        const reports = await Report.findAll({
            where: { WardID: req.params.wardId }, // Fixed the 'req.req' typo
            order: [['CreatedAt', 'DESC']]        // Fixed the column name to match your DB
        });
        res.json(reports);
    } catch (err) {
        console.error('Error fetching ward reports:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT: Increment the Frequency (Bump) of a specific report
router.put('/:id/bump', async (req, res) => {
    try {
        const report = await Report.findByPk(req.params.id);
        
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        // Increment the frequency by 1
        await report.increment('Frequency', { by: 1 });
        
        // Reload to get the fresh data
        await report.reload();

        res.json({ message: 'Issue bumped successfully', newFrequency: report.Frequency });
    } catch (err) {
        console.error('Error bumping report:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports=router;