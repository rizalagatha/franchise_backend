const setoranService = require("../services/setoranPembayaranService");

const getHeaders = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    // HAPUS: const branchCode = req.user.kode.substring(0, 3);

    const data = await setoranService.fetchHeaders(
      startDate,
      endDate,
      // branchCode tidak perlu dikirim lagi dari sini
    );
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getDetails = async (req, res) => {
  try {
    const { nomor } = req.params;
    const data = await setoranService.fetchDetails(nomor);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const removeData = async (req, res) => {
  try {
    const { nomor } = req.params;
    const result = await setoranService.deleteSetoran(nomor);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getUnpaidInvoices = async (req, res) => {
  try {
    const { cusKode } = req.params;
    const data = await setoranService.fetchUnpaidInvoices(cusKode);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const saveData = async (req, res) => {
  try {
    const { header, details, isNew } = req.body;
    const userKode = req.user.kode;
    const result = await setoranService.saveSetoran(
      header,
      details,
      userKode,
      isNew,
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getFormData = async (req, res) => {
  try {
    const data = await setoranService.fetchOneSetoran(req.params.nomor);
    res.json(data);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

const printData = async (req, res) => {
  try {
    const data = await setoranService.getPrintData(req.params.nomor);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getHeaders,
  getDetails,
  removeData,
  getUnpaidInvoices,
  saveData,
  getFormData,
  printData,
};
