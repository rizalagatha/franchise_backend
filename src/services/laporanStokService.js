const { pool } = require("../config/database");

/**
 * Mengambil data laporan stok dengan pivot tabel ukuran
 */
const getLaporanStokData = async (tanggal, cabang, tampilKosong) => {
  let query = `
    SELECT 
      a.brg_kode AS Kode,
      TRIM(CONCAT(a.brg_jeniskaos, " ", a.brg_tipe, " ", a.brg_lengan, " ", a.brg_jeniskain, " ", a.brg_warna)) AS NamaBarang,
      SUM(CASE WHEN m.mst_ukuran = 'ALLSIZE' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END) AS ALLSIZE,
      SUM(CASE WHEN m.mst_ukuran = 'XS' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END) AS XS,
      SUM(CASE WHEN m.mst_ukuran = 'S' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END) AS S,
      SUM(CASE WHEN m.mst_ukuran = 'M' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END) AS M,
      SUM(CASE WHEN m.mst_ukuran = 'L' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END) AS L,
      SUM(CASE WHEN m.mst_ukuran = 'XL' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END) AS XL,
      SUM(CASE WHEN m.mst_ukuran = '2XL' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END) AS \`2XL\`,
      SUM(CASE WHEN m.mst_ukuran = '3XL' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END) AS \`3XL\`,
      SUM(CASE WHEN m.mst_ukuran = '4XL' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END) AS \`4XL\`,
      SUM(CASE WHEN m.mst_ukuran = '5XL' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END) AS \`5XL\`,
      SUM(CASE WHEN m.mst_ukuran = '6XL' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END) AS \`6XL\`,
      SUM(CASE WHEN m.mst_ukuran = '7XL' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END) AS \`7XL\`,
      SUM(CASE WHEN m.mst_ukuran = '8XL' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END) AS \`8XL\`,
      SUM(CASE WHEN m.mst_ukuran = '9XL' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END) AS \`9XL\`,
      SUM(CASE WHEN m.mst_ukuran = '10XL' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END) AS \`10XL\`,
      SUM(CASE WHEN m.mst_ukuran = 'OVERSIZE' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END) AS OVERSIZE,
      SUM(CASE WHEN m.mst_ukuran = 'JUMBO' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END) AS JUMBO,
      SUM(CASE WHEN m.mst_ukuran = '2' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END) AS S2,
      SUM(CASE WHEN m.mst_ukuran = '4' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END) AS S4,
      SUM(CASE WHEN m.mst_ukuran = '6' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END) AS S6,
      SUM(CASE WHEN m.mst_ukuran = '8' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END) AS S8,
      SUM(CASE WHEN m.mst_ukuran = '10' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END) AS S10,
      SUM(CASE WHEN m.mst_ukuran = '12' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END) AS S12,
      SUM(IFNULL(m.mst_stok_in, 0) - IFNULL(m.mst_stok_out, 0)) AS Total
    FROM tbarang a
    LEFT JOIN tmasterstok m ON a.brg_kode = m.mst_brg_kode 
         AND m.mst_aktif = 'Y' 
         AND LEFT(m.mst_noreferensi, 3) = ? 
         AND m.mst_tanggal <= ?
    GROUP BY a.brg_kode
  `;

  // Filter "Tampilkan Stok Kosong"
  if (tampilKosong !== "true") {
    query += ` HAVING Total <> 0 `;
  }

  query += ` ORDER BY NamaBarang`;

  const [rows] = await pool.query(query, [cabang, tanggal]);
  return rows;
};

module.exports = {
  getLaporanStokData,
};
