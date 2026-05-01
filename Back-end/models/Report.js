const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Report = sequelize.define('Report', {
    ReportID: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true 
    },
    WardID: { 
        type: DataTypes.INTEGER,
        allowNull: false
    },
    MunicipalityID: { // Brought over from Mock
        type: DataTypes.INTEGER,
        allowNull: true // Allow null for older reports that didn't have it
    },
    ResidentID: { 
        type: DataTypes.INTEGER,
        allowNull: false
    },
    Latitude: { 
        type: DataTypes.DECIMAL(9, 6), // Upgraded precision
        allowNull: false 
    }, 
    Longitude: { 
        type: DataTypes.DECIMAL(9, 6), // Upgraded precision
        allowNull: false 
    },
    Progress: { 
        type: DataTypes.STRING(255),
        defaultValue: 'Pending Allocation' 
    },
    Type: { 
        type: DataTypes.STRING(255) 
    },
    Frequency: { 
        type: DataTypes.INTEGER,
        defaultValue: 0 
    }, 
    CreatedAt: { 
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW 
    }, 
    AssignedAt: { // Brought over from Mock
        type: DataTypes.DATE, 
        allowNull: true 
    },
    DateFulfilled: { 
        type: DataTypes.DATE, 
        allowNull: true 
    },
    Priority: { 
        type: DataTypes.INTEGER,
        allowNull: true 
    }, 
    Brief: {  // Standardized on 'Brief' (Replacing 'Description')
        type: DataTypes.TEXT, 
        allowNull: true
    },
    Rating: { 
        type: DataTypes.INTEGER, 
        allowNull: true, 
        validate: { min: 1, max: 5 } 
    }
}, { 
    tableName: 'Reports', 
    timestamps: false 
});

// ... keep your ReportImage and Allocation models below this exactly as they are ...

const ReportImage = sequelize.define('ReportImage', {
    ImageID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    ReportID: { type: DataTypes.INTEGER },
    Type: { type: DataTypes.STRING },
Image: {
        // 🚨 Specify 'medium' or 'long' here to bypass the 65KB limit
        type: DataTypes.BLOB('medium'), 
        allowNull: false
    }
}, { tableName: 'ReportImages', timestamps: false });

const Allocation = sequelize.define('Allocation', {
    AllocationID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    ReportID: { type: DataTypes.INTEGER },
    EmployeeID: { type: DataTypes.INTEGER },
    Accepted: {
        type: DataTypes.BOOLEAN,
        defaultValue: true, // Handles all FUTURE records automatically
        allowNull: false
    }
}, { tableName: 'Allocation', timestamps: false });

module.exports = { Report, ReportImage, Allocation };