const barcodeService = require("../services/barcodeService");

/**
 * Mengambil data header barcode.
 */
const getHeaders = async (req, res) => {
  try {
    // Ambil startDate dan endDate dari query string
    const { startDate, endDate } = req.query;
    const headers = await barcodeService.fetchHeaders(startDate, endDate);
    res.json(headers);
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil data header barcode",
      error: error.message,
    });
  }
};

/**
 * Mengambil data detail barcode.
 */
const getDetails = async (req, res) => {
  try {
    const { nomor } = req.params; // Ambil nomor dari URL
    const details = await barcodeService.fetchDetails(nomor);
    res.json(details);
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil data detail barcode",
      error: error.message,
    });
  }
};

/**
 * Menghapus data barcode (header dan detail).
 */
const deleteBarcodeData = async (req, res) => {
  try {
    const { nomor } = req.params;
    const result = await barcodeService.deleteBarcode(nomor);
    res.json(result);
  } catch (error) {
    // Kirim status 404 jika error karena tidak ditemukan
    if (error.message === "Nomor barcode tidak ditemukan.") {
      res.status(404).json({ message: error.message });
    } else {
      res
        .status(500)
        .json({ message: error.message || "Gagal menghapus data barcode." });
    }
  }
};

/**
 * Mencari barang untuk lookup.
 */
const lookupItem = async (req, res) => {
  try {
    // Ambil term, page, itemsPerPage dari query string
    const { term, page = 1, itemsPerPage = 10 } = req.query; // Default page 1, 10 items

    // Pastikan page dan itemsPerPage adalah angka
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(itemsPerPage, 10);

    if (isNaN(pageNum) || pageNum < 1 || isNaN(limitNum) || limitNum < 1) {
      return res
        .status(400)
        .json({ message: "Parameter paginasi tidak valid." });
    }

    // Panggil service dengan parameter lengkap
    const result = await barcodeService.searchBarcodeLookupItems(
      term,
      pageNum,
      limitNum
    );
    res.json(result); // Kirim { items, total }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Gagal mencari barang", error: error.message });
  }
};

/**
 * Menyimpan data barcode (Create/Update).
 */
const saveData = async (req, res) => {
  try {
    // Ambil header, items, dan isNew dari body
    const { header, items, isNew } = req.body;
    const userKode = req.user.kode;

    // Validasi dasar
    if (!header || !header.tanggal || !items) {
      return res
        .status(400)
        .json({ message: "Data header atau detail tidak lengkap." });
    }

    const result = await barcodeService.saveBarcodeData(
      header,
      items,
      userKode,
      isNew
    );
    res.status(isNew ? 201 : 200).json(result); // 201 Created atau 200 OK
  } catch (error) {
    res.status(500).json({ message: error.message || "Gagal menyimpan data." });
  }
};

/**
 * Mengambil data untuk form edit.
 */
const getFormData = async (req, res) => {
  try {
    const { nomor } = req.params;
    const data = await barcodeService.loadFormData(nomor);
    res.json(data);
  } catch (error) {
    res
      .status(404)
      .json({ message: error.message || "Gagal memuat data form." });
  }
};

/**
 * (BARU) Mengambil SEMUA detail varian (ukuran, barcode, harga)
 * berdasarkan KODE barang.
 */
const getVarianDetails = async (req, res) => {
  try {
    const { kode } = req.params; // Ambil kode dari URL
    const details = await barcodeService.getVarianDetailsByKode(kode);
    res.json(details);
  } catch (error) {
    res
      .status(404)
      .json({ message: error.message || "Gagal mengambil detail varian." });
  }
};

module.exports = {
  getHeaders,
  getDetails,
  deleteBarcodeData,
  lookupItem,
  saveData,
  getFormData,
  getVarianDetails,
};
