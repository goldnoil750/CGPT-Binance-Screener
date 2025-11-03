import express from "express";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 10000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// serve static files
app.use(express.static(__dirname));

// ======== CONFIG ========
const symbols = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "SOLUSDT",
  "DOGEUSDT",
  "XRPUSDT",
  "ADAUSDT",
  "LINKUSDT",
  "AVAXUSDT",
  "DOTUSDT"
];
const interval = "30m";

// ======== FETCH LOGIC ========
async function getKline(symbol) {
  const url = `https://api.codetabs.com/v1/proxy?quest=https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=3`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.log(`❌ ${symbol} - Invalid JSON:`, text.slice(0, 200));
      return null;
    }
    if (!Array.isArray(data)) {
      console.log(`❌ ${symbol} - Invalid data format`, data);
      return null;
    }

    const [openTime, open, high, low, close] = data[data.length - 2]; // last completed candle
    const pct = ((close - open) / open) * 100;
    return {
      symbol,
      open: parseFloat(open),
      close: parseFloat(close),
      change: pct.toFixed(2)
    };
  } catch (err) {
    console.log(`❌ ${symbol} error:`, err.message);
    return null;
  }
}

// ======== API ENDPOINT ========
app.get("/data", async (req, res) => {
  const results = [];
  for (const s of symbols) {
    const d = await getKline(s);
    if (d) results.push(d);
  }
  res.json({ updated: new Date().toISOString(), data: results });
});

// ======== FRONT-END HTML ========
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Binance 30m Screener</title>
  <style>
    body {
      background-color: #1c1c1c;
      color: #e0e0e0;
      font-family: Arial, sans-serif;
      text-align: center;
      margin: 0;
      padding: 0;
    }
    h1 {
      color: #00ffc8;
      margin: 20px 0;
    }
    table {
      margin: 0 auto;
      border-collapse: collapse;
      width: 80%;
      background: #2a2a2a;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 0 10px #00000055;
    }
    th, td {
      padding: 12px;
      border-bottom: 1px solid #333;
    }
    th {
      background: #333;
      color: #00ffc8;
    }
    tr:hover { background-color: #383838; }
    button {
      background: #00ffc8;
      color: #000;
      border: none;
      border-radius: 8px;
      padding: 10px 20px;
      font-size: 16px;
      cursor: pointer;
      margin: 20px;
    }
    button:hover { background: #00cc99; }
    #updated {
      margin: 10px;
      color: #aaa;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <h1>Binance 30m Screener (Perp Test)</h1>
  <button onclick="loadData()">🔄 Refresh</button>
  <div id="updated">Loading...</div>
  <table id="tbl">
    <thead>
      <tr><th>Symbol</th><th>Open</th><th>Close</th><th>Change %</th></tr>
    </thead>
    <tbody></tbody>
  </table>

  <script>
    async function loadData() {
      document.getElementById("updated").textContent = "Fetching...";
      const res = await fetch('/data');
      const js = await res.json();
      const tbody = document.querySelector("#tbl tbody");
      tbody.innerHTML = '';
      for (const d of js.data) {
        const row = document.createElement('tr');
        row.innerHTML = \`<td>\${d.symbol}</td>
                         <td>\${d.open.toFixed(2)}</td>
                         <td>\${d.close.toFixed(2)}</td>
                         <td style="color:\${d.change >= 0 ? '#00ff88':'#ff6666'}">\${d.change}%</td>\`;
        tbody.appendChild(row);
      }
      document.getElementById("updated").textContent = "Last updated: " + new Date(js.updated).toLocaleTimeString();
    }
    loadData();
  </script>
</body>
</html>
  `);
});

// ======== START SERVER ========
app.listen(PORT, () => console.log(`✅ Server running on ${PORT}`));
