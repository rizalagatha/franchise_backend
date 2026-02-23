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

const app = express();
// Gunakan port dari .env, atau fallback ke 5001
const port = process.env.PORT || 5001;

app.use(cors());
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
