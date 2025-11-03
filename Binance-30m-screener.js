// Binance Perp 30-min Screener v2
// Fetches Binance perpetual pairs, checks last two closed 30-min candles,
// and lists only those where the last (1) candle is green with body >= 2%.

import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

// ========== CONFIG ==========
const PORT = process.env.PORT || 10000;
const REFRESH_DEFAULT = 60; // seconds

// ========== UTILITIES ==========
async function fetchJSON(url) {
  const r = await fetch(url);
  return r.json();
}

// Get all Binance USDT perpetual pairs
async function getPerpPairs() {
  const url = "https://api.codetabs.com/v1/proxy/?quest=https://fapi.binance.com/fapi/v1/exchangeInfo";
  const data = await fetchJSON(url);
  if (!data.symbols) throw new Error("Invalid symbol list");
  return data.symbols
    .filter(s => s.contractType === "PERPETUAL" && s.symbol.endsWith("USDT"))
    .map(s => s.symbol)
    .slice(0, 100); // limit for demo speed (can raise later)
}

// 📊 Get last 3 closed 30m candles
async function getKlines(symbol) {
  const url = `https://api.codetabs.com/v1/proxy/?quest=https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=30m&limit=3`;
  const data = await fetchJSON(url);
  if (!Array.isArray(data)) throw new Error("Invalid data format");
  return data.map(k => ({
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

// 🚀 Screener logic
async function getScreenerData() {
  const pairs = await getPerpPairs();
  const results = [];

  for (const symbol of pairs) {
    try {
      const kl = await getKlines(symbol);
      const c2 = kl[0]; // candle(2)
      const c1 = kl[1]; // candle(1)
      const body1 = ((c1.close - c1.open) / c1.open) * 100;
      const body2 = ((c2.close - c2.open) / c2.open) * 100;

      if (body1 >= 2 && c1.close > c1.open) {
        const volRatio = c2.volume / c1.volume;
        results.push({
          symbol,
          volRatio: volRatio.toFixed(2),
          body1_pct: body1.toFixed(2),
          body2_pct: body2.toFixed(2),
          vol1: c1.volume.toFixed(0),
          vol2: c2.volume.toFixed(0),
        });
      }
    } catch (e) {
      console.error(`Error ${symbol}:`, e.message);
    }
    await new Promise(r => setTimeout(r, 200)); // small delay
  }

  results.sort((a, b) => b.volRatio - a.volRatio);
  return results;
}

// ========== ROUTES ==========
app.get("/api/data", async (req, res) => {
  try {
    const data = await getScreenerData();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ========== FRONTEND ==========
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Binance Perp 30-min Screener</title>
  <meta charset="UTF-8" />
  <style>
    body { font-family: Arial; margin: 20px; }
    table { border-collapse: collapse; width: 100%; margin-top: 10px; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: center; }
    th { background: #f3f3f3; }
    button, input { padding: 6px 10px; }
  </style>
</head>
<body>
  <h2>Binance Perp 30-min Screener</h2>
  <div>
    Refresh (sec): <input id="refresh" type="number" value="${REFRESH_DEFAULT}" style="width:70px"> 
    <button onclick="applyInterval()">Apply</button>
    <button onclick="refreshNow()">Refresh Now</button>
    <span id="countdown"></span>
  </div>
  <table>
    <thead>
      <tr>
        <th>Pair Name</th>
        <th>Vol Ratio</th>
        <th>Body(1)%</th>
        <th>Body(2)%</th>
        <th>Vol(1)</th>
        <th>Vol(2)</th>
      </tr>
    </thead>
    <tbody id="tbody"></tbody>
  </table>

  <script>
    let intervalSec = ${REFRESH_DEFAULT};
    let timer, countdown = intervalSec;

    async function loadData() {
      document.getElementById("tbody").innerHTML = "<tr><td colspan='6'>Loading...</td></tr>";
      const res = await fetch("/api/data");
      const data = await res.json();
      const tbody = document.getElementById("tbody");
      tbody.innerHTML = "";
      data.forEach(r => {
        const tr = document.createElement("tr");
        tr.innerHTML = "<td style='text-align:left'>" + r.symbol + "</td>" +
                       "<td>" + r.volRatio + "</td>" +
                       "<td>" + r.body1_pct + "</td>" +
                       "<td>" + r.body2_pct + "</td>" +
                       "<td>" + r.vol1 + "</td>" +
                       "<td>" + r.vol2 + "</td>";
        tbody.appendChild(tr);
      });
    }

    function applyInterval() {
      intervalSec = parseInt(document.getElementById("refresh").value) || 60;
      resetTimer();
    }

    function refreshNow() { loadData(); resetTimer(); }

    function resetTimer() {
      clearInterval(timer);
      countdown = intervalSec;
      timer = setInterval(() => {
        countdown--;
        document.getElementById("countdown").innerText = "Next scan in: " + countdown + "s";
        if (countdown <= 0) { loadData(); countdown = intervalSec; }
      }, 1000);
    }

    loadData();
    resetTimer();
  </script>
</body>
</html>`);
});

// ========== START SERVER ==========
app.listen(PORT, () => console.log(`✅ Server running on ${PORT}`));
