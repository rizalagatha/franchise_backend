// src/index.js

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { testConnection } = require("./src/config/database");
const authRoutes = require("./src/routes/authRoutes");
const healthRoutes = require("./src/routes/healthRoutes");
const customerRoutes = require("./src/routes/customerRoutes");
const priceListRoutes = require("./src/routes/priceListRoutes");
const barcodeRoutes = require("./src/routes/barcodeRoutes");
const rekeningRoutes = require("./src/routes/rekeningRoutes");
const pembelianRoutes = require("./src/routes/pembelianRoutes");
const koreksiStokRoutes = require("./src/routes/koreksiStokRoutes");
const standartStokRoutes = require("./src/routes/standartStokRoutes");
const kasirRoutes = require("./src/routes/kasirRoutes");
const fskRoutes = require("./src/routes/fskRoutes");
const userRoutes = require("./src/routes/userRoutes");
const setoranPembayaranRoutes = require("./src/routes/setoranPembayaranRoutes");
const laporanStokRoutes = require("./src/routes/laporanStokRoutes");
const laporanPenjualanRoutes = require("./src/routes/laporanPenjualanRoutes");
const perusahaanRoutes = require("./src/routes/perusahaanRoutes");
const dashboardRoutes = require("./src/routes/dashboardRoutes");
const mintaBarangRoutes = require("./src/routes/mintaBarangRoutes");

const app = express();
// Gunakan port dari .env, atau fallback ke 5001
const port = process.env.PORT || 5001;

// ==========================================
// PENGATURAN CORS WHITELIST
// ==========================================
const whitelist = [
  "http://localhost:3000", // Untuk testing Vue/Nuxt di lokal
  "http://localhost:5173", // Untuk testing Vite di lokal
  "https://priority.kaosanofficial.com", // GANTI dengan domain frontend asli Mas Rizal nanti
  "https://www.priority.kaosanofficial.com", // Tambahkan variasi www jika perlu
];

const corsOptions = {
  origin: function (origin, callback) {
    // Izinkan request jika origin ada di whitelist,
    // ATAU jika !origin (biasanya request dari Postman/Insomnia/Mobile App)
    if (!origin || whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`[CORS Blocked] Origin tidak diizinkan: ${origin}`); // Biar kelihatan di log hostinger kalau ada yg ditolak
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true, // Opsional: Aktifkan jika frontend mengirim cookies/session
};

// Gunakan konfigurasi CORS yang baru
app.use(cors(corsOptions));
// ==========================================

app.use(express.json());
app.disable("etag"); // matikan ETag global

// Pasang di global level, sebelum semua routes
app.use((req, res, next) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, private",
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/price-list", priceListRoutes);
app.use("/api/barcodes", barcodeRoutes);
app.use("/api/rekening", rekeningRoutes);
app.use("/api/pembelian", pembelianRoutes);
app.use("/api/koreksi-stok", koreksiStokRoutes);
app.use("/api/standart-stok", standartStokRoutes);
app.use("/api/kasir", kasirRoutes);
app.use("/api/fsk", fskRoutes);
app.use("/api/users", userRoutes);
app.use("/api/setoran-pembayaran", setoranPembayaranRoutes);
app.use("/api/laporan-stok", laporanStokRoutes);
app.use("/api/laporan-penjualan", laporanPenjualanRoutes);
app.use("/api/perusahaan", perusahaanRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/minta-barang-kaosan", mintaBarangRoutes);

app.get("/", (req, res) => {
  res.send("Franchise Backend (JS) running!");
});

app.listen(port, () => {
  console.log(
    `[server]: Franchise backend (JS) running at http://localhost:${port}`,
  );

  // Tes koneksi DB saat server menyala
  testConnection();
});
