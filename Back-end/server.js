require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const sequelize = require('./config/db');
const models = require('./models'); 

const { OAuth2Client } = require('google-auth-library');
const { Resident } = require('./models/Resident');
const MunicipalWorker = require('./models/Worker');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_EMAILS = [
    '2820314@students.wits.ac.za',
    '2799656@students.wits.ac.za',
    '2805279@students.wits.ac.za',
    'groundwork.wits@gmail.com',
    '2800269@students.wits.ac.za',
    'groundwork.admin@gmail.com'
];

// --- 1. MIDDLEWARE ---
app.use(cors()); 
app.use(express.json({ limit: '50mb' })); // Vital for the base64 images

// --- 2. Resident GOOGLE AUTH API ROUTE ---

app.post('/api/auth/google', async (req, res) => {
    const { idToken } = req.body;
    try {
        const ticket = await client.verifyIdToken({
            idToken: idToken,
            audience: process.env.GOOGLE_CLIENT_ID, //checks if token is valid for our server
        });
        
        const payload = ticket.getPayload();
        const { email, name, picture } = payload; // Added picture here //ticket with user information.

        // --- SPECIAL ADMIN CASE ---
        if (ADMIN_EMAILS.includes(email)) {
            return res.status(200).json({ 
                success: true, 
                role: 'admin', 
                name: name,
                adminEmail: email,
                pictureUrl: picture,
                message: "Admin recognized" 
            });
        }

        const [resident, created] = await Resident.findOrCreate({
            where: { Email: email }, 
            defaults: {
                Username: name || email,
                Email: email,
                ProfilePicture: picture,
                CellphoneNumber: `G-${Date.now().toString().slice(-8)}`,
                BlackListed: false
            }
        });

        if (resident.BlackListed) {
            return res.status(403).json({ success: false, message: "Account restricted." });
        }

        res.status(200).json({ 
            success: true, 
            residentId: resident.ResidentID,
            pictureUrl: resident.ProfilePicture
        });

    } catch (error) {
        console.error("Google Auth Error:", error);
        res.status(401).json({ success: false, message: "Invalid Token" });
    }
});

// --- WORKER GOOGLE AUTH ROUTE ---
app.post('/api/auth/worker/google', async (req, res) => {
    const { idToken } = req.body;
    try {
        const ticket = await client.verifyIdToken({
            idToken: idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const { email, family_name, given_name, picture } = payload;

        // FIXED: Using PascalCase to match your MunicipalWorker model
        const [worker, created] = await MunicipalWorker.findOrCreate({
            where: { Email: email },
            defaults: {
                EmployeeID: Math.floor(Date.now() / 1000), // Manual ID bypass for Azure
                FirstName: given_name,
                LastName: family_name,
                Email: email,
                ProfilePicture: picture,
                Validated: false, 
                Blacklisted: false
            }
        });

        if (!worker.Validated) {
            return res.status(403).json({ 
                success: false, 
                message: "Your registration is received. Please wait for an administrator to grant permission before you can access the ledger." 
            });
        }

        if (worker.Blacklisted) {
            return res.status(403).json({ success: false, message: "This account has been blacklisted." });
        }

        res.status(200).json({ 
            success: true, 
            workerId: worker.EmployeeID,
            name: worker.FirstName 
        });

    } catch (error) {
        console.error("Worker Google Auth Error:", error);
        res.status(401).json({ success: false, message: "Invalid Security Token" });
    }
});

// --- ADMIN: DELETE REPORT ---
app.delete('/api/admin/delete-report/:id', async (req, res) => {
    const reportId = req.params.id;
    const { adminEmail } = req.body; // Sent from the frontend to verify identity

    if (!ADMIN_EMAILS.includes(adminEmail)) {
        return res.status(403).json({ success: false, message: "Unauthorized: Admin access only." });
    }

    try {
        // 2. Perform the deletion
        const deleted = await Report.destroy({
            where: { ReportID: reportId }
        });

        if (deleted) {
            res.status(200).json({ success: true, message: `Report ${reportId} deleted successfully.` });
        } else {
            res.status(404).json({ success: false, message: "Report not found." });
        }
    } catch (error) {
        console.error("Deletion Error:", error);
        res.status(500).json({ success: false, message: "Server error during deletion." });
    }
});


// --- 3. API ROUTES ---
const residentRoutes = require('./routes/residents');
const workerRoutes = require('./routes/workers');
const reportRoutes = require('./routes/reports');
const geographyRoutes = require('./routes/geography');
const allocationRoutes = require('./routes/allocations');
const reportImageRoutes = require('./routes/reportImages');
const grievanceRoutes = require('./routes/grievances');
const notificationRoutes =  require('./routes/notifications');
const PublicRoutes=require('./routes/public');


app.use('/api/workers', workerRoutes);
app.use('/api/residents', residentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/geography', geographyRoutes);
app.use('/api/allocations', allocationRoutes);
app.use('/api/report-images', reportImageRoutes);
app.use('/api/grievances', grievanceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/public',PublicRoutes);

// --- 4. STATIC FILES & FRONTEND ---
const frontendPath = path.resolve(__dirname, '..', 'Front-end');
app.use(express.static(frontendPath));

// Default route to serve the Guest Dashboard
app.get('/', (req, res) => {
    // Navigates into the 'Homes' folder and serves 'GuestDashboard.html'
    res.sendFile(path.join(frontendPath, 'Homes', 'GuestDashboard.html'));
});

// --- 5. DATABASE & START ---
// --- 5. DATABASE & START ---
async function startServer() {
    try {
        // Test if we can actually talk to the SQL server
        await sequelize.authenticate();
        console.log('✅ Database connection established.');

        // 🚨 ADD THIS: Synchronize the models with the database
        // { alter: true } will update existing tables or create them if they are missing
        await sequelize.sync({ alter: true});
        console.log('✅ Database synchronized. All tables are ready!');

        // Start the server
        app.listen(PORT, () => {
            console.log(`🚀 Server is live at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('❌ Unable to connect to the database:', error);
    }
}

const sandboxRoutes = require('./routes/Sandbox');

// Mount it to the /api/sandbox base path
app.use('/api/sandbox', sandboxRoutes);

startServer();
    //this file is the main entry point for the back-end server. It sets up the Express app, connects to the database, defines API routes, and handles Google authentication for both residents and municipal workers. The server serves static files for the front-end and listens on a specified port.