import React from 'react'
import ReactDOM from 'react-dom/client'
import { ApiProvider } from './lib/components'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ApiProvider basePath="http://localhost:3000">
      <App />
    </ApiProvider>
  </React.StrictMode>,
)
