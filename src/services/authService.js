const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt"); // Asumsi menggunakan bcrypt
const { masterPool } = require("../config/database");

const loginUser = async (kodeUser, password) => {
  // 1. Cari user di Master Database beserta konfigurasi cabangnya
  // Sesuaikan nama kolom 'username'/'user_kode' dengan struktur tabel master kamu
  const queryUser = `
    SELECT u.*, c.kode_cabang, c.db_host, c.db_name, c.db_user, c.db_pass, c.nama_cabang 
    FROM users u
    LEFT JOIN cabang c ON u.cabang_id = c.id
    WHERE u.username = ? 
  `;
  const [users] = await masterPool.query(queryUser, [kodeUser]);

  if (users.length === 0) {
    throw new Error("User tidak ditemukan.");
  }

  const user = users[0];

  // 2. Verifikasi Password
  // Catatan: Jika password dari sistem Delphi lama menggunakan MD5 atau Plaintext,
  // ubah pengecekan ini sesuai dengan algoritma hashing Delphi tersebut.
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new Error("Password salah.");
  }

  // 3. Ambil Permissions (Hak Akses) dari tabel thakuser
  const queryPermissions = `SELECT * FROM thakuser WHERE hak_user_kode = ?`;
  const [permissions] = await masterPool.query(queryPermissions, [kodeUser]);

  // 4. Susun Payload JWT (Hanya simpan data esensial di dalam token)
  const payload = {
    kode: user.username,
    role: user.role,
    cabang: {
      id: user.cabang_id,
      nama: user.nama_cabang,
      db_host: user.db_host,
      db_name: user.db_name,
      db_user: user.db_user,
      db_pass: user.db_pass,
    },
  };

  // 5. Generate Token
  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "12h",
  });

  // 6. Kembalikan data untuk AuthController
  return {
    token,
    user: {
      kode: user.username,
      nama: user.username, // Gunakan username sebagai nama, karena kolom nama_lengkap tidak ada
      cabang: user.cabang_id,
      cabangKode: user.kode_cabang,
      cabangNama: user.nama_cabang,
      terms_accepted: user.terms_accepted,
    },
    permissions,
  };
};

module.exports = {
  loginUser,
};
