import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import 'antd/dist/reset.css'

// Remove Firebase imports and initialization
// import { db } from './config/firebase'
// import { setupFirebaseSecurity } from './utils/security'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
