import { state } from '../store/appStore';
import { formatRelative } from '../utils/date';
import { formatTemperature } from '../utils/thermal';

const Devices = () => {
  const getStatusClass = (status) => {
    switch (status) {
      case 'online':
        return 'status-online';
      case 'offline':
        return 'status-offline';
      case 'warning':
        return 'status-warning';
      case 'error':
        return 'status-error';
      default:
        return 'status-offline';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'online':
        return '在线';
      case 'offline':
        return '离线';
      case 'warning':
        return '警告';
      case 'error':
        return '异常';
      default:
        return '未知';
    }
  };

  return (
    <div>
      <div class="flex-between mb-lg">
        <h2>设备管理</h2>
        <button class="btn btn-primary">+ 添加设备</button>
      </div>

      <div class="card">
        <div class="card-body" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>设备名称</th>
                <th>设备编号</th>
                <th>所属建筑</th>
                <th>安装位置</th>
                <th>最高温度</th>
                <th>最低温度</th>
                <th>状态</th>
                <th>最后心跳</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {state.devices.map((device) => {
                const thermalData = state.thermalData[device.id];
                return (
                  <tr key={device.id}>
                    <td class="font-medium">{device.name}</td>
                    <td class="text-muted">{device.device_code || '-'}</td>
                    <td>{device.building_name || '-'}</td>
                    <td>{device.install_location || '-'}</td>
                    <td>
                      {thermalData?.max_temp !== undefined ? (
                        <span class={thermalData.max_temp >= 60 ? 'text-error' : thermalData.max_temp >= 45 ? 'text-warning' : 'text-success'}>
                          {formatTemperature(thermalData.max_temp, state.ui.temperatureUnit)}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      {thermalData?.min_temp !== undefined
                        ? formatTemperature(thermalData.min_temp, state.ui.temperatureUnit)
                        : '-'}
                    </td>
                    <td>
                      <span class={`status-dot ${getStatusClass(device.status)}`}></span>
                      {getStatusText(device.status)}
                    </td>
                    <td class="text-muted">
                      {device.last_heartbeat ? formatRelative(device.last_heartbeat) : '-'}
                    </td>
                    <td>
                      <button class="btn btn-sm">查看</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {state.devices.length === 0 && !state.ui.loading.devices && (
        <div class="card text-center" style={{ padding: '60px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📡</div>
          <div class="text-secondary">暂无设备数据</div>
        </div>
      )}

      {state.ui.loading.devices && (
        <div class="card text-center" style={{ padding: '60px 20px' }}>
          <div class="thermal-spinner" style={{ margin: '0 auto 16px' }}></div>
          <div class="text-secondary">加载中...</div>
        </div>
      )}
    </div>
  );
};

export default Devices;
