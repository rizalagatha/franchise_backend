const { pool } = require("../config/database");
const { format } = require("date-fns");

/**
 * 1. Mengambil data header koreksi stok (tkor_hdr) berdasarkan periode.
 */
const fetchHeaders = async (startDate, endDate) => {
  const headerQuery = `
        SELECT 
            h.kor_nomor AS Nomor,
            DATE_FORMAT(h.kor_tanggal, '%d-%m-%Y') AS Tanggal,
            h.kor_ket AS Keterangan,
            h.user_create AS Created,
            h.user_modified AS Modified
        FROM tkor_hdr h
        WHERE h.kor_tanggal BETWEEN ? AND ? 
        ORDER BY h.kor_tanggal DESC, h.kor_nomor DESC
    `;
  const [headers] = await pool.query(headerQuery, [startDate, endDate]);

  const nominalQuery = `
        SELECT 
            d.kord_kor_nomor AS Nomor, 
            SUM(d.kord_selisih * d.kord_hpp) AS Nominal
        FROM tkor_dtl d
        INNER JOIN tkor_hdr h ON h.kor_nomor = d.kord_kor_nomor
        WHERE h.kor_tanggal BETWEEN ? AND ? 
        GROUP BY d.kord_kor_nomor
    `;
  const [nominals] = await pool.query(nominalQuery, [startDate, endDate]);

  const nominalMap = new Map(
    nominals.map((item) => [item.Nomor, item.Nominal]),
  );

  return headers.map((header) => ({
    ...header,
    Nominal: nominalMap.get(header.Nomor) || 0,
  }));
};

/**
 * 2. Mengambil data detail koreksi stok (tkor_dtl) berdasarkan nomor header.
 */
const fetchDetails = async (nomorHeader) => {
  const query = `
        SELECT 
            d.kord_kor_nomor AS Nomor,
            d.kord_kode AS Kode,
            TRIM(CONCAT_WS(' ', a.brg_jeniskaos, a.brg_tipe, a.brg_lengan, a.brg_jeniskain, a.brg_warna)) AS Nama,
            d.kord_ukuran AS Ukuran,
            d.kord_stok AS Stok,
            d.kord_jumlah AS Jumlah,
            d.kord_selisih AS Selisih,
            d.kord_hpp AS Hpp,
            (d.kord_selisih * d.kord_hpp) AS Total,
            d.kord_ket AS Keterangan
        FROM tkor_dtl d
        LEFT JOIN tbarang a ON a.brg_kode = d.kord_kode
        WHERE d.kord_kor_nomor = ?
    `;
  const [rows] = await pool.query(query, [nomorHeader]);
  return rows;
};

/**
 * 3. Hapus header dan detail koreksi (transaksional).
 */
const deleteKoreksi = async (nomorHeader) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query("DELETE FROM tkor_dtl WHERE kord_kor_nomor = ?", [
      nomorHeader,
    ]);
    const [result] = await connection.query(
      "DELETE FROM tkor_hdr WHERE kor_nomor = ?",
      [nomorHeader],
    );

    if (result.affectedRows === 0)
      throw new Error("Nomor koreksi tidak ditemukan.");

    await connection.commit();
    return { message: `Data koreksi ${nomorHeader} berhasil dihapus.` };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * 4. Lookup Barcode (Scan) - Integrated with Dupe Check, Stock, and Branch Prefix
 */
const lookupBarcodeKoreksi = async (barcode, tanggalKoreksi, nomorKoreksi) => {
  const [perushRows] = await pool.query(
    "SELECT perush_kode FROM tperusahaan LIMIT 1",
  );
  if (perushRows.length === 0) throw new Error("Data perusahaan belum diatur.");
  const branchPrefix = perushRows[0].perush_kode;

  // Cari Barang
  const [rows] = await pool.query(
    `
        SELECT b.brgd_kode AS kode, b.brgd_barcode AS barcode, b.brgd_ukuran AS ukuran, b.brgd_hpp AS hpp, b.brgd_harga AS jual,
               TRIM(CONCAT_WS(' ', a.brg_jeniskaos, a.brg_tipe, a.brg_lengan, a.brg_jeniskain, a.brg_warna)) AS nama
        FROM tbarang_dtl b INNER JOIN tbarang a ON a.brg_kode = b.brgd_kode
        WHERE b.brgd_barcode = ?
    `,
    [barcode],
  );

  if (rows.length === 0) throw new Error(`Barcode ${barcode} tidak ditemukan.`);
  const item = rows[0];

  // Cek Duplikat di hari yang sama khusus cabang ini
  const [dupeRows] = await pool.query(
    `
        SELECT h.kor_nomor FROM tkor_hdr h LEFT JOIN tkor_dtl d ON d.kord_kor_nomor = h.kor_nomor
        WHERE h.kor_nomor <> ? AND h.kor_nomor LIKE CONCAT(?, '%') AND h.kor_tanggal = ? 
          AND d.kord_kode = ? AND d.kord_ukuran = ? LIMIT 1
    `,
    [nomorKoreksi || "", branchPrefix, tanggalKoreksi, item.kode, item.ukuran],
  );

  if (dupeRows.length > 0)
    throw new Error(
      `Sudah dikoreksi di No: ${dupeRows[0].kor_nomor} hari ini.`,
    );

  // Ambil Stok Awal khusus cabang ini
  const [stokRows] = await pool.query(
    `
        SELECT IFNULL(SUM(mst_stok_in - mst_stok_out), 0) AS stok FROM tmasterstok 
        WHERE mst_aktif = 'Y' AND mst_brg_kode = ? AND mst_ukuran = ? AND mst_tanggal < ? 
          AND mst_noreferensi LIKE CONCAT(?, '%')
    `,
    [item.kode, item.ukuran, tanggalKoreksi, branchPrefix],
  );

  return { ...item, stok: stokRows[0].stok };
};

/**
 * 5. Lookup F1 Koreksi (Tabel Bantuan) - Integrated Stock & Branch
 */
const lookupF1Koreksi = async (term, tanggal, page, itemsPerPage) => {
  const offset = (page - 1) * itemsPerPage;
  const searchTerm = term ? `%${term.trim()}%` : null;

  const [perushRows] = await pool.query(
    "SELECT perush_kode FROM tperusahaan LIMIT 1",
  );
  const branchPrefix = perushRows[0].perush_kode;

  const namaField = `TRIM(CONCAT_WS(' ', a.brg_jeniskaos, a.brg_tipe, a.brg_lengan, a.brg_jeniskain, a.brg_warna))`;
  let where = `WHERE 1=1`;
  let params = [];

  if (searchTerm) {
    where += ` AND (b.brgd_barcode LIKE ? OR b.brgd_kode LIKE ? OR ${namaField} LIKE ?)`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  const [countRows] = await pool.query(
    `SELECT COUNT(*) as total FROM tbarang_dtl b INNER JOIN tbarang a ON a.brg_kode = b.brgd_kode ${where}`,
    params,
  );

  const dataQuery = `
        SELECT b.brgd_barcode AS barcode, b.brgd_kode AS kode, ${namaField} AS nama, b.brgd_ukuran AS ukuran, b.brgd_hpp AS hpp, 
            IFNULL((SELECT SUM(m.mst_stok_in - m.mst_stok_out) FROM tmasterstok m WHERE m.mst_aktif = 'Y' 
                AND m.mst_brg_kode = b.brgd_kode AND m.mst_ukuran = b.brgd_ukuran AND m.mst_tanggal < ? 
                AND m.mst_noreferensi LIKE CONCAT(?, '%')), 0) AS stok
        FROM tbarang_dtl b INNER JOIN tbarang a ON a.brg_kode = b.brgd_kode ${where}
        ORDER BY nama, ukuran LIMIT ? OFFSET ?
    `;

  const [items] = await pool.query(dataQuery, [
    tanggal,
    branchPrefix,
    ...params,
    itemsPerPage,
    offset,
  ]);
  return { items, total: countRows[0].total };
};

/**
 * 6. Simpan / Update Koreksi
 */
/**
 * 6. Simpan / Update Koreksi
 */
const saveKoreksi = async (header, items, userKode, isNew) => {
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  try {
    let nomor = header.nomor;
    const tgl = format(new Date(header.tanggal), "yyyy-MM-dd");

    if (isNew) {
      // Logic generate nomor tetap sama...
      const prefix = `KOR.${format(new Date(tgl), "yyMM")}`;
      const [rows] = await connection.query(
        "SELECT IFNULL(MAX(RIGHT(kor_nomor, 4)), 0) AS last FROM tkor_hdr WHERE LEFT(kor_nomor, 8) = ?",
        [prefix],
      );
      nomor = `${prefix}.${String(parseInt(rows[0].last) + 1).padStart(4, "0")}`;
      await connection.query(
        "INSERT INTO tkor_hdr (kor_nomor, kor_tanggal, kor_ket, user_create, date_create) VALUES (?, ?, ?, ?, NOW())",
        [nomor, tgl, header.keterangan, userKode],
      );
    } else {
      await connection.query(
        "UPDATE tkor_hdr SET kor_tanggal=?, kor_ket=?, user_modified=?, date_modified=NOW() WHERE kor_nomor=?",
        [tgl, header.keterangan, userKode, nomor],
      );
    }

    // PENTING: Karena ada trigger 'before_delete' di tkor_dtl,
    // hapus detail ini otomatis akan membersihkan tmasterstok via trigger database.
    await connection.query("DELETE FROM tkor_dtl WHERE kord_kor_nomor = ?", [
      nomor,
    ]);

    // Loop Item untuk Simpan Detail
    for (const item of items) {
      if (!item.kode) continue;

      // HITUNG SELISIH (Kunci agar Trigger bekerja)
      const selisih = Number(item.jumlah) - Number(item.stok);

      // PERBAIKAN: Hapus kord_nourut dari query INSERT dan array parameternya
      await connection.query(
        `INSERT INTO tkor_dtl (kord_kor_nomor, kord_kode, kord_ukuran, kord_stok, kord_jumlah, kord_selisih, kord_hpp, kord_ket) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          nomor,
          item.kode,
          item.ukuran,
          item.stok,
          item.jumlah,
          selisih,
          item.hpp,
          item.keterangan || "",
        ],
      );
    }

    await connection.commit();
    return { message: "Koreksi berhasil disimpan.", nomor };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * 7. Load data untuk Edit
 */
const loadFormData = async (nomor) => {
  const [headerRows] = await pool.query(
    "SELECT kor_nomor, DATE_FORMAT(kor_tanggal, '%Y-%m-%d') AS kor_tanggal, kor_ket FROM tkor_hdr WHERE kor_nomor = ?",
    [nomor],
  );
  if (headerRows.length === 0) throw new Error("Data tidak ditemukan.");

  const [items] = await pool.query(
    `
        SELECT d.kord_kode AS kode, b.brgd_barcode AS barcode, TRIM(CONCAT_WS(' ', a.brg_jeniskaos, a.brg_tipe, a.brg_lengan, a.brg_jeniskain, a.brg_warna)) AS nama,
               d.kord_ukuran AS ukuran, d.kord_stok AS stok, d.kord_jumlah AS jumlah, d.kord_selisih AS selisih, d.kord_hpp AS hpp, d.kord_ket AS keterangan
        FROM tkor_dtl d LEFT JOIN tbarang a ON a.brg_kode = d.kord_kode LEFT JOIN tbarang_dtl b ON b.brgd_kode = d.kord_kode AND b.brgd_ukuran = d.kord_ukuran
        WHERE d.kord_kor_nomor = ?
    `,
    [nomor],
  );

  return { header: headerRows[0], items };
};

/**
 * Mengambil data lengkap untuk cetak laporan koreksi stok
 */
const getPrintData = async (nomorKoreksi, userNama) => {
  // 1. Ambil data perusahaan secara dinamis
  const [perushRows] = await pool.query(
    "SELECT perush_nama, perush_alamat, perush_telp FROM tperusahaan LIMIT 1",
  );
  const perusahaan = perushRows[0] || {
    perush_nama: "KAOSAN",
    perush_alamat: "",
    perush_telp: "",
  };

  // 2. Query Utama (Header + Detail)
  const query = `
        SELECT 
            h.kor_nomor,
            DATE_FORMAT(h.kor_tanggal, '%d-%m-%Y') AS kor_tanggal,
            h.kor_ket,
            DATE_FORMAT(h.date_create, '%d-%m-%Y %T') AS date_create,
            h.user_create,
            d.kord_kode,
            TRIM(CONCAT_WS(' ', a.brg_jeniskaos, a.brg_tipe, a.brg_lengan, a.brg_jeniskain, a.brg_warna)) AS nama,
            d.kord_ukuran AS ukuran,
            d.kord_stok AS stok,
            d.kord_jumlah AS koreksi,
            d.kord_selisih AS selisih,
            d.kord_hpp AS hpp,
            (d.kord_selisih * d.kord_hpp) AS nominal,
            d.kord_ket AS ket_detail
        FROM tkor_hdr h
        LEFT JOIN tkor_dtl d ON d.kord_kor_nomor = h.kor_nomor
        LEFT JOIN tbarang a ON a.brg_kode = d.kord_kode
        WHERE h.kor_nomor = ?
    `;

  const [rows] = await pool.query(query, [nomorKoreksi]);
  if (rows.length === 0) throw new Error("Data cetak tidak ditemukan.");

  // 3. Susun Payload untuk Frontend
  const header = {
    nomor: rows[0].kor_nomor,
    tanggal: rows[0].kor_tanggal,
    keterangan: rows[0].kor_ket,
    userNama: userNama,
    perusahaanNama: perusahaan.perush_nama,
    perusahaanAlamat: perusahaan.perush_alamat,
    perusahaanTelp: perusahaan.perush_telp,
  };

  const details = rows
    .filter((row) => row.kord_kode) // Buang baris jika kode null
    .map((row, index) => ({
      no: index + 1,
      nama: `${row.kord_kode} - ${row.nama}`,
      ukuran: row.ukuran,
      stok: row.stok,
      koreksi: row.koreksi,
      selisih: row.selisih,
      nominal: row.nominal,
      keterangan: row.ket_detail,
    }));

  const totalNominal = details.reduce(
    (sum, item) => sum + (item.nominal || 0),
    0,
  );
  const createdInfo = `${rows[0].date_create} (${rows[0].user_create})`;

  return { header, details, totalNominal, createdInfo };
};

module.exports = {
  fetchHeaders,
  fetchDetails,
  deleteKoreksi,
  loadFormData,
  saveKoreksi,
  lookupBarcodeKoreksi,
  lookupF1Koreksi,
  getPrintData,
};
