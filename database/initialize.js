require("dotenv").config();
const mysql = require("mysql2/promise");
const { sequelize } = require("../models");

(async () => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DATABASE_HOST,
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
    });

    await connection.query("CREATE DATABASE IF NOT EXISTS datalab");
    console.log("Banco de dados 'leitos' criado ou já existente.");

    await connection.end();

    await sequelize.sync({ alter: true });
    console.log("Tabelas sincronizadas com sucesso!");
  } catch (error) {
    console.error("Erro ao inicializar o banco de dados:", error);
  } finally {
    process.exit();
  }
})();
