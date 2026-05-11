import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());

const headers = {
  "User-Agent": "Mozilla/5.0"
};

// ✅ funzione robusta con fallback query1 → query2
async function getQuoteData(ticker) {
  const urls = [
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${ticker}`,
    `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${ticker}`
  ];

  for (let url of urls) {
    try {
      const res = await fetch(url, { headers });
      const data = await res.json();

      const result = data?.quoteResponse?.result?.[0];

      if (result) return result;

    } catch (e) {
      console.log("Errore su:", url);
    }
  }

  return null;
}

app.get("/api/search", async (req, res) => {
  const q = req.query.q;

  try {
    // 🔍 1. cerca ticker
    const searchRes = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${q}`,
      { headers }
    );

    const searchData = await searchRes.json();
    const ticker = searchData?.quotes?.[0]?.symbol;

    if (!ticker) {
      return res.json({ error: "Ticker non trovato" });
    }

    // 📈 2. grafico (safe)
    let prices = [];
    let timestamps = [];
    let stats = null;

    try {
      const chartRes = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=3y&interval=1d`,
        { headers }
      );

      const chartData = await chartRes.json();
      const result = chartData?.chart?.result?.[0];

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

    } catch {
      console.log("Errore grafico");
    }

    // ✅ 3. fundamentals con fallback
    let pe = null;
    let eps = null;
    let beta = null;

    const quote = await getQuoteData(ticker);

    if (quote) {
      pe = quote.trailingPE ?? null;
      eps = quote.epsTrailingTwelveMonths ?? null;
      beta = quote.beta ?? null;
    }

    // ✅ risposta SEMPRE valida
    res.json({
      ticker,
      prices,
      timestamps,
      stats,
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

app.get("/", (req, res) => {
  res.send("Backend OK");
});

app.listen(process.env.PORT || 3001, () => {
  console.log("Server running");
});
