const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
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
// In your backend residents router file:
router.get('/:id/subscriptions', async (req, res) => {
    try {
        const subscriptions = await Subscription.findAll({
            where: { ResidentID: req.params.id },
            include: [{
                model: Ward,
                // Use required: false to allow subscriptions without matching wards
                required: false,
                // 🚨 This manual 'on' clause tells Sequelize to match BOTH IDs
                on: {
                    WardID: { [Op.col]: 'Subscription.WardID' },
                    MunicipalityID: { [Op.col]: 'Subscription.MunicipalityID' }
                }
            }]
        });
        res.json(subscriptions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});//Returns an array of wards

// Inside your residents router (e.g., routes/residents.js)
router.post('/subscribe', async (req, res) => {
    try {
        const { ResidentID, WardID, MunicipalityID } = req.body;

        // 🚨 Ensure all three are present to satisfy the composite key
        if (!ResidentID || !WardID || !MunicipalityID) {
            return res.status(400).json({ error: "Missing required subscription data." });
        }

        const newSubscription = await Subscription.create({
            ResidentID,
            WardID,
            MunicipalityID // 🚨 This stops the notNull Violation
        });

        res.status(201).json(newSubscription);
    } catch (err) {
        console.error("Subscription Error:", err);
        res.status(500).json({ error: err.message });
    }
});//puts association in the db


/**
 * DELETE: Unsubscribe a resident from a ward
 * URL: /api/residents/unsubscribe
 * Body: { "ResidentID": 1, "WardID": 10 }
 */
// routes/residents.js
router.delete('/unsubscribe', async (req, res) => {
    try {
        const { ResidentID, WardID, MunicipalityID } = req.body;

        // 🚨 We now require all three to identify the composite record
        const deleted = await Subscription.destroy({
            where: {
                ResidentID: ResidentID,
                WardID: WardID,
                MunicipalityID: MunicipalityID // 🚨 New required field
            }
        });

        if (deleted) {
            res.status(200).json({ message: "Unsubscribed successfully." });
        } else {
            res.status(404).json({ error: "Subscription not found." });
        }
    } catch (err) {
        console.error("Unsubscribe Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// GET: Fetch resident profile
router.get('/:id/profile', async (req, res) => {
    try {
        const resident = await Resident.findByPk(req.params.id, {
            attributes: ['ResidentID', 'Username', 'Email', 'CellphoneNumber', 'ProfilePicture']
        });
        if (!resident) return res.status(404).json({ message: 'Resident not found' });

        const data = resident.toJSON();
        // ProfilePicture is already a base64 string, no conversion needed
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT: Update resident profile  
router.put('/:id/profile', async (req, res) => {
    try {
        const { Username, Email, CellphoneNumber, ProfilePicture } = req.body; // destructure Email

        const updateData = { Username, CellphoneNumber };

        if (Email) updateData.Email = Email; // now Email is defined

        if (ProfilePicture && ProfilePicture.startsWith('data:image')) {
            // Store as base64 string directly since column is TEXT
            updateData.ProfilePicture = ProfilePicture;
        }

        const [updated] = await Resident.update(updateData, {
            where: { ResidentID: req.params.id }
        });

        if (updated === 0) return res.status(404).json({ message: 'Resident not found' });
        res.json({ success: true, message: 'Profile updated successfully' });
    } catch (err) {
        console.error('Profile update error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;