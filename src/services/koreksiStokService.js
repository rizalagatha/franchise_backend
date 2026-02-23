const { pool } = require("../config/database");
const { format } = require("date-fns");

/**
 * Mengambil data header koreksi stok (tkor_hdr) berdasarkan periode dan cabang.
 * Query Nominal dioptimalkan (tidak pakai subquery per baris).
 */
const fetchHeaders = async (startDate, endDate) => {
  // 1. Ambil data header utama
  const headerQuery = `
        SELECT 
            h.kor_nomor AS Nomor,
            DATE_FORMAT(h.kor_tanggal, '%d-%m-%Y') AS Tanggal,
            h.kor_ket AS Keterangan,
            h.user_create AS Created,
            h.user_modified AS Modified
        FROM tkor_hdr h
        WHERE 
            h.kor_tanggal BETWEEN ? AND ? 
        ORDER BY h.kor_tanggal, h.kor_nomor
    `;
  const [headers] = await pool.query(headerQuery, [startDate, endDate]);

  // 2. Ambil SEMUA nominal dalam satu query (Optimal)
  const nominalQuery = `
        SELECT 
            d.kord_kor_nomor AS Nomor, 
            SUM(d.kord_selisih * d.kord_hpp) AS Nominal
        FROM tkor_dtl d
        INNER JOIN tkor_hdr h ON h.kor_nomor = d.kord_kor_nomor
        WHERE 
            h.kor_tanggal BETWEEN ? AND ? 
        GROUP BY d.kord_kor_nomor
    `;
  const [nominals] = await pool.query(nominalQuery, [startDate, endDate]);

  // 3. Gabungkan data di JavaScript
  const nominalMap = new Map(
    nominals.map((item) => [item.Nomor, item.Nominal])
  );

  const combinedHeaders = headers.map((header) => ({
    ...header,
    Nominal: nominalMap.get(header.Nomor) || 0, // Default 0 jika tidak ada detail
  }));

  return combinedHeaders;
};

/**
 * Mengambil data detail koreksi stok (tkor_dtl) berdasarkan nomor header.
 * Sesuai SQLDetail Delphi.
 */
const fetchDetails = async (nomorHeader) => {
  const query = `
        SELECT 
            d.kord_kor_nomor AS Nomor,
            d.kord_kode AS Kode,
            TRIM(CONCAT(a.brg_jeniskaos, ' ', a.brg_tipe, ' ', a.brg_lengan, ' ', a.brg_jeniskain, ' ', a.brg_warna)) AS Nama,
            d.kord_ukuran AS Ukuran,
            d.kord_Stok AS Stok,
            d.kord_jumlah AS Jumlah,
            d.kord_selisih AS Selisih,
            d.kord_hpp AS Hpp
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
 * Menghapus header dan detail koreksi (transaksional).
 */
const deleteKoreksi = async (nomorHeader) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Hapus Detail (tkor_dtl)
    await connection.query("DELETE FROM tkor_dtl WHERE kord_kor_nomor = ?", [
      nomorHeader,
    ]);

    // 2. Hapus Header (tkor_hdr)
    const [result] = await connection.query(
      "DELETE FROM tkor_hdr WHERE kor_nomor = ?",
      [nomorHeader]
    );

    if (result.affectedRows === 0) {
      throw new Error("Nomor koreksi tidak ditemukan.");
    }

    await connection.commit();
    return { message: `Data koreksi ${nomorHeader} berhasil dihapus.` };
  } catch (error) {
    await connection.rollback();
    console.error("Error deleting koreksi:", error);
    throw new Error(error.message || "Gagal menghapus data koreksi.");
  } finally {
    connection.release();
  }
};

/**
 * 4. Helper: Cek Stok Awal (getStokawal Delphi)
 */
const getStokAwal = async (kodeBarang, ukuran, tanggalKoreksi) => {
  const query = `
        SELECT IFNULL(SUM(m.mst_stok_in - m.mst_stok_out), 0) AS stok
        FROM tmasterstok m
        WHERE m.mst_aktif = 'Y' 
          AND m.mst_brg_kode = ? 
          AND m.mst_ukuran = ?
          AND m.mst_tanggal < ? 
    `;
  const [rows] = await pool.query(query, [kodeBarang, ukuran, tanggalKoreksi]);
  return rows[0].stok;
};

/**
 * 5. Helper: Cek Koreksi di Hari yang Sama (cekkor Delphi)
 */
const cekKoreksiDuplikat = async (
  kodeBarang,
  ukuran,
  tanggalKoreksi,
  nomorKoreksi
) => {
  const query = `
        SELECT h.kor_nomor 
        FROM tkor_hdr h
        LEFT JOIN tkor_dtl d ON d.kord_kor_nomor = h.kor_nomor
        WHERE h.kor_nomor <> ? 
          AND h.kor_tanggal = ?
          AND d.kord_kode = ?
          AND d.kord_ukuran = ?
        LIMIT 1
    `;
  const [rows] = await pool.query(query, [
    nomorKoreksi || "",
    tanggalKoreksi,
    kodeBarang,
    ukuran,
  ]);
  return rows.length > 0 ? rows[0].kor_nomor : null; // Kembalikan nomor duplikat jika ada
};

/**
 * 6. Lookup Barcode (Scan/F1) untuk Grid Koreksi
 * Menggabungkan logika loadbrg, getStokawal, dan cekkor
 */
const lookupBarcodeKoreksi = async (barcode, tanggalKoreksi, nomorKoreksi) => {
  // 1. Cari barang
  const query = `
        SELECT 
            b.brgd_kode AS kode, 
            IFNULL(b.brgd_barcode, '') AS barcode,
            IFNULL(b.brgd_ukuran, '') AS ukuran,
            IFNULL(b.brgd_hpp, 0) AS hpp,
            IFNULL(b.brgd_harga, 0) AS jual,
            
            /* --- FIX NAMA KOSONG --- */
            TRIM(CONCAT_WS(' ', 
                a.brg_jeniskaos, a.brg_tipe, a.brg_lengan, 
                a.brg_jeniskain, a.brg_warna
            )) AS nama,
            /* --- AKHIR FIX --- */

            IFNULL(a.brg_ktgp, '') AS brg_ktgp, 
            IFNULL(a.brg_ktg, '') AS brg_ktg, 
            IFNULL(a.brg_bahan, '') AS brg_bahan, 
            IFNULL(a.brg_jeniskaos, '') AS brg_jeniskaos, 
            IFNULL(a.brg_tipe, '') AS brg_tipe, 
            IFNULL(a.brg_lengan, '') AS brg_lengan, 
            IFNULL(a.brg_jeniskain, '') AS brg_jeniskain, 
            IFNULL(a.brg_warna, '') AS brg_warna
        
        FROM tbarang_dtl b
        INNER JOIN tbarang a ON a.brg_kode = b.brgd_kode
        WHERE b.brgd_barcode = ?
    `;
  const [rows] = await pool.query(query, [barcode]);
  if (rows.length === 0) {
    throw new Error(`Barcode ${barcode} tidak ditemukan.`);
  }
  const item = rows[0];

  // 2. Cek duplikat koreksi (panggil versi tanpa userCabang)
  const duplikat = await cekKoreksiDuplikat(
    item.kode,
    item.ukuran,
    tanggalKoreksi,
    nomorKoreksi
  );
  if (duplikat) {
    throw new Error(
      `Barang ini sudah dikoreksi di No: ${duplikat} pada tanggal yang sama.`
    );
  }

  // 3. Ambil Stok Awal (panggil versi tanpa userCabang)
  const stokAwal = await getStokAwal(item.kode, item.ukuran, tanggalKoreksi);

  return {
    ...item,
    stok: stokAwal,
  };
};

/**
 * 7. Mengambil data header dan detail untuk mode edit.
 * Sesuai logika Delphi loaddataall.
 */
const loadFormData = async (nomorKoreksi) => {
  // 1. Ambil Header
  const headerQuery = `
        SELECT 
            h.kor_nomor, 
            DATE_FORMAT(h.kor_tanggal, '%Y-%m-%d') AS kor_tanggal,
            h.kor_ket
        FROM tkor_hdr h 
        WHERE h.kor_nomor = ?
     `;
  const [headerRows] = await pool.query(headerQuery, [nomorKoreksi]);
  if (headerRows.length === 0) {
    throw new Error("Nomor koreksi tidak ditemukan.");
  }
  const header = headerRows[0];

  // 2. Ambil Detail (loaddataall)
  const detailQuery = `
        SELECT 
            d.kord_kode AS kode,
            b.brgd_barcode AS barcode,
            TRIM(CONCAT(a.brg_jeniskaos, ' ', a.brg_tipe, ' ', a.brg_lengan, ' ', a.brg_jeniskain, ' ', a.brg_warna)) AS nama,
            d.kord_ukuran AS ukuran,
            d.kord_stok AS stok,
            d.kord_jumlah AS jumlah,
            d.kord_selisih AS selisih,
            d.kord_hpp AS hpp,
            (d.kord_selisih * d.kord_hpp) AS total,
            d.kord_ket AS keterangan
        FROM tkor_dtl d
        LEFT JOIN tbarang a ON a.brg_kode = d.kord_kode
        LEFT JOIN tbarang_dtl b ON b.brgd_kode = d.kord_kode AND b.brgd_ukuran = d.kord_ukuran
        WHERE d.kord_kor_nomor = ? 
     `;
  const [details] = await pool.query(detailQuery, [nomorKoreksi]);

  return { header, items: details };
};

/**
 * 8. Menyimpan data Koreksi Stok (Create/Update).
 * Sesuai logika Delphi simpandata.
 */
const saveKoreksi = async (headerData, itemsData, userKode, isNew) => {
  const connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    let nomorKoreksi = headerData.nomor;
    const tanggal = format(new Date(headerData.tanggal), "yyyy-MM-dd");

    if (isNew) {
      // Generate nomor (getmaxnomor Delphi)
      // Format: F01.KOR.2112.0001
      const prefix = `KOR.${format(new Date(tanggal), "yyMM")}`;
      const nomorQuery = `
            SELECT IFNULL(MAX(RIGHT(kor_nomor, 4)), 0) AS jumlah 
            FROM tkor_hdr 
            WHERE LEFT(kor_nomor, 8) = ?`;
      const [nomorRows] = await connection.query(nomorQuery, [prefix]);
      const nextNum = parseInt(nomorRows[0].jumlah, 10) + 1;
      nomorKoreksi = `${prefix}.${String(nextNum).padStart(4, "0")}`;

      // Insert header
      const insertHeaderQuery = `
                INSERT INTO tkor_hdr (kor_nomor, kor_tanggal, kor_ket, user_create, date_create) 
                VALUES (?, ?, ?, ?, NOW())
            `;
      await connection.query(insertHeaderQuery, [
        nomorKoreksi,
        tanggal,
        headerData.keterangan,
        userKode,
      ]);
    } else {
      // Update header
      const updateHeaderQuery = `
                UPDATE tkor_hdr SET 
                    kor_tanggal = ?, kor_ket = ?, 
                    user_modified = ?, date_modified = NOW() 
                WHERE kor_nomor = ?
            `;
      await connection.query(updateHeaderQuery, [
        tanggal,
        headerData.keterangan,
        userKode,
        nomorKoreksi,
      ]);
    }

    // --- Proses Detail ---
    // 1. Hapus detail lama
    await connection.query("DELETE FROM tkor_dtl WHERE kord_kor_nomor = ?", [
      nomorKoreksi,
    ]);

    // 2. Insert detail baru
    if (itemsData && itemsData.length > 0) {
      const insertDetailQuery = `
                INSERT INTO tkor_dtl 
                (kord_kor_nomor, kord_kode, kord_ukuran, kord_stok, kord_jumlah, kord_selisih, kord_hpp, kord_ket) 
                VALUES ?`;

      const detailValues = itemsData
        .filter((item) => item.kode) // Filter baris kosong
        .map((item, index) => [
          nomorKoreksi,
          item.kode,
          item.ukuran,
          item.stok || 0,
          item.jumlah || 0,
          item.selisih || 0,
          item.hpp || 0,
          item.keterangan || "",
        ]);

      if (detailValues.length > 0) {
        await connection.query(insertDetailQuery, [detailValues]);
      }
    }

    await connection.commit();
    return {
      message: `Data koreksi ${nomorKoreksi} berhasil disimpan.`,
      nomor: nomorKoreksi,
    };
  } catch (error) {
    await connection.rollback();
    console.error("Error saving koreksi:", error);
    throw new Error(error.message || "Gagal menyimpan data koreksi.");
  } finally {
    connection.release();
  }
};

/**
 * 9. Mengambil data untuk cetak.
 * Sesuai query Delphi cetak.
 */
const getPrintData = async (nomorKoreksi, userNama) => {
  // 1. Ambil data perusahaan
  const cabangKodeDefault = "F02";
  let perusahaan = { nama: "CABANG KAOSAN", alamat: "", telp: "" }; // Default

  try {
    const [prsRows] = await pool.query(
      "SELECT perush_alamat, perush_telp FROM tperusahaan WHERE perush_kode = ?",
      [cabangKodeDefault] // <-- Gunakan kode default
    );
    if (prsRows.length > 0) {
      perusahaan.alamat = prsRows[0].perush_alamat;
      perusahaan.telp = prsRows[0].perush_telp;
    }
  } catch (e) {
    console.error("Gagal mengambil data tperusahaan:", e.message);
  }

  // 2. Ambil data koreksi
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
            (d.kord_selisih * d.kord_hpp) AS nominal,
            d.kord_ket AS ket_detail
        FROM tkor_hdr h
        LEFT JOIN tkor_dtl d ON d.kord_kor_nomor = h.kor_nomor
        LEFT JOIN tbarang a ON a.brg_kode = d.kord_kode
        WHERE h.kor_nomor = ?
    `;
  const [rows] = await pool.query(query, [nomorKoreksi]);
  if (rows.length === 0) {
    throw new Error("Data cetak tidak ditemukan.");
  }

  // 3. Susun Payload
  const header = {
    nomor: rows[0].kor_nomor,
    tanggal: rows[0].kor_tanggal,
    keterangan: rows[0].kor_ket,
    userNama: userNama,
    perusahaanNama: perusahaan.nama,
    perusahaanAlamat: perusahaan.alamat,
    perusahaanTelp: perusahaan.telp,
  };

  const details = rows
    .filter((row) => row.kord_kode)
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
    0
  );

  // Info 'Created' (untuk di bawah tabel)
  const createdUser = rows[0].user_create || userNama;
  const createdDate =
    rows[0].date_create || format(new Date(), "dd-MM-yyyy HH:mm:ss");
  const createdInfo = `${createdDate} (${createdUser})`;

  // Kembalikan semua
  return { header, details, totalNominal, createdInfo };
};

/**
 * 10. Lookup F1 untuk form (Sesuai Delphi TfrmKor.cxGrdMasterEditKeyDown)
 * Menggunakan server-side pagination & search
 */
const lookupF1Koreksi = async (term, tanggal, page, itemsPerPage) => {
  const offset = (page - 1) * itemsPerPage;
  const searchTermLike = term ? `%${term.trim()}%` : null;

  // --- FIX NAMA KOSONG ---
  const namaBarangField = `
        TRIM(CONCAT_WS(' ', 
            a.brg_jeniskaos, a.brg_tipe, a.brg_lengan, 
            a.brg_jeniskain, a.brg_warna
        ))
    `;

  let fromClause = `
        FROM tbarang_dtl b
        INNER JOIN tbarang a ON a.brg_kode = b.brgd_kode
    `;
  let whereClause = `WHERE 1=1`;

  // --- FIX PARAMETER BUG ---
  let countParams = []; // Parameter HANYA untuk countQuery
  let dataParams = [tanggal]; // Parameter HANYA untuk dataQuery
  // --- AKHIR FIX ---

  if (searchTermLike) {
    whereClause += ` AND (
            b.brgd_barcode LIKE ? OR
            b.brgd_kode LIKE ? OR
            ${namaBarangField} LIKE ?
        )`;
    const searchParams = [searchTermLike, searchTermLike, searchTermLike];
    countParams.push(...searchParams);
    dataParams.push(...searchParams);
  }

  // Gunakan 'countParams'
  const countQuery = `SELECT COUNT(*) as total ${fromClause} ${whereClause}`;
  const [countRows] = await pool.query(countQuery, countParams);
  const total = countRows[0].total;

  // Gunakan 'dataParams'
  const dataQuery = `
        SELECT 
            b.brgd_barcode AS barcode,
            b.brgd_kode AS kode,
            ${namaBarangField} AS nama,
            IFNULL(b.brgd_ukuran, '') AS ukuran,
            IFNULL(b.brgd_hpp, 0) AS hpp, 
            IFNULL((
                SELECT SUM(m.mst_stok_in - m.mst_stok_out) 
                FROM tmasterstok m
                WHERE m.mst_aktif = 'Y'
                  AND m.mst_brg_kode = b.brgd_kode 
                  AND m.mst_ukuran = b.brgd_ukuran
                  AND m.mst_tanggal < ? 
            ), 0) AS stok
        ${fromClause}
        ${whereClause}
        ORDER BY nama, ukuran
        LIMIT ? OFFSET ?
    `;

  dataParams.push(itemsPerPage, offset);
  const [items] = await pool.query(dataQuery, dataParams);

  return { items, total };
};

module.exports = {
  fetchHeaders,
  fetchDetails,
  deleteKoreksi,
  loadFormData,
  saveKoreksi,
  lookupBarcodeKoreksi,
  getPrintData,
  lookupF1Koreksi,
};
