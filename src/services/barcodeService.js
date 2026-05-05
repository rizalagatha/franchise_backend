const { format } = require("date-fns");

const fetchHeaders = async (db, startDate, endDate) => {
  const start = startDate
    ? format(new Date(startDate), "yyyy-MM-dd")
    : format(new Date(), "yyyy-MM-dd");
  const end = endDate
    ? format(new Date(endDate), "yyyy-MM-dd")
    : format(new Date(), "yyyy-MM-dd");

  const query = `
        SELECT 
            h.bch_nomor AS Nomor,
            DATE_FORMAT(h.bch_tanggal, '%d-%m-%Y') AS Tanggal, 
            u.user_nama AS Created 
        FROM tbarcode_hdr h
        LEFT JOIN tuser u ON u.user_kode = h.user_create
        WHERE h.bch_tanggal BETWEEN ? AND ? 
        ORDER BY h.bch_tanggal, h.bch_nomor
    `;
  const [rows] = await db.query(query, [start, end]);
  return rows;
};

const fetchDetails = async (db, nomorHeader) => {
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
  const [rows] = await db.query(query, [nomorHeader]);
  return rows;
};

const deleteBarcode = async (db, nomorHeader) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query("DELETE FROM tbarcode_dtl WHERE bcd_nomor = ?", [
      nomorHeader,
    ]);

    const [result] = await connection.query(
      "DELETE FROM tbarcode_hdr WHERE bch_nomor = ?",
      [nomorHeader],
    );

    if (result.affectedRows === 0) {
      throw new Error("Nomor barcode tidak ditemukan.");
    }

    await connection.commit();
    return { message: `Data barcode ${nomorHeader} berhasil dihapus.` };
  } catch (error) {
    await connection.rollback();
    throw new Error(error.message || "Gagal menghapus data barcode.");
  } finally {
    connection.release();
  }
};

const searchBarcodeLookupItems = async (db, term, page, itemsPerPage) => {
  const offset = (page - 1) * itemsPerPage;
  const searchTermLike = term ? `%${term.trim()}%` : null;

  const [perushRows] = await db.query(
    "SELECT perush_kode FROM tperusahaan LIMIT 1",
  );
  if (perushRows.length === 0) throw new Error("Data perusahaan belum diatur.");
  const branchPrefix = perushRows[0].perush_kode;

  const namaBarangField = `TRIM(CONCAT_WS(' ', a.brg_jeniskaos, a.brg_tipe, a.brg_lengan, a.brg_jeniskain, a.brg_warna))`;

  const stokSubQuery = `
        LEFT JOIN (
            SELECT mst_brg_kode, mst_ukuran, SUM(mst_stok_in - mst_stok_out) as saldo
            FROM tmasterstok 
            WHERE mst_noreferensi LIKE CONCAT(?, '%') 
            GROUP BY mst_brg_kode, mst_ukuran
        ) s ON b.brgd_kode = s.mst_brg_kode AND b.brgd_ukuran = s.mst_ukuran
    `;

  let fromClause = `
        FROM tbarang a 
        LEFT JOIN tbarang_dtl b ON a.brg_kode = b.brgd_kode
        ${stokSubQuery}
    `;

  let whereClause = `WHERE b.brgd_kode IS NOT NULL`;
  let params = [branchPrefix];

  if (searchTermLike) {
    whereClause += ` AND (
            a.brg_kode LIKE ? OR
            ${namaBarangField} LIKE ? OR 
            b.brgd_barcode LIKE ?
        )`;
    params.push(searchTermLike, searchTermLike, searchTermLike);
  }

  const countQuery = `SELECT COUNT(*) as total ${fromClause} ${whereClause}`;
  const [countRows] = await db.query(countQuery, params);
  const total = countRows[0].total;

  const dataQuery = `
        SELECT 
            a.brg_kode AS kode, 
            IFNULL(b.brgd_barcode, '') AS barcode,
            ${namaBarangField} AS nama, 
            IFNULL(b.brgd_ukuran, '') AS ukuran,
            IFNULL(b.brgd_harga, 0) AS harga,
            IFNULL(b.brgd_hpp, 0) AS hpp,
            IFNULL(s.saldo, 0) AS stok
        ${fromClause}
        ${whereClause}
        ORDER BY nama, b.brgd_ukuran
        LIMIT ? OFFSET ? 
    `;

  const dataParams = [...params, itemsPerPage, offset];
  const [items] = await db.query(dataQuery, dataParams);

  return { items, total };
};

const saveBarcodeData = async (db, headerData, itemsData, userKode, isNew) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    let nomorBarcode = headerData.nomor;
    const tanggal = format(new Date(headerData.tanggal), "yyyy-MM-dd");

    if (isNew) {
      const nomorQuery = `
                SELECT IFNULL(MAX(RIGHT(bch_nomor, 5)), 0) AS lastNum 
                FROM tbarcode_hdr 
                WHERE LEFT(bch_nomor, 8) = ?
            `;
      const prefix = `BCD.${format(new Date(tanggal), "yymm")}`;
      const [nomorRows] = await connection.query(nomorQuery, [prefix]);
      const nextNum = parseInt(nomorRows[0].lastNum, 10) + 1;
      nomorBarcode = `${prefix}${String(nextNum).padStart(5, "0")}`;

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

    await connection.query("DELETE FROM tbarcode_dtl WHERE bcd_nomor = ?", [
      nomorBarcode,
    ]);

    if (itemsData && itemsData.length > 0) {
      const insertDetailQuery = `
                INSERT INTO tbarcode_dtl (bcd_nomor, bcd_kode, bcd_ukuran, bcd_jumlah, bcd_nourut) 
                VALUES ?`;

      const detailValues = itemsData
        .filter((item) => item.kode && (item.jumlah || 0) > 0)
        .map((item, index) => [
          nomorBarcode,
          item.kode,
          item.ukuran,
          item.jumlah || 0,
          index + 1,
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
    throw new Error(error.message || "Gagal menyimpan data barcode.");
  } finally {
    connection.release();
  }
};

const loadFormData = async (db, nomorBarcode) => {
  const headerQuery = `
        SELECT 
            h.bch_nomor, 
            DATE_FORMAT(h.bch_tanggal, '%Y-%m-%d') AS bch_tanggal
        FROM tbarcode_hdr h 
        WHERE h.bch_nomor = ?
     `;
  const [headerRows] = await db.query(headerQuery, [nomorBarcode]);
  if (headerRows.length === 0)
    throw new Error("Nomor barcode tidak ditemukan.");
  const header = headerRows[0];

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
  const [details] = await db.query(detailQuery, [nomorBarcode]);

  return { header, items: details };
};

const getVarianDetailsByKode = async (db, kodeBarang) => {
  const query = `
        SELECT 
            b.brgd_kode AS kode, 
            IFNULL(b.brgd_barcode, '') AS barcode,
            IFNULL(b.brgd_ukuran, '') AS ukuran,
            IFNULL(b.brgd_harga, 0) AS harga,
            TRIM(CONCAT_WS(' ', a.brg_jeniskaos, a.brg_tipe, a.brg_lengan, a.brg_jeniskain, a.brg_warna)) AS nama
        FROM tbarang_dtl b
        INNER JOIN tbarang a ON a.brg_kode = b.brgd_kode
        WHERE b.brgd_kode = ?
        ORDER BY b.brgd_ukuran
    `;
  const [rows] = await db.query(query, [kodeBarang]);
  if (rows.length === 0)
    throw new Error(`Varian detail untuk kode ${kodeBarang} tidak ditemukan.`);
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
