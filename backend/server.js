import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());

const headers = {
  "User-Agent": "Mozilla/5.0"
};

// ✅ fallback quote
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
    } catch {}
  }
  return null;
}

// ✅ news via RSS Google News
async function getNews(ticker) {
  try {
    const url = `https://news.google.com/rss/search?q=${ticker}+stock`;
    const res = await fetch(url);
    const text = await res.text();

    // parsing semplice RSS
    const items = [...text.matchAll(/<item>(.*?)<\/item>/gs)].slice(0, 5);

    return items.map(item => {
      const content = item[1];
      const title = content.match(/<title>(.*?)<\/title>/)?.[1];
      const link = content.match(/<link>(.*?)<\/link>/)?.[1];

      return { title, link };
    });

  } catch {
    return [];
  }
}

app.get("/api/search", async (req, res) => {
  const q = req.query.q;

  try {
    // 🔍 ticker
    const searchRes = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${q}`,
      { headers }
    );

    const searchData = await searchRes.json();
    const ticker = searchData?.quotes?.[0]?.symbol;

    if (!ticker) return res.json({ error: "Ticker non trovato" });

    // 📈 grafico
    const chartRes = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=3y&interval=1d`,
      { headers }
    );

    const chartData = await chartRes.json();
    const result = chartData?.chart?.result?.[0];

    let prices = result?.indicators?.quote?.[0]?.close || [];
    let timestamps = result?.timestamp || [];

    const valid = prices.filter(p => p !== null);

    const stats = valid.length > 0 ? {
      max: Math.max(...valid),
      min: Math.min(...valid),
      avg: valid.reduce((a,b)=>a+b,0)/valid.length,
      current: valid[valid.length - 1]
    } : null;

    // ✅ fundamentals
    const quote = await getQuoteData(ticker);

    // ✅ news
    const news = await getNews(ticker);

    res.json({
      ticker,
      prices,
      timestamps,
      stats,
      info: {
        pe: quote?.trailingPE ?? null,
        eps: quote?.epsTrailingTwelveMonths ?? null,
        beta: quote?.beta ?? null
      },
      meta: {
        marketCap: quote?.marketCap ?? null
      },
      news
    });

  } catch (e) {
    res.status(500).json({ error: "Errore server" });
  }
});

app.listen(process.env.PORT || 3001);
