export default function handler(req, res) {
  return res.status(200).json({ ok: true, message: "Bot is live", price: "checking..." });
}
