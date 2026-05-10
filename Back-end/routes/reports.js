const express=require('express');
const router=express.Router();
const {Report, ReportImage, Allocation,Notification, Resident, Subscription}=require('../models');
const { Op } = require('sequelize');
const { MunicipalWorker } = require('../models');

const nodemailer = require('nodemailer');

// Update your transporter setup:
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        // This is the critical part to fix the "self-signed certificate" error
        rejectUnauthorized: false 
    }
});

const ADMIN_EMAIL = '2820314@students.wits.ac.za, 2799656@students.wits.ac.za, 2805279@students.wits.ac.za';

// ─── Email helper 
async function sendEmail(to, subject, html) {
    try {
        await transporter.sendMail({
            from: `"Civic Ledger Alerts" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html
        });
        console.log(`[Email] Sent to ${to}: ${subject}`);
    } catch (err) {
        console.error('[Email] Failed to send:', err.message);
    }
}

async function notify(recipientId, type, title, message, reportId = null) {
    try {
        await Notification.create({
            RecipientID: String(recipientId),
            Type: type,
            Title: title,
            Message: message,
            ReportID: reportId
        });
    } catch (err) {
        console.error('[Notify] Failed:', err.message);
    }
}

if (Allocation && Report && MunicipalWorker) {
    Allocation.belongsTo(Report, { foreignKey: 'ReportID' });
    Report.hasMany(Allocation, { foreignKey: 'ReportID' });

    Allocation.belongsTo(MunicipalWorker, { foreignKey: 'EmployeeID' });
    MunicipalWorker.hasMany(Allocation, { foreignKey: 'EmployeeID' });
} else {
    console.error("CRITICAL: One or more models failed to load. Check your paths and exports.");
}

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

// //GET: Fetch all reports for a SPECIFIC Resident
// router.get('/resident/:residentId', async (req,res)=>{
//     try{
//         const residentReports=await Report.findAll({where:{ResidentID:req.params.residentId}});
//         res.json(residentReports);
//     }catch (err){
//         console.error(err);
//         res.status(500).json({error:err.message});
//     }
// });
// GET: Fetch all reports for a SPECIFIC Resident
router.get('/resident/:residentId', async (req,res)=>{
    try{
        const residentReports=await Report.findAll({where:{ResidentID:req.params.residentId}});
        res.json({ reports: residentReports }); // Keep the { reports: ... } wrapper so the frontend still works!
    }catch (err){
        console.error(err);
        res.status(500).json({error:err.message});
    }
});


// POST: Log a new report/fault and NOTIFIES ADMIN 
router.post('/', async (req, res) => {
    try {
        // 1. Create the base report
        const newReport = await Report.create(req.body);
        const paused = req.headers['x-notif-paused'] === 'true';

        // 2. 🚨 NEW LOGIC: Process and save the images
        if (req.body.Images && Array.isArray(req.body.Images) && req.body.Images.length > 0) {
            const imagePromises = req.body.Images.map(async (base64String) => {
                // Use Regex to split the "data:image/png;base64," prefix from the raw data
                const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                
                if (matches && matches.length === 3) {
                    const mimeType = matches[1]; // e.g., 'image/jpeg'
                    const base64Data = matches[2]; // The raw alphanumeric string
                    
                    // Convert the string into a binary Buffer
                    const imageBuffer = Buffer.from(base64Data, 'base64');

                    // Save it to the ReportImage table
                    return ReportImage.create({
                        ReportID: newReport.ReportID,
                        Type: mimeType,
                        Image: imageBuffer
                    });
                }
            });

            // Wait for all images to finish saving to the database
            await Promise.all(imagePromises);
        }

        // 3. Existing Notification Logic
        await notify('admin', 'NEW_REPORT',
            `New ${newReport.Type} Report`,
            `A new fault has been logged in Ward ${newReport.WardID || 'N/A'}. Report #${newReport.ReportID} is pending assignment.`,
            newReport.ReportID
        );

        // Only email if not paused
        if (!paused) {
             await sendEmail(
            ADMIN_EMAIL,
            `🔔 New Report: ${newReport.Type}`,
            `
            <div style="font-family:sans-serif;max-width:600px;margin:auto;background:#1a1a1a;color:#e2e2e2;padding:32px;border-radius:12px;">
                <h2 style="color:#ff8c00;margin:0 0 8px;">New Fault Reported</h2>
                <p style="color:#a3a3a3;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;">Civic Ledger Alert</p>
                <hr style="border:none;border-top:1px solid #333;margin:20px 0;">
                <p><strong>Type:</strong> ${newReport.Type}</p>
                <p><strong>Ward:</strong> ${newReport.WardID || 'N/A'}</p>
                <p><strong>Report ID:</strong> #${newReport.ReportID}</p>
                <p><strong>Status:</strong> Pending Assignment</p>
                <hr style="border:none;border-top:1px solid #333;margin:20px 0;">
                <p style="color:#737373;font-size:11px;">Log in to the Admin Dashboard to assign this report to a field operative.</p>
            </div>
            `
            );
        } else {
            console.log('[Email] Skipped — notifications paused by user');
        }
        // email residents subscribed to this ward
        const subscriptions = await Subscription.findAll({ 
            where: { WardID: newReport.WardID } 
        });

        for (const sub of subscriptions) {
            
            await notify(sub.ResidentID, 'WARD_REPORT',
                `New Report in Your Area: ${newReport.Type}`,
                `A new report has been logged in Ward ${newReport.WardID}. Report #${newReport.ReportID} is pending assignment.`,
                newReport.ReportID
            );

            // Fetch the specific resident for THIS subscription to get their email
            const residentToNotify = await Resident.findByPk(sub.ResidentID);

            // Only email if not paused, the resident exists, and they have an email address
            if (!paused && residentToNotify && residentToNotify.Email) {
                await sendEmail(
                    residentToNotify.Email, 
                    `🔔 New Report: ${newReport.Type}`,
                    `
                    <div style="font-family:sans-serif;max-width:600px;margin:auto;background:#1a1a1a;color:#e2e2e2;padding:32px;border-radius:12px;">
                        <h2 style="color:#ff8c00;margin:0 0 8px;">New Fault Reported</h2>
                        <p style="color:#a3a3a3;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;">Groundwork Alert</p>
                        <hr style="border:none;border-top:1px solid #333;margin:20px 0;">
                        <p><strong>Type:</strong> ${newReport.Type}</p>
                        <p><strong>Ward:</strong> ${newReport.WardID || 'N/A'}</p>
                        <p><strong>Report ID:</strong> #${newReport.ReportID}</p>
                        <p><strong>Status:</strong> Pending Assignment</p>
                        <hr style="border:none;border-top:1px solid #333;margin:20px 0;">
                        <p style="color:#737373;font-size:11px;">Log in to your dashboard to track the status of this report.</p>
                    </div>
                    `
                );
            }
        }

    res.status(201).json({ message: 'Report logged successfully', report: newReport });
    } catch (err) {
        console.error('Submit failed on backend:', err);
        // Ensure this matches the error message your frontend test is looking for
        res.status(400).json({ error: 'Failed to log report', details: err.message });
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

//PUT: Update the status of a report (Used by workers when fixing a fault)
router.put('/:id/status', async (req, res) => {
    try {
        const reportId = req.params.id;
        const { Status, Progress, DateFulfilled } = req.body;
        const paused = req.headers['x-notif-paused'] === 'true';

        let progressValue = Progress || Status;
        const updatePayload = {};

        if (progressValue == 100 || progressValue === 'Fixed') {
            updatePayload.Status = 'Fixed';
            updatePayload.Progress = 'Fixed';
        } else {
            updatePayload.Progress = progressValue;
        }

        updatePayload.DateFulfilled = DateFulfilled || (progressValue === 'Resolved' ? new Date() : null);

        const [updatedRows] = await Report.update(updatePayload, {
            where: { ReportID: reportId }
        });

        if (updatedRows === 0) {
            return res.status(404).json({ message: 'Report not found' });
        }

        // Notify admin when report is completed 
        const isCompleted = progressValue === 'Fixed' || progressValue === 'Resolved' || progressValue == 100;
        if (isCompleted) {
            const report = await Report.findByPk(reportId);

            await notify(
                'admin',
                'REPORT_COMPLETED',
                `Report #${reportId} Completed`,
                `Report #${reportId} (${report ? report.Type : 'Unknown'}) in Ward ${report ? report.WardID : 'N/A'} has been marked as resolved.`,
                reportId
            );

            if (!paused) {
                await sendEmail(
                    ADMIN_EMAIL,
                    `✅ Report #${reportId} Completed`,
                    `
                    <div style="font-family:sans-serif;max-width:600px;margin:auto;background:#1a1a1a;color:#e2e2e2;padding:32px;border-radius:12px;">
                        <h2 style="color:#4ade80;margin:0 0 8px;">Report Resolved</h2>
                        <p style="color:#a3a3a3;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;">Civic Ledger Alert</p>
                        <hr style="border:none;border-top:1px solid #333;margin:20px 0;">
                        <p><strong>Report ID:</strong> #${reportId}</p>
                        <p><strong>Type:</strong> ${report ? report.Type : 'N/A'}</p>
                        <p><strong>Ward:</strong> ${report ? report.WardID : 'N/A'}</p>
                        <p><strong>Status:</strong> Resolved ✓</p>
                        <hr style="border:none;border-top:1px solid #333;margin:20px 0;">
                        <p style="color:#737373;font-size:11px;">The field operative has marked this task as complete.</p>
                    </div>
                    `
                );
            }
        }

        res.status(200).json({ message: 'Report status updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
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

// POST: Admin assigns a report to a worker and NOTIFIES WORKER 
router.post('/:id/assign', async (req, res) => {
    try {
        const { EmployeeID } = req.body;
        const ReportID = req.params.id;
        const paused = req.headers['x-notif-paused'] === 'true';

        await Allocation.create({ ReportID, EmployeeID });
        await Report.update(
            { Status: 'Assigned', Progress: 'Assigned to Field Staff' },
            { where: { ReportID } }
        );

        const report = await Report.findByPk(ReportID);
        const taskType = report ? report.Type : 'a task';
        const ward = report ? `Ward ${report.WardID}` : 'your area';

        await notify(EmployeeID, 'TASK_ASSIGNED',
            `New Assignment: ${taskType}`,
            `You have been assigned a new task in ${ward}. Report #${ReportID} is ready for acceptance.`,
            ReportID
        );

        if (!paused) {
            const worker = await MunicipalWorker.findByPk(EmployeeID);
            if (worker && worker.Email) {
                await sendEmail(
                worker.Email,
                `📌 New Task Assigned: ${taskType}`,
                `
                <div style="font-family:sans-serif;max-width:600px;margin:auto;background:#1a1a1a;color:#e2e2e2;padding:32px;border-radius:12px;">
                    <h2 style="color:#22d3ee;margin:0 0 8px;">New Task Assigned</h2>
                    <p style="color:#a3a3a3;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;">Civic Ledger Field Operations</p>
                    <hr style="border:none;border-top:1px solid #333;margin:20px 0;">
                    <p>Hi <strong>${worker.FirstName}</strong>,</p>
                    <p>You have been assigned a new field task. Please log in to accept or decline.</p>
                    <p><strong>Task Type:</strong> ${taskType}</p>
                    <p><strong>Location:</strong> ${ward}</p>
                    <p><strong>Report ID:</strong> #${ReportID}</p>
                    <hr style="border:none;border-top:1px solid #333;margin:20px 0;">
                    <p style="color:#737373;font-size:11px;">Log in to the Worker Dashboard to accept this task and begin work.</p>
                </div>
                `
            );
            }
        } else {
            console.log('[Email] Skipped — notifications paused by user');
        }

        res.status(200).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

//GET: tracks workers for admins
router.get('/admin/tracker', async (req, res) => {
    try {
        const trackerData = await Allocation.findAll({
            include: [
                { model: Report, attributes: ['Type', 'Progress'] },
                { model: MunicipalWorker, attributes: ['FirstName', 'LastName'] }
            ]
        });
        res.json(trackerData);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

//PUT: Sets priority for reports
router.put('/:id/priority', async (req, res) => {
    try {
        const { Priority } = req.body;
        await Report.update({ Priority }, { where: { ReportID: req.params.id } });
        res.status(200).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT: Admin Edit Report Details
router.put('/:id/edit', async (req, res) => {
    try {
        const reportId = req.params.id;
        // Destructure all possible editable fields
        const { Type, Progress, WardID, Priority, Latitude, Longitude } = req.body;

        const [updatedRows] = await Report.update(
            { Type, Progress, WardID, Priority, Latitude, Longitude },
            { where: { ReportID: reportId } }
        );

        if (updatedRows === 0) {
            return res.status(404).json({ message: 'Report not found or no changes made' });
        }

        res.status(200).json({ success: true, message: 'Report updated successfully' });
    } catch (err) {
        console.error("Admin Edit Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// PUT: Worker declines a task and NOTIFIES ADMIN 
router.put('/:id/decline', async (req, res) => {
    try {
        const reportId = req.params.id;
        const { reason, workerName } = req.body;
        const paused = req.headers['x-notif-paused'] === 'true';

        await Allocation.destroy({ where: { ReportID: reportId } });
        await Report.update(
            { Status: 'Pending', Progress: `Pending - Declined by ${workerName}: ${reason}` },
            { where: { ReportID: reportId } }
        );

        await notify('admin', 'TASK_DECLINED',
            `Task #${reportId} Declined`,
            `${workerName} declined Report #${reportId}. Reason: "${reason}". The task needs reassignment.`,
            reportId
        );

        if (!paused) {
            await sendEmail(
            ADMIN_EMAIL,
            `⚠️ Task #${reportId} Declined — Reassignment Needed`,
            `
            <div style="font-family:sans-serif;max-width:600px;margin:auto;background:#1a1a1a;color:#e2e2e2;padding:32px;border-radius:12px;">
                <h2 style="color:#ef4444;margin:0 0 8px;">Task Declined</h2>
                <p style="color:#a3a3a3;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;">Civic Ledger Alert</p>
                <hr style="border:none;border-top:1px solid #333;margin:20px 0;">
                <p><strong>Report ID:</strong> #${reportId}</p>
                <p><strong>Declined By:</strong> ${workerName}</p>
                <p><strong>Reason:</strong> ${reason}</p>
                <p><strong>Action Required:</strong> Reassignment needed</p>
                <hr style="border:none;border-top:1px solid #333;margin:20px 0;">
                <p style="color:#737373;font-size:11px;">Log in to the Admin Dashboard to reassign this task to another operative.</p>
            </div>
            `
        );
        } else {
            console.log('[Email] Skipped — notifications paused by user');
        }

        res.status(200).json({ message: 'Task returned to pool' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// GET: Fetch reports assigned to a specific worker
router.get('/assigned/:workerId', async (req, res) => {
    try {
        const { workerId } = req.params;
        const assignments = await Allocation.findAll({ where: { EmployeeID: workerId } });
        const reportIds = assignments.map(a => a.ReportID);

        // We remove the [Op.or] filter so we get EVERYTHING (Active + Fixed)
        const reports = await Report.findAll({
            where: {
                ReportID: reportIds
            }
        });
        res.json(reports);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT: Worker accepts an assigned task
router.put('/:id/accept', async (req, res) => {
    try {
        const reportId = req.params.id;
        
        const [updatedRows] = await Report.update(
            { Progress: 'In Progress' }, // Move to the progress stage
            { where: { ReportID: reportId } }
        );

        if (updatedRows === 0) {
            return res.status(404).json({ message: 'Report not found' });
        }
        res.status(200).json({ message: 'Task accepted and now in progress' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET: Fetch all reports for a specific Ward
// GET /api/reports/ward/:wardId/:muniId
router.get('/ward/:wardId/:muniId', async (req, res) => {
    try {
        const { wardId, muniId } = req.params;

        const reports = await Report.findAll({
            where: {
                WardID: wardId,
                MunicipalityID: muniId
            },
            // Sort by newest first so the dashboard is relevant
            order: [['CreatedAt', 'DESC']] 
        });

        res.json(reports);
    } catch (err) {
        console.error("Report Fetch Error:", err);
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

// PUT: Update the rating of a specific report
router.put('/:id/Rating', async (req, res) => {
    try {
        const reportId = req.params.id;
        const { rating } = req.body;

        // Validation: Ensure rating is between 1 and 5
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: "Invalid rating. Must be between 1 and 5." });
        }

        const [updatedRows] = await Report.update(
            { Rating: rating }, 
            { where: { ReportID: reportId } }
        );

        if (updatedRows === 0) {
            return res.status(404).json({ message: 'Report not found' });
        }

        res.status(200).json({ success: true, message: 'Rating submitted successfully' });
    } catch (err) {
        console.error("Rating Submission Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// GET: Fetch all images for a specific report as base64
router.get('/report/:reportId', async (req, res) => {
    try {
        const images = await ReportImage.findAll({
            where: { ReportID: req.params.reportId }
        });

        // Convert BLOB to base64 so the frontend can display them
        const formatted = images.map(img => ({
            ImageID: img.ImageID,
            Type: img.Type || 'image/jpeg',
            base64: img.Image ? img.Image.toString('base64') : null
        }));

        res.json(formatted);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports=router;