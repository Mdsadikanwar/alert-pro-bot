import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { symbol, type, qty, price } = req.body

  try {
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'trader@test.com')
      .single()

    if (!user) return res.status(400).json({ error: 'User not found' })

    const totalCost = qty * price

    if (type === 'BUY') {
      if (user.balance < totalCost) return res.status(400).json({ error: 'Insufficient balance' })
      
      await supabase.from('users').update({ balance: user.balance - totalCost }).eq('id', user.id)
      await supabase.from('trades').insert({ user_id: user.id, symbol, type, qty, price, status: 'OPEN' })
      
      return res.status(200).json({ success: true, msg: 'BUY executed' })
    }

    if (type === 'SELL') {
      await supabase.from('users').update({ balance: user.balance + totalCost }).eq('id', user.id)
      await supabase.from('trades').insert({ user_id: user.id, symbol, type, qty, price, status: 'CLOSED' })
      
      return res.status(200).json({ success: true, msg: 'SELL executed' })
    }

  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
