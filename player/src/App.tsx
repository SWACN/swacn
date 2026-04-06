import { useState } from 'react'
import { SwacnPlayer } from './components/SwacnPlayer'

function App() {
  // Replace this with a real UUID from your database/uploads folder!
  const [castId, setCastId] = useState('YOUR-CAST-UUID-HERE');

  // Because of our Vite proxy, we point to /api/uploads/...
  const castUrl = `/api/uploads/${castId}/recording.cast`;
  const baselineUrl = `/api/uploads/${castId}/baseline.tar.gz`;

  return (
    <div style={{ maxWidth: '800px', margin: '50px auto', fontFamily: 'sans-serif' }}>
      <h1>SWACN Player Test Harness</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <input 
          type="text" 
          value={castId}
          onChange={(e) => setCastId(e.target.value)}
          placeholder="Enter Cast UUID"
          style={{ padding: '8px', width: '300px', marginRight: '10px' }}
        />
      </div>

      {castId !== 'YOUR-CAST-UUID-HERE' && castId !== '' ? (
        <SwacnPlayer key={castId} castUrl={castUrl} baselineUrl={baselineUrl} />
      ) : (
        <p>Please enter a valid Cast UUID to test.</p>
      )}
    </div>
  )
}

export default App