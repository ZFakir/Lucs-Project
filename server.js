const express = require('express');
const sequelize = require('./config/db');
require('dotenv').config();

const app = express();
app.use(express.json());

// Test Connection
sequelize.authenticate()
    .then(() => console.log('Connected to Azure MySQL!'))
    .catch(err => console.error('Unable to connect:', err));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});