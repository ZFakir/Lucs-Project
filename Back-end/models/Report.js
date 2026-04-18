const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Report = sequelize.define('Report', {
    ReportID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    WardID: { type: DataTypes.INTEGER },
    ResidentID: { type: DataTypes.INTEGER },
    Latitude: { type: DataTypes.FLOAT }, // Fixed spelling
    Longitude: { type: DataTypes.FLOAT },
    Progress: { type: DataTypes.STRING },
    Type: { type: DataTypes.STRING },
    Frequency: { type: DataTypes.INTEGER }, // Changed to INTEGER
    CreatedAt: { type: DataTypes.DATE }, // Changed from 'Date'
    DateFulfilled: { type: DataTypes.DATE, allowNull: true },
    Priority: { type: DataTypes.INTEGER } // Added this column
}, { tableName: 'Reports', timestamps: false });

const ReportImage = sequelize.define('ReportImage', {
    ImageID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    ReportID: { type: DataTypes.INTEGER },
    Type: { type: DataTypes.STRING },
    Image: { type: DataTypes.BLOB }
}, { tableName: 'ReportImages', timestamps: false });

const Allocation = sequelize.define('Allocation', {
    AllocationID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    ReportID: { type: DataTypes.INTEGER },
    EmployeeID: { type: DataTypes.INTEGER }
}, { tableName: 'Allocation', timestamps: false });

module.exports = { Report, ReportImage, Allocation };