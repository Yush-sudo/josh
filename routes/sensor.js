const express = require('express');
const { API_KEY } = require('../config');
const router = express.Router();

router.post('/sensor', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${API_KEY}`) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const { pir, door } = req.body;
  console.log('Sensor Data:', { pir, door });
  res.status(200).json({ success: true, message: 'Sensor data received' });
});

module.exports = router;
