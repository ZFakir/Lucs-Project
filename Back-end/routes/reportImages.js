const express = require('express');
const router = express.Router();
const { ReportImage, Report } = require('../models');

// =======================
// VIEW IMAGES
// =======================

// GET: Fetch ALL images attached to a SPECIFIC Report
// (Useful when a worker clicks on a report and wants to see the photos)
router.get('/report/:reportId', async (req, res) => {
    try {
        const images = await ReportImage.findAll({
            where: { ReportID: req.params.reportId }
        });
        
        if (!images || images.length === 0) {
            return res.status(404).json({ message: 'No images found for this report.' });
        }

        const formattedImages = images.map(img => {
            const imgData = img.toJSON();

            if (imgData.Image) {
                imgData.base64 = Buffer.from(imgData.Image).toString('base64');
            }
        return imgData;
        });
        res.json(formattedImages);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:imageId', async (req, res) => {
    try {
        const deleted = await ReportImage.destroy({
            where: { ImageID: req.params.imageId }
        });
        if (deleted === 0) return res.status(404).json({ message: 'Image not found' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET: Fetch a single image by its exact ID
router.get('/:id', async (req, res) => {
    try {
        const image = await ReportImage.findByPk(req.params.id);
        if (!image) {
            return res.status(404).json({ message: 'Image not found' });
        }
        res.json(image);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// =======================
// MANAGE IMAGES
// =======================

// POST: Upload a new image for a specific report
// POST: Upload a new image for a specific report
// POST: Upload a new image for a specific report
router.post('/report/:reportId', async (req, res) => {
    try {
        const reportId = req.params.reportId;
        
        // Safely grab the image regardless of what the frontend named the key
        const incomingImage = req.body.Image || req.body.imageBase64 || req.body.image || req.body.images;

        // Ensure the report actually exists before attaching an image to it
        const reportExists = await Report.findByPk(reportId);
        if (!reportExists) {
            return res.status(404).json({ message: 'Cannot attach image. Report not found.' });
        }

        if (incomingImage && typeof incomingImage === 'string') {
            let mimeType = 'image/jpeg'; // Safe fallback
            let base64Data = incomingImage;

            // Bulletproof string splitting instead of fragile regex
            if (incomingImage.includes('base64,')) {
                const parts = incomingImage.split('base64,');
                
                // Extract the mime type (e.g. "data:image/png;") and strip the junk
                let prefix = parts[0].replace('data:', '').replace(';', '');
                
                // Tag the image so the Admin Dashboard knows a worker uploaded it!
                mimeType = (prefix || 'image/jpeg') + ';role=worker';
                
                // Trim removes any hidden whitespace/newlines that crash the buffer
                base64Data = parts[1].trim(); 
            } else {
                mimeType = mimeType + ';role=worker';
            }

            // Convert into binary
            const imageBuffer = Buffer.from(base64Data, 'base64');

            const newImage = await ReportImage.create({
                ReportID: reportId,
                Type: mimeType, 
                Image: imageBuffer
            });

            return res.status(201).json({ 
                message: "Image uploaded successfully!", 
                image: { ImageID: newImage.ImageID } 
            });
        }

        return res.status(400).json({ error: 'No valid image data provided.' });

    } catch (err) {
        console.error("Single image upload error:", err);
        res.status(500).json({ error: err.message });
    }
});


module.exports = router;