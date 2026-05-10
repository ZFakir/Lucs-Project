const sequelize = require('../config/db');
const { DataTypes } = require('sequelize');

// 1. Import your unified models
const { Report, ReportImage, Allocation } = require('./Report'); // Unified model
const { Province, Municipality, Ward } = require('./Geography'); // Consolidated Ward
const { Resident, Subscription } = require('./Resident'); // Updated Subscription
const Notification = require('./Notification')(sequelize, DataTypes);
const MunicipalWorker = require('./Worker');

// 2. Define Relationship Logic (Associations)

// Geographic Hierarchy
Province.hasMany(Municipality, { foreignKey: 'ProvinceID' });
Municipality.belongsTo(Province, { foreignKey: 'ProvinceID' });

Municipality.hasMany(Ward, { foreignKey: 'MunicipalityID' });
Ward.belongsTo(Municipality, { foreignKey: 'MunicipalityID' });

// Reporting & Images (One-to-Many)
Ward.hasMany(Report, { foreignKey: 'WardID', sourceKey: 'WardID'});
Report.belongsTo(Ward, { foreignKey: 'WardID', targetKey: 'WardID'});

Resident.hasMany(Report, { foreignKey: 'ResidentID' });
Report.belongsTo(Resident, { foreignKey: 'ResidentID' });

Report.hasMany(ReportImage, { foreignKey: 'ReportID' });
ReportImage.belongsTo(Report, { foreignKey: 'ReportID' });

// "Super Many-to-Many": Subscriptions (Residents <-> Wards)
// Note: We use a simplified association because Ward has a composite primary key (WardID, MunicipalityID).
// The backend routes use manual 'on' clauses to properly join on both keys.
Resident.hasMany(Subscription, { foreignKey: 'ResidentID' });
Subscription.belongsTo(Resident, { foreignKey: 'ResidentID' });

// Simplified associations - the routes will use manual 'on' clauses for proper composite key joins
Ward.hasMany(Subscription, { foreignKey: 'WardID', sourceKey: 'WardID', constraints: false});
Subscription.belongsTo(Ward, { foreignKey: 'WardID', targetKey: 'WardID', constraints: false});

// Many-to-Many: Allocations (Reports <-> Workers)
Report.belongsToMany(MunicipalWorker, { through: Allocation, foreignKey: 'ReportID' });
MunicipalWorker.belongsToMany(Report, { through: Allocation, foreignKey: 'EmployeeID' });

//Report to municipality
Report.belongsTo(Municipality, { foreignKey: 'MunicipalityID' });
Municipality.hasMany(Report, { foreignKey: 'MunicipalityID' });

// 3. Export everything
module.exports = {
    sequelize,
    Province,
    Municipality,
    Ward,
    Resident,
    MunicipalWorker,
    Report,
    ReportImage,
    Allocation,
    Subscription,
    Notification
};