const perusahaanService = require("../services/perusahaanService");

const getPerusahaan = async (req, res) => {
  try {
    const data = await perusahaanService.getPerusahaanList();
    res.json(data);
  } catch (error) {
    console.error("Error getPerusahaan:", error);
    res.status(500).json({ message: "Gagal memuat data perusahaan." });
  }
};

module.exports = {
  getPerusahaan,
};
