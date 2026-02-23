const koreksiStokService = require("../services/koreksiStokService");

const getHeaders = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ message: "Filter tanggal (startDate, endDate) diperlukan." });
    }

    // Kirim cabang ke service
    const headers = await koreksiStokService.fetchHeaders(startDate, endDate);
    res.json(headers);
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil data header koreksi",
      error: error.message,
    });
  }
};

const getDetails = async (req, res) => {
  try {
    const { nomor } = req.params;
    const details = await koreksiStokService.fetchDetails(nomor);
    res.json(details);
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil data detail koreksi",
      error: error.message,
    });
  }
};

const deleteKoreksiData = async (req, res) => {
  try {
    const { nomor } = req.params;
    const result = await koreksiStokService.deleteKoreksi(nomor);
    res.json(result);
  } catch (error) {
    if (error.message === "Nomor koreksi tidak ditemukan.") {
      res.status(404).json({ message: error.message });
    } else {
      res
        .status(500)
        .json({ message: error.message || "Gagal menghapus data." });
    }
  }
};

/**
 * Load data untuk form edit
 */
const getFormData = async (req, res) => {
  try {
    const { nomor } = req.params;
    const data = await koreksiStokService.loadFormData(nomor);
    res.json(data);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

/**
 * Simpan data (Baru/Ubah)
 */
const saveData = async (req, res) => {
  try {
    const { header, items, isNew } = req.body;
    const userKode = req.user.kode;
    // Hapus userCabang
    if (!header || !header.tanggal) {
      return res.status(400).json({ message: "Data header tidak lengkap." });
    }
    // Panggil service TANPA userCabang
    const result = await koreksiStokService.saveKoreksi(
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
 * Lookup Barcode (Scan/F1)
 */
const getBarcodeLookup = async (req, res) => {
  try {
    const { barcode, tanggal, nomor } = req.query; // Ambil parameter

    if (!barcode || !tanggal) {
      return res
        .status(400)
        .json({ message: "Barcode dan tanggal diperlukan." });
    }

    const result = await koreksiStokService.lookupBarcodeKoreksi(
      barcode,
      tanggal,
      nomor
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/**
 * Lookup F1 untuk form (Sesuai Delphi TfrmKor.cxGrdMasterEditKeyDown)
 */
const getF1Lookup = async (req, res) => {
  try {
    const { term, page = 1, itemsPerPage = 10, tanggal } = req.query;
    if (!tanggal) {
      return res
        .status(400)
        .json({ message: "Tanggal diperlukan untuk cek stok." });
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(itemsPerPage, 10);

    const result = await koreksiStokService.lookupF1Koreksi(
      term,
      tanggal,
      pageNum,
      limitNum
    );
    res.json(result); // Kirim { items, total }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Ambil data untuk cetak
 */
const getPrintData = async (req, res) => {
  try {
    const { nomor } = req.params;
    const userNama = req.user.nama; // Ambil nama dari token
    const data = await koreksiStokService.getPrintData(nomor, userNama);
    res.json(data);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

module.exports = {
  getHeaders,
  getDetails,
  deleteKoreksiData,
  getFormData, // <-- Baru
  saveData, // <-- Baru
  getBarcodeLookup, // <-- Baru
  getPrintData, // <-- Baru
  getF1Lookup,
};
