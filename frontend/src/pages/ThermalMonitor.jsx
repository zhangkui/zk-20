import { createSignal, createEffect, onCleanup } from 'solid-js';
import { Line } from 'solid-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import api from '../services/api';
import wsClient from '../services/websocket';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function ThermalMonitor() {
  const [devices, setDevices] = createSignal([]);
  const [selectedDevice, setSelectedDevice] = createSignal(null);
  const [thermalFrame, setThermalFrame] = createSignal(null);
  const [temperatureHistory, setTemperatureHistory] = createSignal([]);
  const [hotspots, setHotspots] = createSignal([]);
  const [isNightMode, setIsNightMode] = createSignal(false);
  const [currentTemp, setCurrentTemp] = createSignal({
    max: 0,
    min: 0,
    avg: 0,
  });

  const checkNightMode = () => {
    const hour = new Date().getHours();
    setIsNightMode(hour >= 20 || hour < 6);
  };

  const loadDevices = async () => {
    try {
      const data = await api.devices.list();
      setDevices(data || []);
      if (data && data.length > 0 && !selectedDevice()) {
        setSelectedDevice(data[0]);
        loadDeviceData(data[0].id);
      }
    } catch (error) {
      console.error('加载设备列表失败:', error);
    }
  };

  const loadDeviceData = async (deviceId) => {
    try {
      const [thermalData, hotspotData] = await Promise.all([
        api.thermalData.getByDevice(deviceId, { limit: 20 }),
        api.hotspots.list({ device_id: deviceId, limit: 10 }),
      ]);

      if (thermalData && thermalData.length > 0) {
        setThermalFrame(thermalData[0]);
        const temps = thermalData.map((d) => d.max_temperature || 0);
        setCurrentTemp({
          max: Math.max(...temps),
          min: Math.min(...temps),
          avg: temps.reduce((a, b) => a + b, 0) / temps.length,
        });

        const history = thermalData.map((d) => ({
          time: new Date(d.created_at).toLocaleTimeString(),
          max: d.max_temperature || 0,
          min: d.min_temperature || 0,
          avg: d.avg_temperature || 0,
        }));
        setTemperatureHistory(history.reverse());
      }

      setHotspots(hotspotData || []);
    } catch (error) {
      console.error('加载设备数据失败:', error);
    }
  };

  const handleThermalFrame = (data) => {
    if (!selectedDevice() || data.device_id !== selectedDevice().id) return;

    setThermalFrame(data);
    setCurrentTemp({
      max: data.max_temperature || currentTemp().max,
      min: data.min_temperature || currentTemp().min,
      avg: data.avg_temperature || currentTemp().avg,
    });

    setTemperatureHistory((prev) => {
      const newEntry = {
        time: new Date().toLocaleTimeString(),
        max: data.max_temperature || 0,
        min: data.min_temperature || 0,
        avg: data.avg_temperature || 0,
      };
      const updated = [...prev, newEntry];
      return updated.slice(-20);
    });

    if (data.hotspots && data.hotspots.length > 0) {
      setHotspots((prev) => [...data.hotspots, ...prev].slice(0, 10));
    }
  };

  const handleDeviceSelect = (device) => {
    setSelectedDevice(device);
    loadDeviceData(device.id);
  };

  const generateThermalGradient = (temp) => {
    const ratio = Math.min(Math.max((temp - 20) / 40, 0), 1);
    const r = Math.floor(255 * ratio);
    const b = Math.floor(255 * (1 - ratio));
    return `rgb(${r}, ${Math.floor(128 * (1 - Math.abs(ratio - 0.5) * 2))}, ${b})`;
  };

  const getRiskClass = (riskLevel) => {
    switch (riskLevel) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRiskText = (riskLevel) => {
    switch (riskLevel) {
      case 'high':
        return '高风险';
      case 'medium':
        return '中风险';
      case 'low':
        return '低风险';
      default:
        return '未检测';
    }
  };

  createEffect(() => {
    checkNightMode();
    loadDevices();
    wsClient.connect();
    wsClient.on('thermal_frame', handleThermalFrame);
    wsClient.subscribeAll();

    const nightModeInterval = setInterval(checkNightMode, 60000);

    onCleanup(() => {
      wsClient.off('thermal_frame', handleThermalFrame);
      clearInterval(nightModeInterval);
    });
  });

  const tempChartData = {
    labels: temperatureHistory().map((d) => d.time),
    datasets: [
      {
        label: '最高温度',
        data: temperatureHistory().map((d) => d.max),
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: false,
        tension: 0.4,
      },
      {
        label: '平均温度',
        data: temperatureHistory().map((d) => d.avg),
        borderColor: 'rgb(245, 158, 11)',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        fill: false,
        tension: 0.4,
      },
      {
        label: '最低温度',
        data: temperatureHistory().map((d) => d.min),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: false,
        tension: 0.4,
      },
    ],
  };

  const tempChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: '温度变化曲线',
        font: { size: 14 },
      },
    },
    scales: {
      y: {
        beginAtZero: false,
        title: {
          display: true,
          text: '温度 (°C)',
        },
      },
    },
  };

  return (
    <div class={`p-6 min-h-screen ${isNightMode() ? 'bg-gray-900 text-white' : 'bg-gray-50'}`}>
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-4">
          <h1 class="text-2xl font-bold">热成像监控</h1>
          {isNightMode() && (
            <span class="px-3 py-1 bg-indigo-600 text-white text-sm rounded-full flex items-center gap-1">
              <span>🌙</span>
              <span>夜间模式</span>
            </span>
          )}
        </div>
        <button
          onClick={() => setIsNightMode(!isNightMode())}
          class={`px-4 py-2 rounded-lg ${isNightMode() ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`}
        >
          {isNightMode() ? '☀️ 日间模式' : '🌙 夜间模式'}
        </button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div class={`rounded-lg shadow p-4 ${isNightMode() ? 'bg-gray-800' : 'bg-white'}`}>
          <h2 class="font-semibold mb-4">设备选择</h2>
          <div class="space-y-2">
            {devices().length === 0 ? (
              <div class="text-gray-500 text-center py-4">暂无设备</div>
            ) : (
              devices().map((device) => (
                <button
                  onClick={() => handleDeviceSelect(device)}
                  class={`w-full p-3 rounded-lg text-left transition-colors ${
                    selectedDevice()?.id === device.id
                      ? 'bg-blue-600 text-white'
                      : isNightMode()
                      ? 'bg-gray-700 hover:bg-gray-600'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  <div class="font-medium">{device.name}</div>
                  <div class={`text-sm ${selectedDevice()?.id === device.id ? 'text-blue-100' : 'text-gray-500'}`}>
                    {device.building_name || '未分配'}
                  </div>
                  <div class="flex items-center gap-2 mt-1">
                    <span
                      class={`w-2 h-2 rounded-full ${
                        device.status === 'online' ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    />
                    <span class="text-xs">
                      {device.status === 'online' ? '在线' : '离线'}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div class="lg:col-span-2">
          <div class={`rounded-lg shadow p-4 ${isNightMode() ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 class="font-semibold mb-4">
              实时热成像 - {selectedDevice()?.name || '未选择设备'}
            </h2>
            <div
              class={`rounded-lg overflow-hidden ${isNightMode() ? 'bg-gray-950' : 'bg-gray-100'}`}
              style={{ height: '400px', position: 'relative' }}
            >
              {thermalFrame() ? (
                <div class="w-full h-full relative">
                  <div
                    class="absolute inset-0"
                    style={{
                      background: `linear-gradient(135deg, ${generateThermalGradient(currentTemp().min)}, ${generateThermalGradient(currentTemp().avg)}, ${generateThermalGradient(currentTemp().max)})`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'column',
                    }}
                  >
                    <div class="text-6xl font-bold text-white drop-shadow-lg">
                      {currentTemp().max.toFixed(1)}°C
                    </div>
                    <div class="text-xl text-white drop-shadow-lg mt-2">
                      最高温度
                    </div>
                  </div>
                  {thermalFrame().hotspots?.map((hotspot, idx) => (
                    <div
                      class="absolute w-8 h-8 border-2 border-red-500 rounded-full animate-pulse"
                      style={{
                        left: `${hotspot.x || 50}%`,
                        top: `${hotspot.y || 50}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                    >
                      <div class="absolute -top-6 left-1/2 -translate-x-1/2 bg-red-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                        {hotspot.temperature?.toFixed(1) || '0.0'}°C
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div class="w-full h-full flex items-center justify-center text-gray-500">
                  请选择设备查看热成像画面
                </div>
              )}
            </div>

            <div class="grid grid-cols-3 gap-4 mt-4">
              <div class={`p-4 rounded-lg text-center ${isNightMode() ? 'bg-red-900/30' : 'bg-red-50'}`}>
                <div class="text-2xl font-bold text-red-600">{currentTemp().max.toFixed(1)}°C</div>
                <div class="text-sm text-gray-500">最高温度</div>
              </div>
              <div class={`p-4 rounded-lg text-center ${isNightMode() ? 'bg-yellow-900/30' : 'bg-yellow-50'}`}>
                <div class="text-2xl font-bold text-yellow-600">{currentTemp().avg.toFixed(1)}°C</div>
                <div class="text-sm text-gray-500">平均温度</div>
              </div>
              <div class={`p-4 rounded-lg text-center ${isNightMode() ? 'bg-blue-900/30' : 'bg-blue-50'}`}>
                <div class="text-2xl font-bold text-blue-600">{currentTemp().min.toFixed(1)}°C</div>
                <div class="text-sm text-gray-500">最低温度</div>
              </div>
            </div>
          </div>

          <div class={`rounded-lg shadow p-4 mt-6 ${isNightMode() ? 'bg-gray-800' : 'bg-white'}`}>
            <div style={{ height: '250px' }}>
              <Line data={tempChartData} options={tempChartOptions} />
            </div>
          </div>
        </div>

        <div class={`rounded-lg shadow p-4 ${isNightMode() ? 'bg-gray-800' : 'bg-white'}`}>
          <h2 class="font-semibold mb-4">热点检测结果</h2>
          <div class="space-y-3 max-h-[600px] overflow-y-auto">
            {hotspots().length === 0 ? (
              <div class="text-gray-500 text-center py-4">暂无热点检测结果</div>
            ) : (
              hotspots().map((hotspot, idx) => (
                <div
                  key={idx}
                  class={`p-3 rounded-lg ${isNightMode() ? 'bg-gray-700' : 'bg-gray-50'}`}
                >
                  <div class="flex items-center justify-between mb-2">
                    <span class="font-medium">热点 #{idx + 1}</span>
                    <span class={`px-2 py-0.5 rounded text-xs font-medium ${getRiskClass(hotspot.risk_level)}`}>
                      {getRiskText(hotspot.risk_level)}
                    </span>
                  </div>
                  <div class="text-sm space-y-1">
                    <div class="flex justify-between">
                      <span class="text-gray-500">温度</span>
                      <span class="font-medium text-red-600">
                        {hotspot.temperature?.toFixed(1) || '0.0'}°C
                      </span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-gray-500">位置</span>
                      <span>({hotspot.x || '?'}, {hotspot.y || '?'})</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-gray-500">时间</span>
                      <span class="text-xs">
                        {hotspot.created_at ? new Date(hotspot.created_at).toLocaleTimeString() : '刚刚'}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ThermalMonitor;
