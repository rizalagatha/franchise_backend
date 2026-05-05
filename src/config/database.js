const mysql = require("mysql2/promise");

// Menyimpan pool koneksi agar tidak perlu create ulang setiap ada request
const connections = {};

// Ini adalah koneksi utama (Master Database) yang menggantikan pool lama kamu
const pool = mysql.createPool({
  host: process.env.DB_MASTER_HOST || "127.0.0.1",
  user: process.env.DB_MASTER_USER,
  password: process.env.DB_MASTER_PASSWORD,
  database: process.env.DB_MASTER_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Fungsi untuk mengambil koneksi cabang secara dinamis
const getBranchDb = async (cabangConfig) => {
  const { db_host, db_name, db_user, db_pass } = cabangConfig;
  const dbKey = db_name; // Gunakan nama database sebagai ID unik

  // Jika pool untuk cabang ini belum ada, buat baru
  if (!connections[dbKey]) {
    console.log(`[DB] Membuka koneksi baru untuk cabang: ${db_name}`);
    connections[dbKey] = mysql.createPool({
      host: db_host,
      user: db_user,
      password: db_pass,
      database: db_name,
      waitForConnections: true,
      connectionLimit: 10, // Sesuaikan dengan traffic transaksi kasir
      queueLimit: 0,
    });
  }

  // Kembalikan pool yang sudah ada
  return connections[dbKey];
};

// Fungsi untuk mengetes koneksi (Biasanya dipanggil di index.js saat server nyala)
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log("Database Master connected successfully!");
    connection.release(); // Kembalikan koneksi ke pool
  } catch (error) {
    console.error("Error connecting to Database Master:", error);
  }
};

module.exports = {
  pool, // Tetap diekspor sebagai 'pool' agar middleware lama tidak error
  masterPool: pool, // Alias jika di file authService ingin pakai nama 'masterPool'
  getBranchDb,
  testConnection,
};
