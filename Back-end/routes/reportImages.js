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
router.post('/report/:reportId', async (req, res) => {
    try {
        const reportId = req.params.reportId;
        const {imageBase64} = req.body;
        // Ensure the report actually exists before attaching an image to it
        const reportExists = await Report.findByPk(reportId);
        if (!reportExists) {
            return res.status(404).json({ message: 'Cannot attach image. Report not found.' });
        }

        // Check if the frontend sent the Base64 string in req.body.Image
        if (req.body.Image && typeof req.body.Image === 'string') {
            // Extract the MIME type and the raw Base64 data
            const matches = req.body.Image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

            if (matches && matches.length === 3) {
                const mimeType = matches[1]; // e.g., 'image/jpeg'
                const base64Data = matches[2]; // The raw alphanumeric string

                // Convert the Base64 string into a raw binary Buffer
                const imageBuffer = Buffer.from(base64Data, 'base64');

                // Create the image record with the proper binary format
                const newImage = await ReportImage.create({
                    ReportID: reportId,
                    Type: mimeType, 
                    Image: imageBuffer
                });

                // Return just the ID, avoiding sending the whole BLOB back in the response
                return res.status(201).json({ 
                    message: "Image uploaded successfully!", 
                    image: { ImageID: newImage.ImageID } 
                });
            } else {
                return res.status(400).json({ error: 'Invalid image format. Expected a valid Base64 data URI.' });
            }
        }

        return res.status(400).json({ error: 'No valid image data provided.' });

    } catch (err) {
        console.error("Single image upload error:", err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE: Remove a specific image
router.delete('/:id', async (req, res) => {
    try {
        
        const deleted = await ReportImage.destroy({ 
            where: { ImageID: req.params.id } 
        });
        
        if (deleted === 0) {
            return res.status(404).json({ message: 'Image not found' });
        }
        res.status(200).json({ message: 'Image deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;