import express from 'react-example/node_modules/@types/express'; // ใช้ express ตามแพ็กเกจที่คุณลงไว้
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json()); // ให้เซิร์ฟเวอร์อ่าน JSON จาก ESP32 ได้

// ==========================================
// 1. เชื่อมต่อฐานข้อมูล Supabase
// ==========================================
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// เก็บ Client (ผู้ใช้เว็บ) ที่รอรับข้อมูล Real-time
let clients: express.Response[] = [];

// ==========================================
// 2. API สำหรับ ESP32 ยิงข้อมูลเข้ามา (ESP32 POST Endpoint)
// ==========================================
app.post('/api/iot/insert', async (req, res) => {
  try {
    const data = req.body;

    // 1. บันทึกลงตาราง sensor_data ใน Supabase
    const { error } = await supabase
      .from('sensor_data')
      .insert([
        {
          device_id: data.device_id || 'main_01',
          avg_temp: data.avg_temp,
          avg_hum: data.avg_hum,
          pressure: data.pressure,
          voltage_100_ln: data.voltage_100_ln,
          voltage_100_lg: data.voltage_100_lg,
          voltage_220_ln: data.voltage_220_ln,
          voltage_220_lg: data.voltage_220_lg,
          g_100: data.g_100,
          g_220: data.g_220,
        }
      ]);

    if (error) throw error;

    // 2. จัดรูปแบบข้อมูลให้ตรงกับที่ App.tsx คาดหวัง
    const telemetryUpdate = {
      telemetry: {
        temperature: data.avg_temp,
        humidity: data.avg_hum,
        barometer: data.pressure,
        v100_ln: data.voltage_100_ln,
        v100_lg: data.voltage_100_lg,
        v220_ln: data.voltage_220_ln,
        v220_lg: data.voltage_220_lg,
        gnd_100v: data.g_100,
        gnd_220v: data.g_220,
      }
    };

    // 3. บรอดแคสต์ (Broadcast) ข้อมูลใหม่ไปให้หน้าเว็บผ่าน SSE ทันที
    clients.forEach(client => {
      client.write(`data: ${JSON.stringify(telemetryUpdate)}\n\n`);
    });

    res.status(200).json({ success: true, message: 'Data saved and broadcasted' });
  } catch (error: any) {
    console.error('Insert error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 3. API สำหรับหน้าเว็บดึงข้อมูลตอนโหลดครั้งแรก (Initial Load)
// ==========================================
app.get('/api/iot/data', async (req, res) => {
  try {
    // ดึงข้อมูลล่าสุด 7 วัน (สมมติ 336 แถว หากส่งทุก 30 นาที) จาก Supabase
    const { data: records, error } = await supabase
      .from('sensor_data')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(336); 

    if (error) throw error;

    if (!records || records.length === 0) {
       return res.json({ telemetry: {}, history: [] });
    }

    // แปลงข้อมูลจากฐานข้อมูลให้เป็น HistoryPoint สำหรับกราฟ
    const history = records.map(record => {
      const date = new Date(record.created_at);
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return {
        time: date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
        day: days[date.getDay()],
        dateStr: date.toLocaleDateString('th-TH'),
        temperature: record.avg_temp,
        humidity: record.avg_hum,
      };
    });

    // เอาข้อมูลล่าสุดแถวสุดท้ายมาโชว์บนการ์ด
    const latest = records[records.length - 1];
    const telemetry = {
        temperature: latest.avg_temp,
        humidity: latest.avg_hum,
        barometer: latest.pressure,
        v100_ln: latest.voltage_100_ln,
        v100_lg: latest.voltage_100_lg,
        v220_ln: latest.voltage_220_ln,
        v220_lg: latest.voltage_220_lg,
        gnd_100v: latest.g_100,
        gnd_220v: latest.g_220,
    };

    res.json({ telemetry, history });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 4. API สำหรับส่งข้อมูล Real-time (Server-Sent Events)
// ==========================================
app.get('/api/iot/stream', (req, res) => {
  // ตั้งค่า Header ให้เป็นการจำลองสตรีม
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); // ส่ง Header ไปก่อน

  // เก็บ client เข้าไปในระบบ
  clients.push(res);

  // ส่งข้อมูล ping ว่างๆ ไปทุกๆ 30 วิ ไม่ให้การเชื่อมต่อหลุด
  const keepAlive = setInterval(() => {
    res.write(':\n\n'); 
  }, 30000);

  // เมื่อผู้ใช้ปิดหน้าเว็บ ให้ลบ client ออก
  req.on('close', () => {
    clearInterval(keepAlive);
    clients = clients.filter(client => client !== res);
  });
});

// ==========================================
// 5. Mock Endpoint สำหรับ Export
// ==========================================
app.post('/api/iot/export-save', (req, res) => {
  // หากต้องการเซฟรูปภาพลงฐานข้อมูลจริง ๆ สามารถเขียนต่อยอดตรงนี้ได้
  res.status(200).json({ success: true });
});

// เริ่มต้น Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});