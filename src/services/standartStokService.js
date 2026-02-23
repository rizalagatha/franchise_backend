const { pool } = require("../config/database");

/**
 * Mengambil data standar stok beserta stok real-time saat ini
 */
const fetchStandartStok = async () => {
  const query = `
    SELECT 
        x.Kode,
        x.Barcode,
        x.Nama,
        x.Ukuran,
        x.MinBuffer,
        x.MaxBuffer,
        IFNULL((
            SELECT SUM(m.mst_stok_in - m.mst_stok_out) 
            FROM tmasterstok m
            WHERE m.mst_aktif = 'Y' 
              AND m.mst_brg_kode = x.Kode 
              AND m.mst_ukuran = x.Ukuran
        ), 0) AS Stok
    FROM (
        SELECT 
            a.brg_kode AS Kode,
            TRIM(CONCAT_WS(' ', a.brg_jeniskaos, a.brg_tipe, a.brg_lengan, a.brg_jeniskain, a.brg_warna)) AS Nama,
            b.brgd_ukuran AS Ukuran,
            b.brgd_barcode AS Barcode,
            b.brgd_min AS MinBuffer,
            b.brgd_max AS MaxBuffer
        FROM tbarang a
        LEFT JOIN tbarang_dtl b ON b.brgd_kode = a.brg_kode
    ) x
    ORDER BY x.Nama, x.Barcode
  `;

  const [rows] = await pool.query(query);
  return rows;
};

/**
 * Update nilai Min dan Max Buffer di tbarang_dtl
 */
const updateBuffer = async (kode, ukuran, minBuffer, maxBuffer) => {
  // Validasi logika bisnis sesuai Delphi
  const xmin = parseFloat(minBuffer) || 0;
  const xmax = parseFloat(maxBuffer) || 0;

  if (xmin === 0 && xmax !== 0) {
    throw new Error(
      "Jika Maximal stok di isi, Minimal stok juga harus di isi.",
    );
  }
  if (xmin !== 0 && xmax === 0) {
    throw new Error(
      "Jika Minimal stok di isi, Maximal stok juga harus di isi.",
    );
  }
  if (xmin > xmax) {
    throw new Error("Minimal Stok tidak boleh lebih besar dari Maximal Stok.");
  }

  const query = `
    UPDATE tbarang_dtl 
    SET brgd_min = ?, brgd_max = ?
    WHERE brgd_kode = ? AND brgd_ukuran = ?
  `;

  const [result] = await pool.query(query, [xmin, xmax, kode, ukuran]);

  if (result.affectedRows === 0) {
    throw new Error("Data barang tidak ditemukan atau tidak ada perubahan.");
  }

  return {
    message: "Standart stok berhasil diperbarui",
    kode,
    ukuran,
    xmin,
    xmax,
  };
};

module.exports = {
  fetchStandartStok,
  updateBuffer,
};
