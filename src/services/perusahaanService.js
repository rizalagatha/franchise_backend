const { pool } = require("../config/database");

/**
 * Mengambil daftar semua perusahaan/cabang
 */
const getPerusahaanList = async () => {
  const query = `
    SELECT 
      perush_kode AS Kode, 
      perush_nama AS Nama, 
      perush_alamat AS Alamat, 
      perush_kota AS Kota 
    FROM tperusahaan 
    ORDER BY perush_nama ASC
  `;

  const [rows] = await pool.query(query);
  return rows;
};

module.exports = {
  getPerusahaanList,
};
