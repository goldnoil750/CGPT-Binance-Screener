// Binance Perp 30-min Screener v3 — Fix for Invalid data format
// Compatible with Render & Codetabs proxy fallback

import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
const PORT = process.env.PORT || 10000;

// Generic safe fetch
async function fetchSafe(url) {
  try {
    const res = await fetch(url);
    return await res.json();
  } catch (e) {
    console.error("Fetch error:", e.message);
    return null;
  }
}

// Get perpetual pairs (Binance Futures)
async function getPerpPairs() {
  const url =
    "https://api.codetabs.com/v1/proxy/?quest=https://fapi.binance.com/fapi/v1/exchangeInfo";
  const data = await fetchSafe(url);
  if (!data?.symbols) throw new Error("ExchangeInfo invalid");
  return data.symbols
    .filter((s) => s.contractType === "PERPETUAL" && s.symbol.endsWith("USDT"))
    .map((s) => s.symbol)
    .slice(0, 60); // limit for performance
}

// Get last 3 closed 30-min candles safely
async function getKlines(symbol) {
  const url1 = `https://api.codetabs.com/v1/proxy/?quest=https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=30m&limit=3`;
  let data = await fetchSafe(url1);

  // Fallback direct Binance if proxy gives object or null
  if (!Array.isArray(data)) {
    const url2 = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=30m&limit=3`;
    data = await fetchSafe(url2);
  }

  if (!Array.isArray(data)) throw new Error("Invalid data format");
  return data.map((k) => ({
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

// Screener logic
async function getScreenerData() {
  const pairs = await getPerpPairs();
  const results = [];

  for (const symbol of pairs) {
    try {
      const kl = await getKlines(symbol);
      const c2 = kl[0];
      const c1 = kl[1];
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
    await new Promise((r) => setTimeout(r, 200));
  }

  results.sort((a, b) => b.volRatio - a.volRatio);
  return results;
}

// API route
app.get("/api/data", async (req, res) => {
  try {
    const data = await getScreenerData();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Frontend
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Binance 30m Screener</title>
<style>
body{font-family:Arial;margin:20px}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid #ccc;padding:6px;text-align:center}
th{background:#f3f3f3}
button,input{padding:6px 10px}
</style>
</head>
<body>
<h2>Binance Perp 30-min Screener</h2>
<div>
Refresh (sec): <input id="refresh" type="number" value="60" style="width:70px">
<button onclick="applyInterval()">Apply</button>
<button onclick="refreshNow()">Refresh Now</button>
<span id="countdown"></span>
</div>
<table>
<thead><tr>
<th>Pair Name</th><th>Vol Ratio</th><th>Body(1)%</th><th>Body(2)%</th><th>Vol(1)</th><th>Vol(2)</th>
</tr></thead>
<tbody id="tbody"></tbody>
</table>

<script>
let intervalSec=60,timer,countdown=intervalSec;
async function loadData(){
 document.getElementById("tbody").innerHTML="<tr><td colspan='6'>Loading...</td></tr>";
 const r=await fetch("/api/data");
 const d=await r.json();
 const tb=document.getElementById("tbody");
 tb.innerHTML="";
 d.forEach(x=>{
  const tr=document.createElement("tr");
  tr.innerHTML="<td style='text-align:left'>"+x.symbol+"</td><td>"+x.volRatio+"</td><td>"+x.body1_pct+"</td><td>"+x.body2_pct+"</td><td>"+x.vol1+"</td><td>"+x.vol2+"</td>";
  tb.appendChild(tr);
 });
}
function applyInterval(){intervalSec=parseInt(document.getElementById("refresh").value)||60;resetTimer();}
function refreshNow(){loadData();resetTimer();}
function resetTimer(){
 clearInterval(timer);
 countdown=intervalSec;
 timer=setInterval(()=>{
  countdown--;
  document.getElementById("countdown").innerText="Next scan in: "+countdown+"s";
  if(countdown<=0){loadData();countdown=intervalSec;}
 },1000);
}
loadData();resetTimer();
</script>
</body></html>`);
});

app.listen(PORT, () => console.log(`✅ Server running on ${PORT}`));
