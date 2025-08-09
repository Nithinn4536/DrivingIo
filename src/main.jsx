import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
// This import is for a global CSS file, if you choose to add one
import './index.css'; 

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
