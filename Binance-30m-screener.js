// --- Binance data fetch ---
async function getKlines(symbol, interval = '30m', limit = 3) {
  const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
        'Accept-Encoding': 'identity' // force plain JSON, no gzip
      },
    });

    if (!res.ok) {
      console.error(`${symbol}: HTTP ${res.status}`);
      return null;
    }

    const text = await res.text();

    // Sometimes Binance sends HTML or empty response — handle gracefully
    if (!text || text[0] !== '[') {
      console.error(`Error ${symbol}: Invalid data format (${text.slice(0, 80)})`);
      return null;
    }

    return JSON.parse(text);
  } catch (e) {
    console.error(`Error ${symbol}: ${e.message}`);
    return null;
  }
}
