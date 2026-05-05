const standartStokService = require("../services/standartStokService");

const getStandartStok = async (req, res) => {
  try {
    // Kirim req.db ke service
    const data = await standartStokService.fetchStandartStok(req.db);
    res.json(data);
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil data standar stok",
      error: error.message,
    });
  }
};

const updateBufferData = async (req, res) => {
  try {
    const { kode, ukuran, minBuffer, maxBuffer } = req.body;

    if (!kode || !ukuran) {
      return res
        .status(400)
        .json({ message: "Kode barang dan ukuran diperlukan." });
    }

    // Kirim req.db ke service
    const result = await standartStokService.updateBuffer(
      req.db,
      kode,
      ukuran,
      minBuffer,
      maxBuffer,
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  getStandartStok,
  updateBufferData,
};
