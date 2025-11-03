import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

// ✅ You can expand this list later
const pairs = [
  "BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT","DOGEUSDT","ADAUSDT",
  "HEMIUSDT","WIFUSDT","PEPEUSDT","BONKUSDT","FLOKIUSDT","SHIBUSDT",
  "1000RATSUSDT","TURBOUSDT","BRETTUSDT","POPCATUSDT","MEWUSDT",
  "JUPUSDT","PYTHUSDT"
];

// ✅ Helper Functions
const sleep = (ms) => new Promise(res => setTimeout(res, ms));
const bodyPct = (c) => Math.abs(((parseFloat(c[4]) - parseFloat(c[1])) / parseFloat(c[1])) * 100);
const volume = (c) => parseFloat(c[5]);

// ✅ FIXED: handles Binance binary / invalid responses
async function getKlines(symbol, tf) {
  const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${tf}&limit=3`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      console.log(`Invalid JSON for ${symbol}:`, text.slice(0, 100));
      return [];
    }
  } catch (e) {
    console.log(`${symbol} fetch error: ${e.message}`);
    return [];
  }
}

// ✅ Main Route
app.get("/", async (req, res) => {
  const now = new Date();
  const mins = (30 - (now.getUTCMinutes() % 30)) % 30;
  const secs = 60 - now.getUTCSeconds();

  let html = `
  <body style="background:black;color:#0f0;font-family:monospace;font-size:20px;">
  <h1>30-MIN SCREENER</h1>
  <h2 id="t">Next candle: ${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")} mm:ss</h2>
  <pre>PAIR        BODY   CURR VOL   PREV VOL   RATIO
${"─".repeat(52)}\n`;

  const hits = [];

  for (const s of pairs) {
    await sleep(200);
    const d = await getKlines(s, "30m");
    if (d.length < 3) continue;

    const cur = d[d.length - 2];
    const pre = d[d.length - 3];
    const body = bodyPct(cur);
    const volCur = volume(cur);
    const volPrev = volume(pre);
    if (parseFloat(cur[4]) > parseFloat(cur[1]) && body >= 2) {
      const ratio = volPrev ? (volCur / volPrev).toFixed(2) : "999";
      hits.push({ s, body: body.toFixed(2), volCur, volPrev, ratio });
    }
  }

  hits.sort((a, b) => b.ratio - a.ratio);
  for (const h of hits) {
    html += `${h.s.padEnd(10)} ${h.body}%   ${(h.volCur/1e6).toFixed(1)}M   ${(h.volPrev/1e6).toFixed(1)}M   ${h.ratio}x\n`;
  }

  if (hits.length === 0) {
    html += "No GREEN ≥2% candle in last 30 min\n";
  }

  html += `
  \nRefresh every <input id=s value=60 size=2> sec 
  <button onclick='clearInterval(i);i=setInterval(go,s.value*1000);go()'>GO</button>
  <script>
  function go(){location.reload()}
  let c={mm:${mins},ss:${secs}};
  setInterval(()=>{
    if(--c.ss<0){c.ss=59;if(c.mm>0)c.mm--}
    t.innerText=\`Next candle: \${String(c.mm).padStart(2,"0")}:\${String(c.ss).padStart(2,"0")} mm:ss\`
  },1000);
  let i=setInterval(go,60000);
  </script></pre></body>`;

  res.send(html);
});

// ✅ Render / Localhost port
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Screener running on port ${PORT}`));
