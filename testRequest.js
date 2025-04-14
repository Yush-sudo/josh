const http = require('http');

const data = JSON.stringify({
  device_id: "ESP32_001",
  intrusion: true,
  triggered_by: "PIR Sensor",
  status: "detected",
  timestamp: "123456"
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/intrusion-alert',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('✅ Response:', body));
});

req.on('error', error => {
  console.error('❌ Request failed:', error);
});

req.write(data);
req.end();
