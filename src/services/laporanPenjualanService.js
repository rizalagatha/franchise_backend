const { pool } = require("../config/database");

const getLaporanPenjualanData = async (startDate, endDate, cabang, groupBy) => {
  let selectClause = "";
  let groupClause = "";

  // SAMAKAN ALIAS DENGAN KEY DI VUE (Kode, Invoice, KdCus, dll)
  if (groupBy === "tanggal") {
    selectClause =
      "? AS Kode, DATE_FORMAT(h.inv_tanggal, '%d-%m-%Y') AS Tanggal, '' AS Invoice, '' AS KdCus, '' AS Customer,";
    groupClause = "GROUP BY h.inv_tanggal";
  } else if (groupBy === "invoice") {
    selectClause = `? AS Kode, h.inv_nomor AS Invoice, DATE_FORMAT(h.inv_tanggal, '%d-%m-%Y') AS Tanggal, 
                    h.inv_cus_kode AS KdCus, s.cus_nama AS Customer,`;
    groupClause = "GROUP BY h.inv_nomor";
  } else {
    // Customer
    selectClause = `h.inv_cus_kode AS KdCus, s.cus_nama AS Nama, s.cus_alamat AS Alamat, 
                    s.cus_kota AS Kota, '' AS Kode, '' AS Tanggal,`;
    groupClause = "GROUP BY h.inv_cus_kode";
  }

  const query = `
    SELECT 
      ${selectClause}
      SUM(COALESCE(n.subtotal, 0) - COALESCE(h.inv_disc, 0) + COALESCE(h.inv_bkrm, 0)) AS Nominal,
      SUM(COALESCE(n.total_hpp, 0)) AS Hpp,
      SUM(COALESCE(n.subtotal, 0) - COALESCE(h.inv_disc, 0) - COALESCE(n.total_hpp, 0)) AS Laba,
      SUM(COALESCE(h.inv_pundiamal, 0)) AS PundiAmal
    FROM tinv_hdr h
    INNER JOIN (
      SELECT invd_inv_nomor, 
             SUM(invd_jumlah * (invd_harga - invd_diskon)) AS subtotal,
             SUM(invd_jumlah * invd_hpp) AS total_hpp
      FROM tinv_dtl
      GROUP BY invd_inv_nomor
    ) n ON n.invd_inv_nomor = h.inv_nomor
    LEFT JOIN tcustomer s ON s.cus_kode = h.inv_cus_kode
    WHERE h.inv_tanggal BETWEEN ? AND ?
      AND LEFT(h.inv_nomor, 3) = ?
    ${groupClause}
    ORDER BY h.inv_tanggal DESC, h.inv_nomor DESC
  `;

  // Binding parameter sesuai urutan tanda tanya (?) di query
  // Jika customer, tidak butuh param 'cabang' di paling depan SELECT
  const queryParams =
    groupBy === "customer"
      ? [startDate, endDate, cabang]
      : [cabang, startDate, endDate, cabang];

  const [rows] = await pool.query(query, queryParams);
  return rows;
};

module.exports = { getLaporanPenjualanData };
