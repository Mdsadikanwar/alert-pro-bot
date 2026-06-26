export default async function handler(req, res) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  
  const message = `🚨 CRYPTO TEST ALERT 🚨\n\nStrategy: BTC Test Strategy\nTime: ${new Date().toLocaleString('en-IN')}\n\nYe test alert hai. Backend working hai ✅`;

  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message
      })
    });
    res.status(200).json({ success: true, msg: 'Alert sent!' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send' });
  }
}
