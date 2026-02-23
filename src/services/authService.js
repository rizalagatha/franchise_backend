const { pool } = require("../config/database");
const jwt = require("jsonwebtoken");

/**
 * Mengambil hak akses (permissions) untuk seorang user.
 * (Fungsi ini tetap sama, karena Anda bilang otorisasi menuId sama)
 * @param {string} userKode - Kode user.
 * @returns {Promise<Array>}
 */
const getPermissions = async (userKode) => {
  const query = `
        SELECT 
            m.men_id AS id,
            m.men_nama AS name,
            m.web_route AS path,
            h.hak_men_view AS 'view',
            h.hak_men_insert AS 'insert',
            h.hak_men_edit AS 'edit',
            h.hak_men_delete AS 'delete'
        FROM thakuser h
        JOIN tmenu m ON h.hak_men_id = m.men_id
        WHERE h.hak_user_kode = ? AND m.web_route IS NOT NULL AND m.web_route <> '';
    `;
  const [permissions] = await pool.query(query, [userKode]);
  return permissions.map((p) => ({
    ...p,
    view: p.view === "Y",
    insert: p.insert === "Y",
    edit: p.edit === "Y",
    delete: p.delete === "Y",
  }));
};

/**
 * Memproses percobaan login (Versi Franchise Sederhana).
 * @param {string} kodeUser - Kode user yang login.
 * @param {string} password - Password user.
 * @returns {Promise<object>}
 */
const loginUser = async (kodeUser, password) => {
  // 1. Verifikasi user (Sama seperti Delphi)
  // Query Delphi: 'select * from tuser where user_aktif="Y" and upper(user_kode) = ...'
  const [users] = await pool.query(
    "SELECT * FROM tuser WHERE UPPER(user_kode) = ? AND user_password = ?",
    [kodeUser.toUpperCase(), password]
  );

  if (users.length === 0) {
    // Delphi: MessageDlg('user atau password salah.', ...)
    throw new Error("User atau password salah.");
  }

  const user = users[0];

  // 2. Cek user_aktif (Sama seperti Delphi)
  if (user.user_aktif !== "Y") {
    // Delphi: MessageDlg('User tsb sudah tidak aktif.', ...)
    throw new Error("User ini sudah tidak aktif.");
  }

  // 3. Buat Payload Sederhana (Tanpa Cabang/Gudang)
  // Delphi: frmmenu.KDUSER := ... dan frmmenu.NMUSER := ...
  const userForToken = {
    kode: user.user_kode,
    nama: user.user_nama,

    // Kirim string kosong agar frontend (authStore) tidak error
    cabang: "",
    cabangNama: "",

    // Default ini ke false, karena tidak ada logika cabang
    canApproveCorrection: false,
    canApprovePrice: false,
  };

  // 4. Buat Token JWT
  const token = jwt.sign(userForToken, process.env.JWT_SECRET || "RAHASIA", {
    expiresIn: "8h",
  });

  // 5. Get Permissions (Logika dari Retail yang kita pertahankan)
  const permissions = await getPermissions(user.user_kode);

  // 6. Return payload final (mirip retail, tapi tanpa data cabang)
  return {
    message: "Login berhasil",
    token,
    user: userForToken,
    permissions,
  };
};

// Ekspor fungsi yang sudah disederhanakan
module.exports = {
  loginUser,
  // Kita tidak lagi mengekspor finalizeLoginWithBranch
};
