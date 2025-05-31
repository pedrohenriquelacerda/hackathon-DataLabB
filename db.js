require("dotenv").config();
const Sequelize = require("sequelize");
const sequelize = new Sequelize(
  process.env.DATABASE_NAME,
  process.env.DATABASE_USER,
  process.env.DATABASE_PASSWORD,
  {
    dialect: process.env.DATABASE_DIALECT,
    host: process.env.DATABASE_HOST,
    query: { raw: true },
    define: { timestamps: false },
  }
);

module.exports = sequelize;
