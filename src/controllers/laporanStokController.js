const laporanStokService = require("../services/laporanStokService");

const getLaporanStok = async (req, res) => {
  try {
    const { tanggal, cabang, tampilKosong } = req.query;

    // Validasi parameter wajib
    if (!tanggal || !cabang) {
      return res
        .status(400)
        .json({ message: "Tanggal dan cabang harus diisi" });
    }

    // Panggil service
    const data = await laporanStokService.getLaporanStokData(
      tanggal,
      cabang,
      tampilKosong,
    );
    res.json(data);
  } catch (error) {
    console.error("Error getLaporanStok:", error);
    res.status(500).json({ message: "Gagal memuat laporan stok." });
  }
};

module.exports = {
  getLaporanStok,
};
