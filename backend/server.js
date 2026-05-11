import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());

const headers = {
  "User-Agent": "Mozilla/5.0"
};

app.get("/api/search", async (req, res) => {
  const q = req.query.q;

  try {
    // 🔍 ricerca ticker
    const searchRes = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${q}`,
      { headers }
    );

    const searchData = await searchRes.json();
    const ticker = searchData?.quotes?.[0]?.symbol;

    if (!ticker) {
      return res.json({ error: "Ticker non trovato" });
    }

    // 📈 prezzi (SAFE)
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
        prices = result.indicators.quote[0].close || [];
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
      console.log("Errore grafico (non critico)");
    }

    // 📊 fundamentals (SAFE)
    let pe = null;
    let eps = null;
    let beta = null;

    try {
      const quoteRes = await fetch(
        `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${ticker}`,
        { headers }
      );

      const quoteData = await quoteRes.json();
      const qd = quoteData?.quoteResponse?.result?.[0];

      if (qd) {
        pe = qd.trailingPE ?? null;
        eps = qd.epsTrailingTwelveMonths ?? null;
        beta = qd.beta ?? null;
      }

    } catch {
      console.log("Errore fundamentals (non critico)");
    }

    // ✅ risposta sempre valida
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
