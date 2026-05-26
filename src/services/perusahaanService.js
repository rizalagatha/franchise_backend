// const { pool } = require("../config/database");

/**
 * Mengambil daftar semua perusahaan/cabang
 */
const getPerusahaanList = async (db) => {
  const query = `
    SELECT 
      perush_kode AS Kode, 
      perush_nama AS Nama, 
      perush_alamat AS Alamat, 
      perush_kota AS Kota 
    FROM tperusahaan 
    ORDER BY perush_nama ASC
  `;

  // Mengeksekusi query menggunakan koneksi yang dikirim dari controller
  const [rows] = await db.query(query);
  return rows;
};

const savePerusahaan = async (db, perusahaanData, isNew) => {
  const { Kode, Nama, Alamat, Kota } = perusahaanData;

  if (!Kode?.trim()) throw new Error("Kode Perusahaan tidak boleh kosong.");
  if (!Nama?.trim()) throw new Error("Nama Perusahaan tidak boleh kosong.");
  if (!Alamat?.trim()) throw new Error("Alamat Perusahaan tidak boleh kosong.");
  if (!Kota?.trim()) throw new Error("Kota Perusahaan tidak boleh kosong.");

  let query = "";
  let params = [];

  if (isNew) {
    const [existing] = await db.query(
      "SELECT 1 FROM tperusahaan WHERE perush_kode = ?",
      [Kode.trim()],
    );
    if (existing.length > 0) {
      throw new Error(`Kode perusahaan ${Kode} sudah ada.`);
    }

    query =
      "INSERT INTO tperusahaan (perush_kode, Perush_nama, Perush_alamat, Perush_kota) VALUES (?, ?, ?, ?)";
    params = [Kode.trim(), Nama.trim(), Alamat.trim(), Kota.trim()];
  } else {
    query =
      "UPDATE tperusahaan SET perush_nama = ?, perush_alamat = ?, perush_kota = ? WHERE perush_kode = ?";
    params = [Nama.trim(), Alamat.trim(), Kota.trim(), Kode.trim()];
  }

  const [result] = await db.query(query, params);
  if (result.affectedRows === 0) {
    throw new Error("Gagal menyimpan data, tidak ada baris yang terpengaruh.");
  }
  return { message: `Perusahaan ${Kode} berhasil disimpan.` };
};

module.exports = {
  getPerusahaanList,
  savePerusahaan,
};
