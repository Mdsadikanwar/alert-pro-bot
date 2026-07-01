import { useState, useEffect } from 'react'

export default function Home() {
  const [price, setPrice] = useState(65000)
  const [qty, setQty] = useState(0.001)
  const [balance, setBalance] = useState(10000)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const getPrice = async () => {
      const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT')
      const data = await res.json()
      setPrice(parseFloat(data.price))
    }
    getPrice()
    const interval = setInterval(getPrice, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleTrade = async (type) => {
    setLoading(true)
    setMsg('')
    
    const res = await fetch('/api/trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: 'BTCUSDT',
        type: type,
        qty: qty,
        price: price
      })
    })
    
    const data = await res.json()
    setLoading(false)
    
    if (data.success) {
      setMsg(`✅ ${data.msg}`)
      setBalance(data.balance)
    } else {
      setMsg(`❌ ${data.error}`)
    }
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial', maxWidth: '400px', margin: '0 auto' }}>
      <h1>BTC Paper Trading</h1>
      
      <div style={{ background: '#f0f0f0', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
        <h2>Live BTC: ${price.toFixed(2)}</h2>
        <h3>Balance: ${balance.toFixed(2)}</h3>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label>Quantity BTC: </label>
        <input 
          type="number" 
          step="0.001"
          value={qty} 
          onChange={(e) => setQty(parseFloat(e.target.value))}
          style={{ padding: '8px', width: '100px' }}
        />
        <p>Total: ${(qty * price).toFixed(2)}</p>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
        <button 
          onClick={() => handleTrade('BUY')} 
          disabled={loading}
          style={{ 
            flex: 1, padding: '15px', background: 'green', color: 'white', 
            border: 'none', borderRadius: '8px', fontSize: '16px', cursor: 'pointer'
          }}
        >
          {loading ? '...' : 'BUY'}
        </button>
        
        <button 
          onClick={() => handleTrade('SELL')} 
          disabled={loading}
          style={{ 
            flex: 1, padding: '15px', background: 'red', color: 'white', 
            border: 'none', borderRadius: '8px', fontSize: '16px', cursor: 'pointer'
          }}
        >
          {loading ? '...' : 'SELL'}
        </button>
      </div>

      {msg && <p style={{ padding: '10px', background: '#e8e8e8', borderRadius: '5px' }}>{msg}</p>}
    </div>
  )
}
