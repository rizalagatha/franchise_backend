const laporanPenjualanService = require("../services/laporanPenjualanService");

const getLaporanPenjualan = async (req, res) => {
  try {
    const { startDate, endDate, cabang, groupBy } = req.query;

    if (!startDate || !endDate || !cabang || !groupBy) {
      return res.status(400).json({
        message:
          "Parameter startDate, endDate, cabang, dan groupBy wajib diisi.",
      });
    }

    const data = await laporanPenjualanService.getLaporanPenjualanData(
      startDate,
      endDate,
      cabang,
      groupBy,
    );
    res.json(data);
  } catch (error) {
    console.error("Error getLaporanPenjualan:", error);
    res.status(500).json({ message: "Gagal memuat laporan penjualan." });
  }
};

module.exports = {
  getLaporanPenjualan,
};
