const customerService = require("../services/customerService");

/**
 * Mengambil semua data customer.
 */
const getAllCustomers = async (req, res) => {
  try {
    const customers = await customerService.fetchAllCustomers();
    res.json(customers);
  } catch (error) {
    console.error("Error fetching customers:", error);
    res
      .status(500)
      .json({ message: "Gagal mengambil data customer", error: error.message });
  }
};

/**
 * Mengambil detail satu customer.
 */
const getCustomer = async (req, res) => {
  try {
    const customerCode = req.params.kode; // Ambil kode dari URL
    const customer = await customerService.getCustomerById(customerCode);
    res.json(customer);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

/**
 * Membuat customer baru.
 */
const createNewCustomer = async (req, res) => {
  try {
    const userKode = req.user.kode; // Dari verifyToken
    const result = await customerService.createCustomer(req.body, userKode);
    res.status(201).json(result); // Status 201 Created
  } catch (error) {
    res.status(400).json({ message: error.message }); // Status 400 Bad Request
  }
};

/**
 * Memperbarui customer yang ada.
 */
const updateExistingCustomer = async (req, res) => {
  try {
    const customerCode = req.params.kode;
    const userKode = req.user.kode;
    const result = await customerService.updateCustomer(
      customerCode,
      req.body,
      userKode
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  getAllCustomers,
  getCustomer,
  createNewCustomer,
  updateExistingCustomer,
};
