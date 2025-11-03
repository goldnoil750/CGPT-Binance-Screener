import fetch from "node-fetch";

const symbol = "BTCUSDT"; // try BTCUSDT.P later
const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=30m&limit=3`;

console.log("Fetching:", url);

const res = await fetch(url, {
  headers: { "User-Agent": "Mozilla/5.0", "Accept-Encoding": "identity" }
});

const text = await res.text();
console.log("---- RAW RESPONSE START ----");
console.log(text.slice(0, 400)); // print first 400 chars
console.log("---- RAW RESPONSE END ----");

try {
  const data = JSON.parse(text);
  console.log("✅ Parsed successfully:", data.length, "rows");
} catch (err) {
  console.error("❌ JSON parse failed:", err.message);
}
