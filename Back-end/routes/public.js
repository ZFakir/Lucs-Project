const express = require('express');
const router = express.Router();
const { Report, Ward, Op } = require('../models');

router.get('/reports/ward/:wardId', async (req, res)=>{
    const report=await Report.findAll({
        where:{
            WardID:req.params.wardId,
        },
        order:[['CreatedAt','DESC']]
    });
    res.json(report);




});

router.get('/geography/wards', async (req, res)=>{
    const wards=await Ward.findAll();
    res.json(wards);
});

// GET: Fetch details for ONE specific ward
// We created this specific endpoint to prevent the frontend from having to download
// the entire database of wards just to find one. 
router.get('/geography/wards/:wardId', async (req, res) => {
    try {
        // We use 'findOne' instead of 'findAll' because we expect exactly one match.
        // We use req.params.wardId to grab the ID directly from the URL.
        const ward = await Ward.findOne({
            where: { WardID: req.params.wardId }
        });
        
        // If a user manually types a random/fake ward ID into their browser URL,
        // this catches it and safely returns a 404 Not Found error without crashing the server.
        if (!ward) {
            return res.status(404).json({ message: 'Ward not found' });
        }
        
        // If successful, send the single ward object back to the frontend as JSON.
        res.json(ward); 
    } catch (err) {
        console.error("Error fetching public ward details:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports=router;