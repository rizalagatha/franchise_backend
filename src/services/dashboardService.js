const { pool } = require("../config/database");

const getStats = async (cabang, tanggal) => {
  // Menghitung total penjualan hari ini dengan join ke detail
  const [sales] = await pool.query(
    `SELECT 
        IFNULL(SUM(d.subtotal - h.inv_disc), 0) as total,
        COUNT(DISTINCT h.inv_nomor) as count
     FROM tinv_hdr h
     LEFT JOIN (
        SELECT invd_inv_nomor, SUM(invd_jumlah * (invd_harga - invd_diskon)) as subtotal
        FROM tinv_dtl
        GROUP BY invd_inv_nomor
     ) d ON h.inv_nomor = d.invd_inv_nomor
     WHERE LEFT(h.inv_nomor, 3) = ? AND h.inv_tanggal = ?`,
    [cabang, tanggal],
  );

  // Ambil jumlah stok menipis (Sisa stok <= 10)
  const [lowStock] = await pool.query(
    `SELECT COUNT(*) as count FROM (
       SELECT SUM(mst_stok_in - mst_stok_out) as sisa 
       FROM tmasterstok 
       WHERE LEFT(mst_noreferensi, 3) = ? 
       GROUP BY mst_brg_kode
       HAVING sisa <= 10
     ) as s`,
    [cabang],
  );

  const [products] = await pool.query("SELECT COUNT(*) as count FROM tbarang");

  return {
    todaySales: parseFloat(sales[0].total),
    todayTransactions: sales[0].count,
    lowStock: lowStock[0].count,
    totalProducts: products[0].count,
  };
};

const getChartData = async (cabang, start, end) => {
  // Query grafik harian dengan kalkulasi nominal dari detail
  const [rows] = await pool.query(
    `SELECT 
        h.inv_tanggal as tanggal, 
        SUM(d.subtotal - h.inv_disc) as total 
     FROM tinv_hdr h
     INNER JOIN (
        SELECT invd_inv_nomor, SUM(invd_jumlah * (invd_harga - invd_diskon)) as subtotal
        FROM tinv_dtl
        GROUP BY invd_inv_nomor
     ) d ON h.inv_nomor = d.invd_inv_nomor
     WHERE LEFT(h.inv_nomor, 3) = ? AND h.inv_tanggal BETWEEN ? AND ?
     GROUP BY h.inv_tanggal 
     ORDER BY h.inv_tanggal ASC`,
    [cabang, start, end],
  );
  return rows;
};

const getPendingActions = async (cabang) => {
  // Menghitung jumlah invoice yang sisa piutangnya > 0
  // Sisa piutang = SUM(pd_debet - pd_kredit)
  const [piutang] = await pool.query(
    `SELECT COUNT(*) as count FROM (
       SELECT SUM(d.pd_debet - d.pd_kredit) as sisa
       FROM tpiutang_hdr h
       JOIN tpiutang_dtl d ON h.ph_nomor = d.pd_ph_nomor
       WHERE LEFT(h.ph_inv_nomor, 3) = ?
       GROUP BY h.ph_inv_nomor
       HAVING sisa > 0
     ) as t`,
    [cabang],
  );

  return [
    {
      key: "piutang_pending",
      title: "Tagihan Belum Lunas",
      icon: "mdi-alert-decagram-outline",
      to: "/transaksi/setoran-pembayaran", // Diarahkan ke form pelunasan
      count: piutang[0].count,
    },
  ];
};

const getRecentTransactions = async (cabang) => {
  const [rows] = await pool.query(
    `SELECT h.inv_nomor as id, 
            c.cus_nama as customer, 
            DATE_FORMAT(h.date_create, "%H:%i") as time, 
            IFNULL(d.total, 0) as amount,
            CASE 
              WHEN h.inv_rpcard > 0 THEN 'Transfer'
              WHEN h.inv_rptunai > 0 THEN 'Tunai'
              ELSE 'Piutang'
            END as payment_type
     FROM tinv_hdr h
     LEFT JOIN tcustomer c ON h.inv_cus_kode = c.cus_kode
     LEFT JOIN (
        SELECT invd_inv_nomor, SUM(invd_jumlah * (invd_harga - invd_diskon)) as total
        FROM tinv_dtl GROUP BY invd_inv_nomor
     ) d ON h.inv_nomor = d.invd_inv_nomor
     WHERE LEFT(h.inv_nomor, 3) = ?
     ORDER BY h.date_create DESC LIMIT 5`,
    [cabang],
  );
  return rows;
};

const getLowStockDetails = async (cabang) => {
  const [rows] = await pool.query(
    `SELECT b.brg_kode as KODE, 
            TRIM(CONCAT(b.brg_jeniskaos, ' ', b.brg_tipe, ' ', b.brg_lengan, ' ', b.brg_jeniskain, ' ', b.brg_warna)) AS NAMA,
            SUM(m.mst_stok_in - m.mst_stok_out) as TOTAL,
            10 as Buffer
     FROM tbarang b
     JOIN tmasterstok m ON b.brg_kode = m.mst_brg_kode
     WHERE LEFT(m.mst_noreferensi, 3) = ?
     GROUP BY b.brg_kode
     HAVING TOTAL <= 10
     ORDER BY TOTAL ASC LIMIT 10`,
    [cabang],
  );
  return rows;
};

const getSalesTarget = async (cabang) => {
  // Contoh: Target statis 150jt, realisasi bulan berjalan
  const currentMonth = new Date().toISOString().slice(0, 7); // "2026-03"
  const [rows] = await pool.query(
    `SELECT IFNULL(SUM(invd_jumlah * (invd_harga - invd_diskon)), 0) as nominal
     FROM tinv_dtl d
     JOIN tinv_hdr h ON d.invd_inv_nomor = h.inv_nomor
     WHERE LEFT(h.inv_nomor, 3) = ? AND h.inv_tanggal LIKE ?`,
    [cabang, `${currentMonth}%`],
  );
  return {
    nominal: parseFloat(rows[0].nominal),
    target: 150000000, // Bisa diambil dari tabel setting jika ada
  };
};

module.exports = {
  getStats,
  getChartData,
  getRecentTransactions,
  getLowStockDetails,
  getSalesTarget,
  getPendingActions,
};
