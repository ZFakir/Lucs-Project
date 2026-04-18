const express=require('express');
const router=express.Router();
const {Province, Municipality, Ward }=require('../models');

// ----------------------
// PROVINCE ROUTES

// GET: Fetch all provinces
router.get('/provinces', async(req,res)=>{
    try{
        const provinces=await Province.findAll();
        res.json(provinces);
    }catch (err){
        console.error(err);
        res.status(500).json({error:err.message});
    }
});

//GET: Fetch all municipalities within a SPECIFC province
// Helpful so that only the relevant municipalities are displayed when a user selects a province in a dropdown
router.get('/provinces/:id/municipalities', async(req,res)=>{
    try{
        const municipalities=await Municipality.findAll({
            where:{ProvinceID: req.params.id}
        });
        res.json(municipalities);
    }catch (err){
        console.error(err);
        res.status(500).json({error:err.message});
    }
});

// ----------------------
// MUNICIPALITY ROUTES

//GET: Fetch all municipalities
router.get('/municpalities', async(req,res)=>{
    try{
        const municipalities=await Municipality.findAll();
        res.json(municipalities);
    }catch (err){
        console.error(err);
        res.status(500).json({error:err.message});
    }
});

//GET: Fetch all wards within a SPECIFC municipality
// Helpful so that only the relevant wards are displayed when a user selects a municipality in a dropdown
router.get('/municipalities/:id/wards', async(req,res)=>{
    try{
        const wards=await Ward.findAll({
            where:{MunicipalityID: req.params.id}
        });
        res.json(wards);
    }catch (err){
        console.error(err);
        res.status(500).json({error:err.message});
    }
});

// GET: Fetch a specific municipality by ID
router.get('/municipalities/:id', async (req, res) => {
    try {
        const municipality = await Municipality.findByPk(req.params.id);
        if (!municipality) {
            return res.status(404).json({ message: 'Municipality not found' });
        }
        res.json(municipality);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});
// ----------------------
// WARD ROUTES

//GET: Fetch all wards
router.get('/wards', async(req,res)=>{
    try{
        const wards=await Ward.findAll();
        res.json(wards);
    }catch (err){
        console.error(err);
        res.status(500).json({error:err.message});
    }
});

//GET: Fetch a specific ward by ID
router.get('/wards/:id', async(req,res)=>{
    try{
        const ward=await Ward.findByPk(req.params.id);
        if (!ward){
            return res.status(404).json({message:'Ward not found'});
        }
        res.json(ward);
    }catch (err){
        console.error(err);
        res.status(500).json({error:err.message});
    }
});

// GET: Fetch all Residents subscribed to a SPECIFIC Ward (For emergency broadcasts)
router.get('/wards/:id/subscribers', async (req, res) => {
    try {
        const { Ward, Resident } = require('../models'); // Import Resident model locally for this route

        const wardWithSubscribers = await Ward.findByPk(req.params.id, {
            include: [{
                model: Resident,
                through: { attributes: [] } // Hides the junction table data to keep the JSON clean
            }]
        });

        if (!wardWithSubscribers) {
            return res.status(404).json({ message: 'Ward not found' });
        }

        // Return the array of residents subscribed to this ward
        res.json(wardWithSubscribers.Residents);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports=router;