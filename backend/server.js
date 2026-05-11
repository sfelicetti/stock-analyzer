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

    // 📊 3. info azienda
    let description = null;
    let sector = null;
    let pe = null;
    let beta = null;
    let eps = null;

    try {
      const infoRes = await fetch(
        `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=assetProfile,defaultKeyStatistics,summaryDetail`,
        { headers }
      );

      const infoData = await infoRes.json();
      const info = infoData?.quoteSummary?.result?.[0];

      if (info) {
        description = info?.assetProfile?.longBusinessSummary || null;
        sector = info?.assetProfile?.sector || null;
        pe = info?.summaryDetail?.trailingPE?.raw || null;
        beta = info?.summaryDetail?.beta?.raw || null;
        eps = info?.defaultKeyStatistics?.trailingEps?.raw || null;
      }

    } catch {
      console.log("Errore info (non critico)");
    }

    // 📊 4. BILANCI ✅
    let financials = {};

    try {
      const finRes = await fetch(
        `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=incomeStatementHistory,balanceSheetHistory`,
        { headers }
      );

      const finData = await finRes.json();
      const fin = finData?.quoteSummary?.result?.[0];

      const income = fin?.incomeStatementHistory?.incomeStatementHistory;
      const balance = fin?.balanceSheetHistory?.balanceSheetStatements;

      if (income && balance && income.length >= 2 && balance.length >= 2) {
        const currIncome = income[0];
        const prevIncome = income[1];

        const currBalance = balance[0];
        const prevBalance = balance[1];

        const revenue = currIncome.totalRevenue?.raw;
        const revenuePrev = prevIncome.totalRevenue?.raw;

        const netIncome = currIncome.netIncome?.raw;
        const netIncomePrev = prevIncome.netIncome?.raw;

        const equity = currBalance.totalStockholderEquity?.raw;
        const equityPrev = prevBalance.totalStockholderEquity?.raw;

        const debt = currBalance.totalDebt?.raw;
        const debtPrev = prevBalance.totalDebt?.raw;

        const growth = (curr, prev) => {
          if (!curr || !prev) return null;
          return ((curr - prev) / prev) * 100;
        };

        financials = {
          revenue: { value: revenue, growth: growth(revenue, revenuePrev) },
          netIncome: { value: netIncome, growth: growth(netIncome, netIncomePrev) },
          equity: { value: equity, growth: growth(equity, equityPrev) },
          debt: { value: debt, growth: growth(debt, debtPrev) }
        };
      }

    } catch {
      console.log("Errore bilanci (non critico)");
    }

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
