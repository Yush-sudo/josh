const express = require('express');
const { API_KEY } = require('../config');
const fs = require('fs');
const router = express.Router();

router.post('/disable-alarm', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${API_KEY}`) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  fs.writeFileSync("alarm.txt", "off");
  console.log('Alarm disabled via API');
  res.status(200).json({ success: true, message: 'Alarm disabled' });
});

module.exports = router;
