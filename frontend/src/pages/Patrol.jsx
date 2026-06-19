import { state } from '../store/appStore';
import { formatRelative } from '../utils/date';

const Patrol = () => {
  const getStatusClass = (status) => {
    switch (status) {
      case 'on_duty':
        return 'badge-success';
      case 'off_duty':
        return 'badge-default';
      case 'patrolling':
        return 'badge-info';
      case 'responding':
        return 'badge-warning';
      default:
        return 'badge-default';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'on_duty':
        return '在岗';
      case 'off_duty':
        return '离岗';
      case 'patrolling':
        return '巡逻中';
      case 'responding':
        return '响应中';
      default:
        return '未知';
    }
  };

  return (
    <div>
      <div class="flex-between mb-lg">
        <h2>巡防管理</h2>
        <button class="btn btn-primary">+ 添加人员</button>
      </div>

      <div class="grid grid-4 mb-lg">
        <div class="card">
          <div class="text-secondary mb-sm">总人数</div>
          <div class="text-3xl font-bold text-primary">{state.patrolPersonnel.length}</div>
        </div>
        <div class="card">
          <div class="text-secondary mb-sm">在岗</div>
          <div class="text-3xl font-bold text-success">
            {state.patrolPersonnel.filter((p) => p.status === 'on_duty' || p.status === 'patrolling' || p.status === 'responding').length}
          </div>
        </div>
        <div class="card">
          <div class="text-secondary mb-sm">巡逻中</div>
          <div class="text-3xl font-bold text-info">
            {state.patrolPersonnel.filter((p) => p.status === 'patrolling').length}
          </div>
        </div>
        <div class="card">
          <div class="text-secondary mb-sm">响应告警</div>
          <div class="text-3xl font-bold text-warning">
            {state.patrolPersonnel.filter((p) => p.status === 'responding').length}
          </div>
        </div>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <div class="card-header">巡防人员列表</div>
          <div class="card-body" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>姓名</th>
                  <th>编号</th>
                  <th>状态</th>
                  <th>联系电话</th>
                  <th>最后位置</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {state.patrolPersonnel.map((person) => (
                  <tr key={person.id}>
                    <td>
                      <div class="flex-center" style={{ gap: '8px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: 'var(--color-primary)',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: '600',
                          }}
                        >
                          {person.name?.charAt(0) || '?'}
                        </div>
                        <span>{person.name}</span>
                      </div>
                    </td>
                    <td class="text-muted">{person.personnel_code || '-'}</td>
                    <td>
                      <span class={`badge ${getStatusClass(person.status)}`}>
                        {getStatusText(person.status)}
                      </span>
                    </td>
                    <td>{person.phone || '-'}</td>
                    <td>
                      {person.lastLocation ? (
                        <span class="text-success">
                          {person.lastLocation.lat?.toFixed(4)}, {person.lastLocation.lng?.toFixed(4)}
                        </span>
                      ) : (
                        <span class="text-muted">-</span>
                      )}
                      {person.lastLocation?.timestamp && (
                        <div class="text-muted text-sm">
                          {formatRelative(person.lastLocation.timestamp)}
                        </div>
                      )}
                    </td>
                    <td>
                      <button class="btn btn-sm">详情</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header">实时位置</div>
          <div class="card-body">
            <div
              style={{
                height: '400px',
                background: 'var(--color-bg)',
                borderRadius: 'var(--border-radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px dashed var(--color-border)',
              }}
            >
              <div class="text-center">
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📍</div>
                <div class="text-secondary mb-sm">实时位置地图</div>
                <div class="text-muted text-sm">显示巡防人员实时位置和移动轨迹</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {state.patrolPersonnel.length === 0 && !state.ui.loading.patrolPersonnel && (
        <div class="card text-center" style={{ padding: '60px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>👮</div>
          <div class="text-secondary">暂无巡防人员数据</div>
        </div>
      )}
    </div>
  );
};

export default Patrol;
