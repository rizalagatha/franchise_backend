const { externalPool } = require("../config/externalDatabase");
const { format } = require("date-fns");

/**
 * Mengambil data header pembelian (tbpb_hdr) berdasarkan periode.
 */
const fetchHeaders = async (db, startDate, endDate) => {
  // Pastikan tanggal valid
  const start = format(new Date(startDate), "yyyy-MM-dd");
  const end = format(new Date(endDate), "yyyy-MM-dd");

  const query = `
        SELECT 
            h.bpb_nomor AS Nomor,
            DATE_FORMAT(h.bpb_tanggal, '%d-%m-%Y') AS Tanggal,
            h.bpb_inv_nomor AS NoInvoice,
            DATE_FORMAT(h.bpb_inv_tanggal, '%d-%m-%Y') AS TglInvoice,
            h.bpb_nominal AS NominalPembelian,
            h.bpb_ket AS Keterangan,
            h.user_create AS Created,
            h.user_modified AS Modified
        FROM tbpb_hdr h
        WHERE h.bpb_tanggal BETWEEN ? AND ?
        ORDER BY h.date_create
    `;
  const [rows] = await db.query(query, [start, end]);
  return rows;
};

/**
 * Mengambil data detail pembelian (tbpb_dtl) berdasarkan nomor header.
 */
const fetchDetails = async (db, nomorHeader) => {
  const query = `
        SELECT 
            d.bpbd_nomor AS Nomor,
            d.bpbd_kode AS Kode,
            TRIM(CONCAT(a.brg_jeniskaos, ' ', a.brg_tipe, ' ', a.brg_lengan, ' ', a.brg_jeniskain, ' ', a.brg_warna)) AS Nama,
            d.bpbd_ukuran AS Ukuran,
            d.bpbd_jumlah AS Jumlah,
            d.bpbd_hpp AS Hpp,
            (d.bpbd_jumlah * d.bpbd_hpp) AS Total
        FROM tbpb_dtl d
        LEFT JOIN tbarang a ON a.brg_kode = d.bpbd_kode
        WHERE d.bpbd_nomor = ?
        ORDER BY d.bpbd_nourut
    `;
  const [rows] = await db.query(query, [nomorHeader]);
  return rows;
};

/**
 * Menghapus header dan detail pembelian.
 */
const deletePembelian = async (db, nomorHeader) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Hapus Detail (tbpb_dtl)
    await connection.query("DELETE FROM tbpb_dtl WHERE bpbd_nomor = ?", [
      nomorHeader,
    ]);

    // 2. Hapus Header (tbpb_hdr)
    const [result] = await connection.query(
      "DELETE FROM tbpb_hdr WHERE bpb_nomor = ?",
      [nomorHeader],
    );

    if (result.affectedRows === 0) {
      throw new Error("Nomor pembelian tidak ditemukan.");
    }

    await connection.commit();
    return { message: `Data pembelian ${nomorHeader} berhasil dihapus.` };
  } catch (error) {
    await connection.rollback();
    console.error("Error deleting pembelian:", error);
    throw new Error(error.message || "Gagal menghapus data pembelian.");
  } finally {
    connection.release();
  }
};

/**
 * 6. Mengambil data header dan detail untuk mode edit.
 */
const loadFormData = async (db, nomorPembelian) => {
  const headerQuery = `
        SELECT 
            h.bpb_nomor, 
            DATE_FORMAT(h.bpb_tanggal, '%Y-%m-%d') AS bpb_tanggal,
            h.bpb_inv_nomor,
            DATE_FORMAT(h.bpb_inv_tanggal, '%Y-%m-%d') AS bpb_inv_tanggal,
            h.bpb_ket
        FROM tbpb_hdr h 
        WHERE h.bpb_nomor = ?
     `;
  const [headerRows] = await db.query(headerQuery, [nomorPembelian]);
  if (headerRows.length === 0) {
    throw new Error("Nomor pembelian tidak ditemukan.");
  }
  const header = headerRows[0];

  const detailQuery = `
        SELECT 
            d.bpbd_kode AS kode,
            b.brgd_barcode AS barcode,
            TRIM(CONCAT(a.brg_jeniskaos, ' ', a.brg_tipe, ' ', a.brg_lengan, ' ', a.brg_jeniskain, ' ', a.brg_warna)) AS nama,
            d.bpbd_ukuran AS ukuran,
            d.bpbd_inv_jumlah AS qtyinv,
            d.bpbd_jumlah AS jumlah,
            d.bpbd_hpp AS hpp,
            d.bpbd_jual AS jual,
            (d.bpbd_jumlah * d.bpbd_hpp) AS total
        FROM tbpb_dtl d
        LEFT JOIN tbarang a ON a.brg_kode = d.bpbd_kode
        LEFT JOIN tbarang_dtl b ON b.brgd_kode = d.bpbd_kode AND b.brgd_ukuran = d.bpbd_ukuran
        WHERE d.bpbd_nomor = ? 
        ORDER BY d.bpbd_nourut
     `;
  const [details] = await db.query(detailQuery, [nomorPembelian]);

  return { header, items: details };
};

/**
 * 7. Menyimpan data Pembelian (Create/Update).
 */
const savePembelian = async (db, headerData, itemsData, userKode, isNew) => {
  const connection = await db.getConnection(); // Koneksi DB Lokal
  await connection.beginTransaction();

  try {
    let nomorPembelian = headerData.nomor;
    const tanggal = format(new Date(headerData.tanggal), "yyyy-MM-dd");
    const tglInvoice = format(new Date(headerData.tglInvoice), "yyyy-MM-dd");

    // Hitung total nominal dari detail
    const nominalTotal = itemsData.reduce((sum, item) => {
      const hpp = parseFloat(item.hpp) || 0;
      const jumlah = parseFloat(item.jumlah) || 0;
      return sum + hpp * jumlah;
    }, 0);

    if (isNew) {
      const tahun = format(new Date(tanggal), "yyyy");
      // Minta DB Cabang untuk tahu perush_kode, agar prefix dinamis
      const [perush] = await connection.query(
        "SELECT perush_kode FROM tperusahaan LIMIT 1",
      );
      const branchCode = perush[0]?.perush_kode || "F02";

      const prefix = `${branchCode}.BPB.${tahun}`;
      const nomorQuery = `
                SELECT IFNULL(MAX(RIGHT(bpb_nomor, 5)), 0) AS jumlah 
                FROM tbpb_hdr 
                WHERE LEFT(bpb_nomor, 12) = ?`;
      const [nomorRows] = await connection.query(nomorQuery, [prefix]);
      const nextNum = parseInt(nomorRows[0].jumlah, 10) + 1;
      nomorPembelian = `${prefix}${String(nextNum).padStart(5, "0")}`;

      const insertHeaderQuery = `
                INSERT INTO tbpb_hdr 
                (bpb_nomor, bpb_tanggal, bpb_nominal, bpb_ket, bpb_inv_nomor, bpb_inv_tanggal, date_create, user_create) 
                VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)
            `;
      await connection.query(insertHeaderQuery, [
        nomorPembelian,
        tanggal,
        nominalTotal,
        headerData.keterangan,
        headerData.noInvoice,
        tglInvoice,
        userKode,
      ]);
    } else {
      const updateHeaderQuery = `
                UPDATE tbpb_hdr SET 
                    bpb_tanggal = ?, bpb_inv_nomor = ?, bpb_inv_tanggal = ?, 
                    bpb_nominal = ?, bpb_ket = ?, date_modified = NOW(), user_modified = ? 
                WHERE bpb_nomor = ?
            `;
      await connection.query(updateHeaderQuery, [
        tanggal,
        headerData.noInvoice,
        tglInvoice,
        nominalTotal,
        headerData.keterangan,
        userKode,
        nomorPembelian,
      ]);
    }

    // --- Proses Detail ---
    await connection.query("DELETE FROM tbpb_dtl WHERE bpbd_nomor = ?", [
      nomorPembelian,
    ]);

    if (itemsData && itemsData.length > 0) {
      const detailValues = [];
      const masterBarangQueries = [];
      const masterDtlQueries = [];

      itemsData.forEach((item, index) => {
        if (item.kode && (item.jumlah || 0) > 0) {
          detailValues.push([
            nomorPembelian,
            item.kode,
            item.ukuran,
            item.qtyinv || 0,
            item.jumlah || 0,
            item.hpp || 0,
            item.jual || 0,
            index + 1,
          ]);

          if (isNew) {
            masterBarangQueries.push({
              query: `
                                INSERT INTO tbarang 
                                (brg_kode, brg_ktgp, brg_ktg, brg_bahan, brg_jeniskaos, brg_tipe, brg_lengan, brg_jeniskain, brg_warna) 
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) 
                                ON DUPLICATE KEY UPDATE brg_warna = ?`,
              params: [
                item.kode,
                item.ktgp ?? "",
                item.ktg ?? "",
                item.bahan ?? "",
                item.jeniskaos ?? "",
                item.tipe ?? "",
                item.lengan ?? "",
                item.jeniskain ?? "",
                item.warna ?? "",
                item.warna ?? "",
              ],
            });

            masterDtlQueries.push({
              query: `
                INSERT INTO tbarang_dtl 
                (brgd_kode, brgd_ukuran, brgd_hpp, brgd_harga, brgd_barcode) 
                VALUES (?, ?, ?, ?, ?) 
                ON DUPLICATE KEY UPDATE brgd_hpp = ?, brgd_barcode = ?`,
              params: [
                item.kode,
                item.ukuran,
                item.hpp || 0,
                item.jual || 0,
                item.barcode,
                item.hpp || 0,
                item.barcode,
              ],
            });
          }
        }
      });

      if (detailValues.length > 0) {
        const insertDetailQuery = `
                    INSERT INTO tbpb_dtl 
                    (bpbd_nomor, bpbd_kode, bpbd_ukuran, bpbd_inv_jumlah, bpbd_jumlah, bpbd_hpp, bpbd_jual, bpbd_nourut) 
                    VALUES ?`;
        await connection.query(insertDetailQuery, [detailValues]);
      }

      if (isNew) {
        for (const q of masterBarangQueries) {
          await connection.query(q.query, q.params);
        }
        for (const q of masterDtlQueries) {
          await connection.query(q.query, q.params);
        }
      }
    }

    await connection.commit();
    return {
      message: `Data pembelian ${nomorPembelian} berhasil disimpan.`,
      nomor: nomorPembelian,
    };
  } catch (error) {
    await connection.rollback();
    console.error("Error saving pembelian:", error);
    throw new Error(error.message || "Gagal menyimpan data pembelian.");
  } finally {
    connection.release();
  }
};

/**
 * 8. Lookup Barcode (Scan).
 */
const lookupBarcode = async (db, barcode) => {
  const query = `
        SELECT 
            b.brgd_kode AS kode,
            b.brgd_barcode AS barcode,
            b.brgd_ukuran AS ukuran,
            b.brgd_hpp AS hpp,
            b.brgd_harga AS jual,
            TRIM(CONCAT(a.brg_jeniskaos, ' ', a.brg_tipe, ' ', a.brg_lengan, ' ', a.brg_jeniskain, ' ', a.brg_warna)) AS nama
        FROM tbarang_dtl b
        INNER JOIN tbarang a ON a.brg_kode = b.brgd_kode
        WHERE b.brgd_barcode = ?
    `;
  const [rows] = await db.query(query, [barcode]);
  if (rows.length === 0) {
    throw new Error(`Barcode ${barcode} tidak ditemukan.`);
  }
  return rows[0];
};

/**
 * 9. Lookup Invoice (dari DB Eksternal).
 */
const lookupInvoice = async (db, nomorInvoice) => {
  // Cek dulu di DB lokal (cekinv Delphi) -- Pakai DB yang di-inject
  const checkQuery = "SELECT 1 FROM tbpb_hdr WHERE bpb_inv_nomor = ?";
  const [existing] = await db.query(checkQuery, [nomorInvoice]);
  if (existing.length > 0) {
    throw new Error("Invoice tersebut sudah pernah diinput di Pembelian.");
  }

  // Jika tidak ada, baru cek ke DB eksternal
  let externalConnection;
  try {
    externalConnection = await externalPool.getConnection();
    const externalQuery = `
            SELECT 
                h.inv_tanggal, d.invd_kode,
                
                /* Tambahkan IFNULL pada semua kolom tbarangdc */
                IFNULL(TRIM(CONCAT(a.brg_jeniskaos, ' ', a.brg_tipe, ' ', a.brg_lengan, ' ', a.brg_jeniskain, ' ', a.brg_warna)), '') AS nama,
                IFNULL(b.brgd_barcode, '') AS brgd_barcode,
                IFNULL(a.brg_ktgp, '') AS brg_ktgp, 
                IFNULL(a.brg_ktg, '') AS brg_ktg, 
                IFNULL(a.brg_bahan, '') AS brg_bahan, 
                IFNULL(a.brg_jeniskaos, '') AS brg_jeniskaos, 
                IFNULL(a.brg_tipe, '') AS brg_tipe, 
                IFNULL(a.brg_lengan, '') AS brg_lengan, 
                IFNULL(a.brg_jeniskain, '') AS brg_jeniskain, 
                IFNULL(a.brg_warna, '') AS brg_warna,
                /* --- Akhir IFNULL --- */

                d.invd_ukuran, d.invd_jumlah, d.invd_harga, d.invd_diskon,
                h.inv_bkrm, h.inv_disc, h.inv_disc1,
                (SELECT SUM(i.invd_jumlah) FROM tinv_dtl i WHERE i.invd_inv_nomor = d.invd_inv_nomor) AS total_jml_invoice
                
            FROM tinv_dtl d
            INNER JOIN tinv_hdr h ON h.inv_nomor = d.invd_inv_nomor
            LEFT JOIN tbarangdc a ON a.brg_kode = d.invd_kode
            LEFT JOIN tbarangdc_dtl b ON b.brgd_kode = d.invd_kode AND b.brgd_ukuran = d.invd_ukuran
            WHERE h.inv_nomor = ?
            ORDER BY d.invd_nourut
        `;
    const [rows] = await externalConnection.query(externalQuery, [
      nomorInvoice,
    ]);

    if (rows.length === 0) {
      throw new Error(
        `Invoice ${nomorInvoice} tidak ditemukan di server eksternal.`,
      );
    }

    const header = {
      tglInvoice: format(new Date(rows[0].inv_tanggal), "yyyy-MM-dd"),
    };

    const items = rows.map((row) => {
      const njml = parseFloat(row.total_jml_invoice) || 0;
      const nharga =
        (parseFloat(row.invd_harga) || 0) - (parseFloat(row.invd_diskon) || 0);
      const xbkrm = parseFloat(row.inv_bkrm) || 0;
      const xdiskon = parseFloat(row.inv_disc) || 0;
      const xdis = parseFloat(row.inv_disc1) || 0;

      let xhpp = 0;
      if (xdis === 0 && xdiskon !== 0) {
        xhpp = nharga - xdiskon / njml;
      } else if (xdis !== 0) {
        xhpp = nharga - (xdis / 100) * nharga;
      } else {
        xhpp = nharga;
      }

      const nbkrm = xbkrm === 0 || njml === 0 ? 0 : xbkrm / njml;
      xhpp += nbkrm;

      return {
        kode: row.invd_kode,
        kodex: row.invd_kode,
        nama: row.nama,
        ukuran: row.invd_ukuran,
        qtyinv: parseFloat(row.invd_jumlah) || 0,
        jumlah: parseFloat(row.invd_jumlah) || 0,
        jual: parseFloat(row.invd_harga) || 0,
        hpp: xhpp,
        total: (parseFloat(row.invd_jumlah) || 0) * xhpp,
        barcode: row.brgd_barcode,
        ktgp: row.brg_ktgp,
        ktg: row.brg_ktg,
        bahan: row.brg_bahan,
        jeniskaos: row.brg_jeniskaos,
        tipe: row.brg_tipe,
        lengan: row.brg_lengan,
        jeniskain: row.brg_jeniskain,
        warna: row.brg_warna,
      };
    });

    return { header, items };
  } catch (error) {
    console.error("Error looking up external invoice:", error);
    throw new Error(error.message || "Gagal terhubung ke server eksternal.");
  } finally {
    if (externalConnection) externalConnection.release();
  }
};

module.exports = {
  fetchHeaders,
  fetchDetails,
  deletePembelian,
  loadFormData,
  savePembelian,
  lookupBarcode,
  lookupInvoice,
};
