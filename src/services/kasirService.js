const { pool } = require("../config/database");
const { format } = require("date-fns");
const terbilang = require("../utils/terbilang");

/**
 * Menghasilkan Nomor Invoice Otomatis
 * Format: [KDCAB].INV.[YYMM].[NOMOR_URUT]
 * Contoh: ADM.INV.2602.0001
 */
const generateNomorInvoice = async (connection, branchCode, date) => {
  const yyMm = format(new Date(date), "yyMM");
  const prefix = `${branchCode}.INV.${yyMm}`;

  // Mengunci baris (SELECT FOR UPDATE) agar tidak ada double nomor saat traffic tinggi
  const [rows] = await connection.query(
    `SELECT MAX(RIGHT(inv_nomor, 4)) AS counter 
     FROM tinv_hdr 
     WHERE inv_nomor LIKE ?`,
    [`${prefix}%`],
  );

  const nextNum = parseInt(rows[0].counter || 0) + 1;
  return `${prefix}.${String(nextNum).padStart(4, "0")}`;
};

/**
 * Menghasilkan Nomor Setoran Otomatis (Bank)
 * Format: [KDCAB].STR.[YYMM].[NOMOR_URUT]
 * Contoh: ADM.STR.2602.0001
 */
const generateNoSetor = async (connection, branchCode) => {
  const yyMm = format(new Date(), "yyMM");
  const prefix = `${branchCode}.STR.${yyMm}`;

  const [rows] = await connection.query(
    `SELECT MAX(RIGHT(sh_nomor, 4)) AS counter 
     FROM tsetor_hdr 
     WHERE sh_nomor LIKE ?`,
    [`${prefix}%`],
  );

  const nextNum = parseInt(rows[0].counter || 0) + 1;
  return `${prefix}.${String(nextNum).padStart(4, "0")}`;
};

/**
 * Mengambil data Header Invoice (Browse)
 */
/**
 * Mengambil data header invoice dengan perhitungan nominal dan status piutang
 * @param {string} startDate - Format YYYY-MM-DD
 * @param {string} endDate - Format YYYY-MM-DD
 */
const fetchHeaders = async (startDate, endDate) => {
  const query = `
    SELECT 
      h.Inv_nomor AS Nomor,
      h.Inv_tanggal AS Tanggal,
      h.inv_disc AS Diskon,
      h.inv_bkrm AS BiayaKirim,
      COALESCE(h.inv_disc, 0) AS Diskon,
      COALESCE(h.inv_bkrm, 0) AS BiayaKirim, 
      COALESCE(n.Nominal, 0) AS Nominal,
      COALESCE(u.ph_nominal, 0) AS Piutang,
      COALESCE(v.kredit, 0) AS Bayar,
      CASE 
        WHEN (COALESCE(v.debet, 0) - COALESCE(v.kredit, 0)) < 0 THEN 0 
        ELSE (COALESCE(v.debet, 0) - COALESCE(v.kredit, 0)) 
      END AS SisaPiutang,
      h.Inv_cus_kode AS KdCus,
      s.cus_nama AS Nama,
      s.cus_alamat AS Alamat,
      s.cus_kota AS Kota,
      s.cus_telp AS Telp,
      h.inv_rptunai AS RpTunai,
      h.inv_rpcard AS RpCard,
      h.inv_nosetor AS NoSetoran,
      h.inv_norek AS NoRekening,
      r.rek_namabank AS NamaBank,
      h.user_create AS Created,
      h.date_create AS Date_Create
    FROM tinv_hdr h
    LEFT JOIN (
      SELECT dd.invd_inv_nomor, 
             /* Fix: Gunakan COALESCE pada setiap komponen perhitungan */
             ROUND(SUM(COALESCE(dd.invd_jumlah, 0) * (COALESCE(dd.invd_harga, 0) - COALESCE(dd.invd_diskon, 0))) 
             - COALESCE(hh.inv_disc, 0) + COALESCE(hh.inv_bkrm, 0)) AS Nominal
      FROM tinv_dtl dd 
      LEFT JOIN tinv_hdr hh ON hh.inv_nomor = dd.invd_inv_nomor 
      GROUP BY dd.invd_inv_nomor
    ) n ON n.invd_inv_nomor = h.Inv_nomor
    LEFT JOIN tcustomer s ON s.cus_kode = h.Inv_cus_kode
    /* Relasi ke tabel piutang untuk melacak sisa tagihan */
    LEFT JOIN tpiutang_hdr u ON u.ph_inv_nomor = h.inv_nomor AND u.ph_cus_kode = h.Inv_cus_kode
    LEFT JOIN (
      /* Menghitung akumulasi pembayaran piutang */
      SELECT pd_ph_nomor, SUM(pd_debet) AS debet, SUM(pd_kredit) AS kredit 
      FROM tpiutang_dtl 
      GROUP BY pd_ph_nomor
    ) v ON v.pd_ph_nomor = u.ph_nomor
    LEFT JOIN trekening r ON r.rek_nomor = h.inv_norek
    WHERE h.Inv_tanggal BETWEEN ? AND ?
    ORDER BY h.Inv_nomor ASC
  `;

  const [rows] = await pool.query(query, [startDate, endDate]);
  return rows;
};

/**
 * Mengambil data Detail Invoice
 */
const fetchDetails = async (nomorInvoice) => {
  const query = `
    SELECT 
      d.invd_inv_nomor AS Nomor,
      d.invd_kode AS Kode,
      TRIM(CONCAT(a.brg_jeniskaos, ' ', a.brg_tipe, ' ', a.brg_lengan, ' ', a.brg_jeniskain, ' ', a.brg_warna)) AS Nama,
      d.invd_ukuran AS Ukuran,
      d.invd_jumlah AS Jumlah,
      d.invd_harga AS Harga,
      d.invd_diskon AS Diskon,
      (d.invd_jumlah * (d.invd_harga - d.invd_diskon)) AS Total
    FROM tinv_dtl d
    LEFT JOIN tbarang a ON a.brg_kode = d.invd_kode
    WHERE d.invd_inv_nomor = ?
    ORDER BY d.invd_nourut
  `;

  const [rows] = await pool.query(query, [nomorInvoice]);
  return rows;
};

/**
 * Hapus Invoice (Header & Detail)
 */
const deleteInvoice = async (nomor) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Hapus Detail dulu (Opsional jika ada FK cascade, tapi aman jika eksplisit)
    await connection.query("DELETE FROM tinv_dtl WHERE invd_inv_nomor = ?", [
      nomor,
    ]);

    // Hapus Header
    const [result] = await connection.query(
      "DELETE FROM tinv_hdr WHERE Inv_nomor = ?",
      [nomor],
    );

    if (result.affectedRows === 0) {
      throw new Error("Nomor invoice tidak ditemukan.");
    }

    await connection.commit();
    return { message: `Invoice ${nomor} berhasil dihapus.` };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Mengambil data lengkap untuk form edit
 */
const loadFormData = async (nomor) => {
  const [headerRows] = await pool.query(
    `SELECT *, DATE_FORMAT(Inv_tanggal, '%Y-%m-%d') as Inv_tanggal FROM tinv_hdr WHERE Inv_nomor = ?`,
    [nomor],
  );

  if (headerRows.length === 0) throw new Error("Invoice tidak ditemukan.");

  const [detailRows] = await pool.query(
    `SELECT d.*, 
     TRIM(CONCAT(a.brg_jeniskaos, ' ', a.brg_tipe, ' ', a.brg_lengan, ' ', a.brg_jeniskain, ' ', a.brg_warna)) AS nama,
     b.brgd_barcode as barcode
     FROM tinv_dtl d
     LEFT JOIN tbarang a ON a.brg_kode = d.invd_kode
     LEFT JOIN tbarang_dtl b ON b.brgd_kode = d.invd_kode AND b.brgd_ukuran = d.invd_ukuran
     WHERE d.invd_inv_nomor = ?`,
    [nomor],
  );

  return { header: headerRows[0], items: detailRows };
};

/**
 * Menyimpan Invoice (Baru/Ubah)
 */
const saveInvoice = async (header, items, userKode, isNew) => {
  const connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    // 1. Ambil Kode Cabang dari tabel tperusahaan
    const [perushRows] = await connection.query(
      "SELECT perush_kode FROM tperusahaan LIMIT 1",
    );

    if (perushRows.length === 0) {
      throw new Error("Data perusahaan (tperusahaan) belum diatur.");
    }

    // branchCode sekarang berisi "F02", bukan lagi "RIJ"
    const branchCode = perushRows[0].perush_kode;
    const tgl = format(new Date(header.tanggal), "yyyy-MM-dd");
    const serverTime = format(new Date(), "yyyy-MM-dd HH:mm:ss");
    const cAngsur = format(new Date(), "yyyyMMddHHmmssSSS"); // Simulasi yyymmddHHmmss.z

    // 1. Inisialisasi & Perhitungan (Logika Delphi)
    let nomorInv = header.nomor;
    const netto = items.reduce(
      (sum, i) => sum + i.jumlah * (i.harga - i.diskon),
      0,
    );
    const bykirim = Number(header.biayaKirim || 0);
    const rawBayarTunai = Number(header.rpTunai || 0);
    const nKembali = Number(header.kembalian || 0);
    const pundiAmal = Number(header.pundiAmal || 0);
    const diskonNominal = Number(header.diskonGlobal || 0);

    // Pastikan string tidak null/undefined (Fix untuk error inv_nosetor)
    let noRek = header.noRek || "";
    let noSetor = header.noSetor || "";
    let bayarTunai = Number(header.rpTunai || 0);
    const bayarCard = Number(header.rpCard || 0);

    const bayarTunaiHeader = rawBayarTunai;

    let bayarTunaiPiutang = rawBayarTunai;
    if (bayarTunaiPiutang > nKembali && nKembali > 0) {
      bayarTunaiPiutang = bayarTunaiPiutang - nKembali;
    }

    // 2. Logika No Setor Otomatis
    if (bayarCard !== 0 && (!noSetor || noSetor === "")) {
      noSetor = await generateNoSetor(connection, branchCode);
    }

    if (isNew) {
      // Logic Generate Nomor Invoice Anda ...
      nomorInv = await generateNomorInvoice(connection, branchCode, tgl);

      // Insert Header
      await connection.query(
        `INSERT INTO tinv_hdr (inv_nomor, inv_tanggal, inv_cus_kode, inv_disc, inv_bkrm, 
         inv_rptunai, inv_rpcard, inv_norek, inv_nosetor, inv_pundiamal, user_create, date_create) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          nomorInv,
          tgl,
          header.kdCus,
          header.diskonGlobal,
          bykirim,
          bayarTunaiHeader,
          bayarCard,
          header.noRek,
          noSetor,
          pundiAmal,
          userKode,
          serverTime,
        ],
      );
    } else {
      // Update Header
      await connection.query(
        `UPDATE tinv_hdr SET inv_cus_kode=?, inv_tanggal=?, inv_bkrm=?, inv_disc=?, 
         inv_rptunai=?, inv_rpcard=?, inv_norek=?, inv_nosetor=?, inv_pundiamal=?, 
         user_modified=?, date_modified=? WHERE inv_nomor=?`,
        [
          header.kdCus,
          tgl,
          bykirim,
          header.diskonGlobal,
          bayarTunai,
          bayarCard,
          header.noRek,
          noSetor,
          pundiAmal,
          userKode,
          serverTime,
          nomorInv,
        ],
      );
    }

    // 3. Sinkronisasi Data Piutang (Header & Detail)
    // Bersihkan data lama jika update
    await connection.query("DELETE FROM tpiutang_hdr WHERE ph_inv_nomor = ?", [
      nomorInv,
    ]);

    const phNomor = header.kdCus.trim() + nomorInv.trim(); // ph_nomor sesuai Delphi

    // Insert Piutang Header
    await connection.query(
      `INSERT INTO tpiutang_hdr (ph_nomor, ph_tanggal, ph_cus_kode, ph_inv_nomor, ph_nominal) VALUES (?, ?, ?, ?, ?)`,
      [phNomor, tgl, header.kdCus, nomorInv, netto + bykirim],
    );

    // Insert Piutang Detail: Penjualan & Biaya Kirim (Debet)
    await connection.query(
      `INSERT INTO tpiutang_dtl (pd_ph_nomor, pd_tanggal, pd_uraian, pd_debet) VALUES (?, ?, 'Penjualan', ?)`,
      [phNomor, tgl, netto],
    );

    if (bykirim !== 0) {
      await connection.query(
        `INSERT INTO tpiutang_dtl (pd_ph_nomor, pd_tanggal, pd_uraian, pd_debet) VALUES (?, ?, 'Biaya Kirim', ?)`,
        [phNomor, tgl, bykirim],
      );
    }

    // Insert Piutang Detail: Pembayaran Tunai (Kredit)
    if (bayarTunaiPiutang !== 0) {
      await connection.query(
        `INSERT INTO tpiutang_dtl (pd_ph_nomor, pd_tanggal, pd_uraian, pd_kredit) VALUES (?, ?, 'BAYAR TUNAI', ?)`,
        [phNomor, tgl, bayarTunaiPiutang],
      );
    }

    // 4. Logika Bayar Card & Setoran
    if (noSetor) {
      await connection.query("DELETE FROM tsetor_hdr WHERE sh_nomor = ?", [
        noSetor,
      ]);
    }

    if (bayarCard !== 0) {
      // Header Setoran
      await connection.query(
        `INSERT INTO tsetor_hdr (sh_nomor, sh_cus_kode, sh_tanggal, sh_jenis, sh_nominal, sh_norek, sh_otomatis, user_create, date_create) 
         VALUES (?, ?, ?, 1, ?, ?, 'Y', ?, ?)`,
        [
          noSetor,
          header.kdCus,
          tgl,
          bayarCard,
          header.noRek,
          userKode,
          serverTime,
        ],
      );

      // Detail Setoran
      await connection.query(
        `INSERT INTO tsetor_dtl (sd_sh_nomor, sd_tanggal, sd_inv, sd_bayar, sd_ket, sd_angsur, sd_nourut) 
         VALUES (?, ?, ?, ?, 'PEMBAYARAN DARI KASIR', ?, 1)`,
        [noSetor, tgl, nomorInv, bayarCard, cAngsur],
      );

      // Kredit ke Piutang dari Card
      await connection.query(
        `INSERT INTO tpiutang_dtl (pd_ph_nomor, pd_tanggal, pd_uraian, pd_kredit, pd_ket, pd_sd_angsur) 
         VALUES (?, ?, 'BAYAR CARD', ?, ?, ?)`,
        [phNomor, tgl, bayarCard, noSetor, cAngsur],
      );
    }

    // 5. Update Detail Barang
    await connection.query("DELETE FROM tinv_dtl WHERE invd_inv_nomor = ?", [
      nomorInv,
    ]);
    const detailValues = items.map((item, index) => [
      nomorInv, // 1. invd_inv_nomor
      item.kode, // 2. invd_kode
      item.ukuran, // 3. invd_ukuran
      item.jumlah, // 4. invd_jumlah
      item.harga, // 5. invd_harga
      item.hpp || 0, // 6. invd_hpp (PASTIKAN di Vue namanya 'hpp')
      0, // 7. invd_disc (Persen) - Set 0 dulu karena di Vue belum ada field %
      item.diskon || 0, // 8. invd_diskon (Nominal) - Pakai item.diskon sesuai data dari Vue
      index + 1, // 9. invd_nourut
    ]);

    // Pastikan urutan kolom di INSERT match dengan urutan di atas!
    await connection.query(
      `INSERT INTO tinv_dtl (invd_inv_nomor, invd_kode, invd_ukuran, invd_jumlah, invd_harga, invd_hpp, invd_disc, invd_diskon, invd_nourut) 
       VALUES ?`,
      [detailValues],
    );

    await connection.commit();
    return {
      message: "Invoice berhasil disimpan.",
      nomor: nomorInv,
      kembali: nKembali,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Mengambil data lengkap untuk cetak struk kasir (58mm)
 */
const getPrintDataKasir = async (nomorInvoice, userNama) => {
  // 1. Ambil Data Perusahaan (Asumsi kode F01 atau ambil dari config)
  const [perusahaan] = await pool.query(
    "SELECT perush_nama, perush_alamat, perush_telp FROM tperusahaan LIMIT 1",
  );

  // 2. Query Utama (Adaptasi dari Delphi SQL ftsreport)
  const query = `
    SELECT 
      h.Inv_nomor AS nomor,
      DATE_FORMAT(h.Inv_tanggal, '%d-%m-%Y') AS tanggal,
      IFNULL(TIME(h.date_create), '00:00') AS jam,
      h.inv_disc AS diskonFaktur,
      h.inv_bkrm AS biayaKirim,
      h.inv_rptunai AS bayarTunai,
      h.inv_pundiamal,
      h.inv_rpcard AS bayarCard,
      s.cus_nama AS namaCustomer,
      d.invd_kode AS kode,
      TRIM(CONCAT_WS(' ', a.brg_jeniskaos, a.brg_tipe, a.brg_lengan, a.brg_jeniskain, a.brg_warna)) AS namaBarang,
      d.invd_ukuran AS ukuran,
      d.invd_jumlah AS jumlah,
      d.invd_harga AS harga,
      d.invd_diskon AS diskonItem,
      (d.invd_jumlah * (d.invd_harga - d.invd_diskon)) AS subTotalItem
    FROM tinv_hdr h
    LEFT JOIN tinv_dtl d ON d.invd_inv_nomor = h.Inv_nomor
    LEFT JOIN tcustomer s ON s.cus_kode = h.Inv_cus_kode
    LEFT JOIN tbarang a ON a.brg_kode = d.invd_kode
    WHERE h.Inv_nomor = ?
    ORDER BY d.invd_nourut
  `;

  const [rows] = await pool.query(query, [nomorInvoice]);
  if (rows.length === 0) throw new Error("Data Invoice tidak ditemukan.");

  const first = rows[0]; // Pastikan mendefinisikan 'first' di sini

  const totalItem = rows.reduce(
    (sum, row) => sum + Number(row.subTotalItem),
    0,
  );
  const grandTotal =
    totalItem - Number(first.diskonFaktur) + Number(first.biayaKirim);
  const totalBayar = Number(first.bayarTunai) + Number(first.bayarCard);
  const pundiAmal = Number(first.inv_pundiamal || 0);

  return {
    header: {
      nomor: first.nomor,
      tanggal: `${first.tanggal} ${first.jam}`,
      customer: first.namaCustomer || "RETAIL",
      userNama: userNama,
      perusahaanNama: perusahaan[0]?.perush_nama || "KAOSAN",
      perusahaanAlamat: perusahaan[0]?.perush_alamat || "",
      perusahaanTelp: perusahaan[0]?.perush_telp || "",
    },
    details: rows.map((r) => ({
      nama: r.namaBarang,
      ukuran: r.ukuran,
      qty: r.jumlah,
      harga: Number(r.harga) - Number(r.diskonItem),
      total: Number(r.subTotalItem),
    })),
    summary: {
      total: totalItem,
      diskon: first.diskonFaktur,
      netto: totalItem - first.diskonFaktur,
      biayaKirim: first.biayaKirim,
      grandTotal: grandTotal,
      bayar: totalBayar,
      // Logika Rincian Kembalian
      kembaliGross: totalBayar - grandTotal,
      pundiAmal: pundiAmal,
      nettoKembali: totalBayar - grandTotal - pundiAmal,
    },
  };
};

const getPrintDataA4 = async (nomorInvoice) => {
  // 1. Ambil Info Perusahaan
  const [perusahaan] = await pool.query(
    "SELECT perush_nama, perush_alamat, perush_telp FROM tperusahaan LIMIT 1",
  );

  // 2. Query Gabungan (Hdr + Cus + Dtl)
  const query = `
    SELECT 
      h.Inv_nomor, DATE_FORMAT(h.Inv_tanggal, '%d-%m-%Y') as inv_tanggal,
      h.inv_disc, h.inv_bkrm, h.inv_rptunai, h.inv_rpcard, h.user_create,
      s.cus_nama, s.cus_alamat, s.cus_kota, s.cus_telp,
      d.invd_kode, d.invd_ukuran, d.invd_jumlah, d.invd_harga, d.invd_diskon,
      TRIM(CONCAT_WS(' ', a.brg_jeniskaos, a.brg_tipe, a.brg_lengan, a.brg_jeniskain, a.brg_warna)) AS nama_barang
    FROM tinv_hdr h
    LEFT JOIN tinv_dtl d ON d.invd_inv_nomor = h.Inv_nomor
    LEFT JOIN tcustomer s ON s.cus_kode = h.Inv_cus_kode
    LEFT JOIN tbarang a ON a.brg_kode = d.invd_kode
    WHERE h.Inv_nomor = ?
    ORDER BY d.invd_nourut
  `;

  const [rows] = await pool.query(query, [nomorInvoice]);
  if (rows.length === 0) throw new Error("Invoice tidak ditemukan");

  const first = rows[0];
  const subTotal = rows.reduce(
    (acc, r) => acc + r.invd_jumlah * (r.invd_harga - r.invd_diskon),
    0,
  );
  const grandTotal = subTotal - first.inv_disc + first.inv_bkrm;

  return {
    header: {
      nomor: first.Inv_nomor,
      tanggal: first.inv_tanggal,
      customer: first.cus_nama || "UMUM",
      alamatCustomer:
        `${first.cus_alamat || ""}, ${first.cus_kota || ""}`.trim(),
      userNama: first.user_create,
      perusahaanNama: perusahaan[0]?.perush_nama || "KAOSAN",
      perusahaanAlamat: perusahaan[0]?.perush_alamat || "",
      perusahaanTelp: perusahaan[0]?.perush_telp || "",
    },
    details: rows.map((r) => ({
      kode: r.invd_kode,
      nama: r.nama_barang,
      ukuran: r.invd_ukuran,
      qty: r.invd_jumlah,
      harga: r.invd_harga,
      diskon: r.invd_diskon,
      total: r.invd_jumlah * (r.invd_harga - r.invd_diskon),
    })),
    summary: {
      total: subTotal,
      diskon: first.inv_disc,
      netto: subTotal - first.inv_disc,
      grandTotal: grandTotal,
      bayar: first.inv_rptunai + first.inv_rpcard,
      kembali: Math.max(0, first.inv_rptunai + first.inv_rpcard - grandTotal),
    },
    terbilang: terbilang(grandTotal),
  };
};

module.exports = {
  fetchHeaders,
  fetchDetails,
  deleteInvoice,
  loadFormData,
  saveInvoice,
  getPrintDataKasir,
  getPrintDataA4,
};
