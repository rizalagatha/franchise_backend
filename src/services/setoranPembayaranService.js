const { pool } = require("../config/database");
const { format } = require("date-fns");

/**
 * Mengambil Data Master (Header) Setoran Pembayaran
 */
const fetchHeaders = async (startDate, endDate, branchCode) => {
  const query = `
    SELECT h.sh_nomor AS Nomor, h.sh_tanggal AS Tanggal, 
           IF(h.sh_jenis=0, "TUNAI", "TRANSFER") AS JenisBayar,
           h.sh_nominal AS Nominal, IFNULL(SUM(d.sd_bayar), 0) AS diBayarkan,
           (h.sh_nominal - IFNULL(SUM(d.sd_bayar), 0)) AS Sisa,
           h.sh_norek AS NoRekening, r.rek_namabank AS NamaBank, 
           h.sh_tgltransfer AS TglTransfer, c.cus_nama AS Customer,
           IF(h.sh_otomatis="Y", "YA", "") AS Otomatis,
           h.user_create AS Created, h.user_modified AS Modified
    FROM tsetor_hdr h
    LEFT JOIN tsetor_dtl d ON d.sd_sh_nomor = h.sh_nomor
    LEFT JOIN tcustomer c ON c.cus_kode = h.sh_cus_kode
    LEFT JOIN trekening r ON r.rek_nomor = h.sh_norek
    WHERE LEFT(h.sh_nomor, 3) = ? 
      AND h.sh_tanggal BETWEEN ? AND ?
    GROUP BY h.sh_nomor
    ORDER BY h.sh_tanggal, h.sh_nomor
  `;
  const [rows] = await pool.query(query, [branchCode, startDate, endDate]);
  return rows;
};

/**
 * Mengambil Data Detail untuk Ekspansi Row
 */
const fetchDetails = async (nomor) => {
  const query = `
    SELECT d.sd_sh_nomor AS Nomor, d.sd_tanggal AS TglBayar, d.sd_inv AS Invoice, 
           ph.ph_tanggal AS TglInvoice, ph.ph_nominal AS Nominal, 
           d.sd_bayar AS Bayar, d.sd_ket AS Keterangan, d.sd_otomatis AS Otomatis
    FROM tsetor_dtl d
    LEFT JOIN tpiutang_dtl pd ON pd.pd_sd_angsur = d.sd_angsur AND d.sd_angsur <> ""
    LEFT JOIN tpiutang_hdr ph ON ph.ph_nomor = pd.pd_ph_nomor
    WHERE d.sd_sh_nomor = ?
    ORDER BY d.sd_nourut, d.sd_angsur
  `;
  const [rows] = await pool.query(query, [nomor]);
  return rows;
};

/**
 * Menghapus Data Setoran dengan Validasi Bisnis
 */
const deleteSetoran = async (nomor) => {
  // Cek apakah ada link otomatis (prosedur ceksdoto di Delphi)
  const [autoCheck] = await pool.query(
    "SELECT 1 FROM tsetor_dtl WHERE sd_otomatis='Y' AND sd_sh_nomor=?",
    [nomor],
  );

  if (autoCheck.length > 0) {
    throw new Error(
      "Ada link Otomatis dari Transaksi Kasir. Tidak bisa di Hapus.",
    );
  }

  const connection = await pool.getConnection();
  await connection.beginTransaction();
  try {
    await connection.query("DELETE FROM tsetor_dtl WHERE sd_sh_nomor = ?", [
      nomor,
    ]);
    await connection.query("DELETE FROM tsetor_hdr WHERE sh_nomor = ?", [
      nomor,
    ]);
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
 * Menghasilkan Nomor Setoran Otomatis
 */
const generateNomorSTR = async (connection, branchCode, date) => {
  const yyMm = format(new Date(date), "yymm");
  const prefix = `${branchCode}.STR.${yyMm}.`;

  const [rows] = await connection.query(
    `SELECT MAX(RIGHT(sh_nomor, 4)) AS counter 
     FROM tsetor_hdr 
     WHERE sh_nomor LIKE ?`,
    [`${prefix}%`],
  );

  const nextNum = parseInt(rows[0].counter || 0) + 1;
  return `${prefix}${String(nextNum).padStart(4, "0")}`;
};

/**
 * Mengambil Daftar Piutang Belum Lunas (Bantuan Invoice)
 */
const fetchUnpaidInvoices = async (cusKode) => {
  const query = `
    SELECT * FROM (
      SELECT h.ph_inv_nomor AS Invoice, h.ph_tanggal AS TglInvoice, h.ph_nominal AS Nominal,
             (SELECT SUM(pd_kredit) FROM tpiutang_dtl WHERE pd_ph_nomor = h.ph_nomor) AS Bayar,
             (SELECT SUM(pd_debet - pd_kredit) FROM tpiutang_dtl WHERE pd_ph_nomor = h.ph_nomor) AS Sisa
      FROM tpiutang_hdr h
      WHERE h.ph_cus_kode = ?
    ) X WHERE X.Sisa > 0 ORDER BY X.TglInvoice ASC`;

  const [rows] = await pool.query(query, [cusKode]);
  return rows;
};

/**
 * Simpan Data Setoran (Insert/Update)
 */
const saveSetoran = async (header, details, userKode, isNew) => {
  const connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    const tgl = format(new Date(header.sh_tanggal), "yyyy-MM-dd");
    const branchCode = userKode.substring(0, 3);
    let nomorSTR = header.sh_nomor;

    // 1. Handle Header
    if (isNew) {
      nomorSTR = await generateNomorSTR(connection, branchCode, tgl);
      await connection.query(
        `INSERT INTO tsetor_hdr (sh_nomor, sh_cus_kode, sh_tanggal, sh_jenis, sh_nominal, sh_norek, sh_tgltransfer, sh_ket, user_create, date_create) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          nomorSTR,
          header.sh_cus_kode,
          tgl,
          header.sh_jenis,
          header.sh_nominal,
          header.sh_norek,
          header.sh_tgltransfer || null,
          header.sh_ket,
          userKode,
        ],
      );
    } else {
      await connection.query(
        `UPDATE tsetor_hdr SET sh_tanggal=?, sh_jenis=?, sh_nominal=?, sh_norek=?, sh_tgltransfer=?, sh_ket=?, user_modified=?, date_modified=NOW() WHERE sh_nomor=?`,
        [
          tgl,
          header.sh_jenis,
          header.sh_nominal,
          header.sh_norek,
          header.sh_tgltransfer || null,
          header.sh_ket,
          userKode,
          nomorSTR,
        ],
      );
      // Bersihkan detail lama
      await connection.query("DELETE FROM tsetor_dtl WHERE sd_sh_nomor = ?", [
        nomorSTR,
      ]);
      await connection.query("DELETE FROM tpiutang_dtl WHERE pd_ket = ?", [
        nomorSTR,
      ]);
    }

    // 2. Handle Details (tsetor_dtl & tpiutang_dtl)
    for (let i = 0; i < details.length; i++) {
      const d = details[i];
      if (!d.invoice) continue;

      await connection.query(
        `INSERT INTO tsetor_dtl (sd_sh_nomor, sd_tanggal, sd_inv, sd_bayar, sd_ket, sd_angsur, sd_nourut) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [nomorSTR, tgl, d.invoice, d.bayar, d.ket, d.angsur, i + 1],
      );

      // Link ke Piutang jika Invoice valid
      if (d.invoice.includes("INV") || d.invoice === "PLL") {
        const uraian =
          header.sh_jenis === 0 ? "Pembayaran Tunai" : "Pembayaran Transfer";
        await connection.query(
          `INSERT INTO tpiutang_dtl (pd_ph_nomor, pd_tanggal, pd_uraian, pd_kredit, pd_ket, pd_sd_angsur) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            `${header.sh_cus_kode}${d.invoice}`,
            tgl,
            uraian,
            d.bayar,
            nomorSTR,
            d.angsur,
          ],
        );
      }
    }

    await connection.commit();
    return { message: "Data berhasil disimpan.", nomor: nomorSTR };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  fetchHeaders,
  fetchDetails,
  deleteSetoran,
  fetchUnpaidInvoices,
  saveSetoran,
};
