const getLaporanStokData = async (db, tanggal, cabang, tampilKosong) => {
  let query = `
    SELECT 
      a.brg_kode AS Kode,
      TRIM(CONCAT(a.brg_jeniskaos, " ", a.brg_tipe, " ", a.brg_lengan, " ", a.brg_jeniskain, " ", a.brg_warna)) AS NamaBarang,
      IFNULL(SUM(CASE WHEN m.mst_ukuran = 'ALLSIZE' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END), 0) AS ALLSIZE,
      IFNULL(SUM(CASE WHEN m.mst_ukuran = 'XS' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END), 0) AS XS,
      IFNULL(SUM(CASE WHEN m.mst_ukuran = 'S' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END), 0) AS S,
      IFNULL(SUM(CASE WHEN m.mst_ukuran = 'M' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END), 0) AS M,
      IFNULL(SUM(CASE WHEN m.mst_ukuran = 'L' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END), 0) AS L,
      IFNULL(SUM(CASE WHEN m.mst_ukuran = 'XL' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END), 0) AS XL,
      IFNULL(SUM(CASE WHEN m.mst_ukuran = '2XL' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END), 0) AS \`2XL\`,
      IFNULL(SUM(CASE WHEN m.mst_ukuran = '3XL' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END), 0) AS \`3XL\`,
      IFNULL(SUM(CASE WHEN m.mst_ukuran = '4XL' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END), 0) AS \`4XL\`,
      IFNULL(SUM(CASE WHEN m.mst_ukuran = '5XL' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END), 0) AS \`5XL\`,
      IFNULL(SUM(CASE WHEN m.mst_ukuran = '6XL' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END), 0) AS \`6XL\`,
      IFNULL(SUM(CASE WHEN m.mst_ukuran = '7XL' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END), 0) AS \`7XL\`,
      IFNULL(SUM(CASE WHEN m.mst_ukuran = '8XL' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END), 0) AS \`8XL\`,
      IFNULL(SUM(CASE WHEN m.mst_ukuran = '9XL' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END), 0) AS \`9XL\`,
      IFNULL(SUM(CASE WHEN m.mst_ukuran = '10XL' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END), 0) AS \`10XL\`,
      IFNULL(SUM(CASE WHEN m.mst_ukuran = 'OVERSIZE' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END), 0) AS OVERSIZE,
      IFNULL(SUM(CASE WHEN m.mst_ukuran = 'JUMBO' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END), 0) AS JUMBO,
      IFNULL(SUM(CASE WHEN m.mst_ukuran = '2' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END), 0) AS S2,
      IFNULL(SUM(CASE WHEN m.mst_ukuran = '4' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END), 0) AS S4,
      IFNULL(SUM(CASE WHEN m.mst_ukuran = '6' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END), 0) AS S6,
      IFNULL(SUM(CASE WHEN m.mst_ukuran = '8' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END), 0) AS S8,
      IFNULL(SUM(CASE WHEN m.mst_ukuran = '10' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END), 0) AS S10,
      IFNULL(SUM(CASE WHEN m.mst_ukuran = '12' THEN m.mst_stok_in - m.mst_stok_out ELSE 0 END), 0) AS S12,
      IFNULL(SUM(m.mst_stok_in - m.mst_stok_out), 0) AS Total
    FROM tbarang a
    LEFT JOIN tmasterstok m ON a.brg_kode = m.mst_brg_kode 
         AND m.mst_aktif = 'Y' 
         AND LEFT(m.mst_noreferensi, 3) = ? 
         AND m.mst_tanggal <= ?
    GROUP BY a.brg_kode
  `;

  // Ubah tipe datanya saat cek "true", karena query string di express.js kadang berupa string "false"
  if (String(tampilKosong) !== "true") {
    // Karena Total sudah di-IFNULL, sekarang 0 aman
    query += ` HAVING Total <> 0 `;
  }

  query += ` ORDER BY NamaBarang`;

  const [rows] = await db.query(query, [cabang, tanggal]);
  return rows;
};

module.exports = {
  getLaporanStokData,
};
