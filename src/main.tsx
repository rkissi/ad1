import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'

// Enable Mock API only in development or when explicitly requested
import { setupMockApi } from './lib/mock-api-server'

if (import.meta.env.DEV || import.meta.env.VITE_USE_MOCK_API === "true") {
  setupMockApi();
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);