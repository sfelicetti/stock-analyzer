import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

const API_KEY = process.env.API_KEY;

app.get("/api/company", async (req, res) => {
  const q = req.query.q;

  try {
    const profile = await fetch(
      `https://financialmodelingprep.com/api/v3/profile/${q}?apikey=${API_KEY}`
    ).then(r => r.json());

    const history = await fetch(
      `https://financialmodelingprep.com/api/v3/historical-price-full/${q}?timeseries=750&apikey=${API_KEY}`
    ).then(r => r.json());

    res.json({
      profile: profile[0],
      history: history.historical
    });

  } catch {
    res.status(500).send("Errore");
  }
});

app.listen(process.env.PORT || 3001);
