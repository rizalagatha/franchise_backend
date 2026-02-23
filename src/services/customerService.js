const { pool } = require("../config/database");

/**
 * Mengambil semua data customer untuk browse.
 * Mengambil kolom sesuai referensi Delphi.
 */
const fetchAllCustomers = async () => {
  // Query disesuaikan dari Delphi: TfrmBrowCus.btnRefreshClick
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
  // Tambahkan ORDER BY agar konsisten

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
  // Sesuaikan nama field jika perlu (misal: cus_nama_kontak -> namaKontak)
  // Untuk konsistensi, kita biarkan nama field database
  return rows[0];
};

/**
 * Membuat customer baru.
 * Akan men-generate kode customer baru.
 */
const createCustomer = async (customerData, userKode) => {
  // 1. Generate Kode Baru (Logika dari Delphi getnomor)
  // Asumsi userKode (dari token) mengandung kode cabang di 3 char pertama
  const branchCode = userKode.substring(0, 3);
  const nomorQuery = `
        SELECT IFNULL(MAX(RIGHT(cus_kode, 5)), 0) AS lastNum 
        FROM tcustomer 
        WHERE LEFT(cus_kode, 3) = ?
    `;
  const [nomorRows] = await pool.query(nomorQuery, [branchCode]);
  const nextNum = parseInt(nomorRows[0].lastNum, 10) + 1;
  const newCustomerCode = `${branchCode}${String(nextNum).padStart(5, "0")}`;

  // 2. Persiapan data insert (sesuai kolom Delphi)
  const {
    cus_nama,
    cus_alamat,
    cus_kota,
    cus_telp,
    cus_nama_kontak,
    cus_aktif,
  } = customerData;

  // Validasi dasar (meski frontend juga validasi)
  if (
    !cus_nama?.trim() ||
    !cus_alamat?.trim() ||
    !cus_kota?.trim() ||
    !cus_telp?.trim() ||
    !cus_nama_kontak?.trim()
  ) {
    throw new Error(
      "Data tidak lengkap. Pastikan Nama, Alamat, Kota, Telp, dan Kontak Person terisi."
    );
  }

  const insertQuery = `
    INSERT INTO tcustomer 
    (cus_kode, cus_nama, cus_alamat, cus_kota, cus_telp, cus_nama_kontak, cus_aktif, user_create, date_create) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `;

  const values = [
    newCustomerCode,
    cus_nama, // Gunakan cus_nama
    cus_alamat, // Gunakan cus_alamat
    cus_kota, // Gunakan cus_kota
    cus_telp, // Gunakan cus_telp
    cus_nama_kontak, // Gunakan cus_nama_kontak
    cus_aktif || "Y",
    userKode,
  ];

  // 3. Eksekusi Insert
  await pool.query(insertQuery, values);

  // 4. Kembalikan kode baru
  return {
    kode: newCustomerCode,
    message: `Customer ${cus_nama} berhasil dibuat.`,
  };
};

/**
 * Memperbarui data customer yang ada.
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

  // Validasi dasar
  if (
    !cus_nama?.trim() ||
    !cus_alamat?.trim() ||
    !cus_kota?.trim() ||
    !cus_telp?.trim() ||
    !cus_nama_kontak?.trim()
  ) {
    throw new Error(
      "Data tidak lengkap. Pastikan Nama, Alamat, Kota, Telp, dan Kontak Person terisi."
    );
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
    cus_nama, // Gunakan cus_nama
    cus_alamat, // Gunakan cus_alamat
    cus_kota, // Gunakan cus_kota
    cus_telp, // Gunakan cus_telp
    cus_nama_kontak, // Gunakan cus_nama_kontak
    cus_aktif || "Y",
    userKode,
    customerCode,
  ];

  // Eksekusi Update
  const [result] = await pool.query(updateQuery, values);

  if (result.affectedRows === 0) {
    throw new Error("Customer tidak ditemukan atau data tidak berubah.");
  }

  return { message: `Customer ${cus_nama} berhasil diperbarui.` };
};

module.exports = {
  fetchAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
};
