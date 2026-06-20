import { createSignal, onMount, onCleanup, createMemo } from 'solid-js';
import { state, actions } from '../store/appStore';
import { formatDateTime, formatRelative } from '../utils/date';
import { formatTemperature } from '../utils/thermal';
import AlertPlayback from '../components/AlertPlayback';
import wsClient from '../services/websocket';
import api from '../services/api';

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
        return 'badge-error';
      case 'high':
        return 'badge-warning';
      case 'medium':
        return 'badge-info';
      case 'low':
        return 'badge-success';
      default:
        return 'badge-default';
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
        return 'badge-error';
      case 'acknowledged':
        return 'badge-warning';
      case 'resolved':
        return 'badge-success';
      default:
        return 'badge-default';
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
      await api.alerts.acknowledge(alertId, personnel.id);
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
      await api.alerts.resolve(alertId, personnel.id);
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
    <div>
      <div class="mb-lg">
        <h2>告警事件管理</h2>
        <div class="text-secondary text-sm mt-sm">实时监控和处理消防安全告警事件</div>
      </div>

      <div class="grid grid-4 mb-lg">
        <div class="card">
          <div class="text-secondary mb-sm">告警总数</div>
          <div class="text-3xl font-bold text-primary">{stats().total}</div>
        </div>
        <div class="card">
          <div class="text-secondary mb-sm">紧急</div>
          <div class="text-3xl font-bold text-error">{stats().critical}</div>
        </div>
        <div class="card">
          <div class="text-secondary mb-sm">待处理</div>
          <div class="text-3xl font-bold text-warning">{stats().pending}</div>
        </div>
        <div class="card">
          <div class="text-secondary mb-sm">已解决</div>
          <div class="text-3xl font-bold text-success">{stats().resolved}</div>
        </div>
      </div>

      <div class="card mb-lg">
        <div class="card-header">告警列表</div>
        <div class="card-body">
          <div class="flex-between mb-md" style={{ flexWrap: 'wrap', gap: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap', flex: 1, minWidth: '200px' }}>
              <input
                type="text"
                placeholder="搜索告警..."
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.target.value)}
                class="form-input"
                style={{ width: '200px' }}
              />
              <select
                value={filterStatus()}
                onChange={(e) => setFilterStatus(e.target.value)}
                class="form-select"
                style={{ width: '140px' }}
              >
                <option value="all">全部状态</option>
                <option value="pending">待处理</option>
                <option value="acknowledged">已确认</option>
                <option value="resolved">已解决</option>
              </select>
              <select
                value={filterSeverity()}
                onChange={(e) => setFilterSeverity(e.target.value)}
                class="form-select"
                style={{ width: '140px' }}
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
                class="form-select"
                style={{ width: '160px' }}
              >
                <option value="all">全部建筑</option>
                {(state.buildings || []).map(b => (
                  <option value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => actions.loadAlerts()}
              class="btn btn-primary btn-sm"
            >
              刷新
            </button>
          </div>

          <table>
            <thead>
              <tr>
                <th>告警时间</th>
                <th>类型</th>
                <th>标题</th>
                <th>级别</th>
                <th>建筑</th>
                <th>位置</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlerts().map((alert) => (
                <tr key={alert.id}>
                  <td>
                    <div class="font-medium">{formatDateTime(alert.created_at)}</div>
                    <div class="text-muted text-sm">{formatRelative(alert.created_at)}</div>
                  </td>
                  <td>{getAlertTypeText(alert.alert_type)}</td>
                  <td>
                    <div class="font-medium">{alert.title}</div>
                    {alert.description && <div class="text-muted text-sm">{alert.description}</div>}
                  </td>
                  <td>
                    <span class={`badge ${getLevelClass(alert.severity)}`}>
                      {getLevelText(alert.severity)}
                    </span>
                  </td>
                  <td>{getBuildingName(alert.building_id)}</td>
                  <td>
                    {alert.latitude && alert.longitude ? (
                      <span>
                        {alert.latitude.toFixed(4)}, {alert.longitude.toFixed(4)}
                      </span>
                    ) : '-'}
                  </td>
                  <td>
                    <span class={`badge ${getStatusClass(alert.status)}`}>
                      {getStatusText(alert.status)}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                      {alert.status === 'pending' && (
                        <button
                          onClick={() => handleAcknowledge(alert.id)}
                          class="btn btn-warning btn-sm"
                        >
                          确认
                        </button>
                      )}
                      {alert.status === 'acknowledged' && (
                        <button
                          onClick={() => handleResolve(alert.id)}
                          class="btn btn-success btn-sm"
                        >
                          解决
                        </button>
                      )}
                      <button
                        onClick={() => handleViewPlayback(alert)}
                        class="btn btn-sm"
                      >
                        回放
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredAlerts().length === 0 && (
            <div class="text-center" style={{ padding: '60px 20px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔔</div>
              <div class="text-secondary">暂无告警数据</div>
            </div>
          )}
        </div>
      </div>

      {showPlayback() && selectedAlert() && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.8)',
            padding: 'var(--spacing-lg)',
          }}
          onClick={() => setShowPlayback(false)}
        >
          <div
            class="card"
            style={{
              width: '100%',
              maxWidth: '1000px',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div class="card-header flex-between">
              <span>告警回放 - {selectedAlert().title}</span>
              <button
                onClick={() => setShowPlayback(false)}
                class="btn btn-sm"
                style={{ border: 'none', background: 'transparent', fontSize: '24px', padding: 0 }}
              >
                ×
              </button>
            </div>
            <div class="card-body">
              <AlertPlayback alertId={selectedAlert().id} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Alerts;
