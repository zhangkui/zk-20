import { state, actions } from '../store/appStore';
import { formatDateTime } from '../utils/date';

const Buildings = () => {
  const handleSelectBuilding = (building) => {
    actions.selectBuilding(building);
  };

  return (
    <div>
      <div class="flex-between mb-lg">
        <h2>建筑管理</h2>
        <button class="btn btn-primary">+ 添加建筑</button>
      </div>

      <div class="grid grid-3">
        {state.buildings.map((building) => (
          <div
            class={`card cursor-pointer ${state.selectedBuilding?.id === building.id ? 'outline-primary' : ''}`}
            onClick={() => handleSelectBuilding(building)}
            style={{
              outline: state.selectedBuilding?.id === building.id ? '2px solid var(--color-primary)' : 'none',
            }}
          >
            <div class="card-header flex-between">
              <span>{building.name}</span>
              <span class={`badge ${building.status === 'active' ? 'badge-success' : 'badge-default'}`}>
                {building.status === 'active' ? '运行中' : '停用'}
              </span>
            </div>
            <div class="card-body">
              <div class="mb-sm">
                <span class="text-secondary">地址：</span>
                <span>{building.address || '-'}</span>
              </div>
              <div class="mb-sm">
                <span class="text-secondary">设备数量：</span>
                <span class="text-primary">{building.device_count || 0}</span>
              </div>
              <div class="mb-sm">
                <span class="text-secondary">负责人：</span>
                <span>{building.responsible_person || '-'}</span>
              </div>
              <div class="mb-sm">
                <span class="text-secondary">今日告警：</span>
                <span class="text-error">{building.today_alerts || 0}</span>
              </div>
              <div class="text-muted text-sm mt-md">
                创建时间：{formatDateTime(building.created_at)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {state.buildings.length === 0 && !state.ui.loading.buildings && (
        <div class="card text-center" style={{ padding: '60px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏢</div>
          <div class="text-secondary">暂无建筑数据</div>
        </div>
      )}

      {state.ui.loading.buildings && (
        <div class="card text-center" style={{ padding: '60px 20px' }}>
          <div class="thermal-spinner" style={{ margin: '0 auto 16px' }}></div>
          <div class="text-secondary">加载中...</div>
        </div>
      )}
    </div>
  );
};

export default Buildings;
