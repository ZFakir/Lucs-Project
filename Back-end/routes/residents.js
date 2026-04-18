const express = require('express');
const router = express.Router();
const {Resident,Ward,Subscription} = require('../models');

// GET: Fetch all residents
router.get('/', async (req, res) => {
  try {
    const residents = await Resident.findAll();
    res.json(residents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Create a new resident (Sign-up)
router.post('/', async (req, res) => {
  try {
    const newResident = await Resident.create(req.body);
    res.status(201).json(newResident);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
//returns subscriptions for a particular resident
router.get('/:id/subscriptions', async (req, res) => {
    try {
        const residentId = req.params.id;

        // Find the resident by Primary Key and "include" their associated Wards
        const residentWithWards = await Resident.findByPk(residentId, {
            include: [{
                model: Ward,
                // The 'through' option refers to the Subscription table 
                // Setting attributes to [] prevents the junction table data from cluttering the result
                through: { attributes: [] } 
            }]//this is how sqlise does join
        });

        if (!residentWithWards) {
            return res.status(404).json({ message: 'Resident not found' });
        }

        // residentWithWards.Wards is an array of Ward objects
        res.json(residentWithWards.Wards);
    } catch (err) {
        console.error('Error fetching subscriptions:', err);
        res.status(500).json({ error: err.message });
    }
});//Returns an array of wards

router.post('/subscribe', async (req, res) => {
    try {
        const { ResidentID, WardID } = req.body;

        // 1. Validation: Ensure both the resident and ward actually exist in Azure
        const resident = await Resident.findByPk(ResidentID);
        const ward = await Ward.findByPk(WardID);

        if (!resident || !ward) {
            return res.status(404).json({ 
                error: 'Resident or Ward not found. Please check the IDs.' 
            });
        }

        // 2. Check if the subscription already exists to avoid duplicates
        const existingSubscription = await Subscription.findOne({
            where: { ResidentID, WardID }
        });

        if (existingSubscription) {
            return res.status(400).json({ message: 'Resident is already subscribed to this ward.' });
        }

        // 3. Create the link in the Subscription table
        const newSubscription = await Subscription.create({
            ResidentID: ResidentID,
            WardID: WardID
        });

        res.status(201).json({
            message: 'Subscription successful!',
            data: newSubscription
        });

    } catch (err) {
        console.error('Error creating subscription:', err);
        res.status(500).json({ error: err.message });
    }
});//puts association in the db


/**
 * DELETE: Unsubscribe a resident from a ward
 * URL: /api/residents/unsubscribe
 * Body: { "ResidentID": 1, "WardID": 10 }
 */
router.delete('/unsubscribe', async (req, res) => {
    try {
        const { ResidentID, WardID } = req.body;

        // 1. Validation: Ensure both IDs are provided
        if (!ResidentID || !WardID) {
            return res.status(400).json({ error: 'ResidentID and WardID are required.' });
        }

        // 2. Perform the deletion (telling Azure to remove the row from Subscription)
        const deletedRows = await Subscription.destroy({
            where: {
                ResidentID: ResidentID,
                WardID: WardID
            }
        });

        // 3. Handle the result
        if (deletedRows > 0) {
            res.status(200).json({ message: 'Unsubscribed successfully!' });
        } else {
            // This happens if the resident wasn't actually subscribed to that ward
            res.status(404).json({ message: 'Subscription not found.' });
        }

    } catch (err) {
        console.error('Error removing subscription:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;