import { state } from '../store/appStore';
import { formatRelative } from '../utils/date';
import { formatTemperature } from '../utils/thermal';

const Dashboard = () => {
  const stats = [
    {
      label: '建筑总数',
      value: state.buildings.length,
      icon: '🏢',
      color: 'text-primary',
    },
    {
      label: '在线设备',
      value: state.devices.filter((d) => d.status === 'online').length,
      icon: '📡',
      color: 'text-success',
    },
    {
      label: '待处理告警',
      value: state.alerts.filter((a) => a.status === 'pending').length,
      icon: '🔔',
      color: 'text-error',
    },
    {
      label: '巡防人员',
      value: state.patrolPersonnel.filter((p) => p.status === 'on_duty').length,
      icon: '👮',
      color: 'text-warning',
    },
  ];

  const recentAlerts = state.alerts.slice(0, 5);
  const onlineDevices = state.devices.filter((d) => d.status === 'online').slice(0, 5);

  return (
    <div>
      <h2 class="mb-lg">数据看板</h2>

      <div class="grid grid-4 mb-lg">
        {stats.map((stat) => (
          <div class="card">
            <div class="flex-between">
              <div>
                <div class="text-secondary mb-sm">{stat.label}</div>
                <div class={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
              </div>
              <div style={{ fontSize: '36px' }}>{stat.icon}</div>
            </div>
          </div>
        ))}
      </div>

      <div class="grid grid-2">
        <div class="card">
          <div class="card-header">最新告警</div>
          <div class="card-body">
            {recentAlerts.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>建筑</th>
                    <th>类型</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAlerts.map((alert) => (
                    <tr>
                      <td>{formatRelative(alert.created_at)}</td>
                      <td>{alert.building_name || '-'}</td>
                      <td>
                        <span class={`badge ${alert.level === 'high' ? 'badge-error' : alert.level === 'medium' ? 'badge-warning' : 'badge-info'}`}>
                          {alert.alert_type}
                        </span>
                      </td>
                      <td>
                        <span class={`badge ${alert.status === 'pending' ? 'badge-error' : alert.status === 'acknowledged' ? 'badge-warning' : 'badge-success'}`}>
                          {alert.status === 'pending' ? '待处理' : alert.status === 'acknowledged' ? '已确认' : '已解决'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div class="text-center text-secondary" style={{ padding: '40px 0' }}>
                暂无告警数据
              </div>
            )}
          </div>
        </div>

        <div class="card">
          <div class="card-header">在线设备</div>
          <div class="card-body">
            {onlineDevices.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>设备名称</th>
                    <th>建筑</th>
                    <th>最新温度</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {onlineDevices.map((device) => (
                    <tr>
                      <td>{device.name}</td>
                      <td>{device.building_name || '-'}</td>
                      <td>
                        {state.thermalData[device.id]?.max_temp !== undefined
                          ? formatTemperature(state.thermalData[device.id].max_temp, state.ui.temperatureUnit)
                          : '-'}
                      </td>
                      <td>
                        <span class="badge badge-success">在线</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div class="text-center text-secondary" style={{ padding: '40px 0' }}>
                暂无在线设备
              </div>
            )}
          </div>
        </div>
      </div>

      <div class="card mt-lg">
        <div class="card-header">热成像概览</div>
        <div class="card-body">
          <div class="thermal-mini-grid">
            {state.devices
              .filter((d) => d.status === 'online')
              .slice(0, 6)
              .map((device) => {
                const thermalData = state.thermalData[device.id];
                return (
                  <div class="thermal-mini-item" key={device.id}>
                    <div class="thermal-mini-canvas" style={{
                      background: `linear-gradient(135deg, #1a237e 0%, #1976d2 40%, #ffeb3b 70%, #b71c1c 100%)`,
                    }}></div>
                    {thermalData?.hotspots?.length > 0 && (
                      <span class="thermal-alert-badge">{thermalData.hotspots.length} 热点</span>
                    )}
                    <div class="thermal-mini-info">
                      <div class="thermal-mini-title">{device.name}</div>
                      <div class="thermal-mini-temp">
                        <span>最高: {thermalData?.max_temp !== undefined ? formatTemperature(thermalData.max_temp, state.ui.temperatureUnit) : '-'}</span>
                        <span>最低: {thermalData?.min_temp !== undefined ? formatTemperature(thermalData.min_temp, state.ui.temperatureUnit) : '-'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
