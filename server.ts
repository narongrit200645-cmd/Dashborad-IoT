import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Initialize IoT Data Store matching screenshot exact default values
  let iotStore = {
    v100_ln: 0.0,
    v220_ln: 0.0,
    temperature: 24.8,
    v100_lg: 0.0,
    v220_lg: 0.0,
    humidity: 50.3,
    gnd_100v: 0.0,
    gnd_220v: 0.0,
    barometer: 1010.09,
    lastUpdated: new Date().toISOString(),
    status: 'online',
    esp32Ip: '192.168.1.105',
    tempTarget: 23,
    tempTolerance: 3,
    humidityTarget: 55,
    humidityTolerance: 15,
  };

  // Generate initial history data spanning Monday to Sunday
  const days = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
  let historyData: Array<{
    id: string;
    day: string;
    time: string;
    dateStr: string;
    timestamp: number;
    temperature: number;
    tempMin: number;
    tempMax: number;
    humidity: number;
    humMin: number;
    humMax: number;
  }> = [];

  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dayName = days[(d.getDay() + 6) % 7];
    
    // Add two points per day (12:00 and 00:00)
    for (const hour of ['00:00', '12:00']) {
      // Small random variations around baseline
      const tempVar = (Math.sin(i * 1.5) * 1.2 + (Math.random() - 0.5) * 0.8).toFixed(1);
      const humVar = (Math.cos(i * 1.2) * 2.5 + (Math.random() - 0.5) * 1.5).toFixed(1);

      historyData.push({
        id: `${d.toISOString()}-${hour}`,
        day: dayName,
        time: hour,
        dateStr: `${d.getDate()}-${d.toLocaleString('default', { month: 'short' })}-26`,
        timestamp: d.getTime(),
        temperature: Number((23 + parseFloat(tempVar)).toFixed(1)),
        tempMin: 20, // 23 - 3
        tempMax: 26, // 23 + 3
        humidity: Number((50 + parseFloat(humVar)).toFixed(1)),
        humMin: 40, // 55 - 15
        humMax: 70, // 55 + 15
      });
    }
  }

  // Saved chart exports history
  let chartExports: Array<{
    id: string;
    timestamp: string;
    type: 'auto' | 'manual';
    title: string;
    imageData: string;
  }> = [];

  // API Endpoints
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', serverTime: new Date().toISOString() });
  });

  // Get current IoT status & telemetry
  app.get('/api/iot/data', (req, res) => {
    res.json({
      telemetry: iotStore,
      history: historyData,
      exportsCount: chartExports.length,
    });
  });

  // ESP32 or simulation update endpoint
  app.post('/api/iot/update', (req, res) => {
    const data = req.body;
    
    if (typeof data.temperature === 'number') iotStore.temperature = Number(data.temperature.toFixed(1));
    if (typeof data.humidity === 'number') iotStore.humidity = Number(data.humidity.toFixed(1));
    if (typeof data.barometer === 'number') iotStore.barometer = Number(data.barometer.toFixed(2));
    if (typeof data.v100_ln === 'number') iotStore.v100_ln = Number(data.v100_ln.toFixed(1));
    if (typeof data.v220_ln === 'number') iotStore.v220_ln = Number(data.v220_ln.toFixed(1));
    if (typeof data.v100_lg === 'number') iotStore.v100_lg = Number(data.v100_lg.toFixed(1));
    if (typeof data.v220_lg === 'number') iotStore.v220_lg = Number(data.v220_lg.toFixed(1));
    if (typeof data.gnd_100v === 'number') iotStore.gnd_100v = Number(data.gnd_100v.toFixed(1));
    if (typeof data.gnd_220v === 'number') iotStore.gnd_220v = Number(data.gnd_220v.toFixed(1));
    if (data.status) iotStore.status = data.status;

    iotStore.lastUpdated = new Date().toISOString();

    // Append to live history
    const d = new Date();
    const dayName = days[(d.getDay() + 6) % 7];
    const hour = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    
    historyData.push({
      id: Date.now().toString(),
      day: dayName,
      time: hour,
      dateStr: `${d.getDate()}-${d.toLocaleString('default', { month: 'short' })}-26`,
      timestamp: d.getTime(),
      temperature: iotStore.temperature,
      tempMin: iotStore.tempTarget - iotStore.tempTolerance,
      tempMax: iotStore.tempTarget + iotStore.tempTolerance,
      humidity: iotStore.humidity,
      humMin: iotStore.humidityTarget - iotStore.humidityTolerance,
      humMax: iotStore.humidityTarget + iotStore.humidityTolerance,
    });

    // Keep history bounded to last 50 points
    if (historyData.length > 50) {
      historyData = historyData.slice(historyData.length - 50);
    }

    res.json({ success: true, message: 'Data updated successfully', telemetry: iotStore });
  });

  // Save exported chart snapshot
  app.post('/api/iot/export-save', (req, res) => {
    const { imageData, type, title } = req.body;
    if (!imageData) {
      return res.status(400).json({ error: 'Missing image data' });
    }

    const newExport = {
      id: `exp_${Date.now()}`,
      timestamp: new Date().toLocaleString('th-TH'),
      type: type || 'manual',
      title: title || 'IoT Graph Snapshot',
      imageData,
    };

    chartExports.unshift(newExport);
    if (chartExports.length > 20) chartExports = chartExports.slice(0, 20);

    res.json({ success: true, item: newExport });
  });

  // Get list of exported charts
  app.get('/api/iot/exports', (req, res) => {
    res.json({ exports: chartExports });
  });

  // Reset/Clear history data
  app.post('/api/iot/reset-history', (req, res) => {
    historyData = [];
    res.json({ success: true, message: 'History cleared' });
  });

  // Vite development vs production serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
