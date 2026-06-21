import { createSignal, onMount, createMemo } from 'solid-js';
import { state, actions } from '../store/appStore';
import { formatDateTime, formatDate } from '../utils/date';
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

const RISK_LEVELS = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
];

const RECTIFICATION_STATUSES = [
  { value: 'pending', label: '待整改' },
  { value: 'in_progress', label: '整改中' },
  { value: 'completed', label: '已完成' },
  { value: 'expired', label: '已逾期' },
];

const defaultInspectionForm = () => ({
  building_id: '',
  inspector_id: '',
  inspection_date: new Date().toISOString().slice(0, 10),
  risk_level_before: 'medium',
  risk_level_after: 'low',
  findings: '',
  rectification_status: 'pending',
  rectification_deadline: '',
  rectification_notes: '',
  notes: '',
});

const BuildingLedger = () => {
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRectificationModal, setShowRectificationModal] = useState(false);
  const [editingInspection, setEditingInspection] = useState(null);
  const [rectificationInspection, setRectificationInspection] = useState(null);
  const [inspectionForm, setInspectionForm] = useState(defaultInspectionForm());
  const [rectificationForm, setRectificationForm] = useState({
    rectification_status: 'in_progress',
    rectification_completed_at: '',
    rectification_notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  onMount(async () => {
    if (!state.buildings.length) {
      await actions.loadBuildings();
    }
    if (!state.patrolPersonnel.length) {
      await actions.loadPatrolPersonnel();
    }
    if (!state.buildingInspections.length) {
      await actions.loadBuildingInspections();
    }
    if (!state.alerts.length) {
      await actions.loadAlerts({ limit: 50 });
    }
    if (!state.hotspots.length) {
      await actions.loadHotspots();
    }
  });

  const getRiskClass = (level) => {
    switch (level) {
      case 'high':
        return 'badge-error';
      case 'medium':
        return 'badge-warning';
      case 'low':
        return 'badge-success';
      default:
        return 'badge-default';
    }
  };

  const getRiskText = (level) => {
    switch (level) {
      case 'high':
        return '高';
      case 'medium':
        return '中';
      case 'low':
        return '低';
      default:
        return '-';
    }
  };

  const getRectificationClass = (status) => {
    switch (status) {
      case 'pending':
        return 'badge-error';
      case 'in_progress':
        return 'badge-warning';
      case 'completed':
        return 'badge-success';
      case 'expired':
        return 'badge-error';
      default:
        return 'badge-default';
    }
  };

  const getRectificationText = (status) => {
    switch (status) {
      case 'pending':
        return '待整改';
      case 'in_progress':
        return '整改中';
      case 'completed':
        return '已完成';
      case 'expired':
        return '已逾期';
      default:
        return '-';
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

  const selectedBuilding = createMemo(() => {
    return (state.buildings || []).find(b => b.id === selectedBuildingId()) || null;
  });

  const buildingInspections = createMemo(() => {
    if (!selectedBuildingId()) return [];
    return (state.buildingInspections || [])
      .filter(i => i.building_id === selectedBuildingId())
      .sort((a, b) => new Date(b.inspection_date) - new Date(a.inspection_date));
  });

  const buildingAlerts = createMemo(() => {
    if (!selectedBuildingId()) return [];
    return (state.alerts || [])
      .filter(a => a.building_id === selectedBuildingId())
      .slice(0, 10);
  });

  const buildingHotspots = createMemo(() => {
    if (!selectedBuildingId()) return [];
    return (state.hotspots || [])
      .filter(h => h.building_id === selectedBuildingId())
      .slice(0, 10);
  });

  const stats = createMemo(() => {
    const inspections = buildingInspections();
    return {
      total: inspections.length,
      pendingRectification: inspections.filter(i => i.rectification_status === 'pending' || i.rectification_status === 'in_progress').length,
      completedRectification: inspections.filter(i => i.rectification_status === 'completed').length,
    };
  });

  const handleSelectBuilding = (buildingId) => {
    setSelectedBuildingId(buildingId);
  };

  const handleOpenAdd = () => {
    if (!selectedBuildingId()) {
      alert('请先选择建筑');
      return;
    }
    setInspectionForm({
      ...defaultInspectionForm(),
      building_id: selectedBuildingId(),
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (inspection) => {
    setEditingInspection(inspection);
    setInspectionForm({
      building_id: inspection.building_id,
      inspector_id: inspection.inspector_id || '',
      inspection_date: inspection.inspection_date ? inspection.inspection_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      risk_level_before: inspection.risk_level_before || 'medium',
      risk_level_after: inspection.risk_level_after || 'low',
      findings: inspection.findings || '',
      rectification_status: inspection.rectification_status || 'pending',
      rectification_deadline: inspection.rectification_deadline ? inspection.rectification_deadline.slice(0, 10) : '',
      rectification_notes: inspection.rectification_notes || '',
      notes: inspection.notes || '',
    });
    setShowEditModal(true);
  };

  const handleOpenRectification = (inspection) => {
    setRectificationInspection(inspection);
    setRectificationForm({
      rectification_status: inspection.rectification_status || 'in_progress',
      rectification_completed_at: inspection.rectification_completed_at ? inspection.rectification_completed_at.slice(0, 10) : '',
      rectification_notes: inspection.rectification_notes || '',
    });
    setShowRectificationModal(true);
  };

  const handleSubmitAdd = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await actions.addBuildingInspection({
        building_id: inspectionForm().building_id,
        inspector_id: inspectionForm().inspector_id || null,
        inspection_date: inspectionForm().inspection_date,
        risk_level_before: inspectionForm().risk_level_before || null,
        risk_level_after: inspectionForm().risk_level_after || null,
        findings: inspectionForm().findings || null,
        rectification_status: inspectionForm().rectification_status || null,
        rectification_deadline: inspectionForm().rectification_deadline || null,
        rectification_notes: inspectionForm().rectification_notes || null,
        notes: inspectionForm().notes || null,
      });
      setShowAddModal(false);
    } catch (err) {
      console.error('Failed to add inspection:', err);
      alert('添加巡检记录失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitEdit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const updated = await api.buildingInspections.update(editingInspection().id, {
        building_id: inspectionForm().building_id,
        inspector_id: inspectionForm().inspector_id || null,
        inspection_date: inspectionForm().inspection_date,
        risk_level_before: inspectionForm().risk_level_before || null,
        risk_level_after: inspectionForm().risk_level_after || null,
        findings: inspectionForm().findings || null,
        rectification_status: inspectionForm().rectification_status || null,
        rectification_deadline: inspectionForm().rectification_deadline || null,
        rectification_notes: inspectionForm().rectification_notes || null,
        notes: inspectionForm().notes || null,
      });
      actions.updateBuildingInspection(editingInspection().id, updated);
      setShowEditModal(false);
    } catch (err) {
      console.error('Failed to update inspection:', err);
      alert('更新巡检记录失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitRectification = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const updated = await api.buildingInspections.updateRectification(rectificationInspection().id, {
        rectification_status: rectificationForm().rectification_status,
        rectification_completed_at: rectificationForm().rectification_completed_at || null,
        rectification_notes: rectificationForm().rectification_notes || null,
      });
      actions.updateBuildingInspection(rectificationInspection().id, updated);
      setShowRectificationModal(false);
    } catch (err) {
      console.error('Failed to update rectification:', err);
      alert('更新整改状态失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (inspectionId) => {
    if (!confirm('确定删除此巡检记录吗？')) return;
    try {
      await actions.removeBuildingInspection(inspectionId);
    } catch (err) {
      console.error('Failed to delete inspection:', err);
    }
  };

  return (
    <div>
      <div class="mb-lg">
        <h2>建筑风险巡检台账</h2>
        <div class="text-secondary text-sm mt-sm">查看和管理各建筑的巡检记录与整改台账</div>
      </div>

      <div class="card mb-lg">
        <div class="card-header">选择建筑</div>
        <div class="card-body">
          <select
            value={selectedBuildingId()}
            onChange={(e) => handleSelectBuilding(e.target.value)}
            class="form-select"
            style={{ maxWidth: '400px' }}
          >
            <option value="">请选择建筑</option>
            {(state.buildings || []).map(b => (
              <option value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {selectedBuilding() && (
        <>
          <div class="grid grid-2 mb-lg">
            <div class="card">
              <div class="card-header">建筑信息</div>
              <div class="card-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
                  <span style={{ fontSize: '36px' }}>{selectedBuilding().icon || '🏛️'}</span>
                  <div>
                    <h3 style={{ margin: 0 }}>{selectedBuilding().name}</h3>
                    <span class={`badge ${selectedBuilding().status === 'active' ? 'badge-success' : 'badge-default'}`}>
                      {selectedBuilding().status === 'active' ? '运行中' : '已停用'}
                    </span>
                  </div>
                </div>
                <div class="grid grid-2">
                  <div>
                    <span class="text-secondary">建筑类型：</span>
                    <span>{selectedBuilding().building_type || '-'}</span>
                  </div>
                  <div>
                    <span class="text-secondary">风险等级：</span>
                    <span class={`badge ${getRiskClass(selectedBuilding().risk_level)}`}>
                      {getRiskText(selectedBuilding().risk_level)}
                    </span>
                  </div>
                  <div>
                    <span class="text-secondary">建筑面积：</span>
                    <span>{selectedBuilding().area || 0} ㎡</span>
                  </div>
                  <div>
                    <span class="text-secondary">楼层数：</span>
                    <span>{selectedBuilding().floors || '-'} 层</span>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span class="text-secondary">地址：</span>
                    <span>{selectedBuilding().address || '-'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="grid grid-3" style={{ alignContent: 'flex-start' }}>
              <div class="card">
                <div class="text-secondary mb-sm">巡检总次数</div>
                <div class="text-3xl font-bold text-primary">{stats().total}</div>
              </div>
              <div class="card">
                <div class="text-secondary mb-sm">待整改</div>
                <div class="text-3xl font-bold text-warning">{stats().pendingRectification}</div>
              </div>
              <div class="card">
                <div class="text-secondary mb-sm">已整改完成</div>
                <div class="text-3xl font-bold text-success">{stats().completedRectification}</div>
              </div>
            </div>
          </div>

          <div class="card mb-lg">
            <div class="card-header flex-between">
              <span>巡检记录台账</span>
              <button
                onClick={handleOpenAdd}
                class="btn btn-primary btn-sm"
              >
                + 添加巡检记录
              </button>
            </div>
            <div class="card-body" style={{ padding: 0 }}>
              <table class="table">
                <thead>
                  <tr>
                    <th>巡检日期</th>
                    <th>巡检人员</th>
                    <th>巡检前风险</th>
                    <th>巡检后风险</th>
                    <th>发现问题</th>
                    <th>整改状态</th>
                    <th>整改期限</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {buildingInspections().map((inspection) => (
                    <tr key={inspection.id}>
                      <td>{formatDate(inspection.inspection_date)}</td>
                      <td>{getPersonnelName(inspection.inspector_id)}</td>
                      <td>
                        <span class={`badge ${getRiskClass(inspection.risk_level_before)}`}>
                          {getRiskText(inspection.risk_level_before)}
                        </span>
                      </td>
                      <td>
                        <span class={`badge ${getRiskClass(inspection.risk_level_after)}`}>
                          {getRiskText(inspection.risk_level_after)}
                        </span>
                      </td>
                      <td>
                        {inspection.findings ? (
                          <div style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {inspection.findings}
                          </div>
                        ) : '-'}
                      </td>
                      <td>
                        <span class={`badge ${getRectificationClass(inspection.rectification_status)}`}>
                          {getRectificationText(inspection.rectification_status)}
                        </span>
                      </td>
                      <td>{inspection.rectification_deadline ? formatDate(inspection.rectification_deadline) : '-'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => handleOpenEdit(inspection)}
                            class="btn btn-sm"
                          >
                            编辑
                          </button>
                          <button
                            onClick={() => handleOpenRectification(inspection)}
                            class="btn btn-warning btn-sm"
                          >
                            更新整改
                          </button>
                          <button
                            onClick={() => handleDelete(inspection.id)}
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

              {buildingInspections().length === 0 && (
                <div class="text-center" style={{ padding: '60px 20px' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
                  <div class="text-secondary">暂无巡检记录</div>
                </div>
              )}
            </div>
          </div>

          <div class="grid grid-2 mb-lg">
            <div class="card">
              <div class="card-header">相关告警历史</div>
              <div class="card-body" style={{ padding: 0 }}>
                {buildingAlerts().length > 0 ? (
                  <table class="table">
                    <thead>
                      <tr>
                        <th>时间</th>
                        <th>标题</th>
                        <th>级别</th>
                        <th>状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {buildingAlerts().map((alert) => (
                        <tr key={alert.id}>
                          <td>{formatDateTime(alert.created_at)}</td>
                          <td>{alert.title}</td>
                          <td>
                            <span class={`badge ${getRiskClass(alert.severity)}`}>
                              {getRiskText(alert.severity)}
                            </span>
                          </td>
                          <td>
                            <span class={`badge ${alert.status === 'resolved' ? 'badge-success' : alert.status === 'acknowledged' ? 'badge-warning' : 'badge-error'}`}>
                              {alert.status === 'resolved' ? '已解决' : alert.status === 'acknowledged' ? '已确认' : '待处理'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div class="text-center" style={{ padding: '40px 20px' }}>
                    <div class="text-secondary">暂无相关告警</div>
                  </div>
                )}
              </div>
            </div>

            <div class="card">
              <div class="card-header">热点历史</div>
              <div class="card-body" style={{ padding: 0 }}>
                {buildingHotspots().length > 0 ? (
                  <table class="table">
                    <thead>
                      <tr>
                        <th>发现时间</th>
                        <th>风险等级</th>
                        <th>状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {buildingHotspots().map((hotspot) => (
                        <tr key={hotspot.id}>
                          <td>{formatDateTime(hotspot.created_at)}</td>
                          <td>
                            <span class={`badge ${getRiskClass(hotspot.risk_level)}`}>
                              {getRiskText(hotspot.risk_level)}
                            </span>
                          </td>
                          <td>
                            <span class={`badge ${hotspot.status === 'resolved' ? 'badge-success' : hotspot.status === 'monitoring' ? 'badge-warning' : 'badge-error'}`}>
                              {hotspot.status === 'resolved' ? '已处理' : hotspot.status === 'monitoring' ? '监控中' : '待处理'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div class="text-center" style={{ padding: '40px 20px' }}>
                    <div class="text-secondary">暂无热点记录</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {!selectedBuilding() && (
        <div class="card text-center" style={{ padding: '80px 20px' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🏛️</div>
          <div class="text-secondary">请先在上方选择一个建筑</div>
        </div>
      )}

      {(showAddModal() || showEditModal()) && (
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
          onClick={() => { if (!submitting()) { setShowAddModal(false); setShowEditModal(false); } }}
        >
          <div
            class="card"
            style={{
              width: '100%',
              maxWidth: '600px',
              maxHeight: '88vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div class="card-header flex-between">
              <span>{showAddModal() ? '添加巡检记录' : '编辑巡检记录'}</span>
              <button
                onClick={() => { if (!submitting()) { setShowAddModal(false); setShowEditModal(false); } }}
                class="btn btn-sm"
                style={{ border: 'none', background: 'transparent', fontSize: '24px', padding: 0 }}
              >
                ×
              </button>
            </div>
            <div class="card-body">
              <form onSubmit={showAddModal() ? handleSubmitAdd : handleSubmitEdit}>
                <div class="grid grid-2">
                  <div class="form-item">
                    <label class="form-label">巡检日期 *</label>
                    <input
                      class="form-input"
                      type="date"
                      value={inspectionForm().inspection_date}
                      onInput={(e) => setInspectionForm({ ...inspectionForm(), inspection_date: e.target.value })}
                      required
                    />
                  </div>
                  <div class="form-item">
                    <label class="form-label">巡检人员</label>
                    <select
                      class="form-select"
                      value={inspectionForm().inspector_id}
                      onInput={(e) => setInspectionForm({ ...inspectionForm(), inspector_id: e.target.value })}
                    >
                      <option value="">请选择巡检人员</option>
                      {(state.patrolPersonnel || []).map(p => (
                        <option value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div class="form-item">
                    <label class="form-label">巡检前风险等级</label>
                    <select
                      class="form-select"
                      value={inspectionForm().risk_level_before}
                      onInput={(e) => setInspectionForm({ ...inspectionForm(), risk_level_before: e.target.value })}
                    >
                      {RISK_LEVELS.map(r => (
                        <option value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                  <div class="form-item">
                    <label class="form-label">巡检后风险等级</label>
                    <select
                      class="form-select"
                      value={inspectionForm().risk_level_after}
                      onInput={(e) => setInspectionForm({ ...inspectionForm(), risk_level_after: e.target.value })}
                    >
                      {RISK_LEVELS.map(r => (
                        <option value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div class="form-item">
                  <label class="form-label">发现问题</label>
                  <textarea
                    class="form-textarea"
                    value={inspectionForm().findings}
                    onInput={(e) => setInspectionForm({ ...inspectionForm(), findings: e.target.value })}
                    placeholder="请输入发现的问题"
                    rows="3"
                  />
                </div>
                <div class="grid grid-2">
                  <div class="form-item">
                    <label class="form-label">整改状态</label>
                    <select
                      class="form-select"
                      value={inspectionForm().rectification_status}
                      onInput={(e) => setInspectionForm({ ...inspectionForm(), rectification_status: e.target.value })}
                    >
                      {RECTIFICATION_STATUSES.map(s => (
                        <option value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div class="form-item">
                    <label class="form-label">整改期限</label>
                    <input
                      class="form-input"
                      type="date"
                      value={inspectionForm().rectification_deadline}
                      onInput={(e) => setInspectionForm({ ...inspectionForm(), rectification_deadline: e.target.value })}
                    />
                  </div>
                </div>
                <div class="form-item">
                  <label class="form-label">整改说明</label>
                  <textarea
                    class="form-textarea"
                    value={inspectionForm().rectification_notes}
                    onInput={(e) => setInspectionForm({ ...inspectionForm(), rectification_notes: e.target.value })}
                    placeholder="请输入整改说明"
                    rows="2"
                  />
                </div>
                <div class="form-item">
                  <label class="form-label">备注</label>
                  <textarea
                    class="form-textarea"
                    value={inspectionForm().notes}
                    onInput={(e) => setInspectionForm({ ...inspectionForm(), notes: e.target.value })}
                    placeholder="请输入备注信息"
                    rows="2"
                  />
                </div>
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end', marginTop: 'var(--spacing-md)' }}>
                  <button
                    type="button"
                    onClick={() => { if (!submitting()) { setShowAddModal(false); setShowEditModal(false); } }}
                    class="btn"
                    disabled={submitting()}
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    class="btn btn-primary"
                    disabled={submitting()}
                  >
                    {submitting() ? '提交中...' : '确认'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showRectificationModal() && rectificationInspection() && (
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
          onClick={() => { if (!submitting()) setShowRectificationModal(false); }}
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
              <span>更新整改状态</span>
              <button
                onClick={() => { if (!submitting()) setShowRectificationModal(false); }}
                class="btn btn-sm"
                style={{ border: 'none', background: 'transparent', fontSize: '24px', padding: 0 }}
              >
                ×
              </button>
            </div>
            <div class="card-body">
              <form onSubmit={handleSubmitRectification}>
                <div class="form-item">
                  <label class="form-label">整改状态 *</label>
                  <select
                    class="form-select"
                    value={rectificationForm().rectification_status}
                    onInput={(e) => setRectificationForm({ ...rectificationForm(), rectification_status: e.target.value })}
                    required
                  >
                    {RECTIFICATION_STATUSES.map(s => (
                      <option value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div class="form-item">
                  <label class="form-label">整改完成日期</label>
                  <input
                    class="form-input"
                    type="date"
                    value={rectificationForm().rectification_completed_at}
                    onInput={(e) => setRectificationForm({ ...rectificationForm(), rectification_completed_at: e.target.value })}
                  />
                </div>
                <div class="form-item">
                  <label class="form-label">整改说明</label>
                  <textarea
                    class="form-textarea"
                    value={rectificationForm().rectification_notes}
                    onInput={(e) => setRectificationForm({ ...rectificationForm(), rectification_notes: e.target.value })}
                    placeholder="请输入整改说明"
                    rows="3"
                  />
                </div>
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end', marginTop: 'var(--spacing-md)' }}>
                  <button
                    type="button"
                    onClick={() => { if (!submitting()) setShowRectificationModal(false); }}
                    class="btn"
                    disabled={submitting()}
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    class="btn btn-primary"
                    disabled={submitting()}
                  >
                    {submitting() ? '提交中...' : '确认更新'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuildingLedger;
