import { state, actions } from '../store/appStore';
import { A } from '@solidjs/router';
import { formatRelative } from '../utils/date';
import { formatTemperature } from '../utils/thermal';

const Home = () => {
  const quickActions = [
    { path: '/buildings', icon: '🏢', label: '建筑管理', desc: '管理所有监控建筑' },
    { path: '/devices', icon: '📡', label: '设备管理', desc: '查看热成像设备状态' },
    { path: '/alerts', icon: '🔔', label: '告警中心', desc: '处理温度异常告警' },
    { path: '/map', icon: '🗺️', label: '地图展示', desc: '查看建筑分布地图' },
  ];

  const pendingAlerts = state.alerts.filter((a) => a.status === 'pending');
  const onlineDevices = state.devices.filter((d) => d.status === 'online');
  const onDutyPersonnel = state.patrolPersonnel.filter((p) => p.status === 'on_duty');

  return (
    <div>
      <div class="mb-lg">
        <h1>热成像监控系统</h1>
        <p class="text-secondary mt-sm">实时温度监测 · 智能热点检测 · 自动告警通知</p>
      </div>

      <div class="grid grid-4 mb-lg">
        <div class="card">
          <div class="flex-between">
            <div>
              <div class="text-secondary mb-sm">监控建筑</div>
              <div class="text-3xl font-bold text-primary">{state.buildings.length}</div>
            </div>
            <div style={{ fontSize: '36px' }}>🏢</div>
          </div>
          <div class="mt-sm text-muted text-sm">
            {onlineDevices.length} 台设备在线
          </div>
        </div>

        <div class="card">
          <div class="flex-between">
            <div>
              <div class="text-secondary mb-sm">待处理告警</div>
              <div class="text-3xl font-bold text-error">{pendingAlerts.length}</div>
            </div>
            <div style={{ fontSize: '36px' }}>🔔</div>
          </div>
          <div class="mt-sm text-muted text-sm">
            {pendingAlerts.length > 0 ? '需要及时处理' : '暂无待处理告警'}
          </div>
        </div>

        <div class="card">
          <div class="flex-between">
            <div>
              <div class="text-secondary mb-sm">在线设备</div>
              <div class="text-3xl font-bold text-success">{onlineDevices.length}</div>
            </div>
            <div style={{ fontSize: '36px' }}>📡</div>
          </div>
          <div class="mt-sm text-muted text-sm">
            共 {state.devices.length} 台设备
          </div>
        </div>

        <div class="card">
          <div class="flex-between">
            <div>
              <div class="text-secondary mb-sm">在岗巡防</div>
              <div class="text-3xl font-bold text-warning">{onDutyPersonnel.length}</div>
            </div>
            <div style={{ fontSize: '36px' }}>👮</div>
          </div>
          <div class="mt-sm text-muted text-sm">
            共 {state.patrolPersonnel.length} 名巡防人员
          </div>
        </div>
      </div>

      <div class="grid grid-4 mb-lg">
        {quickActions.map((action) => (
          <A href={action.path} class="card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>{action.icon}</div>
            <div class="font-bold text-lg mb-sm">{action.label}</div>
            <div class="text-secondary text-sm">{action.desc}</div>
          </A>
        ))}
      </div>

      <div class="grid grid-2">
        <div class="card">
          <div class="card-header flex-between">
            <span>最新告警</span>
            <A href="/alerts" class="text-primary text-sm">查看全部 →</A>
          </div>
          <div class="card-body">
            {pendingAlerts.length > 0 ? (
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {pendingAlerts.slice(0, 5).map((alert) => (
                  <div
                    class="flex-between mb-md pb-md"
                    style={{ borderBottom: '1px solid var(--color-border)' }}
                  >
                    <div>
                      <div class="font-medium">{alert.alert_type}</div>
                      <div class="text-muted text-sm mt-xs">
                        {alert.building_name} · {formatRelative(alert.created_at)}
                      </div>
                    </div>
                    <span class={`badge ${alert.level === 'high' ? 'badge-error' : 'badge-warning'}`}>
                      {alert.level === 'high' ? '高' : '中'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div class="text-center text-secondary" style={{ padding: '40px 0' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
                暂无待处理告警
              </div>
            )}
          </div>
        </div>

        <div class="card">
          <div class="card-header flex-between">
            <span>热成像设备状态</span>
            <A href="/devices" class="text-primary text-sm">查看全部 →</A>
          </div>
          <div class="card-body">
            {onlineDevices.length > 0 ? (
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {onlineDevices.slice(0, 5).map((device) => {
                  const thermalData = state.thermalData[device.id];
                  return (
                    <div
                      class="flex-between mb-md pb-md"
                      style={{ borderBottom: '1px solid var(--color-border)' }}
                      key={device.id}
                    >
                      <div>
                        <div class="font-medium">{device.name}</div>
                        <div class="text-muted text-sm mt-xs">
                          {device.building_name || '未分配建筑'}
                        </div>
                      </div>
                      <div class="text-right">
                        {thermalData?.max_temp !== undefined ? (
                          <div class="font-bold">
                            {formatTemperature(thermalData.max_temp, state.ui.temperatureUnit)}
                          </div>
                        ) : (
                          <div class="text-muted">-</div>
                        )}
                        <span class="badge badge-success text-xs">在线</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div class="text-center text-secondary" style={{ padding: '40px 0' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📡</div>
                暂无在线设备
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
