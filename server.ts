import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// ตัวแปรเก็บข้อมูลจำลอง (In-memory Storage)
let currentTelemetry = {
  v100_ln: 0, v220_ln: 0, temperature: 24.8, v100_lg: 0,
  v220_lg: 0, humidity: 50.3, gnd_100v: 0, gnd_220v: 0,
  barometer: 1010.09, lastUpdated: new Date().toISOString(),
  status: 'online', tempTarget: 23, tempTolerance: 3,
  humidityTarget: 55, humidityTolerance: 15,
};

let historyData: any[] = []; // เก็บประวัติกราฟ
let clients: any[] = []; // เก็บ Connection ของหน้าเว็บที่เปิดอยู่ (SSE)

// 1. API: ส่งข้อมูลเริ่มต้นให้หน้าเว็บตอนโหลด
app.get('/api/iot/data', (req, res) => {
  res.json({ telemetry: currentTelemetry, history: historyData });
});

// 2. API: รับข้อมูลจาก ESP32 (POST)
app.post('/api/iot/update', (req, res) => {
  const data = req.body;
  
  // อัปเดตข้อมูลล่าสุด
  currentTelemetry = { 
    ...currentTelemetry, 
    ...data, 
    lastUpdated: new Date().toISOString(),
    status: 'online'
  };

  // บันทึกลงกราฟ (เก็บแค่ 200 ค่าล่าสุด ป้องกันเมมโมรี่เต็ม)
  const now = new Date();
  historyData.push({
    time: now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][now.getDay()],
    dateStr: now.toLocaleDateString('th-TH'),
    temperature: currentTelemetry.temperature,
    humidity: currentTelemetry.humidity,
  });
  if (historyData.length > 200) historyData.shift();

  // บรอดแคสต์ข้อมูลแบบ Real-time ให้ทุกหน้าเว็บที่เปิดอยู่
  clients.forEach(client => client.res.write(`data: ${JSON.stringify({ telemetry: currentTelemetry })}\n\n`));

  res.status(200).json({ success: true, message: 'Data updated successfully' });
});

// 3. API: สำหรับเปิดท่อเชื่อมต่อ Real-time (Server-Sent Events)
app.get('/api/iot/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const clientId = Date.now();
  const newClient = { id: clientId, res };
  clients.push(newClient);

  req.on('close', () => {
    clients = clients.filter(client => client.id !== clientId);
  });
});

// API สำหรับบันทึกรูปภาพ Export
app.post('/api/iot/export-save', (req, res) => {
  // ในเวอร์ชันจริงอาจจะบันทึกรูปภาพลงฐานข้อมูล หรือ AWS S3
  res.status(200).json({ success: true });
});

// ให้บริการไฟล์หน้าเว็บ (Frontend) สำหรับ Production
app.use(express.static(path.join(__dirname, '../dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});