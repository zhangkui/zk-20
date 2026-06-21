import { createSignal, onMount, createMemo } from 'solid-js';
import { state, actions } from '../store/appStore';
import { formatDateTime, formatRelative } from '../utils/date';
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

const AlertDispatch = () => {
  const [selectedDispatch, setSelectedDispatch] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPersonnel, setFilterPersonnel] = useState('all');
  const [filterBuilding, setFilterBuilding] = useState('all');
  const [handlingNotes, setHandlingNotes] = useState('');
  const [showHandlingModal, setShowHandlingModal] = useState(false);
  const [handlingDispatchId, setHandlingDispatchId] = useState(null);
  const [handlingAction, setHandlingAction] = useState(null);

  onMount(async () => {
    await actions.loadAlertDispatches();
    if (!state.patrolPersonnel.length) {
      await actions.loadPatrolPersonnel();
    }
    if (!state.buildings.length) {
      await actions.loadBuildings();
    }
  });

  const getStatusClass = (status) => {
    switch (status) {
      case 'pending':
        return 'badge-error';
      case 'accepted':
        return 'badge-warning';
      case 'arrived':
        return 'badge-info';
      case 'handled':
        return 'badge-success';
      case 'closed':
        return 'badge-default';
      default:
        return 'badge-default';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending':
        return '待接收';
      case 'accepted':
        return '已接收';
      case 'arrived':
        return '已到达';
      case 'handled':
        return '已处置';
      case 'closed':
        return '已关闭';
      default:
        return '未知';
    }
  };

  const getPersonnelName = (personnelId) => {
    const person = (state.patrolPersonnel || []).find(p => p.id === personnelId);
    return person?.name || '-';
  };

  const getBuildingName = (buildingId) => {
    const building = (state.buildings || []).find(b => b.id === buildingId);
    return building?.name || '-';
  };

  const getAlertTitle = (dispatch) => {
    return dispatch?.alert?.title || '-';
  };

  const getAlertBuildingId = (dispatch) => {
    return dispatch?.alert?.building_id;
  };

  const filteredDispatches = createMemo(() => {
    let dispatches = state.alertDispatches || [];

    if (filterStatus() !== 'all') {
      dispatches = dispatches.filter(d => d.status === filterStatus());
    }

    if (filterPersonnel() !== 'all') {
      dispatches = dispatches.filter(d => d.dispatched_to === filterPersonnel());
    }

    if (filterBuilding() !== 'all') {
      dispatches = dispatches.filter(d => getAlertBuildingId(d) === filterBuilding());
    }

    return dispatches.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  });

  const stats = createMemo(() => {
    const dispatches = state.alertDispatches || [];
    return {
      total: dispatches.length,
      pending: dispatches.filter(d => d.status === 'pending').length,
      inProgress: dispatches.filter(d => d.status === 'accepted' || d.status === 'arrived').length,
      completed: dispatches.filter(d => d.status === 'handled' || d.status === 'closed').length,
    };
  });

  const handleAccept = async (dispatchId) => {
    try {
      await api.alertDispatches.accept(dispatchId);
      await actions.loadAlertDispatches();
    } catch (err) {
      console.error('Failed to accept dispatch:', err);
    }
  };

  const handleArrive = async (dispatchId) => {
    try {
      await api.alertDispatches.arrive(dispatchId);
      await actions.loadAlertDispatches();
    } catch (err) {
      console.error('Failed to mark arrived:', err);
    }
  };

  const openHandlingModal = (dispatchId, action) => {
    setHandlingDispatchId(dispatchId);
    setHandlingAction(action);
    setHandlingNotes('');
    setShowHandlingModal(true);
  };

  const handleSubmitHandling = async () => {
    try {
      if (handlingAction() === 'handle') {
        await api.alertDispatches.handle(handlingDispatchId(), handlingNotes());
      } else if (handlingAction() === 'close') {
        await api.alertDispatches.close(handlingDispatchId(), handlingNotes() || null);
      }
      setShowHandlingModal(false);
      await actions.loadAlertDispatches();
    } catch (err) {
      console.error('Failed to submit handling:', err);
    }
  };

  const handleViewDetail = (dispatch) => {
    setSelectedDispatch(dispatch);
    setShowDetail(true);
  };

  const handleDelete = async (dispatchId) => {
    if (!confirm('确定删除此派单记录吗？')) return;
    try {
      await actions.removeAlertDispatch(dispatchId);
    } catch (err) {
      console.error('Failed to delete dispatch:', err);
    }
  };

  return (
    <div>
      <div class="mb-lg">
        <h2>告警派单处置</h2>
        <div class="text-secondary text-sm mt-sm">管理告警派单的接收、到达、处置和关闭流程</div>
      </div>

      <div class="grid grid-4 mb-lg">
        <div class="card">
          <div class="text-secondary mb-sm">派单总数</div>
          <div class="text-3xl font-bold text-primary">{stats().total}</div>
        </div>
        <div class="card">
          <div class="text-secondary mb-sm">待接收</div>
          <div class="text-3xl font-bold text-error">{stats().pending}</div>
        </div>
        <div class="card">
          <div class="text-secondary mb-sm">处置中</div>
          <div class="text-3xl font-bold text-warning">{stats().inProgress}</div>
        </div>
        <div class="card">
          <div class="text-secondary mb-sm">已完成</div>
          <div class="text-3xl font-bold text-success">{stats().completed}</div>
        </div>
      </div>

      <div class="card mb-lg">
        <div class="card-header">派单列表</div>
        <div class="card-body">
          <div class="flex-between mb-md" style={{ flexWrap: 'wrap', gap: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap', flex: 1, minWidth: '200px' }}>
              <select
                value={filterStatus()}
                onChange={(e) => setFilterStatus(e.target.value)}
                class="form-select"
                style={{ width: '140px' }}
              >
                <option value="all">全部状态</option>
                <option value="pending">待接收</option>
                <option value="accepted">已接收</option>
                <option value="arrived">已到达</option>
                <option value="handled">已处置</option>
                <option value="closed">已关闭</option>
              </select>
              <select
                value={filterPersonnel()}
                onChange={(e) => setFilterPersonnel(e.target.value)}
                class="form-select"
                style={{ width: '160px' }}
              >
                <option value="all">全部人员</option>
                {(state.patrolPersonnel || []).map(p => (
                  <option value={p.id}>{p.name}</option>
                ))}
              </select>
              <select
                value={filterBuilding()}
                onChange={(e) => setFilterBuilding(e.target.value)}
                class="form-select"
                style={{ width: '180px' }}
              >
                <option value="all">全部建筑</option>
                {(state.buildings || []).map(b => (
                  <option value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => actions.loadAlertDispatches()}
              class="btn btn-primary btn-sm"
            >
              刷新
            </button>
          </div>

          <table class="table">
            <thead>
              <tr>
                <th>派单时间</th>
                <th>告警标题</th>
                <th>建筑</th>
                <th>派给人员</th>
                <th>状态</th>
                <th>接收时间</th>
                <th>到达时间</th>
                <th>处置时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredDispatches().map((dispatch) => (
                <tr key={dispatch.id}>
                  <td>
                    <div class="font-medium">{formatDateTime(dispatch.created_at)}</div>
                    <div class="text-muted text-sm">{formatRelative(dispatch.created_at)}</div>
                  </td>
                  <td>{getAlertTitle(dispatch)}</td>
                  <td>{getBuildingName(getAlertBuildingId(dispatch))}</td>
                  <td>{getPersonnelName(dispatch.dispatched_to)}</td>
                  <td>
                    <span class={`badge ${getStatusClass(dispatch.status)}`}>
                      {getStatusText(dispatch.status)}
                    </span>
                  </td>
                  <td>{dispatch.accepted_at ? formatDateTime(dispatch.accepted_at) : '-'}</td>
                  <td>{dispatch.arrived_at ? formatDateTime(dispatch.arrived_at) : '-'}</td>
                  <td>{dispatch.handled_at ? formatDateTime(dispatch.handled_at) : '-'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
                      {dispatch.status === 'pending' && (
                        <button
                          onClick={() => handleAccept(dispatch.id)}
                          class="btn btn-warning btn-sm"
                        >
                          接收
                        </button>
                      )}
                      {dispatch.status === 'accepted' && (
                        <button
                          onClick={() => handleArrive(dispatch.id)}
                          class="btn btn-info btn-sm"
                        >
                          到达
                        </button>
                      )}
                      {dispatch.status === 'arrived' && (
                        <button
                          onClick={() => openHandlingModal(dispatch.id, 'handle')}
                          class="btn btn-success btn-sm"
                        >
                          处置
                        </button>
                      )}
                      {(dispatch.status === 'handled') && (
                        <button
                          onClick={() => openHandlingModal(dispatch.id, 'close')}
                          class="btn btn-primary btn-sm"
                        >
                          关闭
                        </button>
                      )}
                      <button
                        onClick={() => handleViewDetail(dispatch)}
                        class="btn btn-sm"
                      >
                        详情
                      </button>
                      <button
                        onClick={() => handleDelete(dispatch.id)}
                        class="btn btn-error btn-sm"
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredDispatches().length === 0 && (
            <div class="text-center" style={{ padding: '60px 20px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
              <div class="text-secondary">暂无派单数据</div>
            </div>
          )}
        </div>
      </div>

      {showDetail() && selectedDispatch() && (
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
            background: 'rgba(0,0,0,0.5)',
            padding: 'var(--spacing-lg)',
          }}
          onClick={() => setShowDetail(false)}
        >
          <div
            class="card"
            style={{
              width: '100%',
              maxWidth: '700px',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div class="card-header flex-between">
              <span>派单详情</span>
              <button
                onClick={() => setShowDetail(false)}
                class="btn btn-sm"
                style={{ border: 'none', background: 'transparent', fontSize: '24px', padding: 0 }}
              >
                ×
              </button>
            </div>
            <div class="card-body">
              <div class="mb-md">
                <div class="grid grid-2">
                  <div>
                    <span class="text-secondary">告警标题：</span>
                    <span class="font-medium">{getAlertTitle(selectedDispatch())}</span>
                  </div>
                  <div>
                    <span class="text-secondary">状态：</span>
                    <span class={`badge ${getStatusClass(selectedDispatch().status)}`}>
                      {getStatusText(selectedDispatch().status)}
                    </span>
                  </div>
                  <div>
                    <span class="text-secondary">派给人员：</span>
                    <span>{getPersonnelName(selectedDispatch().dispatched_to)}</span>
                  </div>
                  <div>
                    <span class="text-secondary">派单时间：</span>
                    <span>{formatDateTime(selectedDispatch().created_at)}</span>
                  </div>
                  {selectedDispatch().dispatch_reason && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span class="text-secondary">派单原因：</span>
                      <span>{selectedDispatch().dispatch_reason}</span>
                    </div>
                  )}
                </div>
              </div>

              <h3 class="mb-sm">处置时间线</h3>
              <div style={{ position: 'relative', paddingLeft: '24px' }}>
                <div style={{ position: 'absolute', left: '7px', top: '8px', bottom: '8px', width: '2px', background: 'var(--color-border)' }}></div>
                {selectedDispatch().created_at && (
                  <div style={{ position: 'relative', paddingBottom: '16px' }}>
                    <div style={{ position: 'absolute', left: '-20px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--color-primary)' }}></div>
                    <div class="font-medium">派单创建</div>
                    <div class="text-muted text-sm">{formatDateTime(selectedDispatch().created_at)}</div>
                  </div>
                )}
                {selectedDispatch().accepted_at && (
                  <div style={{ position: 'relative', paddingBottom: '16px' }}>
                    <div style={{ position: 'absolute', left: '-20px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--color-warning)' }}></div>
                    <div class="font-medium">已接收</div>
                    <div class="text-muted text-sm">{formatDateTime(selectedDispatch().accepted_at)}</div>
                  </div>
                )}
                {selectedDispatch().arrived_at && (
                  <div style={{ position: 'relative', paddingBottom: '16px' }}>
                    <div style={{ position: 'absolute', left: '-20px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--color-info)' }}></div>
                    <div class="font-medium">已到达现场</div>
                    <div class="text-muted text-sm">{formatDateTime(selectedDispatch().arrived_at)}</div>
                  </div>
                )}
                {selectedDispatch().handled_at && (
                  <div style={{ position: 'relative', paddingBottom: '16px' }}>
                    <div style={{ position: 'absolute', left: '-20px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--color-success)' }}></div>
                    <div class="font-medium">已处置</div>
                    <div class="text-muted text-sm">{formatDateTime(selectedDispatch().handled_at)}</div>
                    {selectedDispatch().handling_notes && (
                      <div class="text-sm mt-xs" style={{ padding: '8px', background: 'var(--color-bg)', borderRadius: 'var(--border-radius-sm)' }}>
                        {selectedDispatch().handling_notes}
                      </div>
                    )}
                  </div>
                )}
                {selectedDispatch().closed_at && (
                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '-20px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--color-text-secondary)' }}></div>
                    <div class="font-medium">已关闭</div>
                    <div class="text-muted text-sm">{formatDateTime(selectedDispatch().closed_at)}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showHandlingModal() && (
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
            background: 'rgba(0,0,0,0.5)',
            padding: 'var(--spacing-lg)',
          }}
          onClick={() => setShowHandlingModal(false)}
        >
          <div
            class="card"
            style={{
              width: '100%',
              maxWidth: '480px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div class="card-header flex-between">
              <span>{handlingAction() === 'handle' ? '处置告警' : '关闭派单'}</span>
              <button
                onClick={() => setShowHandlingModal(false)}
                class="btn btn-sm"
                style={{ border: 'none', background: 'transparent', fontSize: '24px', padding: 0 }}
              >
                ×
              </button>
            </div>
            <div class="card-body">
              <div class="form-item">
                <label class="form-label">{handlingAction() === 'handle' ? '处置说明' : '关闭说明（可选）'}</label>
                <textarea
                  class="form-textarea"
                  value={handlingNotes()}
                  onInput={(e) => setHandlingNotes(e.target.value)}
                  placeholder={handlingAction() === 'handle' ? '请输入处置说明' : '请输入关闭说明'}
                  rows="4"
                  style={{ minHeight: '100px' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end', marginTop: 'var(--spacing-md)' }}>
                <button
                  onClick={() => setShowHandlingModal(false)}
                  class="btn"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmitHandling}
                  class="btn btn-primary"
                >
                  确认
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertDispatch;
