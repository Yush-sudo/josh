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
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type, data }));
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
const pisofiApiUrl = 'http://10.0.0.1/admin/sales/daily'; // Replace with actual endpoint

async function fetchSalesData() {
  try {
    const response = await fetch(pisofiApiUrl, {
      headers: {
        'Authorization': 'Bearer YOUR_API_KEY' // Replace with your actual API key
      }
    });

    if (!response.ok) throw new Error('Failed to fetch sales data');
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
  } catch (error) {
    console.error('Error fetching sales data:', error);
  }
}

// Fetch sales data every 60 seconds
setInterval(fetchSalesData, 60000);

// ✅ Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  fetchSalesData(); // Fetch once on start
});
