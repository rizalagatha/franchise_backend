// src/config/database.js

const mysql = require("mysql2/promise"); // Gunakan versi promise

// Buat Connection Pool (lebih efisien untuk server)
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Fungsi untuk mengetes koneksi
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log("Database connected successfully!");
    connection.release(); // Kembalikan koneksi ke pool
  } catch (error) {
    console.error("Error connecting to database:", error);
  }
};

// Ekspor pool agar bisa dipakai di controller/service
module.exports = {
  pool,
  testConnection,
};
