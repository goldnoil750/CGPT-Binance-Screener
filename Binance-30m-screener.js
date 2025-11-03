// Binance-30m-screener.js
// Clean dark UI + Codetabs proxy for Binance Futures data
// Works on Render.com with:  node Binance-30m-screener.js

import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 10000;
const REFRESH_DEFAULT = 60; // seconds

// Binance Perp pairs to scan (you can add more)
const PAIRS = [
  "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT",
  "ADAUSDT", "AVAXUSDT", "LINKUSDT", "DOTUSDT", "PEPEUSDT", "WIFUSDT",
  "BONKUSDT", "FLOKIUSDT", "1000RATSUSDT", "POPCATUSDT", "JUPUSDT", "PYTHUSDT"
];

// Helper to compute body % and volume ratio
function calcBodyPct(candle) {
  const open = parseFloat(candle[1]);
  const close = parseFloat(candle[4]);
  return ((Math.abs(close - open)) / open * 100).toFixed(2);
}

function isGreen(candle) {
  return parseFloat(candle[4]) > parseFloat(candle[1]);
}

// API Fetch via Codetabs proxy (works globally)
async function fetchCandleData(symbol) {
  const url = `https://api.codetabs.com/v1/proxy/?quest=https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=30m&limit=3`;
  try {
    const res = await fetch(url);
    const data = await res.json();

    if (!Array.isArray(data) || data.length < 3) {
      console.error(`Error ${symbol}: Invalid data format`);
      return null;
    }

    const c1 = data[data.length - 2]; // last closed
    const c2 = data[data.length - 3]; // previous closed

    const body1 = parseFloat(calcBodyPct(c1));
    const body2 = parseFloat(calcBodyPct(c2));
    const vol1 = parseFloat(c1[5]);
    const vol2 = parseFloat(c2[5]);

    if (isGreen(c1) && body1 >= 2) {
      const ratio = vol2 > 0 ? (vol1 / vol2).toFixed(2) : 0;
      return { symbol, volRatio: parseFloat(ratio), body1, body2, vol1, vol2 };
    }
  } catch (err) {
    console.error(`Error ${symbol}: ${err.message}`);
  }
  return null;
}

async function getAllData() {
  const results = await Promise.all(PAIRS.map(fetchCandleData));
  return results.filter(Boolean).sort((a, b) => b.volRatio - a.volRatio);
}

// Web UI
app.get("/", async (req, res) => {
  const data = await getAllData();

  // Calculate countdown to next 30-min candle
  const now = new Date();
  const minsToNext = 30 - (now.getMinutes() % 30);
  const secsToNext = 60 - now.getSeconds();
  const countdown = `${String(minsToNext % 30).padStart(2, "0")}:${String(secsToNext % 60).padStart(2, "0")}`;

  const html = `
  <html>
  <head>
    <title>Binance 30m Screener</title>
    <style>
      body { background-color: #1e1e1e; color: #eaeaea; font-family: Arial, sans-serif; text-align: center; }
      table { margin: 20px auto; border-collapse: collapse; width: 90%; }
      th, td { border: 1px solid #444; padding: 8px 10px; }
      th { background-color: #333; }
      tr:nth-child(even) { background-color: #2a2a2a; }
      tr:hover { background-color: #3a3a3a; }
      #controls { margin: 15px; }
      button { background-color: #555; color: white; padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; }
      button:hover { background-color: #777; }
      input { width: 50px; text-align: center; background-color: #333; color: white; border: 1px solid #555; border-radius: 3px; }
    </style>
  </head>
  <body>
    <h1>Binance 30-min Screener</h1>
    <h3>Next 30-min candle in: <span id="count">${countdown}</span></h3>
    <div id="controls">
      Auto-refresh every <input id="refreshInt" value="${REFRESH_DEFAULT}" /> sec
      <button onclick="applyRefresh()">Apply</button>
      <button onclick="manualRefresh()">🔄 Refresh Now</button>
      <p id="timer"></p>
    </div>
    <table>
      <tr>
        <th>Pair</th>
        <th>Vol Ratio</th>
        <th>Body(1)%</th>
        <th>Body(2)%</th>
        <th>Vol(1)</th>
        <th>Vol(2)</th>
      </tr>
      ${data.length
        ? data
            .map(
              (r) => `
              <tr>
                <td style="text-align:left">${r.symbol}</td>
                <td>${r.volRatio}</td>
                <td>${r.body1}</td>
                <td>${r.body2}</td>
                <td>${(r.vol1 / 1_000_000).toFixed(1)}M</td>
                <td>${(r.vol2 / 1_000_000).toFixed(1)}M</td>
              </tr>`
            )
            .join("")
        : `<tr><td colspan="6">No GREEN ≥2% candles found</td></tr>`}
    </table>

    <script>
      let countdown = ${REFRESH_DEFAULT};
      let interval = ${REFRESH_DEFAULT};
      let timerEl = document.getElementById('timer');

      function updateTimer() {
        countdown--;
        timerEl.innerText = "Auto refresh in: " + countdown + " sec";
        if (countdown <= 0) location.reload();
      }

      let t = setInterval(updateTimer, 1000);

      function applyRefresh() {
        clearInterval(t);
        interval = parseInt(document.getElementById('refreshInt').value) || 60;
        countdown = interval;
        t = setInterval(updateTimer, 1000);
      }

      function manualRefresh() {
        location.reload();
      }
    </script>
  </body>
  </html>
  `;

  res.send(html);
});

app.listen(PORT, () => console.log(`✅ Server running on ${PORT}`));
