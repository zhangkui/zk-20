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

const TASK_TYPES = [
  { value: 'daily', label: '日常巡检' },
  { value: 'weekly', label: '周度巡检' },
  { value: 'monthly', label: '月度巡检' },
  { value: 'special', label: '专项巡检' },
  { value: 'fire_prevention', label: '防火检查' },
];

const RISK_LEVELS = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
];

const defaultFormData = () => ({
  building_id: '',
  personnel_id: '',
  task_name: '',
  task_type: 'daily',
  risk_level: 'medium',
  scheduled_start: '',
  scheduled_end: '',
  notes: '',
});

const PatrolTasks = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [completingTask, setCompletingTask] = useState(null);
  const [formData, setFormData] = useState(defaultFormData());
  const [completeData, setCompleteData] = useState({
    inspection_result: '',
    findings: '',
    completed_risk_level: 'low',
  });
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPersonnel, setFilterPersonnel] = useState('all');
  const [filterBuilding, setFilterBuilding] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  onMount(async () => {
    await actions.loadPatrolTasks();
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
        return 'badge-default';
      case 'in_progress':
        return 'badge-warning';
      case 'completed':
        return 'badge-success';
      case 'overdue':
        return 'badge-error';
      default:
        return 'badge-default';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending':
        return '待执行';
      case 'in_progress':
        return '进行中';
      case 'completed':
        return '已完成';
      case 'overdue':
        return '已逾期';
      default:
        return '未知';
    }
  };

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

  const getTaskTypeText = (type) => {
    const found = TASK_TYPES.find(t => t.value === type);
    return found?.label || type;
  };

  const getPersonnelName = (personnelId) => {
    const person = (state.patrolPersonnel || []).find(p => p.id === personnelId);
    return person?.name || '-';
  };

  const getBuildingName = (buildingId) => {
    const building = (state.buildings || []).find(b => b.id === buildingId);
    return building?.name || '-';
  };

  const filteredTasks = createMemo(() => {
    let tasks = state.patrolTasks || [];

    if (filterStatus() !== 'all') {
      tasks = tasks.filter(t => t.status === filterStatus());
    }

    if (filterPersonnel() !== 'all') {
      tasks = tasks.filter(t => t.personnel_id === filterPersonnel());
    }

    if (filterBuilding() !== 'all') {
      tasks = tasks.filter(t => t.building_id === filterBuilding());
    }

    if (dateFrom()) {
      const from = new Date(dateFrom());
      tasks = tasks.filter(t => new Date(t.scheduled_start) >= from);
    }

    if (dateTo()) {
      const to = new Date(dateTo() + ' 23:59:59');
      tasks = tasks.filter(t => new Date(t.scheduled_start) <= to);
    }

    return tasks.sort((a, b) => new Date(b.scheduled_start) - new Date(a.scheduled_start));
  });

  const stats = createMemo(() => {
    const tasks = state.patrolTasks || [];
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      overdue: tasks.filter(t => t.status === 'overdue').length,
    };
  });

  const handleOpenCreate = () => {
    setFormData(defaultFormData());
    setShowCreateModal(true);
  };

  const handleOpenEdit = (task) => {
    setEditingTask(task);
    setFormData({
      building_id: task.building_id,
      personnel_id: task.personnel_id || '',
      task_name: task.task_name,
      task_type: task.task_type,
      risk_level: task.risk_level,
      scheduled_start: task.scheduled_start ? task.scheduled_start.slice(0, 16) : '',
      scheduled_end: task.scheduled_end ? task.scheduled_end.slice(0, 16) : '',
      notes: task.notes || '',
    });
    setShowEditModal(true);
  };

  const handleOpenComplete = (task) => {
    setCompletingTask(task);
    setCompleteData({
      inspection_result: '',
      findings: '',
      completed_risk_level: 'low',
    });
    setShowCompleteModal(true);
  };

  const handleSubmitCreate = async (e) => {
    e.preventDefault();
    if (!formData().building_id || !formData().task_name || !formData().scheduled_start || !formData().scheduled_end) {
      alert('请填写必填字段');
      return;
    }
    setSubmitting(true);
    try {
      await actions.addPatrolTask({
        building_id: formData().building_id,
        personnel_id: formData().personnel_id || null,
        task_name: formData().task_name,
        task_type: formData().task_type,
        risk_level: formData().risk_level,
        scheduled_start: formData().scheduled_start,
        scheduled_end: formData().scheduled_end,
        notes: formData().notes || null,
      });
      setShowCreateModal(false);
    } catch (err) {
      console.error('Failed to create task:', err);
      alert('创建任务失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitEdit = async (e) => {
    e.preventDefault();
    if (!formData().building_id || !formData().task_name || !formData().scheduled_start || !formData().scheduled_end) {
      alert('请填写必填字段');
      return;
    }
    setSubmitting(true);
    try {
      const updated = await api.patrolTasks.update(editingTask().id, {
        building_id: formData().building_id,
        personnel_id: formData().personnel_id || null,
        task_name: formData().task_name,
        task_type: formData().task_type,
        risk_level: formData().risk_level,
        scheduled_start: formData().scheduled_start,
        scheduled_end: formData().scheduled_end,
        notes: formData().notes || null,
      });
      actions.updatePatrolTask(editingTask().id, updated);
      setShowEditModal(false);
    } catch (err) {
      console.error('Failed to update task:', err);
      alert('更新任务失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitComplete = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.patrolTasks.complete(completingTask().id, {
        inspection_result: completeData().inspection_result,
        findings: completeData().findings || null,
        completed_risk_level: completeData().completed_risk_level,
      });
      await actions.loadPatrolTasks();
      setShowCompleteModal(false);
    } catch (err) {
      console.error('Failed to complete task:', err);
      alert('完成任务失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStart = async (taskId) => {
    try {
      await api.patrolTasks.start(taskId);
      await actions.loadPatrolTasks();
    } catch (err) {
      console.error('Failed to start task:', err);
    }
  };

  const handleDelete = async (taskId) => {
    if (!confirm('确定删除此任务吗？')) return;
    try {
      await actions.removePatrolTask(taskId);
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const handleGenerateDaily = async () => {
    try {
      await api.patrolTasks.generateDaily();
      await actions.loadPatrolTasks();
      alert('每日任务生成成功');
    } catch (err) {
      console.error('Failed to generate daily tasks:', err);
      alert('生成每日任务失败');
    }
  };

  return (
    <div>
      <div class="mb-lg">
        <h2>巡防任务排班</h2>
        <div class="text-secondary text-sm mt-sm">管理和安排建筑巡防巡检任务</div>
      </div>

      <div class="grid grid-4 mb-lg">
        <div class="card">
          <div class="text-secondary mb-sm">任务总数</div>
          <div class="text-3xl font-bold text-primary">{stats().total}</div>
        </div>
        <div class="card">
          <div class="text-secondary mb-sm">待执行</div>
          <div class="text-3xl font-bold text-muted">{stats().pending}</div>
        </div>
        <div class="card">
          <div class="text-secondary mb-sm">进行中</div>
          <div class="text-3xl font-bold text-warning">{stats().inProgress}</div>
        </div>
        <div class="card">
          <div class="text-secondary mb-sm">已完成</div>
          <div class="text-3xl font-bold text-success">{stats().completed}</div>
        </div>
        <div class="card">
          <div class="text-secondary mb-sm">已逾期</div>
          <div class="text-3xl font-bold text-error">{stats().overdue}</div>
        </div>
      </div>

      <div class="card mb-lg">
        <div class="card-header flex-between">
          <span>任务列表</span>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            <button
              onClick={handleGenerateDaily}
              class="btn btn-sm"
            >
              生成每日任务
            </button>
            <button
              onClick={handleOpenCreate}
              class="btn btn-primary btn-sm"
            >
              + 创建任务
            </button>
          </div>
        </div>
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
                <option value="pending">待执行</option>
                <option value="in_progress">进行中</option>
                <option value="completed">已完成</option>
                <option value="overdue">已逾期</option>
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
              <input
                type="date"
                value={dateFrom()}
                onChange={(e) => setDateFrom(e.target.value)}
                class="form-input"
                style={{ width: '140px' }}
                placeholder="开始日期"
              />
              <input
                type="date"
                value={dateTo()}
                onChange={(e) => setDateTo(e.target.value)}
                class="form-input"
                style={{ width: '140px' }}
                placeholder="结束日期"
              />
            </div>
            <button
              onClick={() => actions.loadPatrolTasks()}
              class="btn btn-primary btn-sm"
            >
              刷新
            </button>
          </div>

          <table class="table">
            <thead>
              <tr>
                <th>任务名称</th>
                <th>建筑</th>
                <th>负责人</th>
                <th>类型</th>
                <th>风险等级</th>
                <th>计划时间</th>
                <th>状态</th>
                <th>开始时间</th>
                <th>完成时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks().map((task) => (
                <tr key={task.id}>
                  <td>
                    <div class="font-medium">{task.task_name}</div>
                    {task.notes && <div class="text-muted text-sm">{task.notes}</div>}
                  </td>
                  <td>{getBuildingName(task.building_id)}</td>
                  <td>{getPersonnelName(task.personnel_id)}</td>
                  <td>{getTaskTypeText(task.task_type)}</td>
                  <td>
                    <span class={`badge ${getRiskClass(task.risk_level)}`}>
                      {getRiskText(task.risk_level)}
                    </span>
                  </td>
                  <td>
                    <div>{formatDate(task.scheduled_start)}</div>
                    <div class="text-muted text-sm">至 {formatDate(task.scheduled_end)}</div>
                  </td>
                  <td>
                    <span class={`badge ${getStatusClass(task.status)}`}>
                      {getStatusText(task.status)}
                    </span>
                  </td>
                  <td>{task.started_at ? formatDateTime(task.started_at) : '-'}</td>
                  <td>{task.completed_at ? formatDateTime(task.completed_at) : '-'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
                      {task.status === 'pending' && (
                        <button
                          onClick={() => handleStart(task.id)}
                          class="btn btn-warning btn-sm"
                        >
                          开始
                        </button>
                      )}
                      {task.status === 'in_progress' && (
                        <button
                          onClick={() => handleOpenComplete(task)}
                          class="btn btn-success btn-sm"
                        >
                          完成
                        </button>
                      )}
                      {(task.status === 'pending' || task.status === 'in_progress') && (
                        <button
                          onClick={() => handleOpenEdit(task)}
                          class="btn btn-sm"
                        >
                          编辑
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(task.id)}
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

          {filteredTasks().length === 0 && (
            <div class="text-center" style={{ padding: '60px 20px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
              <div class="text-secondary">暂无任务数据</div>
            </div>
          )}
        </div>
      </div>

      {(showCreateModal() || showEditModal()) && (
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
          onClick={() => { if (!submitting()) { setShowCreateModal(false); setShowEditModal(false); } }}
        >
          <div
            class="card"
            style={{
              width: '100%',
              maxWidth: '560px',
              maxHeight: '88vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div class="card-header flex-between">
              <span>{showCreateModal() ? '创建巡防任务' : '编辑巡防任务'}</span>
              <button
                onClick={() => { if (!submitting()) { setShowCreateModal(false); setShowEditModal(false); } }}
                class="btn btn-sm"
                style={{ border: 'none', background: 'transparent', fontSize: '24px', padding: 0 }}
              >
                ×
              </button>
            </div>
            <div class="card-body">
              <form onSubmit={showCreateModal() ? handleSubmitCreate : handleSubmitEdit}>
                <div class="form-item">
                  <label class="form-label">任务名称 *</label>
                  <input
                    class="form-input"
                    type="text"
                    value={formData().task_name}
                    onInput={(e) => setFormData({ ...formData(), task_name: e.target.value })}
                    placeholder="请输入任务名称"
                    required
                  />
                </div>
                <div class="grid grid-2">
                  <div class="form-item">
                    <label class="form-label">建筑 *</label>
                    <select
                      class="form-select"
                      value={formData().building_id}
                      onInput={(e) => setFormData({ ...formData(), building_id: e.target.value })}
                      required
                    >
                      <option value="">请选择建筑</option>
                      {(state.buildings || []).map(b => (
                        <option value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div class="form-item">
                    <label class="form-label">负责人</label>
                    <select
                      class="form-select"
                      value={formData().personnel_id}
                      onInput={(e) => setFormData({ ...formData(), personnel_id: e.target.value })}
                    >
                      <option value="">请选择负责人</option>
                      {(state.patrolPersonnel || []).map(p => (
                        <option value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div class="grid grid-2">
                  <div class="form-item">
                    <label class="form-label">任务类型 *</label>
                    <select
                      class="form-select"
                      value={formData().task_type}
                      onInput={(e) => setFormData({ ...formData(), task_type: e.target.value })}
                      required
                    >
                      {TASK_TYPES.map(t => (
                        <option value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div class="form-item">
                    <label class="form-label">风险等级 *</label>
                    <select
                      class="form-select"
                      value={formData().risk_level}
                      onInput={(e) => setFormData({ ...formData(), risk_level: e.target.value })}
                      required
                    >
                      {RISK_LEVELS.map(r => (
                        <option value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div class="grid grid-2">
                  <div class="form-item">
                    <label class="form-label">计划开始 *</label>
                    <input
                      class="form-input"
                      type="datetime-local"
                      value={formData().scheduled_start}
                      onInput={(e) => setFormData({ ...formData(), scheduled_start: e.target.value })}
                      required
                    />
                  </div>
                  <div class="form-item">
                    <label class="form-label">计划结束 *</label>
                    <input
                      class="form-input"
                      type="datetime-local"
                      value={formData().scheduled_end}
                      onInput={(e) => setFormData({ ...formData(), scheduled_end: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div class="form-item">
                  <label class="form-label">备注</label>
                  <textarea
                    class="form-textarea"
                    value={formData().notes}
                    onInput={(e) => setFormData({ ...formData(), notes: e.target.value })}
                    placeholder="请输入备注信息"
                    rows="3"
                  />
                </div>
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end', marginTop: 'var(--spacing-md)' }}>
                  <button
                    type="button"
                    onClick={() => { if (!submitting()) { setShowCreateModal(false); setShowEditModal(false); } }}
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

      {showCompleteModal() && completingTask() && (
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
          onClick={() => { if (!submitting()) setShowCompleteModal(false); }}
        >
          <div
            class="card"
            style={{
              width: '100%',
              maxWidth: '520px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div class="card-header flex-between">
              <span>完成任务 - {completingTask().task_name}</span>
              <button
                onClick={() => { if (!submitting()) setShowCompleteModal(false); }}
                class="btn btn-sm"
                style={{ border: 'none', background: 'transparent', fontSize: '24px', padding: 0 }}
              >
                ×
              </button>
            </div>
            <div class="card-body">
              <form onSubmit={handleSubmitComplete}>
                <div class="form-item">
                  <label class="form-label">巡检结果 *</label>
                  <textarea
                    class="form-textarea"
                    value={completeData().inspection_result}
                    onInput={(e) => setCompleteData({ ...completeData(), inspection_result: e.target.value })}
                    placeholder="请输入巡检结果"
                    rows="3"
                    required
                  />
                </div>
                <div class="form-item">
                  <label class="form-label">发现问题</label>
                  <textarea
                    class="form-textarea"
                    value={completeData().findings}
                    onInput={(e) => setCompleteData({ ...completeData(), findings: e.target.value })}
                    placeholder="请输入发现的问题（可选）"
                    rows="3"
                  />
                </div>
                <div class="form-item">
                  <label class="form-label">完成后风险等级 *</label>
                  <select
                    class="form-select"
                    value={completeData().completed_risk_level}
                    onInput={(e) => setCompleteData({ ...completeData(), completed_risk_level: e.target.value })}
                    required
                  >
                    {RISK_LEVELS.map(r => (
                      <option value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end', marginTop: 'var(--spacing-md)' }}>
                  <button
                    type="button"
                    onClick={() => { if (!submitting()) setShowCompleteModal(false); }}
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
                    {submitting() ? '提交中...' : '确认完成'}
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

export default PatrolTasks;
