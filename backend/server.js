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

    // 📈 2. prezzi
    const chartRes = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=3y&interval=1d`,
      { headers }
    );

    const chartData = await chartRes.json();

    if (!chartData.chart?.result) {
      return res.json({ error: "Dati grafico non disponibili" });
    }

    const result = chartData.chart.result[0];
    const prices = result.indicators.quote[0].close;
    const timestamps = result.timestamp;
    const validPrices = prices.filter(p => p !== null);

    // ✅ INFO ROBUSTE (endpoint stabile)
    let description = null;
    let sector = null;
    let pe = null;
    let beta = null;
    let eps = null;

    try {
      const quoteRes = await fetch(
        `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${ticker}`,
        { headers }
      );

      const quoteData = await quoteRes.json();
      const qdata = quoteData.quoteResponse.result?.[0];

      if (qdata) {
        pe = qdata.trailingPE || null;
        beta = qdata.beta || null;
        eps = qdata.epsTrailingTwelveMonths || null;
      }
    } catch {
      console.log("Errore quote");
    }

    try {
      const infoRes = await fetch(
        `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=assetProfile`,
        { headers }
      );

      const infoData = await infoRes.json();
      const info = infoData?.quoteSummary?.result?.[0];

      if (info) {
        description = info?.assetProfile?.longBusinessSummary || null;
        sector = info?.assetProfile?.sector || null;
      }
    } catch {
      console.log("Errore descrizione");
    }

    // ✅ FINANCIALS ROBUSTI
    let financials = {
      revenue: {},
      netIncome: {},
      equity: {},
      debt: {}
    };

    try {
      const finRes = await fetch(
        `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=incomeStatementHistory,balanceSheetHistory`,
        { headers }
      );

      const finData = await finRes.json();
      const fin = finData?.quoteSummary?.result?.[0];

      const income = fin?.incomeStatementHistory?.incomeStatementHistory || [];
      const balance = fin?.balanceSheetHistory?.balanceSheetStatements || [];

      const growth = (curr, prev) =>
        curr && prev ? ((curr - prev) / prev) * 100 : null;

      if (income.length >= 2) {
        financials.revenue = {
          value: income[0].totalRevenue?.raw,
          growth: growth(income[0].totalRevenue?.raw, income[1].totalRevenue?.raw)
        };

        financials.netIncome = {
          value: income[0].netIncome?.raw,
          growth: growth(income[0].netIncome?.raw, income[1].netIncome?.raw)
        };
      }

      if (balance.length >= 2) {
        financials.equity = {
          value: balance[0].totalStockholderEquity?.raw,
          growth: growth(balance[0].totalStockholderEquity?.raw, balance[1].totalStockholderEquity?.raw)
        };

        financials.debt = {
          value: balance[0].totalDebt?.raw,
          growth: growth(balance[0].totalDebt?.raw, balance[1].totalDebt?.raw)
        };
      }

    } catch {
      console.log("Errore bilanci");
    }

    // ✅ risposta finale
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
        description,
        sector,
        pe,
        beta,
        eps
      },

      financials
    });

  } catch (e) {
    console.error("ERRORE BACKEND:", e);
    res.status(500).json({ error: "Errore server" });
  }
});

app.listen(process.env.PORT || 3001, () => {
  console.log("Server running");
});
