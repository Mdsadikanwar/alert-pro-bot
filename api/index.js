export default async function handler(req, res) {
  try {
    // Binance API से BTC price ले रहे हैं
    const response = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // lastPrice से price ले रहे हैं, वो सबसे accurate होता है
    const price = data.lastPrice;
    
    res.status(200).json({ 
      ok: true, 
      message: "Bot is live", 
      btc_price: `$${parseFloat(price).toFixed(2)}`,
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
