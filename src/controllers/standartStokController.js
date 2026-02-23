const standartStokService = require("../services/standartStokService");

const getStandartStok = async (req, res) => {
  try {
    const data = await standartStokService.fetchStandartStok();
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

    const result = await standartStokService.updateBuffer(
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
