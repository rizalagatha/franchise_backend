const { pool } = require("../config/database");

const getUsers = async () => {
  const [rows] = await pool.query(
    `SELECT user_kode AS Kode, user_nama AS Nama, user_aktif AS Aktif
     FROM tuser
     ORDER BY user_nama`,
  );
  return rows;
};

const deleteUser = async (kode) => {
  if (kode === "ADMIN") {
    throw new Error("User Admin tidak boleh dihapus.");
  }

  const [result] = await pool.query("DELETE FROM tuser WHERE user_kode = ?", [
    kode,
  ]);
  if (result.affectedRows === 0) {
    throw new Error("User tidak ditemukan.");
  }
  return { message: "Berhasil dihapus" };
};

// Mengambil daftar semua menu aplikasi
const getMenus = async () => {
  const [rows] = await pool.query(
    "SELECT men_id, men_nama, men_keterangan FROM tmenu ORDER BY men_id",
  );
  return rows;
};

// Mengambil 1 User beserta hak aksesnya (untuk mode Edit)
const getUserById = async (kode) => {
  const [userRows] = await pool.query(
    "SELECT * FROM tuser WHERE user_kode = ?",
    [kode],
  );
  if (userRows.length === 0) throw new Error("User tidak ditemukan");

  const [hakAksesRows] = await pool.query(
    "SELECT hak_men_id, hak_men_view, hak_men_insert, hak_men_edit, hak_men_delete FROM thakuser WHERE hak_user_kode = ?",
    [kode],
  );

  return {
    user: userRows[0],
    hakAkses: hakAksesRows,
  };
};

// Menyimpan User (Insert / Update) beserta hak aksesnya (Transaksi)
const saveUser = async (data, isNew) => {
  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    const { Kode, Nama, Password, Aktif, hakAkses } = data;
    const isAktif = Aktif ? "Y" : "N";

    if (isNew) {
      // Validasi kode unik
      const [exist] = await conn.query(
        "SELECT 1 FROM tuser WHERE user_kode = ?",
        [Kode],
      );
      if (exist.length > 0) throw new Error("Kode user sudah digunakan.");

      await conn.query(
        "INSERT INTO tuser (user_kode, user_nama, user_password, user_aktif) VALUES (?, ?, ?, ?)",
        [Kode, Nama, Password, isAktif],
      );
    } else {
      // Jika password kosong, jangan update password
      if (Password && Password.trim() !== "") {
        await conn.query(
          "UPDATE tuser SET user_nama = ?, user_password = ?, user_aktif = ? WHERE user_kode = ?",
          [Nama, Password, isAktif, Kode],
        );
      } else {
        await conn.query(
          "UPDATE tuser SET user_nama = ?, user_aktif = ? WHERE user_kode = ?",
          [Nama, isAktif, Kode],
        );
      }
    }

    // Reset hak akses lama
    await conn.query("DELETE FROM thakuser WHERE hak_user_kode = ?", [Kode]);

    // Insert hak akses baru yang memiliki minimal 1 izin
    for (const hak of hakAkses) {
      if (
        hak.view === "Y" ||
        hak.insert === "Y" ||
        hak.edit === "Y" ||
        hak.delete === "Y"
      ) {
        await conn.query(
          `INSERT INTO thakuser (HAK_user_kode, HAK_men_id, hak_men_view, hak_men_insert, hak_men_edit, hak_men_delete) 
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
    return { message: "Data user berhasil disimpan" };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

const changePassword = async (userKode, oldPassword, newPassword) => {
  const conn = await pool.getConnection();
  try {
    // Cek kecocokan password lama
    const [rows] = await conn.query(
      "SELECT 1 FROM tuser WHERE UPPER(user_kode) = UPPER(?) AND user_password = ?",
      [userKode, oldPassword],
    );

    if (rows.length === 0) {
      throw new Error("Password lama salah."); // Pesan error seperti Delphi
    }

    // Update ke password baru
    await conn.query("UPDATE tuser SET user_password = ? WHERE user_kode = ?", [
      newPassword,
      userKode,
    ]);

    return { message: "Password berhasil diganti." };
  } finally {
    conn.release();
  }
};

module.exports = {
  getUsers,
  deleteUser,
  getMenus,
  getUserById,
  saveUser,
  changePassword,
};
