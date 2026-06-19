import { createSignal, createEffect, onMount, onCleanup, createMemo } from 'solid-js';
import ThermalImage from './ThermalImage';
import api from '../services/api';
import { formatDateTime } from '../utils/date';

function useState(initial) {
  const [val, setVal] = createSignal(initial);
  const setter = (arg) => {
    if (typeof arg === 'function') {
      setVal(prev => arg(prev));
    } else {
      setVal(arg);
    }
  };
  return [val, setter];
}

export default function AlertPlayback(props) {
  const alertId = () => props.alertId;
  const [playbackData, setPlaybackData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  
  const frames = createMemo(() => {
    if (!playbackData()) return [];
    try {
      return JSON.parse(playbackData().playback_data).frames || [];
    } catch {
      return [];
    }
  });
  
  const currentFrame = createMemo(() => {
    return frames()[currentFrameIndex()] || null;
  });
  
  const totalDuration = createMemo(() => {
    return playbackData()?.duration_seconds || 0;
  });
  
  const currentTime = createMemo(() => {
    if (frames().length === 0) return 0;
    return (currentFrameIndex() / (frames().length - 1)) * totalDuration();
  });
  
  let playInterval = null;
  
  onMount(async () => {
    await loadPlaybackData();
  });
  
  onCleanup(() => {
    stopPlayback();
  });
  
  async function loadPlaybackData() {
    if (!alertId()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await api.alerts.getPlayback(alertId());
      setPlaybackData(data);
      
      if (data && data.thermal_data_id) {
        const thermalData = await api.thermalData.getById(data.thermal_data_id);
        setPlaybackData(prev => ({ ...prev, thermalData }));
      }
    } catch (err) {
      setError(err.message || '加载回放数据失败');
    } finally {
      setIsLoading(false);
    }
  }
  
  async function generatePlayback() {
    if (!alertId()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const alert = await api.alerts.get(alertId());
      const thermalData = await api.thermalData.getByBuilding(
        alert.building_id,
        {
          start_time: new Date(new Date(alert.created_at) - 5 * 60 * 1000).toISOString(),
          end_time: new Date(alert.created_at).toISOString(),
        }
      );
      
      const frames = thermalData.map((td, idx) => ({
        index: idx,
        timestamp: td.timestamp,
        temperature_matrix: JSON.parse(td.temperature_matrix),
        min_temp: td.min_temp,
        max_temp: td.max_temp,
        avg_temp: td.avg_temp,
        is_alert_frame: td.id === alert.hotspot_id ? true : idx === thermalData.length - 1,
      }));
      
      const playbackData = {
        frames,
        alert_info: alert,
      };
      
      await api.alerts.createPlayback(alertId(), {
        thermal_data_id: thermalData[0]?.id,
        playback_data: JSON.stringify(playbackData),
        duration_seconds: frames.length * 2,
      });
      
      await loadPlaybackData();
    } catch (err) {
      setError(err.message || '生成回放数据失败');
    } finally {
      setIsLoading(false);
    }
  }
  
  function startPlayback() {
    if (frames().length === 0) return;
    
    setIsPlaying(true);
    playInterval = setInterval(() => {
      setCurrentFrameIndex(prev => {
        if (prev >= frames().length - 1) {
          stopPlayback();
          return prev;
        }
        return prev + 1;
      });
    }, 500 / playbackSpeed());
  }
  
  function stopPlayback() {
    setIsPlaying(false);
    if (playInterval) {
      clearInterval(playInterval);
      playInterval = null;
    }
  }
  
  function togglePlayback() {
    if (isPlaying()) {
      stopPlayback();
    } else {
      startPlayback();
    }
  }
  
  function seekToFrame(index) {
    setCurrentFrameIndex(Math.max(0, Math.min(frames().length - 1, index)));
  }
  
  function seekToTime(seconds) {
    const ratio = seconds / totalDuration();
    const index = Math.round(ratio * (frames().length - 1));
    seekToFrame(index);
  }
  
  function goToAlertFrame() {
    const alertFrameIndex = frames().findIndex(f => f.is_alert_frame);
    if (alertFrameIndex >= 0) {
      seekToFrame(alertFrameIndex);
    }
  }
  
  createEffect(() => {
    if (isPlaying()) {
      stopPlayback();
      startPlayback();
    }
  });
  
  if (isLoading()) {
    return (
      <div class="flex items-center justify-center p-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span class="ml-3 text-gray-600">加载回放数据中...</span>
      </div>
    );
  }
  
  if (error()) {
    return (
      <div class="p-8 text-center">
        <div class="text-red-500 text-lg mb-4">{error()}</div>
        <button
          onClick={generatePlayback}
          class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          生成回放数据
        </button>
      </div>
    );
  }
  
  if (!playbackData() || frames().length === 0) {
    return (
      <div class="p-8 text-center">
        <div class="text-gray-500 mb-4">暂无回放数据</div>
        <button
          onClick={generatePlayback}
          class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          生成回放数据
        </button>
      </div>
    );
  }
  
  return (
    <div class="bg-gray-900 rounded-lg overflow-hidden">
      <div class="p-4 border-b border-gray-700">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-white font-semibold">告警事件回放</h3>
            <p class="text-gray-400 text-sm">
              {formatDateTime(playbackData().created_at)} · {frames().length} 帧 · {totalDuration()} 秒
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button
              onClick={goToAlertFrame}
              class="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
            >
              跳转到告警帧
            </button>
          </div>
        </div>
      </div>
      
      <div class="relative aspect-video bg-black">
        {currentFrame() && (
          <ThermalImage
            temperatureMatrix={currentFrame().temperature_matrix}
            minTemp={currentFrame().min_temp}
            maxTemp={currentFrame().max_temp}
            showColorBar={true}
            hotspots={currentFrame().is_alert_frame ? [{
              center_x: Math.floor(currentFrame().temperature_matrix[0].length / 2),
              center_y: Math.floor(currentFrame().temperature_matrix.length / 2),
              temperature: currentFrame().max_temp,
              risk_level: 'critical',
            }] : []}
          />
        )}
        
        {currentFrame()?.is_alert_frame && (
          <div class="absolute top-4 left-4 px-3 py-1 bg-red-600 text-white text-sm rounded animate-pulse">
            ⚠️ 告警发生时刻
          </div>
        )}
        
        <div class="absolute bottom-4 right-4 bg-black/70 px-3 py-2 rounded text-white text-sm">
          <div>最高温度: <span class="text-red-400 font-bold">{currentFrame()?.max_temp?.toFixed(1)}°C</span></div>
          <div>平均温度: <span class="text-yellow-400">{currentFrame()?.avg_temp?.toFixed(1)}°C</span></div>
          <div>时间: <span class="text-gray-300">{formatDateTime(currentFrame()?.timestamp)}</span></div>
        </div>
      </div>
      
      <div class="p-4 bg-gray-800">
        <div class="flex items-center gap-4 mb-3">
          <button
            onClick={togglePlayback}
            class="w-10 h-10 flex items-center justify-center bg-blue-600 text-white rounded-full hover:bg-blue-700"
          >
            {isPlaying() ? '⏸' : '▶'}
          </button>
          
          <button
            onClick={() => seekToFrame(0)}
            class="w-8 h-8 flex items-center justify-center bg-gray-700 text-white rounded hover:bg-gray-600"
          >
            ⏮
          </button>
          
          <button
            onClick={() => seekToFrame(frames().length - 1)}
            class="w-8 h-8 flex items-center justify-center bg-gray-700 text-white rounded hover:bg-gray-600"
          >
            ⏭
          </button>
          
          <div class="flex items-center gap-2 text-white text-sm">
            <span>速度:</span>
            <select
              value={playbackSpeed()}
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
              class="bg-gray-700 border border-gray-600 rounded px-2 py-1"
            >
              <option value="0.5">0.5x</option>
              <option value="1">1x</option>
              <option value="2">2x</option>
              <option value="4">4x</option>
            </select>
          </div>
          
          <div class="flex-1 text-right text-gray-400 text-sm">
            帧 {currentFrameIndex() + 1} / {frames().length}
          </div>
        </div>
        
        <div class="relative">
          <input
            type="range"
            min="0"
            max={totalDuration()}
            step="0.1"
            value={currentTime()}
            onChange={(e) => seekToTime(Number(e.target.value))}
            class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(currentTime() / totalDuration()) * 100}%, #374151 ${(currentTime() / totalDuration()) * 100}%, #374151 100%)`,
            }}
          />
          
          <div class="flex justify-between text-xs text-gray-500 mt-1">
            <span>{formatTime(currentTime())}</span>
            <span>{formatTime(totalDuration())}</span>
          </div>
        </div>
        
        <div class="mt-4 flex gap-2 overflow-x-auto pb-2">
          {frames().map((frame, idx) => (
            <button
              key={idx}
              onClick={() => seekToFrame(idx)}
              class={`flex-shrink-0 w-16 h-12 rounded overflow-hidden border-2 ${
                idx === currentFrameIndex()
                  ? 'border-blue-500'
                  : frame.is_alert_frame
                  ? 'border-red-500'
                  : 'border-gray-600'
              }`}
            >
              <div
                class="w-full h-full"
                style={{
                  background: `linear-gradient(to right, #1e3a8a ${frame.min_temp}%, #f59e0b ${(frame.min_temp + frame.max_temp) / 2}%, #dc2626 ${frame.max_temp}%)`,
                }}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
