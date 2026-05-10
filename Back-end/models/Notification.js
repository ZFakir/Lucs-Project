
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Notification extends Model {
        static associate(models) {
            // A notification targets either an Admin (no FK needed, role-based)
            // or a specific MunicipalWorker
            Notification.belongsTo(models.MunicipalWorker, {
                foreignKey: 'RecipientID',
                as: 'Worker',
                constraints: false // Because admins don't have a worker ID
            });
            
            // Link notification to the report it relates to
            Notification.belongsTo(models.Report, {
                foreignKey: 'ReportID',
                as: 'Report',
                constraints: false
            });
        }
    }

    Notification.init({
        NotificationID: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        // 'admin' or a numeric EmployeeID (stored as string for flexibility)
        RecipientID: {
            type: DataTypes.STRING,
            allowNull: false
        },
        // e.g. 'TASK_DECLINED', 'NEW_REPORT', 'TASK_ASSIGNED'
        Type: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        Title: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        Message: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        // Link back to the relevant report
        ReportID: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        IsRead: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        sequelize,
        modelName: 'Notification',
        tableName: 'Notifications',
        timestamps: true,
        createdAt: 'CreatedAt',
        updatedAt: false
    });

    return Notification;
};