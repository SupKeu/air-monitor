require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { TuyaContext } = require('@tuya/tuya-connector-nodejs');
const tuya = new TuyaContext({
  baseUrl: 'https://openapi.tuyaeu.com',
  accessKey: process.env.TUYA_ID,
  secretKey: process.env.TUYA_SECRET,
});
const app = express();
app.use(cors());
app.use(express.static('public'));
app.get('/api/air', async (req, res) => {
  try {
    const r = await tuya.request({ path: `/v1.0/devices/${process.env.DEVICE_ID}`, method: 'GET' });
    if (!r.success) return res.status(500).json(r);
    res.json({ online: r.result.online, status: r.result.status });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.listen(process.env.PORT || 3000, () => console.log('Open http://localhost:3000'));
