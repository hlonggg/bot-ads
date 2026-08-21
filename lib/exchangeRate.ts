let cachedRate: { value: number; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h — exchange rate doesn't need to be fresher than this

/**
 * Free, no-API-key exchange rate service. If it's ever down, we fall back to
 * the last cached value, or the manual override stored in Setting("usdVndRateManual")
 * so a network hiccup never blocks reward calculation.
 */
export async function fetchUsdToVndRate(manualFallback?: number): Promise<number> {
  if (cachedRate && Date.now() - cachedRate.fetchedAt < CACHE_TTL_MS) {
    return cachedRate.value;
  }

  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store" });
    const data = await res.json();
    const rate = data?.rates?.VND;
    if (typeof rate === "number" && rate > 0) {
      cachedRate = { value: rate, fetchedAt: Date.now() };
      return rate;
    }
  } catch (e) {
    console.error("[exchangeRate] fetch failed", e);
  }

  if (cachedRate) return cachedRate.value; // stale but better than nothing
  if (manualFallback) return manualFallback;
  return 26000; // last-resort hardcoded fallback, update Setting("usdVndRateManual") instead of relying on this
}
