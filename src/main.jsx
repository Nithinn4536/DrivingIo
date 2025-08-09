mport React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
// The import for a global CSS file has been removed as it was causing a build error
// import './index.css'; 

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
