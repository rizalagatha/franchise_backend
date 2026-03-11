const fskService = require("../services/fskService");
const { pool } = require("../config/database");

const getHeaders = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // 1. Ambil Kode Cabang RESMI dari tperusahaan (Agar sinkron F02)
    const [perushRows] = await pool.query(
      "SELECT perush_kode FROM tperusahaan LIMIT 1",
    );
    const branchCode = perushRows[0]?.perush_kode || "F01";

    // 2. Kirim branchCode ke service
    const headers = await fskService.fetchHeaders(
      startDate,
      endDate,
      branchCode, // <--- Ini yang tadi ketinggalan
    );

    res.json(headers);
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil data browse FSK",
      error: error.message,
    });
  }
};

const getDetails = async (req, res) => {
  try {
    const { nomor } = req.params;
    const data = await fskService.fetchDetails(nomor);
    res.json(data);
  } catch (error) {
    res.status(500).json({
      message: "Gagal memuat detail setoran kasir.",
      error: error.message,
    });
  }
};

const removeFSK = async (req, res) => {
  try {
    const { nomor } = req.params;
    const result = await fskService.deleteFSK(nomor);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      message: error.message || "Gagal menghapus data setoran.",
    });
  }
};

/**
 * Load data untuk form edit FSK
 */
const getFormData = async (req, res) => {
  try {
    const { nomor } = req.params;
    // Asumsi service loadFormData sudah diimplementasikan mirip Kasir
    const data = await fskService.loadFormData(nomor);
    res.json(data);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

/**
 * Simpan Data Setoran Kasir (Baru/Ubah)
 */
const saveNewFSK = async (req, res) => {
  try {
    // FIX: Ambil detail1 dan detail2 sesuai payload dari Vue
    const { header, detail1, detail2, isNew } = req.body;
    const userKode = req.user.kode;

    if (!header.fsk_tanggal || !detail2 || detail2.length === 0) {
      return res
        .status(400)
        .json({ message: "Data tidak lengkap atau rincian kosong." });
    }

    const result = await fskService.saveFSK(
      header,
      detail1,
      detail2,
      userKode,
      isNew,
    );
    res.status(isNew ? 201 : 200).json(result);
  } catch (error) {
    res
      .status(500)
      .json({ message: error.message || "Gagal menyimpan data setoran." });
  }
};

const getRekap = async (req, res) => {
  try {
    const { tanggal, kasir } = req.query;
    const branchCode = req.user.kode.substring(0, 3);

    if (!tanggal || !kasir) {
      return res.status(400).json({ message: "Tanggal dan Kasir diperlukan." });
    }

    const data = await fskService.generateRekapData(tanggal, kasir, branchCode);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Mengambil data lengkap untuk cetak Laporan FSK (A4 Landscape)
 */
const getPrintData = async (req, res) => {
  try {
    const { nomor } = req.params;

    // Memanggil service yang sudah kita buat sebelumnya
    const data = await fskService.getPrintDataFSK(nomor);

    res.json(data);
  } catch (error) {
    // Jika data tidak ditemukan, kirim status 404
    res.status(404).json({ message: error.message });
  }
};

module.exports = {
  getHeaders,
  getDetails,
  removeFSK,
  getFormData,
  saveNewFSK,
  getRekap,
  getPrintData,
};
