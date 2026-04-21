const { pool } = require("../config/database");

/**
 * Mengambil semua data customer untuk browse.
 */
const fetchAllCustomers = async () => {
  const query = `
        SELECT 
            c.cus_kode AS Kode,
            c.cus_nama AS Nama,
            c.cus_alamat AS Alamat,
            c.cus_kota AS Kota,
            c.cus_telp AS Telp,
            c.cus_nama_kontak AS Nama_Kontak,
            c.cus_aktif AS Aktif,
            c.user_create AS Created,
            c.user_modified AS Modified
        FROM tcustomer c
        ORDER BY c.cus_kode ASC 
    `;
  const [rows] = await pool.query(query);
  return rows;
};

/**
 * Mengambil detail satu customer berdasarkan kode.
 */
const getCustomerById = async (customerCode) => {
  const query = "SELECT * FROM tcustomer WHERE cus_kode = ?";
  const [rows] = await pool.query(query, [customerCode]);
  if (rows.length === 0) {
    throw new Error("Customer tidak ditemukan.");
  }
  return rows[0];
};

/**
 * Membuat customer baru dengan prefix dari tperusahaan
 */
const createCustomer = async (customerData, userKode) => {
  // 1. Ambil Kode Cabang Aktif dari tperusahaan
  const [perushRows] = await pool.query(
    "SELECT perush_kode FROM tperusahaan LIMIT 1",
  );

  if (perushRows.length === 0) {
    throw new Error("Data perusahaan (tperusahaan) belum diatur.");
  }
  const branchCode = perushRows[0].perush_kode; // Mengambil prefix (misal: F02)

  // 2. Generate Nomor Urut berdasarkan branchCode tersebut
  const nomorQuery = `
        SELECT IFNULL(MAX(RIGHT(cus_kode, 5)), 0) AS lastNum 
        FROM tcustomer 
        WHERE LEFT(cus_kode, 3) = ?
    `;
  const [nomorRows] = await pool.query(nomorQuery, [branchCode]);
  const nextNum = parseInt(nomorRows[0].lastNum, 10) + 1;
  const newCustomerCode = `${branchCode}${String(nextNum).padStart(5, "0")}`;

  // 3. Persiapan data insert
  const {
    cus_nama,
    cus_alamat,
    cus_kota,
    cus_telp,
    cus_nama_kontak,
    cus_aktif,
  } = customerData;

  if (
    !cus_nama?.trim() ||
    !cus_alamat?.trim() ||
    !cus_kota?.trim() ||
    !cus_telp?.trim() ||
    !cus_nama_kontak?.trim()
  ) {
    throw new Error(
      "Data tidak lengkap. Pastikan Nama, Alamat, Kota, Telp, dan Kontak Person terisi.",
    );
  }

  const insertQuery = `
    INSERT INTO tcustomer 
    (cus_kode, cus_nama, cus_alamat, cus_kota, cus_telp, cus_nama_kontak, cus_aktif, user_create, date_create) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `;

  const values = [
    newCustomerCode,
    cus_nama,
    cus_alamat,
    cus_kota,
    cus_telp,
    cus_nama_kontak,
    cus_aktif || "Y",
    userKode, // user_create tetap menggunakan ID orang yang login
  ];

  await pool.query(insertQuery, values);

  return {
    kode: newCustomerCode,
    message: `Customer ${cus_nama} berhasil dibuat.`,
  };
};

/**
 * Memperbarui data customer
 */
const updateCustomer = async (customerCode, customerData, userKode) => {
  const {
    cus_nama,
    cus_alamat,
    cus_kota,
    cus_telp,
    cus_nama_kontak,
    cus_aktif,
  } = customerData;

  if (
    !cus_nama?.trim() ||
    !cus_alamat?.trim() ||
    !cus_kota?.trim() ||
    !cus_telp?.trim() ||
    !cus_nama_kontak?.trim()
  ) {
    throw new Error("Data tidak lengkap.");
  }

  const updateQuery = `
    UPDATE tcustomer SET 
      cus_nama = ?, 
      cus_alamat = ?, 
      cus_kota = ?, 
      cus_telp = ?, 
      cus_nama_kontak = ?, 
      cus_aktif = ?, 
      user_modified = ?, 
      date_modified = NOW() 
    WHERE cus_kode = ?
  `;

  const values = [
    cus_nama,
    cus_alamat,
    cus_kota,
    cus_telp,
    cus_nama_kontak,
    cus_aktif || "Y",
    userKode,
    customerCode,
  ];

  const [result] = await pool.query(updateQuery, values);

  if (result.affectedRows === 0) {
    throw new Error("Customer tidak ditemukan atau tidak ada perubahan.");
  }

  return { message: `Customer ${cus_nama} berhasil diperbarui.` };
};

module.exports = {
  fetchAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
};
