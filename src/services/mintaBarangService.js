const { pool } = require("../config/database");
const { format } = require("date-fns");

/**
 * Menghasilkan Nomor Otomatis
 * Format: [KDCAB].MTB.[YYMM].[NOMOR_URUT]
 * Contoh: F02.MTB.2603.0001
 */
const generateNomorPermintaan = async (connection, branchCode, date) => {
  const yyMm = format(new Date(date), "yyMM");
  const prefix = `${branchCode}.MTB.${yyMm}`;

  const [rows] = await connection.query(
    `SELECT MAX(RIGHT(mth_nomor, 4)) AS counter 
     FROM tmintaan_kaosan_hdr 
     WHERE mth_nomor LIKE ?`,
    [`${prefix}%`],
  );

  const nextNum = parseInt(rows[0].counter || 0) + 1;
  return `${prefix}.${String(nextNum).padStart(4, "0")}`;
};

const fetchHeaders = async (startDate, endDate) => {
  const query = `
    SELECT 
      mth_nomor AS Nomor,
      DATE_FORMAT(mth_tanggal, '%Y-%m-%d') AS Tanggal,
      mth_keterangan AS Keterangan,
      mth_total_item AS TotalQty,
      mth_status AS Status,
      user_create AS Created,
      DATE_FORMAT(date_create, '%Y-%m-%d %H:%i:%s') AS DateCreated
    FROM tmintaan_kaosan_hdr
    WHERE mth_tanggal BETWEEN ? AND ?
    ORDER BY mth_tanggal DESC, mth_nomor DESC
  `;
  const [rows] = await pool.query(query, [startDate, endDate]);
  return rows;
};

const fetchDetails = async (nomor) => {
  const query = `
    SELECT 
      d.mtd_brg_kode AS Kode,
      d.mtd_ukuran AS Ukuran, /* <--- TAMBAHKAN INI AGAR UKURANNYA MUNCUL DI DETAIL */
      TRIM(CONCAT_WS(' ', b.brg_jeniskaos, b.brg_tipe, b.brg_lengan, b.brg_jeniskain, b.brg_warna)) AS Nama,
      d.mtd_jumlah AS Jumlah
    FROM tmintaan_kaosan_dtl d
    LEFT JOIN retail.tbarangdc b ON b.brg_kode = d.mtd_brg_kode
    WHERE d.mtd_nomor = ?
  `;
  const [rows] = await pool.query(query, [nomor]);
  return rows;
};

const deleteRequest = async (nomor) => {
  // Karena tabel DTL punya ON DELETE CASCADE, hapus HDR saja cukup
  const [result] = await pool.query(
    "DELETE FROM tmintaan_kaosan_hdr WHERE mth_nomor = ?",
    [nomor],
  );

  if (result.affectedRows === 0) {
    throw new Error("Data permintaan tidak ditemukan.");
  }
  return { message: `Permintaan ${nomor} berhasil dihapus.` };
};

const loadFormData = async (nomor) => {
  const [headerRows] = await pool.query(
    `SELECT mth_nomor as nomor, DATE_FORMAT(mth_tanggal, '%Y-%m-%d') as tanggal, mth_keterangan as keterangan, mth_status as status 
     FROM tmintaan_kaosan_hdr WHERE mth_nomor = ?`,
    [nomor],
  );

  if (headerRows.length === 0) throw new Error("Permintaan tidak ditemukan.");

  const [detailRows] = await pool.query(
    `SELECT d.mtd_brg_kode as kode, d.mtd_jumlah as jumlah, d.mtd_ukuran as ukuran,
     TRIM(CONCAT_WS(' ', b.brg_jeniskaos, b.brg_tipe, b.brg_lengan, b.brg_jeniskain, b.brg_warna)) AS nama,
     bd.brgd_barcode as barcode   /* <--- TARIK BARCODE */
     FROM tmintaan_kaosan_dtl d
     LEFT JOIN retail.tbarangdc b ON b.brg_kode = d.mtd_brg_kode
     LEFT JOIN retail.tbarangdc_dtl bd ON bd.brgd_kode = d.mtd_brg_kode AND bd.brgd_ukuran = d.mtd_ukuran
     WHERE d.mtd_nomor = ?`,
    [nomor],
  );

  return { header: headerRows[0], items: detailRows };
};

const saveRequest = async (header, items, userKode, isNew) => {
  const connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    const [perushRows] = await connection.query(
      "SELECT perush_kode FROM tperusahaan LIMIT 1",
    );
    if (perushRows.length === 0)
      throw new Error("Data perusahaan belum diatur.");

    const branchCode = perushRows[0].perush_kode;
    const tgl = format(new Date(header.tanggal), "yyyy-MM-dd");

    // Hitung total Qty
    const totalItem = items.reduce(
      (sum, i) => sum + (Number(i.jumlah) || 0),
      0,
    );

    let nomorReq = header.nomor;

    if (isNew) {
      nomorReq = await generateNomorPermintaan(connection, branchCode, tgl);
      await connection.query(
        `INSERT INTO tmintaan_kaosan_hdr (mth_nomor, mth_tanggal, mth_keterangan, mth_total_item, mth_status, user_create) 
         VALUES (?, ?, ?, ?, 'Pending', ?)`,
        [nomorReq, tgl, header.keterangan || "", totalItem, userKode],
      );
    } else {
      // Cek apakah status masih Pending, kalau sudah diproses Pusat tidak boleh diedit
      const [cekStatus] = await connection.query(
        "SELECT mth_status FROM tmintaan_kaosan_hdr WHERE mth_nomor = ?",
        [nomorReq],
      );
      if (cekStatus[0]?.mth_status !== "Pending") {
        throw new Error("Data tidak bisa diubah karena sudah diproses Pusat.");
      }

      await connection.query(
        `UPDATE tmintaan_kaosan_hdr SET mth_tanggal=?, mth_keterangan=?, mth_total_item=? WHERE mth_nomor=?`,
        [tgl, header.keterangan || "", totalItem, nomorReq],
      );
    }

    // Refresh Details
    await connection.query(
      "DELETE FROM tmintaan_kaosan_dtl WHERE mtd_nomor = ?",
      [nomorReq],
    );

    const detailValues = items.map((item) => [
      nomorReq,
      item.kode,
      item.ukuran || "", // <--- Tambahkan ukuran di sini
      item.jumlah,
    ]);

    if (detailValues.length > 0) {
      await connection.query(
        // <--- Pastikan mtd_ukuran ditambahkan di query INSERT ini
        `INSERT INTO tmintaan_kaosan_dtl (mtd_nomor, mtd_brg_kode, mtd_ukuran, mtd_jumlah) VALUES ?`,
        [detailValues],
      );
    }

    await connection.commit();
    return { message: "Permintaan barang berhasil disimpan.", nomor: nomorReq };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Mencari data barang langsung ke tabel FEDERATED (tbarangdc)
 */
const searchBarangPusat = async (keyword, page, itemsPerPage) => {
  const limitVal = parseInt(itemsPerPage) > 0 ? parseInt(itemsPerPage) : 15;
  const offsetVal = (parseInt(page) - 1) * limitVal;

  let params = [];

  // ---------- BASE QUERY ----------
  let baseFrom = ` FROM retail.tbarangdc a 
                   INNER JOIN retail.tbarangdc_dtl b 
                   ON a.brg_kode = b.brgd_kode `;

  let baseWhere = ` WHERE a.brg_aktif = 0 `;

  // ---------- SMART SEARCH ----------
  const tokens = (keyword || "")
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);

  let searchWhere = "";

  if (tokens.length > 0) {
    searchWhere += " AND (";
    const likeParts = [];

    for (const t of tokens) {
      likeParts.push(`
        (
          b.brgd_kode LIKE ?
          OR b.brgd_barcode LIKE ?
          OR TRIM(CONCAT_WS(' ',
            a.brg_jeniskaos,
            a.brg_tipe,
            a.brg_lengan,
            a.brg_jeniskain,
            a.brg_warna
          )) LIKE ?
        )
      `);

      const likeVal = `%${t}%`;
      params.push(likeVal, likeVal, likeVal);
    }

    searchWhere += likeParts.join(" AND ");
    searchWhere += ")";
  }

  // ---------- QUERY TOTAL ----------
  const countQuery = `
    SELECT COUNT(*) AS total
    ${baseFrom}
    ${baseWhere}
    ${searchWhere}
  `;

  const [countRows] = await pool.query(countQuery, params);

  // ---------- QUERY DATA ----------
  const dataQuery = `
    SELECT
      b.brgd_kode AS kode,
      b.brgd_barcode AS barcode,
      TRIM(CONCAT_WS(' ',
        a.brg_jeniskaos,
        a.brg_tipe,
        a.brg_lengan,
        a.brg_jeniskain,
        a.brg_warna
      )) AS nama,
      b.brgd_ukuran AS ukuran,
      b.brgd_harga AS harga
    ${baseFrom}
    ${baseWhere}
    ${searchWhere}
    ORDER BY b.brgd_barcode ASC   /* <--- INI KUNCINYA, diurutkan by Barcode */
    LIMIT ${limitVal} OFFSET ${offsetVal}
  `;

  const [items] = await pool.query(dataQuery, params);

  return { items, total: countRows[0].total };
};

// 2. TAMBAHKAN FUNGSI BARU INI DI BAWAH (Sebelum module.exports):
const getPrintData = async (nomor, userNama) => {
  const [perusahaan] = await pool.query(
    "SELECT perush_nama, perush_alamat, perush_telp FROM tperusahaan LIMIT 1",
  );

  const [header] = await pool.query(
    `SELECT mth_nomor, DATE_FORMAT(mth_tanggal, '%d-%m-%Y') as tanggal, mth_keterangan, mth_status, user_create 
     FROM tmintaan_kaosan_hdr WHERE mth_nomor = ?`,
    [nomor],
  );

  if (header.length === 0) throw new Error("Permintaan tidak ditemukan");

  const [details] = await pool.query(
    `SELECT 
      d.mtd_brg_kode as kode, 
      d.mtd_ukuran as ukuran, 
      d.mtd_jumlah as qty,
      TRIM(CONCAT_WS(' ', b.brg_jeniskaos, b.brg_tipe, b.brg_lengan, b.brg_jeniskain, b.brg_warna)) AS nama,
      bd.brgd_barcode as barcode   /* <--- TARIK BARCODE */
     FROM tmintaan_kaosan_dtl d
     LEFT JOIN retail.tbarangdc b ON b.brg_kode = d.mtd_brg_kode
     LEFT JOIN retail.tbarangdc_dtl bd ON bd.brgd_kode = d.mtd_brg_kode AND bd.brgd_ukuran = d.mtd_ukuran
     WHERE d.mtd_nomor = ?`,
    [nomor],
  );

  const totalQty = details.reduce((sum, item) => sum + item.qty, 0);

  return {
    header: {
      nomor: header[0].mth_nomor,
      tanggal: header[0].tanggal,
      status: header[0].mth_status,
      keterangan: header[0].mth_keterangan,
      userNama: header[0].user_create || userNama,
      perusahaanNama: perusahaan[0]?.perush_nama || "CABANG",
      perusahaanAlamat: perusahaan[0]?.perush_alamat || "",
    },
    details: details,
    summary: { totalQty },
  };
};

module.exports = {
  fetchHeaders,
  fetchDetails,
  deleteRequest,
  loadFormData,
  saveRequest,
  searchBarangPusat,
  getPrintData, // <--- Jangan lupa ekspor fungsi baru ini
};
