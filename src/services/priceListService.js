const { pool } = require("../config/database");

/**
 * Mengambil data price list (join tbarang & tbarang_dtl).
 * Menggunakan CONCAT untuk nama barang.
 */
const fetchAllPriceListData = async () => {
  // Query disesuaikan dari Delphi TfrmPriceList.btnRefreshClick
  const query = `
        SELECT 
            a.brg_kode AS Kode,
            b.brgd_barcode AS Barcode,
            TRIM(CONCAT(a.brg_jeniskaos, ' ', a.brg_tipe, ' ', a.brg_lengan, ' ', a.brg_jeniskain, ' ', a.brg_warna)) AS Nama,
            b.brgd_ukuran AS Ukuran,
            b.brgd_hpp AS Hpp,
            b.brgd_harga AS Harga,
            (b.brgd_harga - b.brgd_hpp) AS Laba 
        FROM tbarang a
        LEFT JOIN tbarang_dtl b ON b.brgd_kode = a.brg_kode
        ORDER BY a.brg_kode, b.brgd_ukuran; 
    `;
  const [rows] = await pool.query(query);
  return rows;
};

/**
 * Memperbarui HPP dan Harga Jual barang, serta mencatat riwayat di tharga.
 * Menggunakan transaksi.
 */
const updatePrice = async (kodeBarang, ukuran, newHpp, newHarga, userKode) => {
  const connection = await pool.getConnection(); // Dapatkan koneksi untuk transaksi
  try {
    await connection.beginTransaction(); // Mulai transaksi

    // 1. Update tbarang_dtl
    const updateDtlQuery = `
            UPDATE tbarang_dtl SET 
                brgd_hpp = ?, 
                brgd_harga = ? 
            WHERE brgd_kode = ? AND brgd_ukuran = ?
        `;
    await connection.query(updateDtlQuery, [
      newHpp,
      newHarga,
      kodeBarang,
      ukuran,
    ]);

    // 2. Insert/Update tharga (Logika Delphi simpandata)
    const updateHargaQuery = `
            INSERT INTO tharga (hrg_tanggal, hrg_kode, hrg_ukuran, hrg_harga, hrg_created) 
            VALUES (NOW(), ?, ?, ?, ?) 
            ON DUPLICATE KEY UPDATE 
                hrg_harga = VALUES(hrg_harga), 
                hrg_created = VALUES(hrg_created),
                hrg_tanggal = NOW() -- Update tanggal juga jika sudah ada
        `;
    await connection.query(updateHargaQuery, [
      kodeBarang,
      ukuran,
      newHarga,
      userKode,
    ]);

    await connection.commit(); // Sukses, commit transaksi
    return {
      message: `Harga untuk ${kodeBarang} ukuran ${ukuran} berhasil diperbarui.`,
    };
  } catch (error) {
    await connection.rollback(); // Gagal, rollback transaksi
    console.error("Error updating price:", error);
    throw new Error("Gagal memperbarui harga."); // Lempar error agar controller tahu
  } finally {
    connection.release(); // Selalu lepaskan koneksi
  }
};

/**
 * Mengambil riwayat harga jual suatu barang berdasarkan kode dan ukuran.
 * Sesuai logika Delphi TfrmPriceList.loadHarga
 */
const getPriceHistory = async (kodeBarang, ukuran) => {
  const query = `
        SELECT 
            DATE_FORMAT(h.hrg_tanggal, '%d-%m-%Y %T') AS Tanggal, 
            h.hrg_kode AS Kode, 
            h.hrg_ukuran AS Ukuran, 
            h.hrg_harga AS Harga, 
            h.hrg_created AS Created 
        FROM tharga h 
        WHERE h.hrg_kode = ? AND h.hrg_ukuran = ? 
        ORDER BY h.hrg_tanggal DESC
    `;
  const [rows] = await pool.query(query, [kodeBarang, ukuran]);
  return rows;
};

module.exports = {
  fetchAllPriceListData,
  updatePrice,
  getPriceHistory,
};
