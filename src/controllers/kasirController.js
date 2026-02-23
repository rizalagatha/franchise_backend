const kasirService = require("../services/kasirService");

const getHeaders = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ message: "Filter tanggal diperlukan." });
    }
    const data = await kasirService.fetchHeaders(startDate, endDate);
    res.json(data);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Gagal memuat data invoice.", error: error.message });
  }
};

const getDetails = async (req, res) => {
  try {
    const { nomor } = req.params;
    const data = await kasirService.fetchDetails(nomor);
    res.json(data);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Gagal memuat detail invoice.", error: error.message });
  }
};

const removeInvoice = async (req, res) => {
  try {
    const { nomor } = req.params;
    const result = await kasirService.deleteInvoice(nomor);
    res.json(result);
  } catch (error) {
    res
      .status(500)
      .json({ message: error.message || "Gagal menghapus invoice." });
  }
};

/**
 * Load data untuk form edit
 */
const getFormData = async (req, res) => {
  try {
    const { nomor } = req.params;
    const data = await kasirService.loadFormData(nomor);
    res.json(data);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

/**
 * Simpan Data Invoice
 */
const saveData = async (req, res) => {
  try {
    const { header, items, isNew } = req.body;
    const userKode = req.user.kode;

    if (!header.kdCus || items.length === 0) {
      return res.status(400).json({ message: "Data tidak lengkap." });
    }

    const result = await kasirService.saveInvoice(
      header,
      items,
      userKode,
      isNew,
    );
    res.status(isNew ? 201 : 200).json(result);
  } catch (error) {
    res
      .status(500)
      .json({ message: error.message || "Gagal menyimpan invoice." });
  }
};

const getPrintData = async (req, res) => {
  try {
    const { nomor } = req.params;
    const userNama = req.user.nama;
    const data = await kasirService.getPrintDataKasir(nomor, userNama);
    res.json(data);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

const getPrintDataA4 = async (req, res) => {
  try {
    const data = await kasirService.getPrintDataA4(req.params.nomor);
    res.json(data);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

module.exports = {
  getHeaders,
  getDetails,
  removeInvoice,
  getFormData,
  saveData,
  getPrintData,
  getPrintDataA4,
};
