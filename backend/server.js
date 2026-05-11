import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());

app.get("/api/search", async (req, res) => {
  const q = req.query.q;

  try {
    // 🔍 1. Ricerca ticker
    const searchRes = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${q}`
    );
    const searchData = await searchRes.json();

    const ticker = searchData.quotes?.[0]?.symbol;

    if (!ticker) {
      return res.json({ error: "Ticker non trovato" });
    }

    // 📈 2. Storico prezzi
    const chartRes = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=3y&interval=1d`
    );
    const chartData = await chartRes.json();

    const result = chartData.chart.result[0];

    const prices = result.indicators.quote[0].close;
    const timestamps = result.timestamp;

    // 📊 3. Statistiche
    const validPrices = prices.filter(p => p !== null);

    const max = Math.max(...validPrices);
    const min = Math.min(...validPrices);
    const avg = validPrices.reduce((a, b) => a + b, 0) / validPrices.length;
    const current = validPrices[validPrices.length - 1];

    res.json({
      ticker,
      prices,
      timestamps,
      stats: {
        max,
        min,
        avg,
        current
      }
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore server" });
  }
});

app.get("/", (req, res) => {
  res.send("Backend OK");
});

app.listen(process.env.PORT || 3001, () => {
  console.log("Server running");
});
