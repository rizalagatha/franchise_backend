const { pool } = require("../config/database");
const { format } = require("date-fns");

/**
 * Mengambil data Header FSK (Browse)
 */
const fetchHeaders = async (startDate, endDate, branchCode) => {
  const query = `
    SELECT 
      h.fsk_nomor AS Nomor,
      h.fsk_tanggal AS TglSetor,
      h.fsk_kasir AS Kasir,
      h.user_create AS Created,
      h.user_modified AS Modified
    FROM tform_setorkasir_hdr h
    WHERE LEFT(h.fsk_nomor, 3) = ? 
      AND h.fsk_tanggal BETWEEN ? AND ?
    ORDER BY h.fsk_tanggal ASC
  `;

  const [rows] = await pool.query(query, [branchCode, startDate, endDate]);
  return rows;
};

/**
 * Mengambil detail setoran per nomor
 */
const fetchDetails = async (nomor) => {
  const query = `
    SELECT 
      fskd2_nomor AS Nomor,
      fskd2_jenis AS Jenis,
      fskd2_nominal AS NominalSetor
    FROM tform_setorkasir_dtl2
    WHERE fskd2_nomor = ?
    ORDER BY fskd2_jenis ASC
  `;

  const [rows] = await pool.query(query, [nomor]);
  return rows;
};

/**
 * Menghapus data FSK (Header & Detail)
 */
const deleteFSK = async (nomor) => {
  const connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    // Hapus Detail 2
    await connection.query(
      "DELETE FROM tform_setorkasir_dtl2 WHERE fskd2_nomor = ?",
      [nomor],
    );

    // Hapus Header
    const [result] = await connection.query(
      "DELETE FROM tform_setorkasir_hdr WHERE fsk_nomor = ?",
      [nomor],
    );

    if (result.affectedRows === 0) throw new Error("Data tidak ditemukan.");

    await connection.commit();
    return { message: "Data setoran berhasil dihapus." };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Menghasilkan Nomor FSK Otomatis
 * Format: [KDCAB].FSK.[YYMM].[NOMOR_URUT]
 */
const generateNomorFSK = async (connection, branchCode, date) => {
  const yyMm = format(new Date(date), "yyMM");
  const prefix = `${branchCode}.FSK.${yyMm}`;

  const [rows] = await connection.query(
    `SELECT MAX(RIGHT(fsk_nomor, 4)) AS counter 
     FROM tform_setorkasir_hdr 
     WHERE fsk_nomor LIKE ?`,
    [`${prefix}%`],
  );

  const nextNum = parseInt(rows[0].counter || 0) + 1;
  return `${prefix}.${String(nextNum).padStart(4, "0")}`;
};

/**
 * Menyimpan data FSK (Insert atau Update)
 */
const saveFSK = async (header, detail1, detail2, userKode, isNew) => {
  const connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    const tgl = format(new Date(header.fsk_tanggal), "yyyy-MM-dd");
    const branchCode = userKode.substring(0, 3);
    let nomorFSK = header.fsk_nomor;

    if (isNew) {
      nomorFSK = await generateNomorFSK(connection, branchCode, tgl);
      await connection.query(
        `INSERT INTO tform_setorkasir_hdr (fsk_nomor, fsk_tanggal, fsk_kasir, user_create, date_create) 
         VALUES (?, ?, ?, ?, NOW())`,
        [nomorFSK, tgl, header.fsk_kasir, userKode],
      );
    } else {
      await connection.query(
        `UPDATE tform_setorkasir_hdr SET fsk_tanggal = ?, fsk_kasir = ?, user_modified = ?, date_modified = NOW() 
         WHERE fsk_nomor = ?`,
        [tgl, header.fsk_kasir, userKode, nomorFSK],
      );
      // Hapus detail lama agar tidak duplikat
      await connection.query(
        "DELETE FROM tform_setorkasir_dtl WHERE fskd_nomor = ?",
        [nomorFSK],
      );
      await connection.query(
        "DELETE FROM tform_setorkasir_dtl2 WHERE fskd2_nomor = ?",
        [nomorFSK],
      );
    }

    // SIMPAN DETAIL 1 (Rincian Transaksi)
    if (detail1 && detail1.length > 0) {
      const values1 = detail1.map((d) => [
        nomorFSK,
        d.jenis,
        d.tgltrf ? format(new Date(d.tgltrf), "yyyy-MM-dd") : null,
        d.kdcus,
        d.inv,
        d.nominal,
      ]);
      await connection.query(
        `INSERT INTO tform_setorkasir_dtl (fskd_nomor, fskd_jenis, fskd_tgltrf, fskd_kdcus, fskd_inv, fskd_nominal) VALUES ?`,
        [values1],
      );
    }

    // SIMPAN DETAIL 2 (Ringkasan Jenis)
    if (detail2 && detail2.length > 0) {
      const values2 = detail2.map((d) => [nomorFSK, d.jenis, d.nominal]);
      await connection.query(
        `INSERT INTO tform_setorkasir_dtl2 (fskd2_nomor, fskd2_jenis, fskd2_nominal) VALUES ?`,
        [values2],
      );
    }

    await connection.commit();
    return { message: "Data setoran berhasil disimpan.", nomor: nomorFSK };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Menghasilkan Rekap Data Otomatis berdasarkan Tanggal dan Kasir
 * Sesuai prosedur loadnew di Delphi
 */
const generateRekapData = async (tanggal, kasir, branchCode) => {
  // 1. Cek apakah sudah ada data FSK tersimpan untuk tanggal & kasir ini
  const [existing] = await pool.query(
    `SELECT fsk_nomor FROM tform_setorkasir_hdr 
     WHERE fsk_tanggal = ? AND fsk_kasir = ? AND LEFT(fsk_nomor, 3) = ?`,
    [tanggal, kasir, branchCode],
  );

  // --- QUERY DETAIL 1: RINCIAN TRANSAKSI ---
  // Query ini menggabungkan Setoran Kasir Tunai, Pembayaran Tunai, dan Transfer
  let queryDtl1 = `
    SELECT * FROM (
      /* SETORAN KASIR TUNAI FROM INVOICE */
      SELECT 'SETORAN KASIR TUNAI' AS jenis, h.inv_tanggal AS tgltrf, h.inv_cus_kode AS kdcus, 
             c.cus_nama AS nmcus, c.cus_alamat AS alamat, h.inv_nomor AS inv, h.inv_rptunai AS nominal
      FROM tinv_hdr h
      LEFT JOIN tcustomer c ON c.cus_kode = h.inv_cus_kode
      WHERE LEFT(h.inv_nomor, 3) = ? AND h.inv_rptunai <> 0 AND h.inv_tanggal = ?
      ${kasir !== "ALL" ? "AND h.user_create = ?" : ""}

      UNION ALL

      /* PEMBAYARAN TUNAI FROM SETORAN HDR */
      SELECT 'PEMBAYARAN TUNAI' AS jenis, h.sh_tanggal AS tgltrf, h.sh_cus_kode AS kdcus, 
             c.cus_nama AS nmcus, c.cus_alamat AS alamat, 
             (SELECT sd_inv FROM tsetor_dtl WHERE sd_sh_nomor = h.sh_nomor LIMIT 1) AS inv, h.sh_nominal AS nominal
      FROM tsetor_hdr h
      LEFT JOIN tcustomer c ON c.cus_kode = h.sh_cus_kode
      WHERE LEFT(h.sh_nomor, 3) = ? AND h.sh_jenis = 0 AND h.sh_tanggal = ?
      ${kasir !== "ALL" ? "AND h.user_create = ?" : ""}

      UNION ALL

      /* PEMBAYARAN TRANSFER FROM SETORAN HDR */
      SELECT 'PEMBAYARAN TRANSFER' AS jenis, h.sh_tgltransfer AS tgltrf, h.sh_cus_kode AS kdcus, 
             c.cus_nama AS nmcus, c.cus_alamat AS alamat, 
             (SELECT sd_inv FROM tsetor_dtl WHERE sd_sh_nomor = h.sh_nomor LIMIT 1) AS inv, h.sh_nominal AS nominal
      FROM tsetor_hdr h
      LEFT JOIN tcustomer c ON c.cus_kode = h.sh_cus_kode
      WHERE LEFT(h.sh_nomor, 3) = ? AND h.sh_jenis = 1 AND h.sh_tanggal = ?
      ${kasir !== "ALL" ? "AND h.user_create = ?" : ""}
    ) x ORDER BY kdcus, inv`;

  const paramsDtl1 =
    kasir === "ALL"
      ? [branchCode, tanggal, branchCode, tanggal, branchCode, tanggal]
      : [
          branchCode,
          tanggal,
          kasir,
          branchCode,
          tanggal,
          kasir,
          branchCode,
          tanggal,
          kasir,
        ];

  const [detail1] = await pool.query(queryDtl1, paramsDtl1);

  // --- QUERY DETAIL 2: RINGKASAN JENIS ---
  const [detail2] = await pool.query(
    `SELECT jenis, SUM(nominal) as nominal FROM (${queryDtl1}) summary GROUP BY jenis`,
    paramsDtl1,
  );

  return {
    isExisting: existing.length > 0,
    nomorExisting: existing.length > 0 ? existing[0].fsk_nomor : null,
    detail1,
    detail2,
  };
};

const loadFormData = async (nomor) => {
  const [headerRows] = await pool.query(
    `SELECT *, DATE_FORMAT(fsk_tanggal, '%Y-%m-%d') as fsk_tanggal FROM tform_setorkasir_hdr WHERE fsk_nomor = ?`,
    [nomor],
  );

  if (headerRows.length === 0) throw new Error("Data setoran tidak ditemukan.");

  const [detailRows] = await pool.query(
    `SELECT fskd2_jenis as jenis, fskd2_nominal as nominal FROM tform_setorkasir_dtl2 WHERE fskd2_nomor = ?`,
    [nomor],
  );

  const [detailTransaksi] = await pool.query(
    `SELECT fskd_jenis as jenis, fskd_tgltrf as tgltrf, fskd_kdcus as kdcus, fskd_inv as inv, fskd_nominal as nominal 
     FROM tform_setorkasir_dtl WHERE fskd_nomor = ?`,
    [nomor],
  );

  return {
    header: headerRows[0],
    detail1: detailTransaksi,
    detail2: detailRows,
  };
};

/**
 * Mengambil data lengkap untuk cetak Laporan FSK
 */
const getPrintDataFSK = async (nomor) => {
  // 1. Ambil Info Perusahaan
  const [perusahaan] = await pool.query(
    "SELECT perush_nama, perush_alamat, perush_telp FROM tperusahaan LIMIT 1",
  );

  // 2. Ambil Header FSK
  const [header] = await pool.query(
    `SELECT h.fsk_nomor, DATE_FORMAT(h.fsk_tanggal, '%d-%m-%Y') as fsk_tanggal, 
            h.fsk_kasir, DATE_FORMAT(h.date_create, '%d-%m-%Y %T') as created_at
     FROM tform_setorkasir_hdr h 
     WHERE h.fsk_nomor = ?`,
    [nomor],
  );

  if (header.length === 0) throw new Error("Data FSK tidak ditemukan.");

  // 3. Ambil Detail 1 (Rincian Transaksi)
  const [detail1] = await pool.query(
    `SELECT d.fskd_jenis as jenis, DATE_FORMAT(d.fskd_tgltrf, '%d-%m-%Y') as tgl_trf, 
            d.fskd_kdcus as kdcus, c.cus_nama as nmcus, d.fskd_inv as inv, d.fskd_nominal as nominal
     FROM tform_setorkasir_dtl d
     LEFT JOIN tcustomer c ON c.cus_kode = d.fskd_kdcus
     WHERE d.fskd_nomor = ?`,
    [nomor],
  );

  // 4. Ambil Detail 2 (Ringkasan Jenis)
  const [detail2] = await pool.query(
    `SELECT fskd2_jenis as jenis, fskd2_nominal as nominal 
     FROM tform_setorkasir_dtl2 
     WHERE fskd2_nomor = ?`,
    [nomor],
  );

  return {
    perusahaan: perusahaan[0],
    header: header[0],
    detail1,
    detail2,
  };
};

module.exports = {
  fetchHeaders,
  fetchDetails,
  deleteFSK,
  saveFSK,
  generateRekapData,
  loadFormData,
  getPrintDataFSK,
};
