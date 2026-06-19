import { createSignal, onMount, onCleanup, createMemo } from 'solid-js';
import { state, actions } from '../store/appStore';
import { formatDateTime, formatRelative } from '../utils/date';
import { formatTemperature } from '../utils/thermal';
import AlertPlayback from '../components/AlertPlayback';
import wsClient from '../services/websocket';
import api from '../services/api';

const Alerts = () => {
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [showPlayback, setShowPlayback] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterBuilding, setFilterBuilding] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  onMount(async () => {
    await actions.loadAlerts();
    wsClient.connect();
    wsClient.on('alert', handleNewAlert);
    wsClient.subscribeAll();
  });

  onCleanup(() => {
    wsClient.off('alert', handleNewAlert);
  });

  function handleNewAlert(alert) {
    actions.addAlert(alert);
  }

  const getLevelClass = (level) => {
    switch (level) {
      case 'critical':
        return 'bg-red-600 text-white';
      case 'high':
        return 'bg-orange-500 text-white';
      case 'medium':
        return 'bg-yellow-500 text-white';
      case 'low':
        return 'bg-blue-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  const getLevelText = (level) => {
    switch (level) {
      case 'critical':
        return '紧急';
      case 'high':
        return '高';
      case 'medium':
        return '中';
      case 'low':
        return '低';
      default:
        return '未知';
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-red-100 text-red-800';
      case 'acknowledged':
        return 'bg-yellow-100 text-yellow-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending':
        return '待处理';
      case 'acknowledged':
        return '已确认';
      case 'resolved':
        return '已解决';
      default:
        return '未知';
    }
  };

  const getAlertTypeText = (type) => {
    switch (type) {
      case 'hotspot':
        return '异常热点';
      case 'fire':
        return '火灾隐患';
      case 'device_offline':
        return '设备离线';
      case 'patrol_missing':
        return '巡防异常';
      default:
        return type;
    }
  };

  const filteredAlerts = createMemo(() => {
    let alerts = state.alerts || [];
    
    if (filterStatus() !== 'all') {
      alerts = alerts.filter(a => a.status === filterStatus());
    }
    
    if (filterSeverity() !== 'all') {
      alerts = alerts.filter(a => a.severity === filterSeverity());
    }
    
    if (filterBuilding() !== 'all') {
      alerts = alerts.filter(a => a.building_id === filterBuilding());
    }
    
    if (searchQuery()) {
      const query = searchQuery().toLowerCase();
      alerts = alerts.filter(a => 
        a.title.toLowerCase().includes(query) ||
        (a.description && a.description.toLowerCase().includes(query))
      );
    }
    
    return alerts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  });

  const stats = createMemo(() => {
    const alerts = state.alerts || [];
    return {
      total: alerts.length,
      pending: alerts.filter(a => a.status === 'pending').length,
      acknowledged: alerts.filter(a => a.status === 'acknowledged').length,
      resolved: alerts.filter(a => a.status === 'resolved').length,
      critical: alerts.filter(a => a.severity === 'critical').length,
    };
  });

  const handleAcknowledge = async (alertId) => {
    const personnel = state.patrolPersonnel[0];
    if (!personnel) {
      alert('请先创建巡防人员');
      return;
    }
    try {
      await api.alerts.acknowledge(alertId, { personnel_id: personnel.id });
      await actions.loadAlerts();
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  const handleResolve = async (alertId) => {
    const personnel = state.patrolPersonnel[0];
    if (!personnel) {
      alert('请先创建巡防人员');
      return;
    }
    try {
      await api.alerts.resolve(alertId, { personnel_id: personnel.id });
      await actions.loadAlerts();
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    }
  };

  const handleViewPlayback = (alert) => {
    setSelectedAlert(alert);
    setShowPlayback(true);
  };

  const getBuildingName = (buildingId) => {
    const building = (state.buildings || []).find(b => b.id === buildingId);
    return building?.name || '-';
  };

  return (
    <div class="p-6">
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-800 mb-2">告警事件管理</h1>
        <p class="text-gray-600">实时监控和处理消防安全告警事件</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div class="bg-white rounded-lg shadow p-4">
          <div class="text-gray-500 text-sm">告警总数</div>
          <div class="text-2xl font-bold text-gray-800">{stats().total}</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
          <div class="text-gray-500 text-sm">紧急</div>
          <div class="text-2xl font-bold text-red-600">{stats().critical}</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
          <div class="text-gray-500 text-sm">待处理</div>
          <div class="text-2xl font-bold text-orange-600">{stats().pending}</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
          <div class="text-gray-500 text-sm">处理中</div>
          <div class="text-2xl font-bold text-yellow-600">{stats().acknowledged}</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div class="text-gray-500 text-sm">已解决</div>
          <div class="text-2xl font-bold text-green-600">{stats().resolved}</div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow mb-6">
        <div class="p-4 border-b flex flex-wrap gap-4">
          <div class="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="搜索告警..."
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.target.value)}
              class="w-full px-3 py-2 border rounded"
            />
          </div>
          <select
            value={filterStatus()}
            onChange={(e) => setFilterStatus(e.target.value)}
            class="px-3 py-2 border rounded"
          >
            <option value="all">全部状态</option>
            <option value="pending">待处理</option>
            <option value="acknowledged">已确认</option>
            <option value="resolved">已解决</option>
          </select>
          <select
            value={filterSeverity()}
            onChange={(e) => setFilterSeverity(e.target.value)}
            class="px-3 py-2 border rounded"
          >
            <option value="all">全部级别</option>
            <option value="critical">紧急</option>
            <option value="high">高</option>
            <option value="medium">中</option>
            <option value="low">低</option>
          </select>
          <select
            value={filterBuilding()}
            onChange={(e) => setFilterBuilding(e.target.value)}
            class="px-3 py-2 border rounded"
          >
            <option value="all">全部建筑</option>
            {(state.buildings || []).map(b => (
              <option value={b.id}>{b.name}</option>
            ))}
          </select>
          <button
            onClick={() => actions.loadAlerts()}
            class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            刷新
          </button>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">告警时间</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">标题</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">级别</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">建筑</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">温度</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              {filteredAlerts().map((alert) => (
                <tr key={alert.id} class="hover:bg-gray-50">
                  <td class="px-4 py-3">
                    <div class="text-sm font-medium text-gray-900">{formatDateTime(alert.created_at)}</div>
                    <div class="text-xs text-gray-500">{formatRelative(alert.created_at)}</div>
                  </td>
                  <td class="px-4 py-3 text-sm">{getAlertTypeText(alert.alert_type)}</td>
                  <td class="px-4 py-3">
                    <div class="text-sm font-medium text-gray-900">{alert.title}</div>
                    {alert.description && <div class="text-xs text-gray-500">{alert.description}</div>}
                  </td>
                  <td class="px-4 py-3">
                    <span class={`px-2 py-1 text-xs rounded-full ${getLevelClass(alert.severity)}`}>
                      {getLevelText(alert.severity)}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-sm">{getBuildingName(alert.building_id)}</td>
                  <td class="px-4 py-3">
                    {alert.latitude && alert.longitude ? (
                      <span class="text-sm text-gray-900">
                        {alert.latitude.toFixed(4)}, {alert.longitude.toFixed(4)}
                      </span>
                    ) : '-'}
                  </td>
                  <td class="px-4 py-3">
                    <span class={`px-2 py-1 text-xs rounded-full ${getStatusClass(alert.status)}`}>
                      {getStatusText(alert.status)}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex gap-2">
                      {alert.status === 'pending' && (
                        <button
                          onClick={() => handleAcknowledge(alert.id)}
                          class="px-3 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600"
                        >
                          确认
                        </button>
                      )}
                      {alert.status === 'acknowledged' && (
                        <button
                          onClick={() => handleResolve(alert.id)}
                          class="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                        >
                          解决
                        </button>
                      )}
                      <button
                        onClick={() => handleViewPlayback(alert)}
                        class="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        回放
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredAlerts().length === 0 && (
          <div class="p-12 text-center">
            <div class="text-5xl mb-4">🔔</div>
            <div class="text-gray-500">暂无告警数据</div>
          </div>
        )}
      </div>

      {showPlayback() && selectedAlert() && (
        <div class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div class="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-auto">
            <div class="p-4 border-b flex justify-between items-center">
              <h3 class="text-lg font-semibold">告警回放 - {selectedAlert().title}</h3>
              <button
                onClick={() => setShowPlayback(false)}
                class="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <div class="p-4">
              <AlertPlayback alertId={selectedAlert().id} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function useState(initial) {
  const [val, setVal] = createSignal(initial);
  return [val, setVal];
}

export default Alerts;
