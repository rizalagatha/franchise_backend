const { pool } = require("../config/database");
const { format } = require("date-fns"); // Untuk format tanggal jika perlu

/**
 * Mengambil data header cetak barcode berdasarkan periode.
 * Sesuai SQLMaster Delphi.
 */
const fetchHeaders = async (startDate, endDate) => {
  // Pastikan tanggal valid atau set default jika tidak
  const start = startDate
    ? format(new Date(startDate), "yyyy-MM-dd")
    : format(new Date(), "yyyy-MM-dd");
  const end = endDate
    ? format(new Date(endDate), "yyyy-MM-dd")
    : format(new Date(), "yyyy-MM-dd");

  const query = `
        SELECT 
            h.bch_nomor AS Nomor,
            DATE_FORMAT(h.bch_tanggal, '%d-%m-%Y') AS Tanggal, -- Format tanggal
            u.user_nama AS Created -- Ambil nama user
        FROM tbarcode_hdr h
        LEFT JOIN tuser u ON u.user_kode = h.user_create
        WHERE h.bch_tanggal BETWEEN ? AND ? 
        ORDER BY h.bch_tanggal, h.bch_nomor
    `;
  const [rows] = await pool.query(query, [start, end]);
  return rows;
};

/**
 * Mengambil data detail barcode berdasarkan nomor header.
 * Sesuai SQLDetail Delphi (difilter by nomor).
 */
const fetchDetails = async (nomorHeader) => {
  console.log(`--- [LOG: Browse] Panggil fetchDetails...`);
  console.log(`--- [LOG: Browse] Nomor Header: ${nomorHeader}`);
  // Query ini meniru loaddataall, dimulai dari tbarcode_hdr
  const query = `
        SELECT 
            d.bcd_nomor AS Nomor,
            a.brg_kode AS Kode,
            b.brgd_barcode AS Barcode,
            TRIM(CONCAT(a.brg_jeniskaos, ' ', a.brg_tipe, ' ', a.brg_lengan, ' ', a.brg_jeniskain, ' ', a.brg_warna)) AS Nama,
            d.bcd_ukuran AS Ukuran,
            d.bcd_jumlah AS Jumlah
        FROM tbarcode_hdr h
        LEFT JOIN tbarcode_dtl d ON d.bcd_nomor = h.bch_nomor
        LEFT JOIN tbarang a ON a.brg_kode = d.bcd_kode
        LEFT JOIN tbarang_dtl b ON b.brgd_kode = d.bcd_kode AND b.brgd_ukuran = d.bcd_ukuran
        WHERE h.bch_nomor = ? AND d.bcd_nomor IS NOT NULL
        ORDER BY d.bcd_nourut
    `;
  console.log(`--- [LOG: Browse] Query: ${query.substring(0, 150)}...`);
  const [rows] = await pool.query(query, [nomorHeader]);
  console.log(
    `--- [LOG: Browse] Hasil: Ditemukan ${rows.length} baris detail.`
  );
  return rows;
};

/**
 * Menghapus data header dan detail barcode.
 * Menggunakan transaksi.
 */
const deleteBarcode = async (nomorHeader) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Hapus Detail dulu (jika ada foreign key constraint)
    await connection.query("DELETE FROM tbarcode_dtl WHERE bcd_nomor = ?", [
      nomorHeader,
    ]);

    // 2. Hapus Header
    const [result] = await connection.query(
      "DELETE FROM tbarcode_hdr WHERE bch_nomor = ?",
      [nomorHeader]
    );

    if (result.affectedRows === 0) {
      throw new Error("Nomor barcode tidak ditemukan.");
    }

    await connection.commit();
    return { message: `Data barcode ${nomorHeader} berhasil dihapus.` };
  } catch (error) {
    await connection.rollback();
    console.error("Error deleting barcode:", error);
    throw new Error(error.message || "Gagal menghapus data barcode.");
  } finally {
    connection.release();
  }
};

/**
 * Mencari barang untuk lookup F1 dengan server-side pagination & search.
 * Mengambil detail varian (kode, barcode, nama, ukuran, harga).
 * Mengadopsi pola searchProducts retail, disederhanakan untuk franchise.
 */
const searchBarcodeLookupItems = async (term, page, itemsPerPage) => {
  const offset = (page - 1) * itemsPerPage;
  const searchTermLike = term ? `%${term.trim()}%` : null;

  // --- PERBAIKAN DI SINI ---
  // Definisikan 'namaBarangField' HANYA menggunakan CONCAT_WS
  const namaBarangField = `
        TRIM(CONCAT_WS(' ', 
            a.brg_jeniskaos, a.brg_tipe, a.brg_lengan, 
            a.brg_jeniskain, a.brg_warna
        ))
    `;
  // --- AKHIR PERBAIKAN ---

  let fromClause = `
        FROM tbarang a 
        LEFT JOIN tbarang_dtl b ON a.brg_kode = b.brgd_kode
    `;
  let whereClause = `WHERE b.brgd_kode IS NOT NULL`;
  let params = [];

  if (searchTermLike) {
    // Gunakan 'namaBarangField' di WHERE clause
    whereClause += ` AND (
            a.brg_kode LIKE ? OR
            ${namaBarangField} LIKE ? OR 
            b.brgd_barcode LIKE ?
        )`;
    params.push(searchTermLike, searchTermLike, searchTermLike);
  }

  const countQuery = `SELECT COUNT(*) as total ${fromClause} ${whereClause}`;
  const [countRows] = await pool.query(countQuery, params);
  const total = countRows[0].total;

  const dataQuery = `
        SELECT 
            a.brg_kode AS kode, 
            IFNULL(b.brgd_barcode, '') AS barcode,
            ${namaBarangField} AS nama, IFNULL(b.brgd_ukuran, '') AS ukuran,
            IFNULL(b.brgd_harga, 0) AS harga 
        ${fromClause}
        ${whereClause}
        ORDER BY nama, b.brgd_ukuran
        LIMIT ? OFFSET ? 
    `;
  const dataParams = [...params, itemsPerPage, offset];
  const [items] = await pool.query(dataQuery, dataParams);

  return { items, total };
};

/**
 * Menyimpan data Cetak Barcode (Header + Detail).
 * Bisa untuk create (isNew=true) atau update (isNew=false).
 */
const saveBarcodeData = async (headerData, itemsData, userKode, isNew) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    let nomorBarcode = headerData.nomor; // Ambil nomor dari header (jika update)
    const tanggal = format(new Date(headerData.tanggal), "yyyy-MM-dd"); // Pastikan format tanggal SQL

    // 1. Proses Header
    if (isNew) {
      // Generate nomor baru (Logika Delphi getmaxnomor)
      const nomorQuery = `
                SELECT IFNULL(MAX(RIGHT(bch_nomor, 5)), 0) AS lastNum 
                FROM tbarcode_hdr 
                WHERE LEFT(bch_nomor, 8) = ?
            `;
      const prefix = `BCD.${format(new Date(tanggal), "yymm")}`;
      const [nomorRows] = await connection.query(nomorQuery, [prefix]);
      const nextNum = parseInt(nomorRows[0].lastNum, 10) + 1;
      nomorBarcode = `${prefix}${String(nextNum).padStart(5, "0")}`;

      // Insert header
      const insertHeaderQuery = `
                INSERT INTO tbarcode_hdr (bch_nomor, bch_tanggal, user_create, date_create) 
                VALUES (?, ?, ?, NOW())
            `;
      await connection.query(insertHeaderQuery, [
        nomorBarcode,
        tanggal,
        userKode,
      ]);
    } else {
      // Update header (hanya tanggal & user modified)
      const updateHeaderQuery = `
                UPDATE tbarcode_hdr SET 
                    bch_tanggal = ?, 
                    user_modified = ?, 
                    date_modified = NOW() 
                WHERE bch_nomor = ?
            `;
      await connection.query(updateHeaderQuery, [
        tanggal,
        userKode,
        nomorBarcode,
      ]);
    }

    // 2. Proses Detail (Delete existing then Insert new)
    // Delphi: s:='delete from tbarcode_dtl where bcd_nomor='+ quot(edtNomor.Text) ; xExecQuery(s,frmmenu.conn);
    await connection.query("DELETE FROM tbarcode_dtl WHERE bcd_nomor = ?", [
      nomorBarcode,
    ]);

    // Insert detail baru dari itemsData
    if (itemsData && itemsData.length > 0) {
      const insertDetailQuery = `
                INSERT INTO tbarcode_dtl (bcd_nomor, bcd_kode, bcd_ukuran, bcd_jumlah, bcd_nourut) 
                VALUES ?`; // Gunakan bulk insert

      const detailValues = itemsData
        // Filter item yang valid (punya nama/kode & jumlah > 0)
        .filter((item) => item.kode && (item.jumlah || 0) > 0)
        .map((item, index) => [
          nomorBarcode,
          item.kode,
          item.ukuran,
          item.jumlah || 0, // Pastikan jumlah adalah angka
          index + 1, // bcd_nourut
        ]);

      if (detailValues.length > 0) {
        await connection.query(insertDetailQuery, [detailValues]);
      }
    }

    await connection.commit();
    return {
      message: `Data barcode ${nomorBarcode} berhasil disimpan.`,
      nomor: nomorBarcode,
    };
  } catch (error) {
    await connection.rollback();
    console.error("Error saving barcode data:", error);
    throw new Error(error.message || "Gagal menyimpan data barcode.");
  } finally {
    connection.release();
  }
};

/**
 * Mengambil data header dan detail untuk mode edit.
 * Sesuai logika Delphi loaddataall.
 */
const loadFormData = async (nomorBarcode) => {
  // 1. Ambil Header
  const headerQuery = `
        SELECT 
            h.bch_nomor, 
            DATE_FORMAT(h.bch_tanggal, '%Y-%m-%d') AS bch_tanggal
        FROM tbarcode_hdr h 
        WHERE h.bch_nomor = ?
     `;
  const [headerRows] = await pool.query(headerQuery, [nomorBarcode]);
  if (headerRows.length === 0) {
    throw new Error("Nomor barcode tidak ditemukan.");
  }
  const header = headerRows[0];

  // 2. Ambil Detail
  console.log(`--- [LOG: Edit Form] Panggil loadFormData (detail)...`);
  console.log(`--- [LOG: Edit Form] Nomor Barcode: ${nomorBarcode}`);

  const detailQuery = `
        SELECT 
            d.bcd_kode AS kode, 
            b.brgd_barcode AS barcode,
            TRIM(CONCAT(a.brg_jeniskaos, ' ', a.brg_tipe, ' ', a.brg_lengan, ' ', a.brg_jeniskain, ' ', a.brg_warna)) AS nama,
            d.bcd_ukuran AS ukuran, 
            b.brgd_harga AS harga, 
            d.bcd_jumlah AS jumlah
        FROM tbarcode_hdr h
        LEFT JOIN tbarcode_dtl d ON d.bcd_nomor = h.bch_nomor
        LEFT JOIN tbarang a ON a.brg_kode = d.bcd_kode
        LEFT JOIN tbarang_dtl b ON b.brgd_kode = d.bcd_kode AND b.brgd_ukuran = d.bcd_ukuran
        WHERE h.bch_nomor = ? AND d.bcd_nomor IS NOT NULL
        ORDER BY d.bcd_nourut
     `;

  console.log(
    `--- [LOG: Edit Form] Query: ${detailQuery.substring(0, 150)}...`
  ); // Log query

  const [details] = await pool.query(detailQuery, [nomorBarcode]);

  console.log(
    `--- [LOG: Edit Form] Hasil: Ditemukan ${details.length} baris detail.`
  ); // Log hasil

  return { header, items: details };
};

const getVarianDetailsByKode = async (kodeBarang) => {
  const query = `
        SELECT 
            b.brgd_kode AS kode, 
            IFNULL(b.brgd_barcode, '') AS barcode,
            IFNULL(b.brgd_ukuran, '') AS ukuran,
            IFNULL(b.brgd_harga, 0) AS harga,
            
            /* --- PERBAIKAN NAMA KOSONG --- */
            TRIM(CONCAT_WS(' ', 
                a.brg_jeniskaos, a.brg_tipe, a.brg_lengan, 
                a.brg_jeniskain, a.brg_warna
            )) AS nama
            /* --- AKHIR PERBAIKAN --- */

        FROM tbarang_dtl b
        INNER JOIN tbarang a ON a.brg_kode = b.brgd_kode
        WHERE b.brgd_kode = ?
        ORDER BY b.brgd_ukuran
    `;
  const [rows] = await pool.query(query, [kodeBarang]);
  if (rows.length === 0) {
    throw new Error(`Varian detail untuk kode ${kodeBarang} tidak ditemukan.`);
  }
  return rows;
};

module.exports = {
  fetchHeaders,
  fetchDetails,
  deleteBarcode,
  searchBarcodeLookupItems,
  saveBarcodeData,
  loadFormData,
  getVarianDetailsByKode,
};
