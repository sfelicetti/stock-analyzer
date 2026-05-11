import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());

const headers = {
  "User-Agent": "Mozilla/5.0"
};

// ✅ funzione quote con fallback
async function getQuote(ticker) {
  const urls = [
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${ticker}`,
    `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${ticker}`
  ];

  for (let url of urls) {
    try {
      const res = await fetch(url, { headers });
      const data = await res.json();
      const q = data?.quoteResponse?.result?.[0];
      if (q) return q;
    } catch {}
  }

  return null;
}

app.get("/api/search", async (req, res) => {

  const q = req.query.q;

  try {
    // 🔍 search ticker
    const searchRes = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${q}`,
      { headers }
    );

    const searchData = await searchRes.json();
    const ticker = searchData?.quotes?.[0]?.symbol;

    if (!ticker)
      return res.json({ error: "Ticker non trovato" });

    // 📈 chart
    const chartRes = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=3y&interval=1d`,
      { headers }
    );

    const chartData = await chartRes.json();
    const result = chartData?.chart?.result?.[0];

    let prices = [];
    let timestamps = [];
    let stats = null;

    if (result) {
      prices = result.indicators?.quote?.[0]?.close || [];
      timestamps = result.timestamp || [];

      const valid = prices.filter(p => p !== null);

      if (valid.length > 0) {
        stats = {
          max: Math.max(...valid),
          min: Math.min(...valid),
          avg: valid.reduce((a,b)=>a+b,0)/valid.length,
          current: valid[valid.length - 1]
        };
      }
    }

    // ✅ fallback dati da QUOTE
    let pe = null;
    let eps = null;
    let beta = null;
    let marketCap = null;

    const quote = await getQuote(ticker);

    if (quote) {
      pe = quote.trailingPE ?? null;
      eps = quote.epsTrailingTwelveMonths ?? null;
      beta = quote.beta ?? null;
      marketCap = quote.marketCap ?? null;
    }

    // ✅ fallback extra da chart.meta
    const meta = result?.meta;

    const currency = meta?.currency;
    const exchange = meta?.exchangeName;

    res.json({
      ticker,
      prices,
      timestamps,
      stats,
      meta: {
        currency,
        exchange,
        marketCap
      },
      info: {
        pe,
        eps,
        beta
      }
    });

  } catch (e) {
    console.error("ERRORE BACKEND:", e);
    res.status(500).json({ error: "Errore server" });
  }
});

app.listen(process.env.PORT || 3001, () => {
  console.log("Server running");
});
