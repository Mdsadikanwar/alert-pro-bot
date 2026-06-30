export default async function handler(req, res) {
  try {
    // Step 1: NSE se live data laao
    const nseResponse = await fetch('https://www.nseindia.com/api/equity-stockIndices?index=NIFTY 50', {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    
    const nseData = await nseResponse.json();
    const nifty = nseData.data[0];
    
    const price = nifty.lastPrice;
    const change = nifty.pChange;
    const high = nifty.dayHigh;
    const low = nifty.dayLow;

    // Step 2: Sentiment calculate karo
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

    // Step 3: Frontend ko data bhejo
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
    res.status(500).json({ 
      success: false, 
      error: 'NSE data fetch failed',
      message: error.message 
    });
  }
}
