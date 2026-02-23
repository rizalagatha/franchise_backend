const { pool } = require("../config/database");

/**
 * 1. Mengambil data header (master) rekening bank.
 * Sesuai SQLMaster Delphi TfrmBrowRekening.btnRefreshClick.
 */
const fetchHeaders = async () => {
  const query = `
        SELECT 
            h.rek_nomor AS NoRekening,
            h.rek_namabank AS NamaBank,
            h.rek_atasnama AS AtasNama
        FROM trekening h
        ORDER BY h.rek_namabank, h.rek_nomor
    `;
  const [rows] = await pool.query(query);
  return rows;
};

/**
 * 2. Mengambil detail satu rekening berdasarkan nomor.
 * Sesuai Delphi loaddata.
 */
const getRekeningById = async (nomorRekening) => {
  const query = "SELECT * FROM trekening WHERE rek_nomor = ?";
  const [rows] = await pool.query(query, [nomorRekening]);
  if (rows.length === 0) {
    return null; // Tidak ditemukan (mode Baru)
  }
  // Ubah nama field agar konsisten dengan form
  return {
    rek_nomor: rows[0].rek_nomor,
    rek_namabank: rows[0].rek_namabank,
    rek_atasnama: rows[0].rek_atasnama,
  };
};

/**
 * 3. Menyimpan data rekening (Create / Update).
 * Sesuai Delphi simpandata.
 */
const saveRekening = async (rekeningData, isNew) => {
  const { rek_nomor, rek_namabank, rek_atasnama } = rekeningData;

  // Validasi (from btnSimpanClick)
  if (!rek_nomor?.trim()) {
    throw new Error("No. Rekening tidak boleh kosong.");
  }
  if (!rek_namabank?.trim()) {
    throw new Error("Nama Bank tidak boleh kosong.");
  }

  let query = "";
  let params = [];

  if (isNew) {
    // Cek duplikat (penting untuk mode 'Baru')
    const [existing] = await pool.query(
      "SELECT 1 FROM trekening WHERE rek_nomor = ?",
      [rek_nomor.trim()]
    );
    if (existing.length > 0) {
      throw new Error(`No. Rekening ${rek_nomor} sudah ada.`);
    }

    // Insert (Sesuai Delphi)
    query =
      "INSERT INTO trekening (rek_nomor, rek_namabank, rek_atasnama) VALUES (?, ?, ?)";
    params = [
      rek_nomor.trim(),
      rek_namabank.trim(),
      rek_atasnama?.trim() ?? null,
    ];
  } else {
    // Update (Sesuai Delphi)
    query =
      "UPDATE trekening SET rek_namabank = ?, rek_atasnama = ? WHERE rek_nomor = ?";
    params = [
      rek_namabank.trim(),
      rek_atasnama?.trim() ?? null,
      rek_nomor.trim(),
    ];
  }

  const [result] = await pool.query(query, params);
  if (result.affectedRows === 0) {
    throw new Error("Gagal menyimpan data, tidak ada baris yang terpengaruh.");
  }
  return { message: `Rekening ${rek_nomor} berhasil disimpan.` };
};

/**
 * 4. Lookup F1 untuk dialog form.
 * Sesuai Delphi FormKeyDown F1.
 */
const lookupRekeningF1 = async (term, page, itemsPerPage) => {
  const offset = (page - 1) * itemsPerPage;
  const searchTermLike = term ? `%${term.trim()}%` : null;

  let whereClause = "";
  let params = [];

  if (searchTermLike) {
    whereClause = `WHERE rek_nomor LIKE ? OR rek_namabank LIKE ?`;
    params = [searchTermLike, searchTermLike];
  }

  const countQuery = `SELECT COUNT(*) as total FROM trekening ${whereClause}`;
  const [countRows] = await pool.query(countQuery, params);
  const total = countRows[0].total;

  const dataQuery = `
        SELECT rek_nomor AS kode, rek_namabank AS nama 
        FROM trekening 
        ${whereClause}
        ORDER BY rek_namabank ASC
        LIMIT ? OFFSET ?
    `;
  const dataParams = [...params, itemsPerPage, offset];
  const [items] = await pool.query(dataQuery, dataParams);

  return { items, total };
};

/**
 * 5. Menghapus rekening bank.
 * Sesuai Delphi cxButton4Click.
 */
const deleteRekening = async (nomorRekening) => {
  // Di sini Anda mungkin perlu cek tmutasibank jika ada relasi
  // ...

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      "DELETE FROM trekening WHERE rek_nomor = ?",
      [nomorRekening]
    );

    if (result.affectedRows === 0) {
      throw new Error("No Rekening tidak ditemukan.");
    }
    await connection.commit();
    return { message: `Rekening ${nomorRekening} berhasil dihapus.` };
  } catch (error) {
    await connection.rollback();
    throw new Error(error.message || "Gagal menghapus data rekening.");
  } finally {
    connection.release();
  }
};

module.exports = {
  fetchHeaders,
  getRekeningById,
  saveRekening,
  lookupRekeningF1,
  deleteRekening,
  // fetchDetails dihapus
};
