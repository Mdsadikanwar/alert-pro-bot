export default async function handler(req, res) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  
  const message = `📈 SHARE MARKET TEST ALERT 📈\n\nStrategy: NIFTY Test\nTime: ${new Date().toLocaleString('en-IN')}\n\nYe test alert hai. Share Market Backend working hai ✅`;

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message
      })
    });
    
    const data = await response.json();
    
    if (data.ok) {
      res.status(200).json({ success: true, msg: 'Share Alert sent!' });
    } else {
      res.status(500).json({ error: 'Telegram failed', details: data });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed', details: error.message });
  }
}
