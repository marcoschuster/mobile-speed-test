const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

app.use(express.static('.'));

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Mobile Speed Test</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          color: white;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          text-align: center;
        }
        h1 {
          font-size: 2.5em;
          margin-bottom: 30px;
        }
        .info-box {
          background: rgba(255, 255, 255, 0.1);
          padding: 20px;
          border-radius: 10px;
          margin: 20px 0;
        }
        .button {
          background: #4CAF50;
          color: white;
          padding: 15px 30px;
          border: none;
          border-radius: 5px;
          font-size: 18px;
          cursor: pointer;
          margin: 10px;
        }
        .button:hover {
          background: #45a049;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Mobile Speed Test App</h1>
        <div class="info-box">
          <h2>🚀 Speed Test Application</h2>
          <p>This is a React Native mobile speed test application.</p>
          <p>To view on your phone:</p>
          <ol style="text-align: left; display: inline-block;">
            <li>Install Expo Go app from App Store/Play Store</li>
            <li>Open Expo Go and scan the QR code from Expo CLI</li>
            <li>Or access this web version directly</li>
          </ol>
        </div>
        <div class="info-box">
          <h3>📱 App Features:</h3>
          <ul style="text-align: left; display: inline-block;">
            <li>Speed Test functionality</li>
            <li>History tracking</li>
            <li>Mobile-optimized UI</li>
          </ul>
        </div>
        <button class="button" onclick="window.location.reload()">🔄 Refresh</button>
      </div>
    </body>
    </html>
  `);
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Access from your phone: http://YOUR_LOCAL_IP:${port}`);
});
