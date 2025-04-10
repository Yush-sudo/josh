const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser'); // For parsing form data

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Middleware
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));  // Added for parsing POST form data

// ✅ In-memory user credentials (for simplicity)
const users = [
    { username: 'admin', password: 'password123' },
    { username: 'user', password: 'userpass' }
];

// ✅ Routes for features originally from PHP files
app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/sensor'));
app.use('/api', require('./routes/disableAlarm'));

// ✅ Login routes
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html')); // Serve the login form
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Check if the username and password match
  const user = users.find(u => u.username === username && u.password === password);

  if (user) {
    // Successful login, redirect to home or dashboard
    res.redirect('/'); // Adjust as per your route
  } else {
    // Invalid credentials
    res.send('Invalid credentials, please try again.');
  }
});

// ✅ Catch-all to serve index.html
app.get('*', (req, res) => {
  console.log("📢 Request received for:", req.url);
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ✅ HTTP and WebSocket setup
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ✅ Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// ✅ Broadcast function
function broadcast(type, data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type, data }));
    }
  });
}

// ✅ Watch `alarm.txt`
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
