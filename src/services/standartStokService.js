const { pool } = require("../config/database");

/**
 * Mengambil data standar stok beserta stok real-time saat ini khusus untuk cabang/perusahaan aktif
 */
const fetchStandartStok = async () => {
  // 1. Ambil Kode Cabang Aktif dari tperusahaan
  const [perushRows] = await pool.query(
    "SELECT perush_kode FROM tperusahaan LIMIT 1",
  );

  if (perushRows.length === 0) {
    throw new Error("Data perusahaan (tperusahaan) belum diatur.");
  }
  const branchPrefix = perushRows[0].perush_kode;

  // 2. Query Utama (Filter Stok berdasarkan Prefix Cabang)
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
              AND m.mst_noreferensi LIKE CONCAT(?, '%') -- Filter berdasarkan cabang
        ), 0) AS Stok
    FROM (
        SELECT 
            a.brg_kode AS Kode,
            TRIM(CONCAT_WS(' ', a.brg_jeniskaos, a.brg_tipe, a.brg_lengan, a.brg_jeniskain, a.brg_warna)) AS Nama,
            b.brgd_ukuran AS Ukuran,
            b.brgd_barcode AS Barcode,
            IFNULL(b.brgd_min, 0) AS MinBuffer,
            IFNULL(b.brgd_max, 0) AS MaxBuffer
        FROM tbarang a
        LEFT JOIN tbarang_dtl b ON b.brgd_kode = a.brg_kode
        WHERE b.brgd_kode IS NOT NULL
    ) x
    ORDER BY x.Nama, x.Barcode
  `;

  const [rows] = await pool.query(query, [branchPrefix]);
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
    message: "Standar stok berhasil diperbarui",
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
