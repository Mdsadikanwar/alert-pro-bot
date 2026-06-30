export default async function handler(req, res) {
  try {
    // Step 1: Pehle NSE ka homepage hit karo cookie lene ke liye
    await fetch('https://www.nseindia.com', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    // Step 2: Ab real API call karo with proper headers
    const nseResponse = await fetch('https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%2050', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.nseindia.com/'
      }
    });

    if (!nseResponse.ok) {
      throw new Error('NSE API failed');
    }

    const nseData = await nseResponse.json();
    const nifty = nseData.data[0];

    const price = parseFloat(nifty.lastPrice);
    const change = parseFloat(nifty.pChange);
    const high = parseFloat(nifty.dayHigh);
    const low = parseFloat(nifty.dayLow);

    // Sentiment logic
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

    // JSON bhejo, HTML nahi
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
      success: true,
      price: price,
      change: change,
      high: high,
      low: low,
      sentiment: sentiment,
      percent: percent
    });

  } catch (error) {
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({
      success: false,
      error: 'NSE data fetch failed',
      message: error.message
    });
  }
}
