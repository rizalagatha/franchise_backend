// const { pool } = require("../config/database");

/**
 * Mengambil daftar perusahaan/cabang dari Master DB (Berdasarkan Hak Akses)
 */
const getPerusahaanList = async (db, cabangId, role) => {
  let query = `
    SELECT 
      kode_cabang AS Kode, 
      nama_cabang AS Nama 
    FROM cabang 
  `;

  let params = [];

  // Jika sistemmu memiliki role khusus untuk Pusat (misal: 'superadmin' atau 'pusat')
  // yang boleh melihat semua cabang, kamu bisa menggunakan kondisi ini.
  // Tapi secara default, kita paksa user hanya bisa melihat cabangnya sendiri:
  if (role !== "superadmin") {
    query += ` WHERE id = ? `;
    params.push(cabangId);
  }

  query += ` ORDER BY nama_cabang ASC`;

  const [rows] = await db.query(query, params);
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
