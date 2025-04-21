const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const bodyParser = require('body-parser');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Middleware
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));

// 🔐 Session setup
app.use(session({
  secret: 'mySecretKey123',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 60 * 60 * 1000 } // 1 hour
}));

// ✅ In-memory user store
const users = [
  { username: 'admin', password: 'password123' },
  { username: 'user', password: 'userpass' }
];

// ✅ API routes
app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/sensor'));
app.use('/api', require('./routes/disableAlarm'));

// ✅ WebSocket setup
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ✅ WebSocket broadcast utility
function broadcast(type, data) {
  const message = JSON.stringify({ type, data });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// ✅ Intrusion alert route with WebSocket
app.use('/api', require('./routes/intrusionAlert')(wss));

// ✅ Login route
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ✅ Login handler
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (user) {
    req.session.loggedIn = true;
    res.redirect('/');
  } else {
    res.send('Invalid credentials. <a href="/login">Try again</a>.');
  }
});

// ✅ Logout route
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// ✅ Protected dashboard route
app.get('/', (req, res) => {
  if (!req.session.loggedIn) {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ✅ Catch-all route
app.get('*', (req, res) => {
  res.redirect('/login');
});

// ✅ Watch alarm.txt and broadcast alerts
fs.watchFile("alarm.txt", () => {
  try {
    const alarmStatus = fs.readFileSync("alarm.txt", "utf8").trim();
    const isIntrusion = alarmStatus === "on";
    broadcast("intrusionAlert", { alert: isIntrusion });
    console.log("🔔 WebSocket pushed intrusion alert:", isIntrusion);
  } catch (err) {
    console.error("❌ Error reading alarm.txt:", err);
  }
});

// ✅ Fetch and broadcast sales data from Pisofi Admin
const pisofiApiUrl = 'http://10.0.0.1/admin/sales/daily'; // Replace with the actual API endpoint

async function fetchSalesData() {
  try {
    const response = await fetch(pisofiApiUrl, {
      headers: {
        'Authorization': 'Bearer CVJeTuYBsxAwWm8tozK55xSevS5tWROMNDn4U4odI2keqLaV4mO3uuDAf2QNf5POFESJeZzdiPBYjeASYOE4slTTu0pp0e6jwQAKVvMH955Le9JopNsaktvMXEDUoFYoFVDynuB2eZSp2LItvK0jHr19NiRZ1eyVzYUJzIgGKh3aJU3a0pd8zZJIO13WcGd9Qea5PXsFrmaNm5IHbX5WSrJeegnA6d6MWzSisIw54b8WBrsBb6P0JDFOE3EcyQzXbtIMgkBVHgrZRqvETSfQ9NtWMZrIIKiibvwYZlLgYyrqKUFHxWL4LgG642CXt6NVHv3M1fYJPCyMGMVz5GwJaoTlydswDYY5DTuzdbbaoA00EeFKEpB1KE1LpLsQydjEUWTLNU6NLCPeQyahNUu5hPvtA6N2P0p3dZ1Fuzb8t9zcq2W7lnd9c5uJkwFbOjZdTKCPI0y3m7ko1KO14vK5EJFbh0rBmdlUgffAVCCeD4vgZP6TQPV7ge6m83me8WqkwAT4T8NPzIINBI9LCjCl6zy0Gl25qWOf22v0BJvBpOhZPc5C3FKBUjdAJZ7dECRJlYfLbCOpBpQVPygtlZ1ThfjHcRkPj84bnfjtJRivGUXj0SxO1tndTfTv3Op43gukDA6Pr35C5QVU8zNiaKxgtPjLDKIYMcnuXghI1L8rGq3zxCq3UEXuuc0TrlgbvZbouIcaowMKnrsHD0ztTHAyg4Vlkg49iEh2Ou5H5X7SkB8c6YVwu1zt8SjKPXEglGPBaUvpeIGWe0qsOgw996qpTnPdYGQLDJrrKOVyk3EPxULGO5onbz9GvlRzTUypFb2yfcXJF9kItBgzqzINKf9AFOygNiPzwutNcFEnw43a9U73JY0sXKooUvChvB1VDhudv7gihfzUOCEpE7mOzA4jp4Rc7pcLKOfdmjm5sq6UYgQAPkTW2cLImMu0sFcmBq5JlAWgrSzKUQsxDHrrPnt0yvHM43JP8S9p9lsyzRcpdJzOx84pmSKQbig89NZp2JpU' // Real API token
      }
    });

    const contentType = response.headers.get('content-type');
    console.log('Response status:', response.status);
    console.log('Content-Type:', contentType);

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      const salesData = {
        type: 'salesUpdate',
        data: {
          daily: data.daily_sales || 'N/A',
          weekly: data.weekly_sales || 'N/A',
          monthly: data.monthly_sales || 'N/A'
        }
      };

      broadcast('salesUpdate', salesData.data);
      console.log("📤 Broadcasted sales data:", salesData.data);
    } else {
      const text = await response.text();
      console.warn('⚠️ Received non-JSON response from Pisofi:', text.slice(0, 100)); // Log first 100 chars of response body
    }

  } catch (error) {
    console.error('❌ Error fetching sales data:', error.message);
    // Retry after 10 seconds if an error occurs
    setTimeout(fetchSalesData, 10000);
  }
}

// Fetch sales data every 60 seconds
setInterval(fetchSalesData, 60000);

// ✅ Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  fetchSalesData(); // Initial fetch on server start
});
