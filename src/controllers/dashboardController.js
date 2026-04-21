const service = require("../services/dashboardService");
const { pool } = require("../config/database");

const getData = async (req, res) => {
  try {
    // 1. Ambil kode cabang resmi dari tperusahaan
    const [perush] = await pool.query(
      "SELECT perush_kode FROM tperusahaan LIMIT 1",
    );
    if (perush.length === 0)
      return res.status(404).json({ message: "Setting perusahaan belum ada" });

    const cabang = perush[0].perush_kode; // Contoh: "F02"
    const today = new Date().toISOString().split("T")[0];

    // 2. Jalankan query dashboard berdasarkan cabang tersebut
    const [stats, actions, recent, lowStock, target] = await Promise.all([
      service.getStats(cabang, today),
      service.getPendingActions(cabang),
      service.getRecentTransactions(cabang),
      service.getLowStockDetails(cabang),
      service.getSalesTarget(cabang),
    ]);

    res.json({ stats, actions, recent, lowStock, target, cabang });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getChart = async (req, res) => {
  try {
    // 1. Ambil kode cabang resmi dulu (Sama seperti getData)
    const [perush] = await pool.query(
      "SELECT perush_kode FROM tperusahaan LIMIT 1",
    );

    if (perush.length === 0)
      return res.status(404).json({ message: "Setting perusahaan belum ada" });

    const cabang = perush[0].perush_kode; // Pastikan pakai "F02" (atau sesuai DB)

    // 2. Ambil parameter dari query string
    const { start, end, groupBy } = req.query;

    // 3. Panggil service (Jangan lupa kirim groupBy agar dashboard bisa filter hari/minggu/bulan)
    const data = await service.getChartData(cabang, start, end, groupBy);

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getData, getChart };
