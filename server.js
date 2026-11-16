require('dotenv').config();
for (const k of ['TUYA_ID', 'TUYA_SECRET', 'DEVICE_ID']) {
  if (process.env[k]) process.env[k] = process.env[k].trim().replace(/^["']|["']$/g, '');
}
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

// Текущие значения
app.get('/api/air', async (req, res) => {
  try {
    const r = await tuya.request({ path: `/v1.0/devices/${process.env.DEVICE_ID}`, method: 'GET' });
    if (!r.success) return res.status(500).json(r);
    res.json({ online: r.result.online, status: r.result.status });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// История за 24 часа (из облака Tuya)
const ALLOWED = ['co2_value', 'pm25_value', 'temp_current', 'humidity_value'];
const cache = {};
app.get('/api/history', async (req, res) => {
  const code = String(req.query.code || '');
  if (!ALLOWED.includes(code)) return res.status(400).json({ error: 'unknown code' });
  const hit = cache[code];
  if (hit && Date.now() - hit.t < 60000) return res.json(hit.d);
  try {
    const end = Date.now();
    const start = end - 24 * 3600 * 1000;
    const points = [];
    let lastKey = '';
    for (let i = 0; i < 10; i++) {
      const query = { codes: code, start_time: start, end_time: end, size: 100 };
      if (lastKey) query.last_row_key = lastKey;
      const r = await tuya.request({
        path: `/v2.0/cloud/thing/${process.env.DEVICE_ID}/report-logs`,
        method: 'GET',
        query,
      });
      if (!r.success) return res.status(502).json({ error: r.msg || 'tuya error', tuya_code: r.code });
      const logs = (r.result && r.result.logs) || [];
      for (const l of logs) {
        const v = Number(l.value);
        if (isFinite(v)) points.push([l.event_time, v]);
      }
      if (!r.result.has_more || !r.result.last_row_key) break;
      lastKey = r.result.last_row_key;
    }
    points.sort((a, b) => a[0] - b[0]);
    const d = { code, points };
    cache[code] = { t: Date.now(), d };
    res.json(d);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.listen(process.env.PORT || 3000, () => console.log('Open http://localhost:3000'));
