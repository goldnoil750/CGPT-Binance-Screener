const express = require("express");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 10000;

// Binance Futures API base
const BASE = "https://fapi.binance.com/fapi/v1/klines";

// Pairs list
const pairs = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "DOGEUSDT",
  "ADAUSDT",
  "PEPEUSDT",
  "BONKUSDT",
  "WIFUSDT",
  "FLOKIUSDT",
];

// Fetch function with full error handling
async function getKlines(symbol, interval = "30m") {
  try {
    const url = `${BASE}?symbol=${symbol}&interval=${interval}&limit=3`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const data = await res.json();

    if (!Array.isArray(data)) {
      console.error(`❌ ${symbol} - Invalid data format`, data);
      return null;
    }

    return data;
  } catch (err) {
    console.error(`❌ ${symbol} - Fetch error:`, err);
    return null;
  }
}

// Calculate candle body % and volume
function bodyPercent(candle) {
  const open = parseFloat(candle[1]);
  const close = parseFloat(candle[4]);
  return Math.abs(((close - open) / open) * 100);
}

function volume(candle) {
  return parseFloat(candle[5]);
}

// Webpage route
app.get("/", async (req, res) => {
  const results = [];

  for (const pair of pairs) {
    const data = await getKlines(pair, "30m");
    if (!data) continue;

    const cur = data[data.length - 2]; // last closed candle
    const prev = data[data.length - 3];

    results.push({
      pair,
      body: bodyPercent(cur).toFixed(2),
      curVol: (volume(cur) / 1_000_000).toFixed(2),
      prevVol: (volume(prev) / 1_000_000).toFixed(2),
    });
  }

  // HTML Output (Dark Theme)
  const html = `
  <html>
  <head>
    <title>Binance 30m Screener</title>
    <style>
      body { background-color: #121212; color: #e0e0e0; font-family: monospace; padding: 20px; }
      table { border-collapse: collapse; width: 100%; margin-top: 10px; }
      th, td { border: 1px solid #333; padding: 8px 10px; text-align: left; }
      th { background-color: #1e1e1e; color: #fff; }
      tr:nth-child(even) { background-color: #1c1c1c; }
      tr:hover { background-color: #292929; }
      button { background-color: #333; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; }
      button:hover { background-color: #555; }
    </style>
  </head>
  <body>
    <h2>📊 Binance 30-Min Screener (All Candles)</h2>
    <button onclick="location.reload()">🔄 Refresh</button>
    <table>
      <tr><th>PAIR</th><th>BODY %</th><th>CURR VOL (M)</th><th>PREV VOL (M)</th></tr>
      ${results
        .map(
          (r) => `<tr>
          <td>${r.pair}</td>
          <td>${r.body}</td>
          <td>${r.curVol}</td>
          <td>${r.prevVol}</td>
        </tr>`
        )
        .join("")}
    </table>
  </body>
  </html>
  `;

  res.send(html);
});

app.listen(PORT, () => console.log(`✅ Server running on ${PORT}`));
