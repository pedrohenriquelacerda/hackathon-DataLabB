require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DATABASE_NAME || 'datalab',
  process.env.DATABASE_USER || 'root',
  process.env.DATABASE_PASSWORD || '',
  {
    host: process.env.DATABASE_HOST || 'localhost',
    dialect: process.env.DATABASE_DIALECT || 'mysql',
    port: process.env.DATABASE_PORT || 3306,
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    define: {
      timestamps: true,
      underscored: true,
      paranoid: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at'
    }
  }
);

const Cultura = require('./Cultura')(sequelize, DataTypes);

module.exports = {
  sequelize,
  Sequelize,
  Cultura
};