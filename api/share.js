export default async function handler(req, res) {
  try {
    // Yahoo Finance se NIFTY 50 ka data
    const yahooRes = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI?interval=1m&range=1d');

    if (!yahooRes.ok) {
      throw new Error('Yahoo API failed');
    }

    const yahooData = await yahooRes.json();
    const result = yahooData.chart.result[0];
    const meta = result.meta;
    const quote = result.indicators.quote[0];

    const price = meta.regularMarketPrice;
    const prevClose = meta.previousClose;
    const change = ((price - prevClose) / prevClose) * 100;
    const high = meta.regularMarketDayHigh;
    const low = meta.regularMarketDayLow;

    // Sentiment calculate karo
    let sentiment = "NEUTRAL";
    let percent = 50;

    if(change > 1) {
      sentiment = "STRONG BULLISH";
      percent = 75 + Math.floor(change);
    } else if (change > 0.3) {
      sentiment = "BULLISH";
      percent = 60 + Math.floor(change * 10);
    } else if (change < -1) {
      sentiment = "STRONG BEARISH";
      percent = 25 + Math.floor(change);
    } else if (change < -0.3) {
      sentiment = "BEARISH";
      percent = 40 + Math.floor(change * 10);
    }

    percent = Math.min(95, Math.max(5, percent));

    // JSON response bhejo
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
      success: true,
      price: parseFloat(price.toFixed(2)),
      change: parseFloat(change.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      sentiment: sentiment,
      percent: percent
    });

  } catch (error) {
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({
      success: false,
      error: 'Data fetch failed',
      message: error.message
    });
  }
}
