const rekeningService = require("../services/rekeningService");

/**
 * Mengambil data header rekening (untuk browse).
 */
const getHeaders = async (req, res) => {
  try {
    const headers = await rekeningService.fetchHeaders();
    res.json(headers);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Gagal mengambil data rekening", error: error.message });
  }
};

/**
 * Menghapus rekening.
 */
const deleteRekeningData = async (req, res) => {
  try {
    const { nomor } = req.params;
    const result = await rekeningService.deleteRekening(nomor);
    res.json(result);
  } catch (error) {
    if (error.message === "No Rekening tidak ditemukan.") {
      res.status(404).json({ message: error.message });
    } else {
      res
        .status(500)
        .json({ message: error.message || "Gagal menghapus data." });
    }
  }
};

/**
 * (BARU) Mengambil detail satu rekening untuk form dialog.
 * Dipakai saat blur field No. Rekening atau saat klik Ubah.
 */
const getRekening = async (req, res) => {
  try {
    const { nomor } = req.params;
    const data = await rekeningService.getRekeningById(nomor);
    // Kirim null jika tidak ada (untuk mode 'Baru'), bukan error 404
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

/**
 * (BARU) Menyimpan data (Create/Update).
 * Dipakai oleh dialog simpan.
 */
const saveData = async (req, res) => {
  try {
    // 'data' adalah object { rek_nomor, ... }, 'isNew' adalah boolean
    const { data, isNew } = req.body;
    const result = await rekeningService.saveRekening(data, isNew);
    res.status(isNew ? 201 : 200).json(result);
  } catch (error) {
    // Kirim 400 jika error validasi (misal: "No. Rekening kosong")
    res.status(400).json({ message: error.message });
  }
};

/**
 * (BARU) Lookup F1 untuk dialog form.
 */
const lookup = async (req, res) => {
  try {
    const { term, page = 1, itemsPerPage = 10 } = req.query;
    // Parse parameter (pure JS)
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(itemsPerPage, 10);

    if (isNaN(pageNum) || pageNum < 1 || isNaN(limitNum) || limitNum < 1) {
      return res
        .status(400)
        .json({ message: "Parameter paginasi tidak valid." });
    }

    const result = await rekeningService.lookupRekeningF1(
      term,
      pageNum,
      limitNum
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Ekspor semua fungsi yang benar
module.exports = {
  getHeaders,
  deleteRekeningData,
  getRekening, // <-- Ditambahkan
  saveData, // <-- Ditambahkan
  lookup, // <-- Ditambahkan
  // getDetails,      // <-- Dihapus
};
