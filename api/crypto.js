export default async function handler(req, res) {
  try {
    const { coin = 'bitcoin' } = req.query;
    
    // CoinGecko ka simple price API - Vercel pe 100% chalta hai
    const response = await fetch(`https://api.coingecko.com/api/v3/coins/${coin}`);
    
    if (!response.ok) {
      return res.status(500).json({ success: false, message: 'CoinGecko API failed' });
    }

    const data = await response.json();
    
    const price = data.market_data.current_price.usd;
    const change = data.market_data.price_change_percentage_24h;
    
    // Sentiment calculation from 24h change
    let sentiment = "NEUTRAL";
    let percent = 50;
    if(change > 5) { sentiment = "STRONG BULLISH"; percent = 85; }
    else if(change > 2) { sentiment = "BULLISH"; percent = 70; }
    else if(change < -5) { sentiment = "STRONG BEARISH"; percent = 15; }
    else if(change < -2) { sentiment = "BEARISH"; percent = 30; }
    
    res.status(200).json({
      success: true,
      coin: data.name,
      symbol: data.symbol.toUpperCase(),
      price: price,
      change: change,
      sentiment: sentiment,
      percent: percent
    });
    
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}
