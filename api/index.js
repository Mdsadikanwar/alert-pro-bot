export default async function handler(req, res) {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    const data = await response.json();
    const price = data.bitcoin.usd;
    
    const TOKEN = process.env.TELEGRAM_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
    const ALERT_PRICE = 110000; // $110k पे alert बजेगा
    
    let message = `BTC: $${price.toFixed(2)}\nTime: ${new Date().toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'})}`;
    let alert_sent = false;
    
    // Alert logic - $110k cross होते ही धमाका
    if (price >= ALERT_PRICE && TOKEN && CHAT_ID) {
      message = `🚨 ALERT! BTC $${price.toFixed(2)} cross कर गया!\n$110k टूट गया भाई! 🔥`;
      alert_sent = true;
      
      await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({chat_id: CHAT_ID, text: message})
      });
    }
    
    res.status(200).json({ ok: true, btc_price: `$${price.toFixed(2)}`, alert_sent });
    
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}
