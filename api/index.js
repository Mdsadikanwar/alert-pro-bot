export default async function handler(req, res) {
  try {
    const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
    const data = await response.json();
    
    res.status(200).json({ 
      ok: true, 
      message: "Bot is live", 
      btc_price: `$${parseFloat(data.price).toFixed(2)}`,
      time: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}
