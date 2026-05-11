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
    // 🔍 1. ricerca ticker
    const searchRes = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${q}`,
      { headers }
    );

    const searchData = await searchRes.json();
    const ticker = searchData.quotes?.[0]?.symbol;

    if (!ticker) {
      return res.json({ error: "Ticker non trovato" });
    }

    // 📈 2. storico prezzi
    const chartRes = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=3y&interval=1d`,
      { headers }
    );

    const chartData = await chartRes.json();
    const result = chartData.chart.result[0];

    const prices = result.indicators.quote[0].close;
    const timestamps = result.timestamp;

    const validPrices = prices.filter(p => p !== null);

    // 📊 3. info azienda + fondamentali
    const infoRes = await fetch(
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=assetProfile,defaultKeyStatistics,summaryDetail`,
      { headers }
    );

    const infoData = await infoRes.json();
    const info = infoData.quoteSummary.result?.[0];

    const description = info?.assetProfile?.longBusinessSummary;
    const sector = info?.assetProfile?.sector;
    const pe = info?.summaryDetail?.trailingPE?.raw;
    const beta = info?.summaryDetail?.beta?.raw;
    const eps = info?.defaultKeyStatistics?.trailingEps?.raw;

    // ✅ risposta finale
    res.json({
      ticker,

      prices,
      timestamps,

      stats: {
        max: Math.max(...validPrices),
        min: Math.min(...validPrices),
        avg: validPrices.reduce((a, b) => a + b, 0) / validPrices.length,
        current: validPrices[validPrices.length - 1]
      },

      info: {
        description,
        sector,
        pe,
        beta,
        eps
      }
    });

  } catch (e) {
    console.error("ERRORE BACKEND:", e);
    res.status(500).json({ error: "Errore server" });
  }
});

// health check
app.get("/", (req, res) => {
  res.send("Backend OK");
});

app.listen(process.env.PORT || 3001, () => {
  console.log("Server running");
});
