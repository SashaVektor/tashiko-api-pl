import axios from "axios";

const CACHE_TTL_MS = 60 * 60 * 1000;
let cachedRate = null;
let cachedAt = 0;

export const getUsdPlnRate = async (_req, res) => {
  try {
    if (!cachedRate || Date.now() - cachedAt > CACHE_TTL_MS) {
      const { data } = await axios.get(
        "https://api.nbp.pl/api/exchangerates/rates/A/USD/?format=json",
        { timeout: 5000 },
      );
      const rate = Number(data?.rates?.[0]?.mid);
      if (!Number.isFinite(rate) || rate <= 0) {
        throw new Error("NBP returned an invalid USD/PLN rate");
      }
      cachedRate = rate;
      cachedAt = Date.now();
    }

    res.send({ base: "USD", quote: "PLN", rate: cachedRate, fetchedAt: new Date(cachedAt).toISOString() });
  } catch (error) {
    console.error("[Exchange rate]", error.message);
    res.status(503).send({ message: "USD/PLN exchange rate is temporarily unavailable" });
  }
};
