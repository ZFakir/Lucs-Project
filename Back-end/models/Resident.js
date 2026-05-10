const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Resident = sequelize.define('Resident', {
  ResidentID: { 
    type: DataTypes.INTEGER, 
    primaryKey: true, 
    autoIncrement: true 
  },
  Username: { 
    type: DataTypes.STRING(50), 
    allowNull: false 
  },
  Email: { 
    type: DataTypes.STRING(255), 
    unique: true, 
    allowNull: false 
  },
  CellphoneNumber: { 
    type: DataTypes.STRING(15), 
    unique: true, 
    allowNull: true 
  },
  BlackListed: { 
    type: DataTypes.BOOLEAN, 
    defaultValue: false 
  },
  ProfilePicture: { 
    type: DataTypes.TEXT('long'),
     allowNull: true }
}, {
  tableName: 'Residents', // Matches your SQL script
  indexes: [
        {
            unique: true,
            fields: ['Email']
        }
    ],
  timestamps: false       // Prevents Sequelize from looking for 'createdAt' columns
});

const Subscription = sequelize.define('Subscription', {
    SubscriptionID: { 
        type: DataTypes.INTEGER, 
        primaryKey: true,
        autoIncrement: true 
    },
    ResidentID: { 
        type: DataTypes.INTEGER, 
        allowNull: false
    },
    WardID: { 
        type: DataTypes.INTEGER, 
        allowNull: false
    },
    MunicipalityID: { 
        type: DataTypes.INTEGER, 
        allowNull: false
    }
}, { 
    tableName: 'Subscription', 
    timestamps: false 
});

module.exports = {Resident,Subscription};