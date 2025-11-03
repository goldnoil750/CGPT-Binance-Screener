// Binance-30m-screener.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 10000;

// ------------------------------------------------------------
// ✅ Config
// ------------------------------------------------------------
const symbols = [
  "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT",
  "XRPUSDT", "DOGEUSDT", "ADAUSDT", "AVAXUSDT",
  "DOTUSDT", "LINKUSDT", "LTCUSDT", "TRXUSDT",
  "UNIUSDT", "FILUSDT", "ATOMUSDT", "NEARUSDT"
];

// ------------------------------------------------------------
// ✅ Fetch last 3 candles via Codetabs proxy
// ------------------------------------------------------------
async function fetchKlines(symbol) {
  const url = `https://api.codetabs.com/v1/proxy/?quest=https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=30m&limit=3`;

  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const text = await res.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error(`❌ ${symbol}: JSON parse error`, text.slice(0, 100));
      return null;
    }

    if (!Array.isArray(data)) {
      console.error(`⚠️ ${symbol}: Invalid data format`, data);
      return null;
    }

    return data;
  } catch (err) {
    console.error(`🚫 ${symbol}: Fetch failed`, err.message);
    return null;
  }
}

// ------------------------------------------------------------
// ✅ Candle helpers
// ------------------------------------------------------------
function bodyPercent(c) {
  return Math.abs(((parseFloat(c[4]) - parseFloat(c[1])) / parseFloat(c[1])) * 100);
}
function volume(c) {
  return parseFloat(c[5]);
}

// ------------------------------------------------------------
// ✅ API endpoint
// ------------------------------------------------------------
app.get("/data", async (req, res) => {
  const results = [];

  for (const symbol of symbols) {
    const d = await fetchKlines(symbol);
    if (!d) continue;

    const prev = d[d.length - 2];
    const curr = d[d.length - 1];
    const body = bodyPercent(curr).toFixed(2);
    const volRatio = volume(curr) && volume(d[d.length - 2])
      ? (volume(curr) / volume(d[d.length - 2])).toFixed(2)
      : 0;

    results.push({
      symbol,
      body: Number(body),
      volNow: volume(curr),
      volPrev: volume(d[d.length - 2]),
      volRatio: Number(volRatio)
    });
  }

  res.json(results);
});

// ------------------------------------------------------------
// ✅ Simple HTML frontend
// ------------------------------------------------------------
app.get("/", async (req, res) => {
  const now = new Date();
  const mins = (30 - (now.getUTCMinutes() % 30)) % 30;
  const secs = 60 - now.getUTCSeconds();

  const html = `
  <html>
  <head>
    <title>Binance 30m Screener</title>
    <style>
      body { background:#000; color:#0f0; font-family:monospace; font-size:18px; }
      table { border-collapse:collapse; width:100%; margin-top:10px; }
      th,td { border-bottom:1px solid #0f0; padding:6px 10px; text-align:left; }
    </style>
  </head>
  <body>
    <h2>BINANCE 30m PERP SCREENER (via Codetabs)</h2>
    <h3 id="timer">Next candle: ${mins.toString().padStart(2,"0")}:${secs.toString().padStart(2,"0")} mm:ss</h3>
    <table id="tbl"><tr><th>PAIR</th><th>Body%</th><th>VolNow</th><th>VolPrev</th><th>Ratio</th></tr></table>
    <script>
      async function load(){
        try {
          const r = await fetch('/data');
          const d = await r.json();
          const tbl = document.getElementById('tbl');
          tbl.innerHTML = '<tr><th>PAIR</th><th>Body%</th><th>VolNow</th><th>VolPrev</th><th>Ratio</th></tr>' +
            d.map(x => '<tr><td>'+x.symbol+'</td><td>'+x.body+'</td><td>'+x.volNow.toFixed(0)+'</td><td>'+x.volPrev.toFixed(0)+'</td><td>'+x.volRatio+'</td></tr>').join('');
        } catch(e){ console.error(e); }
      }
      load(); setInterval(load, 60000);

      // Countdown
      let mm=${mins}, ss=${secs};
      setInterval(()=>{
        if(--ss<0){ss=59; if(mm>0)mm--;}
        document.getElementById('timer').innerText = 
          'Next candle: '+String(mm).padStart(2,'0')+':'+String(ss).padStart(2,'0')+' mm:ss';
      },1000);
    </script>
  </body>
  </html>`;
  res.send(html);
});

// ------------------------------------------------------------
app.listen(PORT, () => console.log(`✅ Server running on ${PORT}`));
