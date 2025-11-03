// test-binance.js
import fetch from "node-fetch";  // or remove this line if using browser-side JS

async function testBinance() {
  const symbol = "BTCUSDT"; // try also BTCUSDT.P if needed
  const interval = "30m";
  const limit = 3;
  const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;

  console.log(`Fetching ${symbol}...`);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
        "Accept-Encoding": "identity"
      }
    });

    const text = await res.text();

    // Print what Binance actually sent (first 300 chars)
    console.log("Raw response (first 300 chars):");
    console.log(text.slice(0, 300));

    if (!text || text[0] !== "[") {
      console.error(`Invalid data format`);
      return;
    }

    const data = JSON.parse(text);
    console.log(`✅ Parsed ${data.length} entries successfully`);
    console.log(data[0]);
  } catch (err) {
    console.error(`Error fetching ${symbol}: ${err.message}`);
  }
}

testBinance();
