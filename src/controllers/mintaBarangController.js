const mintaBarangService = require("../services/mintaBarangService.js");

const getHeaders = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ message: "Filter tanggal diperlukan." });
    }
    const data = await mintaBarangService.fetchHeaders(startDate, endDate);
    res.json(data);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Gagal memuat data permintaan.", error: error.message });
  }
};

const getDetails = async (req, res) => {
  try {
    const { nomor } = req.params;
    const data = await mintaBarangService.fetchDetails(nomor);
    res.json(data);
  } catch (error) {
    res.status(500).json({
      message: "Gagal memuat detail permintaan.",
      error: error.message,
    });
  }
};

const removeRequest = async (req, res) => {
  try {
    const { nomor } = req.params;
    const result = await mintaBarangService.deleteRequest(nomor);
    res.json(result);
  } catch (error) {
    res
      .status(500)
      .json({ message: error.message || "Gagal menghapus permintaan." });
  }
};

const getFormData = async (req, res) => {
  try {
    const { nomor } = req.params;
    const data = await mintaBarangService.loadFormData(nomor);
    res.json(data);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

const saveData = async (req, res) => {
  try {
    const { header, items, isNew } = req.body;
    const userKode = req.user.kode;

    if (items.length === 0) {
      return res
        .status(400)
        .json({ message: "Detail barang tidak boleh kosong." });
    }

    const result = await mintaBarangService.saveRequest(
      header,
      items,
      userKode,
      isNew,
    );
    res.status(isNew ? 201 : 200).json(result);
  } catch (error) {
    res
      .status(500)
      .json({ message: error.message || "Gagal menyimpan permintaan." });
  }
};

const lookupBarang = async (req, res) => {
  try {
    // Tangkap keyword/term beserta page dan itemsPerPage dari query string Vue
    const { keyword, term, page = 1, itemsPerPage = 15 } = req.query;
    const searchKeyword = keyword || term || "";

    const data = await mintaBarangService.searchBarangPusat(
      searchKeyword,
      page,
      itemsPerPage,
    );
    res.json(data);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Gagal mencari barang pusat.", error: error.message });
  }
};

const getPrintData = async (req, res) => {
  try {
    const data = await mintaBarangService.getPrintData(
      req.params.nomor,
      req.user.nama,
    );
    res.json(data);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

module.exports = {
  getHeaders,
  getDetails,
  removeRequest,
  getFormData,
  saveData,
  lookupBarang,
  getPrintData, // <--- Jangan lupa ekspor fungsi baru ini
};
