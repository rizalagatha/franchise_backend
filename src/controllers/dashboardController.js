const service = require("../services/dashboardService");

const getData = async (req, res) => {
  try {
    // 1. Ambil kode cabang resmi dari tperusahaan menggunakan req.db (DB Cabang)
    const [perush] = await req.db.query(
      "SELECT perush_kode FROM tperusahaan LIMIT 1",
    );
    if (perush.length === 0)
      return res.status(404).json({ message: "Setting perusahaan belum ada" });

    const cabang = perush[0].perush_kode; // Contoh: "F02"
    const today = new Date().toISOString().split("T")[0];

    // 2. Jalankan query dashboard dengan melempar req.db
    const [stats, actions, recent, lowStock, target] = await Promise.all([
      service.getStats(req.db, cabang, today),
      service.getPendingActions(req.db, cabang),
      service.getRecentTransactions(req.db, cabang),
      service.getLowStockDetails(req.db, cabang),
      service.getSalesTarget(req.db, cabang),
    ]);

    res.json({ stats, actions, recent, lowStock, target, cabang });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getChart = async (req, res) => {
  try {
    // 1. Ambil kode cabang resmi dari req.db
    const [perush] = await req.db.query(
      "SELECT perush_kode FROM tperusahaan LIMIT 1",
    );

    if (perush.length === 0)
      return res.status(404).json({ message: "Setting perusahaan belum ada" });

    const cabang = perush[0].perush_kode;

    // 2. Ambil parameter dari query string
    const { start, end, groupBy } = req.query;

    // 3. Panggil service dengan parameter db
    const data = await service.getChartData(
      req.db,
      cabang,
      start,
      end,
      groupBy,
    );

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getData, getChart };
