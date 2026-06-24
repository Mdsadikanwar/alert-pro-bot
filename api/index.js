export default async function handler(req, res) {
  try {
    // CoinGecko API - Binance से ज्यादा reliable Vercel पे
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }
    
    const data = await response.json();
    const price = data.bitcoin.usd;
    
    res.status(200).json({ 
      ok: true, 
      message: "Bot is live", 
      btc_price: `$${price.toFixed(2)}`,
      source: "CoinGecko",
      time: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    });
    
  } catch (error) {
    res.status(500).json({ 
      ok: false, 
      error: error.message,
      time: new Date().toISOString()
    });
  }
}
