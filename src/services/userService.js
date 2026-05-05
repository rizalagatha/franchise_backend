// src/services/userService.js
const { masterPool } = require("../config/database");
const bcrypt = require("bcrypt");

/**
 * Mengambil daftar user yang HANYA berada di cabang yang sama dengan Admin
 */
const getUsers = async (cabangId) => {
  const [rows] = await masterPool.query(
    `SELECT username AS Kode, username AS Nama, role AS Role, 'Y' AS Aktif 
     FROM users 
     WHERE cabang_id = ? 
     ORDER BY username`,
    [cabangId],
  );
  return rows;
};

/**
 * Mendapatkan daftar user aktif untuk keperluan dropdown (misal: Kasir)
 */
const getUserList = async (cabangId) => {
  const [rows] = await masterPool.query(
    "SELECT username AS user_kode, username AS user_nama FROM users WHERE cabang_id = ? ORDER BY username ASC",
    [cabangId],
  );
  return rows;
};

/**
 * Menghapus user dengan validasi cabang_id (Security Check)
 */
const deleteUser = async (cabangId, username) => {
  if (username.toUpperCase() === "ADMIN") {
    throw new Error("User Super Admin tidak boleh dihapus.");
  }

  // Pastikan user yang dihapus memang milik cabang sang Admin
  const [result] = await masterPool.query(
    "DELETE FROM users WHERE username = ? AND cabang_id = ?",
    [username, cabangId],
  );

  if (result.affectedRows === 0) {
    throw new Error("User tidak ditemukan atau Anda tidak memiliki akses.");
  }
  return { message: "User berhasil dihapus" };
};

/**
 * Mengambil daftar menu aplikasi (Centralized di Master)
 */
const getMenus = async () => {
  const [rows] = await masterPool.query(
    "SELECT men_id, men_nama, men_keterangan FROM tmenu ORDER BY CAST(men_id AS UNSIGNED)",
  );
  return rows;
};

/**
 * Mengambil detail user beserta hak aksesnya (Security Check)
 */
const getUserById = async (cabangId, username) => {
  const [userRows] = await masterPool.query(
    "SELECT username, role, cabang_id FROM users WHERE username = ? AND cabang_id = ?",
    [username, cabangId],
  );

  if (userRows.length === 0) throw new Error("User tidak ditemukan");

  const [hakAksesRows] = await masterPool.query(
    `SELECT hak_men_id, hak_men_view, hak_men_insert, hak_men_edit, hak_men_delete 
     FROM thakuser 
     WHERE hak_user_kode = ?`,
    [username],
  );

  return {
    user: userRows[0],
    hakAkses: hakAksesRows,
  };
};

/**
 * Simpan User (Insert/Update) dengan memaksa cabang_id dari Admin (Security)
 */
const saveUser = async (cabangId, data, isNew) => {
  const conn = await masterPool.getConnection();
  await conn.beginTransaction();

  try {
    const { Kode, Nama, Password, Role, hakAkses } = data;

    if (isNew) {
      // Cek duplikasi di seluruh sistem (Master)
      const [exist] = await conn.query(
        "SELECT 1 FROM users WHERE username = ?",
        [Kode],
      );
      if (exist.length > 0) throw new Error("Username sudah digunakan.");

      // Insert ke tabel Master 'users'
      // Cabang_id dipaksa menggunakan ID cabang milik Admin yang sedang login
      await conn.query(
        "INSERT INTO users (username, password, role, cabang_id) VALUES (?, ?, ?, ?)",
        [Kode, Password, Role || "user", cabangId],
      );
    } else {
      // Update data (Password hanya jika diisi)
      if (Password && Password.trim() !== "") {
        await conn.query(
          "UPDATE users SET role = ? WHERE username = ? AND cabang_id = ?",
          [Role, Kode, cabangId],
        );
        // Implementasi update password terpisah atau gabung sesuai kebutuhan
      }
    }

    // Update Hak Akses di Master (thakuser)
    await conn.query("DELETE FROM thakuser WHERE hak_user_kode = ?", [Kode]);

    for (const hak of hakAkses) {
      if (
        hak.view === "Y" ||
        hak.insert === "Y" ||
        hak.edit === "Y" ||
        hak.delete === "Y"
      ) {
        await conn.query(
          `INSERT INTO thakuser (hak_user_kode, hak_men_id, hak_men_view, hak_men_insert, hak_men_edit, hak_men_delete) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            Kode,
            hak.men_id,
            hak.view || "N",
            hak.insert || "N",
            hak.edit || "N",
            hak.delete || "N",
          ],
        );
      }
    }

    await conn.commit();
    return { message: "Data user berhasil disimpan." };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

const changePassword = async (cabangId, userKode, oldPassword, newPassword) => {
  // 1. Cari user di Master DB berdasarkan username dan cabang_id
  const [rows] = await masterPool.query(
    "SELECT password FROM users WHERE username = ? AND cabang_id = ?",
    [userKode, cabangId],
  );

  if (rows.length === 0) {
    throw new Error("User tidak ditemukan.");
  }

  // 2. Bandingkan password lama (bcrypt)
  const isMatch = await bcrypt.compare(oldPassword, rows[0].password);
  if (!isMatch) {
    throw new Error("Password lama salah.");
  }

  // 3. Hash password baru
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  // 4. Update di Master DB
  await masterPool.query(
    "UPDATE users SET password = ? WHERE username = ? AND cabang_id = ?",
    [hashedPassword, userKode, cabangId],
  );

  return { message: "Password berhasil diganti." };
};

module.exports = {
  getUsers,
  getUserList,
  deleteUser,
  getMenus,
  getUserById,
  saveUser,
  changePassword,
};
