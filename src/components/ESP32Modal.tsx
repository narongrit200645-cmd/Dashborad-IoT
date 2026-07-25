import React, { useState } from 'react';
import { Cpu, Copy, Check, Sliders, Wifi, Server, RefreshCw, Send } from 'lucide-react';
import { TelemetryData } from '../types';

interface ESP32ModalProps {
  isOpen: boolean;
  onClose: () => void;
  telemetry: TelemetryData;
  onUpdateTelemetry: (updated: Partial<TelemetryData>) => void;
}

export const ESP32Modal: React.FC<ESP32ModalProps> = ({
  isOpen,
  onClose,
  telemetry,
  onUpdateTelemetry,
}) => {
  const [activeTab, setActiveTab] = useState<'simulator' | 'code'>('simulator');
  const [wifiSsid, setWifiSsid] = useState('CalibrationLab_WiFi');
  const [wifiPass, setWifiPass] = useState('LabPass2026');
  const [serverUrl, setServerUrl] = useState(
    window.location.origin + '/api/iot/update'
  );
  const [copied, setCopied] = useState(false);

  // Local state for live simulator sliders
  const [simTemp, setSimTemp] = useState(telemetry.temperature);
  const [simHum, setSimHum] = useState(telemetry.humidity);
  const [simBaro, setSimBaro] = useState(telemetry.barometer);
  const [simV100LN, setSimV100LN] = useState(telemetry.v100_ln);
  const [simV220LN, setSimV220LN] = useState(telemetry.v220_ln);

  if (!isOpen) return null;

  // Generated ESP32 C++ Arduino Code snippet
  const esp32ArduinoCode = `/*
 * Smart IoT Calibration Room Monitoring - ESP32 Firmware
 * Sends Voltage, Temperature, Humidity, and Barometer readings via HTTP POST JSON
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid = "${wifiSsid}";
const char* password = "${wifiPass}";
const char* serverName = "${serverUrl}";

// Sensor pin definitions (e.g., DHT22 / BME280 / Voltage Sensors)
#define DHTPIN 4
#define DHTTYPE DHT22

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  
  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\\nConnected! IP address: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverName);
    http.addHeader("Content-Type", "application/json");

    // Read real sensors or ADC inputs
    float temp = 24.8; // e.g. dht.readTemperature();
    float hum = 50.3;  // e.g. dht.readHumidity();
    float baro = 1010.09; // e.g. bme.readPressure() / 100.0F;
    float v100_ln = 0.0;
    float v220_ln = 0.0;
    float v100_lg = 0.0;
    float v220_lg = 0.0;
    float gnd100 = 0.0;
    float gnd220 = 0.0;

    // Build JSON Payload
    StaticJsonDocument<256> doc;
    doc["temperature"] = temp;
    doc["humidity"] = hum;
    doc["barometer"] = baro;
    doc["v100_ln"] = v100_ln;
    doc["v220_ln"] = v220_ln;
    doc["v100_lg"] = v100_lg;
    doc["v220_lg"] = v220_lg;
    doc["gnd_100v"] = gnd100;
    doc["gnd_220v"] = gnd220;
    doc["status"] = "online";

    String jsonOutput;
    serializeJson(doc, jsonOutput);

    int httpResponseCode = http.POST(jsonOutput);
    
    if (httpResponseCode > 0) {
      Serial.print("Data sent successfully. HTTP Code: ");
      Serial.println(httpResponseCode);
    } else {
      Serial.print("Error sending POST: ");
      Serial.println(httpResponseCode);
    }
    http.end();
  } else {
    Serial.println("Wi-Fi Disconnected!");
  }

  // Send update every 5 seconds
  delay(5000);
}
`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(esp32ArduinoCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleApplySimulatedData = () => {
    onUpdateTelemetry({
      temperature: Number(simTemp),
      humidity: Number(simHum),
      barometer: Number(simBaro),
      v100_ln: Number(simV100LN),
      v220_ln: Number(simV220LN),
      lastUpdated: new Date().toISOString(),
      status: 'simulated',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-[#0F172A] border border-blue-600/70 rounded-2xl shadow-2xl text-white overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#1E293B] border-b border-blue-900/60">
          <div className="flex items-center space-x-2">
            <Cpu className="w-6 h-6 text-amber-400" />
            <h2 className="text-xl font-bold text-white">
              ระบบเชื่อมต่อ ESP32 / IoT Hardware Integration
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl font-bold p-1 rounded-lg hover:bg-slate-800 transition"
          >
            &times;
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-[#0B1329]">
          <button
            onClick={() => setActiveTab('simulator')}
            className={`flex-1 py-3 text-sm font-bold flex items-center justify-center space-x-2 border-b-2 transition ${
              activeTab === 'simulator'
                ? 'border-blue-500 text-blue-400 bg-blue-950/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>จำลองการส่งค่า ESP32 (Live Simulator)</span>
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`flex-1 py-3 text-sm font-bold flex items-center justify-center space-x-2 border-b-2 transition ${
              activeTab === 'code'
                ? 'border-blue-500 text-blue-400 bg-blue-950/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>โค้ด ESP32 C++ (Arduino Code)</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {activeTab === 'simulator' ? (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-800/60 text-xs text-blue-200">
                💡 <b>คำแนะนำ:</b> ท่านสามารถปรับแถบสไลเดอร์เพื่อจำลองการส่งค่าจากบอร์ด ESP32
                แบบเรียลไทม์ ค่าบนหน้าแดชบอร์ดและกราฟจะอัปเดตทันที
              </div>

              {/* Sliders Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Temp */}
                <div className="p-4 rounded-xl bg-[#1B2745] border border-blue-900/50 space-y-2">
                  <div className="flex justify-between text-sm font-bold">
                    <span className="text-rose-300">Temperature (อุณหภูมิ):</span>
                    <span className="text-white font-mono">{simTemp} °C</span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="35"
                    step="0.1"
                    value={simTemp}
                    onChange={(e) => setSimTemp(Number(e.target.value))}
                    className="w-full accent-rose-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>15 °C</span>
                    <span>23 °C (Target)</span>
                    <span>35 °C</span>
                  </div>
                </div>

                {/* Humidity */}
                <div className="p-4 rounded-xl bg-[#1B2745] border border-blue-900/50 space-y-2">
                  <div className="flex justify-between text-sm font-bold">
                    <span className="text-cyan-300">Humidity (ความชื้น):</span>
                    <span className="text-white font-mono">{simHum} %</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="90"
                    step="0.1"
                    value={simHum}
                    onChange={(e) => setSimHum(Number(e.target.value))}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>20 %</span>
                    <span>55 % (Target)</span>
                    <span>90 %</span>
                  </div>
                </div>

                {/* Barometer */}
                <div className="p-4 rounded-xl bg-[#1B2745] border border-blue-900/50 space-y-2">
                  <div className="flex justify-between text-sm font-bold">
                    <span className="text-sky-300">Barometer (ความดันอากาศ):</span>
                    <span className="text-white font-mono">{simBaro} hPa</span>
                  </div>
                  <input
                    type="range"
                    min="980"
                    max="1050"
                    step="0.1"
                    value={simBaro}
                    onChange={(e) => setSimBaro(Number(e.target.value))}
                    className="w-full accent-sky-400 cursor-pointer"
                  />
                </div>

                {/* Voltage 100V L-N */}
                <div className="p-4 rounded-xl bg-[#1B2745] border border-blue-900/50 space-y-2">
                  <div className="flex justify-between text-sm font-bold">
                    <span className="text-amber-300">100V L-N Voltage:</span>
                    <span className="text-white font-mono">{simV100LN} V</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="130"
                    step="1"
                    value={simV100LN}
                    onChange={(e) => setSimV100LN(Number(e.target.value))}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleApplySimulatedData}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-lg transition flex items-center justify-center space-x-2"
              >
                <Send className="w-4 h-4" />
                <span>ส่งค่าจำลองเข้า Dashboard ทันที (Simulate ESP32 POST)</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Settings Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[#1B2745] border border-blue-900/50">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                    <Wifi className="w-3.5 h-3.5 text-amber-400" />
                    Wi-Fi SSID Name:
                  </label>
                  <input
                    type="text"
                    value={wifiSsid}
                    onChange={(e) => setWifiSsid(e.target.value)}
                    className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                    <Server className="w-3.5 h-3.5 text-blue-400" />
                    Dashboard API Endpoint:
                  </label>
                  <input
                    type="text"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              {/* Code Viewer */}
              <div className="relative rounded-xl bg-slate-950 border border-slate-800 p-4 font-mono text-xs text-emerald-400 overflow-x-auto">
                <button
                  onClick={handleCopyCode}
                  className="absolute top-3 right-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-sans text-xs font-bold rounded-lg transition flex items-center space-x-1.5 shadow"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'คัดลอกเรียบร้อย!' : 'คัดลอกโค้ด C++'}</span>
                </button>
                <pre>{esp32ArduinoCode}</pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#1E293B] border-t border-blue-900/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 font-bold text-sm text-white rounded-lg transition"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
