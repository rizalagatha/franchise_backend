const barcodeService = require("../services/barcodeService");

const getHeaders = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    // Lempar req.db ke service
    const headers = await barcodeService.fetchHeaders(
      req.db,
      startDate,
      endDate,
    );
    res.json(headers);
  } catch (error) {
    res
      .status(500)
      .json({
        message: "Gagal mengambil data header barcode",
        error: error.message,
      });
  }
};

const getDetails = async (req, res) => {
  try {
    const { nomor } = req.params;
    const details = await barcodeService.fetchDetails(req.db, nomor);
    res.json(details);
  } catch (error) {
    res
      .status(500)
      .json({
        message: "Gagal mengambil data detail barcode",
        error: error.message,
      });
  }
};

const deleteBarcodeData = async (req, res) => {
  try {
    const { nomor } = req.params;
    const result = await barcodeService.deleteBarcode(req.db, nomor);
    res.json(result);
  } catch (error) {
    if (error.message === "Nomor barcode tidak ditemukan.") {
      res.status(404).json({ message: error.message });
    } else {
      res
        .status(500)
        .json({ message: error.message || "Gagal menghapus data barcode." });
    }
  }
};

const lookupItem = async (req, res) => {
  try {
    const { term, page = 1, itemsPerPage = 10 } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(itemsPerPage, 10);

    if (isNaN(pageNum) || pageNum < 1 || isNaN(limitNum) || limitNum < 1) {
      return res
        .status(400)
        .json({ message: "Parameter paginasi tidak valid." });
    }

    const result = await barcodeService.searchBarcodeLookupItems(
      req.db,
      term,
      pageNum,
      limitNum,
    );
    res.json(result);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Gagal mencari barang", error: error.message });
  }
};

const saveData = async (req, res) => {
  try {
    const { header, items, isNew } = req.body;
    const userKode = req.user.kode;

    if (!header || !header.tanggal || !items) {
      return res
        .status(400)
        .json({ message: "Data header atau detail tidak lengkap." });
    }

    const result = await barcodeService.saveBarcodeData(
      req.db,
      header,
      items,
      userKode,
      isNew,
    );
    res.status(isNew ? 201 : 200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message || "Gagal menyimpan data." });
  }
};

const getFormData = async (req, res) => {
  try {
    const { nomor } = req.params;
    const data = await barcodeService.loadFormData(req.db, nomor);
    res.json(data);
  } catch (error) {
    res
      .status(404)
      .json({ message: error.message || "Gagal memuat data form." });
  }
};

const getVarianDetails = async (req, res) => {
  try {
    const { kode } = req.params;
    const details = await barcodeService.getVarianDetailsByKode(req.db, kode);
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
