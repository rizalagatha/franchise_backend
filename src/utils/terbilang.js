function terbilangInt(n) {
  const angka = [
    "",
    "Satu",
    "Dua",
    "Tiga",
    "Empat",
    "Lima",
    "Enam",
    "Tujuh",
    "Delapan",
    "Sembilan",
    "Sepuluh",
    "Sebelas",
  ];

  let hasil = "";

  if (n < 12) {
    hasil = angka[n];
  } else if (n < 20) {
    hasil = terbilangInt(n - 10) + " Belas";
  } else if (n < 100) {
    hasil = terbilangInt(Math.floor(n / 10)) + " Puluh " + terbilangInt(n % 10);
  } else if (n < 200) {
    hasil = "Seratus " + terbilangInt(n - 100);
  } else if (n < 1000) {
    hasil =
      terbilangInt(Math.floor(n / 100)) + " Ratus " + terbilangInt(n % 100);
  } else if (n < 2000) {
    hasil = "Seribu " + terbilangInt(n - 1000);
  } else if (n < 1000000) {
    hasil =
      terbilangInt(Math.floor(n / 1000)) + " Ribu " + terbilangInt(n % 1000);
  } else if (n < 1000000000) {
    hasil =
      terbilangInt(Math.floor(n / 1000000)) +
      " Juta " +
      terbilangInt(n % 1000000);
  }

  return hasil.trim();
}

// Wrapper
function terbilang(nominal) {
  const n = Math.floor(nominal);

  if (n === 0) return "Nol Rupiah";

  return terbilangInt(n) + " Rupiah";
}

module.exports = terbilang;
