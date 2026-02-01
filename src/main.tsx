import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'

// Note: Mock API is disabled as we use Supabase for real authentication
// If you need to test without Supabase, uncomment the following lines:
// import { setupMockApi } from './lib/mock-api-server'
// setupMockApi();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);