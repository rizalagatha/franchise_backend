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
 * Mengambil data header invoice dengan perhitungan nominal dan status piutang
 */
const fetchHeaders = async (db, startDate, endDate) => {
  const query = `
    SELECT 
      h.Inv_nomor AS Nomor,
      h.Inv_tanggal AS Tanggal,
      COALESCE(h.inv_disc, 0) AS Diskon,
      COALESCE(h.inv_bkrm, 0) AS BiayaKirim, 
      COALESCE(n.Nominal, 0) AS Nominal,
      COALESCE(n.Nominal, 0) AS Piutang,
      /* Pastikan di sini hanya menghitung yang bukan diskon */
      IFNULL(v.kredit, 0) AS Bayar,
      (COALESCE(n.Nominal, 0) - IFNULL(v.kredit, 0)) AS SisaPiutang,
      h.Inv_cus_kode AS KdCus,
      s.cus_nama AS Nama,
      h.inv_rptunai AS RpTunai,
      h.inv_rpcard AS RpCard,
      h.user_create AS Created
    FROM tinv_hdr h
    LEFT JOIN (
      SELECT dd.invd_inv_nomor, 
             ROUND(SUM(dd.invd_jumlah * (dd.invd_harga - dd.invd_diskon)) - hh.inv_disc + hh.inv_bkrm) AS Nominal
      FROM tinv_dtl dd 
      LEFT JOIN tinv_hdr hh ON hh.inv_nomor = dd.invd_inv_nomor 
      GROUP BY dd.invd_inv_nomor
    ) n ON n.invd_inv_nomor = h.Inv_nomor
    LEFT JOIN tcustomer s ON s.cus_kode = h.Inv_cus_kode
    LEFT JOIN tpiutang_hdr u ON u.ph_inv_nomor = h.inv_nomor
    LEFT JOIN (
      SELECT pd_ph_nomor, 
             SUM(CASE WHEN pd_uraian LIKE '%Diskon%' THEN 0 ELSE pd_kredit END) AS kredit 
      FROM tpiutang_dtl GROUP BY pd_ph_nomor
    ) v ON v.pd_ph_nomor = u.ph_nomor
    WHERE h.Inv_tanggal BETWEEN ? AND ?
    ORDER BY h.Inv_nomor ASC
  `;

  const [rows] = await db.query(query, [startDate, endDate]);
  return rows;
};

/**
 * Mengambil data Detail Invoice
 */
const fetchDetails = async (db, nomorInvoice) => {
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

  const [rows] = await db.query(query, [nomorInvoice]);
  return rows;
};

/**
 * Hapus Invoice (Header & Detail)
 */
const deleteInvoice = async (db, nomor) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query("DELETE FROM tinv_dtl WHERE invd_inv_nomor = ?", [
      nomor,
    ]);

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
const loadFormData = async (db, nomor) => {
  const [headerRows] = await db.query(
    `SELECT *, DATE_FORMAT(Inv_tanggal, '%Y-%m-%d') as Inv_tanggal FROM tinv_hdr WHERE Inv_nomor = ?`,
    [nomor],
  );

  if (headerRows.length === 0) throw new Error("Invoice tidak ditemukan.");

  const [detailRows] = await db.query(
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
const saveInvoice = async (db, header, items, userKode, isNew) => {
  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    const [perushRows] = await connection.query(
      "SELECT perush_kode FROM tperusahaan LIMIT 1",
    );

    if (perushRows.length === 0) {
      throw new Error("Data perusahaan (tperusahaan) belum diatur.");
    }

    const branchCode = perushRows[0].perush_kode;
    const tgl = format(new Date(header.tanggal), "yyyy-MM-dd");
    const serverTime = format(new Date(), "yyyy-MM-dd HH:mm:ss");
    const cAngsur = format(new Date(), "yyyyMMddHHmmssSSS");

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

    let noRek = header.noRek || "";
    let noSetor = header.noSetor || "";
    let bayarTunai = Number(header.rpTunai || 0);
    const bayarCard = Number(header.rpCard || 0);

    const bayarTunaiHeader = rawBayarTunai;

    let bayarTunaiPiutang = rawBayarTunai;
    if (bayarTunaiPiutang > nKembali && nKembali > 0) {
      bayarTunaiPiutang = bayarTunaiPiutang - nKembali;
    }

    if (bayarCard !== 0 && (!noSetor || noSetor === "")) {
      noSetor = await generateNoSetor(connection, branchCode);
    }

    if (isNew) {
      nomorInv = await generateNomorInvoice(connection, branchCode, tgl);

      await connection.query(
        `INSERT INTO tinv_hdr (inv_nomor, inv_tanggal, inv_cus_kode, inv_disc, inv_bkrm, 
         inv_rptunai, inv_kembalian, inv_rpcard, inv_norek, inv_nosetor, inv_pundiamal, user_create, date_create) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          nomorInv,
          tgl,
          header.kdCus,
          header.diskonGlobal,
          bykirim,
          bayarTunaiHeader,
          nKembali,
          bayarCard,
          header.noRek,
          noSetor,
          pundiAmal,
          userKode,
          serverTime,
        ],
      );
    } else {
      await connection.query(
        `UPDATE tinv_hdr SET inv_cus_kode=?, inv_tanggal=?, inv_bkrm=?, inv_disc=?, 
         inv_rptunai=?, inv_kembalian=?, inv_rpcard=?, inv_norek=?, inv_nosetor=?, inv_pundiamal=?, 
         user_modified=?, date_modified=? WHERE inv_nomor=?`,
        [
          header.kdCus,
          tgl,
          bykirim,
          header.diskonGlobal,
          bayarTunai,
          nKembali,
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

    // Hapus data piutang lama jika mode edit
    await connection.query("DELETE FROM tpiutang_hdr WHERE ph_inv_nomor = ?", [
      nomorInv,
    ]);

    const phNomor = header.kdCus.trim() + nomorInv.trim();

    // 1. Simpan Header Piutang (Total Tagihan Asli sebelum bayar)
    // Nilai piutang_hdr.ph_nominal = Netto Barang + Biaya Kirim - Diskon Global
    const totalTagihan = netto + bykirim - diskonNominal;
    await connection.query(
      `INSERT INTO tpiutang_hdr (ph_nomor, ph_tanggal, ph_cus_kode, ph_inv_nomor, ph_nominal) VALUES (?, ?, ?, ?, ?)`,
      [phNomor, tgl, header.kdCus, nomorInv, totalTagihan],
    );

    // 2. Simpan Detail Debet (Tagihan)
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

    // 3. Simpan Detail Kredit untuk Diskon Global (Agar memotong piutang)
    // Di sistem akuntansi, diskon penjualan mengurangi piutang (dicatat sebagai kredit)
    if (diskonNominal > 0) {
      await connection.query(
        `INSERT INTO tpiutang_dtl (pd_ph_nomor, pd_tanggal, pd_uraian, pd_kredit) VALUES (?, ?, 'Diskon Penjualan', ?)`,
        [phNomor, tgl, diskonNominal],
      );
    }

    // 4. Simpan Detail Kredit untuk Pembayaran Tunai
    if (bayarTunaiPiutang !== 0) {
      await connection.query(
        `INSERT INTO tpiutang_dtl (pd_ph_nomor, pd_tanggal, pd_uraian, pd_kredit) VALUES (?, ?, 'BAYAR TUNAI', ?)`,
        [phNomor, tgl, bayarTunaiPiutang],
      );
    }

    // 5. Simpan Detail Kredit untuk Pembayaran Kartu (dan Setoran)
    if (noSetor) {
      await connection.query("DELETE FROM tsetor_hdr WHERE sh_nomor = ?", [
        noSetor,
      ]);
    }

    if (bayarCard !== 0) {
      await connection.query(
        `INSERT INTO tsetor_hdr (
        sh_nomor, sh_cus_kode, sh_tanggal, sh_jenis, 
        sh_nominal, sh_norek, sh_tgltransfer, sh_otomatis, 
        user_create, date_create
      ) 
      VALUES (?, ?, ?, 1, ?, ?, ?, 'Y', ?, ?)`,
        [
          noSetor,
          header.kdCus,
          tgl,
          bayarCard,
          header.noRek,
          tgl,
          userKode,
          serverTime,
        ],
      );

      await connection.query(
        `INSERT INTO tsetor_dtl (sd_sh_nomor, sd_tanggal, sd_inv, sd_bayar, sd_ket, sd_angsur, sd_nourut) 
         VALUES (?, ?, ?, ?, 'PEMBAYARAN DARI KASIR', ?, 1)`,
        [noSetor, tgl, nomorInv, bayarCard, cAngsur],
      );

      await connection.query(
        `INSERT INTO tpiutang_dtl (pd_ph_nomor, pd_tanggal, pd_uraian, pd_kredit, pd_ket, pd_sd_angsur) 
         VALUES (?, ?, 'BAYAR CARD', ?, ?, ?)`,
        [phNomor, tgl, bayarCard, noSetor, cAngsur],
      );
    }

    await connection.query("DELETE FROM tinv_dtl WHERE invd_inv_nomor = ?", [
      nomorInv,
    ]);
    const detailValues = items.map((item, index) => [
      nomorInv,
      item.kode,
      item.ukuran,
      item.jumlah,
      item.harga,
      item.hpp || 0,
      0,
      item.diskon || 0,
      index + 1,
    ]);

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
const getPrintDataKasir = async (db, nomorInvoice, userNama) => {
  const [perusahaan] = await db.query(
    "SELECT perush_nama, perush_alamat, perush_telp FROM tperusahaan LIMIT 1",
  );

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

  const [rows] = await db.query(query, [nomorInvoice]);
  if (rows.length === 0) throw new Error("Data Invoice tidak ditemukan.");

  const first = rows[0];

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
      kembaliGross: totalBayar - grandTotal,
      pundiAmal: pundiAmal,
      nettoKembali: totalBayar - grandTotal - pundiAmal,
    },
  };
};

const getPrintDataA4 = async (db, nomorInvoice) => {
  const [perusahaan] = await db.query(
    "SELECT perush_nama, perush_alamat, perush_telp FROM tperusahaan LIMIT 1",
  );

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

  const [rows] = await db.query(query, [nomorInvoice]);
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
