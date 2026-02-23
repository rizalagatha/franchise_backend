const { pool } = require("../config/database");

const getActiveUsers = async () => {
  // Mengambil user_kode sesuai kebutuhan ComboBox di Delphi
  const [rows] = await pool.query(
    "SELECT user_kode, user_nama FROM tuser WHERE user_aktif = 'Y' ORDER BY user_kode ASC",
  );
  return rows;
};

module.exports = { getActiveUsers };
