const priceListService = require("../services/priceListService");

/**
 * Mengambil semua data price list.
 */
const getAllPriceListData = async (req, res) => {
  try {
    const data = await priceListService.fetchAllPriceListData();
    res.json(data);
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil data price list",
      error: error.message,
    });
  }
};

/**
 * Memperbarui harga barang.
 */
const updateItemPrice = async (req, res) => {
  try {
    const { kode, ukuran } = req.params; // Ambil kode & ukuran dari URL
    const { hpp, harga } = req.body; // Ambil hpp & harga baru dari body
    const userKode = req.user.kode; // Ambil user dari token (via middleware)

    // Validasi input sederhana
    if (
      hpp === undefined ||
      harga === undefined ||
      isNaN(parseFloat(hpp)) ||
      isNaN(parseFloat(harga))
    ) {
      return res
        .status(400)
        .json({ message: "HPP dan Harga Jual harus diisi dengan angka." });
    }

    const result = await priceListService.updatePrice(
      kode,
      ukuran,
      parseFloat(hpp),
      parseFloat(harga),
      userKode
    );
    res.json(result);
  } catch (error) {
    res
      .status(500)
      .json({ message: error.message || "Gagal memperbarui harga." });
  }
};

/**
 * Mengambil riwayat harga jual.
 */
const getHistory = async (req, res) => {
  try {
    const { kode, ukuran } = req.params;
    const history = await priceListService.getPriceHistory(kode, ukuran);
    res.json(history);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Gagal mengambil riwayat harga", error: error.message });
  }
};

module.exports = {
  getAllPriceListData,
  updateItemPrice,
  getHistory,
};
