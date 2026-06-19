import { createSignal, createEffect, onCleanup } from 'solid-js';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../services/api';
import wsClient from '../services/websocket';

function PatrolMap() {
  const [personnel, setPersonnel] = createSignal([]);
  const [selectedPersonnel, setSelectedPersonnel] = createSignal(null);
  const [statusFilter, setStatusFilter] = createSignal('all');
  const [showTrackModal, setShowTrackModal] = createSignal(false);
  const [trackData, setTrackData] = createSignal([]);
  const [isPlaying, setIsPlaying] = createSignal(false);
  const [trackIndex, setTrackIndex] = createSignal(0);
  let mapContainer;
  let map;
  let markers = {};
  let trackLayer = null;
  let trackMarker = null;
  let playInterval = null;

  const initMap = () => {
    if (map || !mapContainer) return;

    map = L.map(mapContainer).setView([39.9042, 116.4074], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
  };

  const createPersonnelIcon = (status) => {
    const colors = {
      online: '#22c55e',
      offline: '#6b7280',
      patrolling: '#3b82f6',
    };
    const color = colors[status] || '#6b7280';

    return L.divIcon({
      html: `<div style="width: 40px; height: 40px; background: ${color}; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
        <span style="color: white; font-size: 18px;">👮</span>
      </div>`,
      className: 'custom-marker',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
  };

  const updatePersonnelMarkers = () => {
    if (!map) return;

    Object.values(markers).forEach((m) => map.removeLayer(m));
    markers = {};

    const filteredPersonnel = personnel().filter((p) => {
      if (statusFilter() === 'all') return true;
      return p.status === statusFilter();
    });

    filteredPersonnel.forEach((p) => {
      const marker = L.marker(
        [p.latitude || 39.9042 + Math.random() * 0.02, p.longitude || 116.4074 + Math.random() * 0.02],
        { icon: createPersonnelIcon(p.status) }
      )
        .addTo(map)
        .bindPopup(
          `<div class="p-2">
            <strong>${p.name}</strong><br>
            状态: ${getStatusText(p.status)}<br>
            电话: ${p.phone || '未填写'}
            <button class="mt-2 px-2 py-1 bg-blue-500 text-white text-xs rounded" onclick="window.selectPersonnel(${p.id})">查看详情</button>
          </div>`
        )
        .on('click', () => {
          setSelectedPersonnel(p);
        });
      markers[p.id] = marker;
    });
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'online':
        return '在线';
      case 'offline':
        return '离线';
      case 'patrolling':
        return '巡逻中';
      default:
        return '未知';
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'online':
        return 'bg-green-100 text-green-800';
      case 'offline':
        return 'bg-gray-100 text-gray-800';
      case 'patrolling':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const loadPersonnel = async () => {
    try {
      const data = await api.patrolPersonnel.list();
      setPersonnel(data || []);
    } catch (error) {
      console.error('加载巡防人员列表失败:', error);
    }
  };

  const handleLocationUpdate = (data) => {
    if (!data.personnel_id) return;

    setPersonnel((prev) =>
      prev.map((p) => {
        if (p.id === data.personnel_id) {
          return { ...p, latitude: data.latitude, longitude: data.longitude, last_location: data };
        }
        return p;
      })
    );

    if (markers[data.personnel_id]) {
      markers[data.personnel_id].setLatLng([data.latitude, data.longitude]);
    }
  };

  const showTrack = async (person) => {
    try {
      const data = await api.patrolLocations.getByPersonnel(person.id, { limit: 50 });
      setTrackData(data || []);
      setShowTrackModal(true);
      setTrackIndex(0);
      setIsPlaying(false);

      setTimeout(() => {
        if (data && data.length > 1) {
          const latlngs = data.map((d) => [d.latitude, d.longitude]);
          if (trackLayer) map.removeLayer(trackLayer);
          if (trackMarker) map.removeLayer(trackMarker);

          trackLayer = L.polyline(latlngs, {
            color: '#3b82f6',
            weight: 4,
            opacity: 0.7,
          }).addTo(map);

          trackMarker = L.marker(latlngs[0], {
            icon: createPersonnelIcon('patrolling'),
          }).addTo(map);

          map.fitBounds(trackLayer.getBounds());
        }
      }, 100);
    } catch (error) {
      console.error('加载轨迹数据失败:', error);
    }
  };

  const playTrack = () => {
    if (isPlaying()) {
      setIsPlaying(false);
      if (playInterval) {
        clearInterval(playInterval);
        playInterval = null;
      }
      return;
    }

    setIsPlaying(true);
    playInterval = setInterval(() => {
      setTrackIndex((prev) => {
        if (prev >= trackData().length - 1) {
          setIsPlaying(false);
          if (playInterval) {
            clearInterval(playInterval);
            playInterval = null;
          }
          return 0;
        }
        const nextIndex = prev + 1;
        if (trackMarker && trackData()[nextIndex]) {
          trackMarker.setLatLng([trackData()[nextIndex].latitude, trackData()[nextIndex].longitude]);
        }
        return nextIndex;
      });
    }, 500);
  };

  const callPersonnel = (person) => {
    alert(`正在呼叫 ${person.name}...\n电话: ${person.phone || '未填写'}`);
  };

  createEffect(() => {
    loadPersonnel();
    wsClient.connect();
    wsClient.on('patrol_location', handleLocationUpdate);
    wsClient.subscribeAll();

    const timer = setTimeout(() => {
      initMap();
    }, 100);

    window.selectPersonnel = (id) => {
      const person = personnel().find((p) => p.id === id);
      if (person) setSelectedPersonnel(person);
    };

    onCleanup(() => {
      clearTimeout(timer);
      delete window.selectPersonnel;
      if (playInterval) clearInterval(playInterval);
      if (map) {
        map.remove();
        map = null;
      }
      wsClient.off('patrol_location', handleLocationUpdate);
    });
  });

  createEffect(() => {
    if (map) {
      updatePersonnelMarkers();
    }
  });

  return (
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold">巡防人员定位</h1>
        <div class="flex items-center gap-4">
          <span class="text-sm text-gray-600">状态筛选:</span>
          <div class="flex gap-2">
            {[
              { value: 'all', label: '全部' },
              { value: 'online', label: '在线' },
              { value: 'offline', label: '离线' },
              { value: 'patrolling', label: '巡逻中' },
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                class={`px-3 py-1 rounded-lg text-sm ${
                  statusFilter() === filter.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div class="bg-white rounded-lg shadow overflow-hidden">
          <div class="p-4 border-b font-semibold">人员列表</div>
          <div class="divide-y max-h-[600px] overflow-y-auto">
            {personnel().length === 0 ? (
              <div class="p-8 text-center text-gray-500">暂无巡防人员</div>
            ) : (
              personnel()
                .filter((p) => (statusFilter() === 'all' ? true : p.status === statusFilter()))
                .map((person) => (
                  <div
                    class={`p-4 hover:bg-gray-50 cursor-pointer ${
                      selectedPersonnel()?.id === person.id ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => setSelectedPersonnel(person)}
                  >
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-3">
                        <div
                          class={`w-10 h-10 rounded-full flex items-center justify-center ${
                            person.status === 'online'
                              ? 'bg-green-100'
                              : person.status === 'patrolling'
                              ? 'bg-blue-100'
                              : 'bg-gray-100'
                          }`}
                        >
                          <span class="text-xl">👮</span>
                        </div>
                        <div>
                          <div class="font-medium">{person.name}</div>
                          <div class="text-sm text-gray-500">{person.phone || '未填写电话'}</div>
                        </div>
                      </div>
                      <span
                        class={`px-2 py-1 rounded text-xs font-medium ${getStatusClass(person.status)}`}
                      >
                        {getStatusText(person.status)}
                      </span>
                    </div>
                    <div class="flex gap-2 mt-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          showTrack(person);
                        }}
                        class="flex-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        轨迹回放
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          callPersonnel(person);
                        }}
                        class="flex-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                      >
                        📞 呼叫
                      </button>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        <div class="lg:col-span-3 bg-white rounded-lg shadow overflow-hidden">
          <div class="p-4 border-b font-semibold">实时位置地图</div>
          <div ref={mapContainer} style={{ height: '600px', width: '100%' }} />
        </div>
      </div>

      {selectedPersonnel() && (
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div class="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div class="p-4 border-b flex items-center justify-between">
              <h2 class="text-lg font-semibold">人员详情</h2>
              <button
                onClick={() => setSelectedPersonnel(null)}
                class="text-gray-500 hover:text-gray-700 text-xl"
              >
                ✕
              </button>
            </div>
            <div class="p-6">
              <div class="flex items-center gap-4 mb-6">
                <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
                  <span class="text-4xl">👮</span>
                </div>
                <div>
                  <h3 class="text-xl font-bold">{selectedPersonnel()?.name}</h3>
                  <span
                    class={`inline-block mt-1 px-2 py-1 rounded text-xs font-medium ${getStatusClass(
                      selectedPersonnel()?.status
                    )}`}
                  >
                    {getStatusText(selectedPersonnel()?.status)}
                  </span>
                </div>
              </div>

              <div class="space-y-3">
                <div class="flex justify-between">
                  <span class="text-gray-500">电话</span>
                  <span>{selectedPersonnel()?.phone || '未填写'}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500">编号</span>
                  <span>{selectedPersonnel()?.employee_id || '未填写'}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500">负责区域</span>
                  <span>{selectedPersonnel()?.area || '未分配'}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500">最后更新</span>
                  <span>
                    {selectedPersonnel()?.last_location?.created_at
                      ? new Date(selectedPersonnel().last_location.created_at).toLocaleString()
                      : '未知'}
                  </span>
                </div>
              </div>

              <div class="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    showTrack(selectedPersonnel());
                    setSelectedPersonnel(null);
                  }}
                  class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  轨迹回放
                </button>
                <button
                  onClick={() => callPersonnel(selectedPersonnel())}
                  class="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  📞 呼叫
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTrackModal() && (
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div class="p-4 border-b flex items-center justify-between">
              <h2 class="text-lg font-semibold">
                轨迹回放 - {selectedPersonnel()?.name || '巡防人员'}
              </h2>
              <button
                onClick={() => {
                  setShowTrackModal(false);
                  setIsPlaying(false);
                  if (playInterval) {
                    clearInterval(playInterval);
                    playInterval = null;
                  }
                  if (trackLayer) {
                    map.removeLayer(trackLayer);
                    trackLayer = null;
                  }
                  if (trackMarker) {
                    map.removeLayer(trackMarker);
                    trackMarker = null;
                  }
                }}
                class="text-gray-500 hover:text-gray-700 text-xl"
              >
                ✕
              </button>
            </div>
            <div class="flex-1 p-4">
              <div class="bg-gray-100 rounded-lg overflow-hidden" style={{ height: '400px' }}>
                {trackData().length > 0 ? (
                  <div class="h-full flex flex-col justify-center items-center p-4">
                    <div class="text-center">
                      <div class="text-4xl mb-4">🗺️</div>
                      <p class="text-gray-600">轨迹点数: {trackData().length}</p>
                      <p class="text-gray-600">
                        当前位置: {trackIndex() + 1} / {trackData().length}
                      </p>
                      {trackData()[trackIndex()] && (
                        <p class="text-sm text-gray-500 mt-2">
                          时间:{' '}
                          {new Date(trackData()[trackIndex()].created_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div class="mt-4 w-full max-w-md">
                      <input
                        type="range"
                        min="0"
                        max={trackData().length - 1}
                        value={trackIndex()}
                        onInput={(e) => {
                          const idx = parseInt(e.target.value);
                          setTrackIndex(idx);
                          if (trackMarker && trackData()[idx]) {
                            trackMarker.setLatLng([
                              trackData()[idx].latitude,
                              trackData()[idx].longitude,
                            ]);
                          }
                        }}
                        class="w-full"
                      />
                    </div>
                    <div class="flex gap-3 mt-4">
                      <button
                        onClick={playTrack}
                        class={`px-6 py-2 rounded-lg ${
                          isPlaying()
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-blue-600 hover:bg-blue-700'
                        } text-white`}
                      >
                        {isPlaying() ? '⏸️ 暂停' : '▶️ 播放'}
                      </button>
                      <button
                        onClick={() => {
                          setTrackIndex(0);
                          if (trackMarker && trackData()[0]) {
                            trackMarker.setLatLng([
                              trackData()[0].latitude,
                              trackData()[0].longitude,
                            ]);
                          }
                        }}
                        class="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                      >
                        ⏮️ 重置
                      </button>
                    </div>
                  </div>
                ) : (
                  <div class="h-full flex items-center justify-center text-gray-500">
                    暂无轨迹数据
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PatrolMap;
