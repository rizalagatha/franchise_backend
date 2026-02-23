const mysql = require("mysql2/promise");

// Konfigurasi untuk koneksi ke server 'retail'
const externalPool = mysql.createPool({
  host: process.env.EXT_DB_HOST || "103.94.238.252", // Sesuai referensi
  port: process.env.EXT_DB_PORT || 3307, // Sesuai referensi
  user: process.env.EXT_DB_USER || "kpr", // Sesuai referensi
  password: process.env.EXT_DB_PASSWORD || "Kaosan@KPR7", // Sesuai referensi
  database: process.env.EXT_DB_NAME || "retail", // Sesuai referensi
  waitForConnections: true,
  connectionLimit: 5, // Batasi koneksi ke server eksternal
  queueLimit: 0,
  connectTimeout: 10000, // 10 detik timeout
});

// Fungsi tes koneksi (opsional)
const testExternalConnection = async () => {
  try {
    const connection = await externalPool.getConnection();
    console.log("Koneksi database EKSTERNAL (Retail) berhasil!");
    connection.release();
  } catch (error) {
    console.error("Gagal terhubung ke database EKSTERNAL:", error);
  }
};

module.exports = {
  externalPool,
  testExternalConnection,
};
