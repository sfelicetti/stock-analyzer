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
    const ticker = searchData.quotes?.[0]?.symbol;

    if (!ticker) {
      return res.json({ error: "Ticker non trovato" });
    }

    // 📈 prezzi
    const chartRes = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=3y&interval=1d`,
      { headers }
    );

    const chartData = await chartRes.json();
    const result = chartData.chart.result[0];

    const prices = result.indicators.quote[0].close;
    const timestamps = result.timestamp;
    const validPrices = prices.filter(p => p !== null);

    // ✅ DATI AFFIDABILI (QUI STA LA SOLUZIONE)
    const quoteRes = await fetch(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${ticker}`,
      { headers }
    );

    const quoteData = await quoteRes.json();
    const qd = quoteData.quoteResponse.result[0];

    const pe = qd?.trailingPE;
    const eps = qd?.epsTrailingTwelveMonths;
    const beta = qd?.beta;

    // ✅ risposta
    res.json({
      ticker,
      prices,
      timestamps,
      stats: {
        max: Math.max(...validPrices),
        min: Math.min(...validPrices),
        avg: validPrices.reduce((a,b)=>a+b,0)/validPrices.length,
        current: validPrices[validPrices.length - 1]
      },
      info: {
        pe,
        eps,
        beta
      }
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore server" });
  }
});

app.listen(process.env.PORT || 3001, () => {
  console.log("Server running");
});
