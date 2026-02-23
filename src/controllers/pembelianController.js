const pembelianService = require("../services/pembelianService");

const getHeaders = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ message: "Filter tanggal (startDate, endDate) diperlukan." });
    }
    const headers = await pembelianService.fetchHeaders(startDate, endDate);
    res.json(headers);
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil data header pembelian",
      error: error.message,
    });
  }
};

const getDetails = async (req, res) => {
  try {
    const { nomor } = req.params;
    const details = await pembelianService.fetchDetails(nomor);
    res.json(details);
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil data detail pembelian",
      error: error.message,
    });
  }
};

const deletePembelianData = async (req, res) => {
  try {
    const { nomor } = req.params;
    const result = await pembelianService.deletePembelian(nomor);
    res.json(result);
  } catch (error) {
    if (error.message === "Nomor pembelian tidak ditemukan.") {
      res.status(404).json({ message: error.message });
    } else {
      res
        .status(500)
        .json({ message: error.message || "Gagal menghapus data." });
    }
  }
};

/**
 * 8. Load data untuk form edit
 */
const getFormData = async (req, res) => {
  try {
    const { nomor } = req.params;
    const data = await pembelianService.loadFormData(nomor);
    res.json(data);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

/**
 * 9. Simpan data (Baru/Ubah)
 */
const saveData = async (req, res) => {
  try {
    const { header, items, isNew } = req.body;
    const userKode = req.user.kode;
    if (!header || !header.tanggal || !items) {
      return res
        .status(400)
        .json({ message: "Data header atau detail tidak lengkap." });
    }
    const result = await pembelianService.savePembelian(
      header,
      items,
      userKode,
      isNew
    );
    res.status(isNew ? 201 : 200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message || "Gagal menyimpan data." });
  }
};

/**
 * 10. Lookup Barcode (Scan)
 */
const getBarcodeLookup = async (req, res) => {
  try {
    const { barcode } = req.params;
    const result = await pembelianService.lookupBarcode(barcode);
    res.status(200).json(result);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

/**
 * 11. Lookup Invoice (Eksternal)
 */
const getInvoiceLookup = async (req, res) => {
  try {
    const { nomor } = req.params;
    const result = await pembelianService.lookupInvoice(nomor);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message }); // 400 Bad Request
  }
};

module.exports = {
  getHeaders,
  getDetails,
  deletePembelianData,
  getFormData,
  saveData,
  getBarcodeLookup,
  getInvoiceLookup,
};
