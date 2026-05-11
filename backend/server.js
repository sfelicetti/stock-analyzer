import express from "express";
import cors from "cors";

const app = express();
app.use(cors());

app.get("/api/search", async (req, res) => {
  const q = req.query.q;

  try {
    // 1️⃣ Trova ticker da nome (Yahoo search)
    const searchRes = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${q}`
    ).then(r => r.json());

    const ticker = searchRes.quotes[0]?.symbol;

    if (!ticker) {
      return res.status(404).send("Ticker non trovato");
    }

    // 2️⃣ Prezzi 3 anni
    const chartRes = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=3y&interval=1d`
    ).then(r => r.json());

    const result = chartRes.chart.result[0];

    const prices = result.indicators.quote[0].close;
    const timestamps = result.timestamp;

    // 3️⃣ Statistiche
    const validPrices = prices.filter(p => p !== null);

    const max = Math.max(...validPrices);
    const min = Math.min(...validPrices);
    const avg = validPrices.reduce((a,b)=>a+b,0) / validPrices.length;
    const current = validPrices[validPrices.length - 1];

    res.json({
      ticker,
      prices,
      timestamps,
      stats: { max, min, avg, current }
    });

  } catch (e) {
    res.status(500).send("Errore server");
  }
});

app.listen(process.env.PORT || 3001);
