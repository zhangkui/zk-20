import { createSignal, createEffect, onCleanup } from 'solid-js';
import { state, actions } from '../store/appStore';
import { formatDateTime } from '../utils/date';

const Buildings = () => {
  const [showModal, setShowModal] = createSignal(false);
  const [submitting, setSubmitting] = createSignal(false);
  const [formData, setFormData] = createSignal({
    name: '',
    address: '',
    description: '',
    building_type: '宫殿建筑',
    latitude: 39.9163,
    longitude: 116.3972,
    area: 1000,
    construction_year: 1900,
    floors: 2,
    risk_level: 'medium',
  });

  const handleSelectBuilding = (building) => {
    actions.selectBuilding(building);
  };

  const handleOpenModal = () => {
    setFormData({
      name: '',
      address: '',
      description: '',
      building_type: '宫殿建筑',
      latitude: 39.9163,
      longitude: 116.3972,
      area: 1000,
      construction_year: 1900,
      floors: 2,
      risk_level: 'medium',
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    if (!submitting()) {
      setShowModal(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData().name || !formData().address) {
      alert('请填写建筑名称和地址');
      return;
    }

    setSubmitting(true);
    try {
      await actions.createBuilding({
        name: formData().name,
        address: formData().address,
        description: formData().description,
        building_type: formData().building_type,
        latitude: parseFloat(formData().latitude),
        longitude: parseFloat(formData().longitude),
        area: parseFloat(formData().area),
        construction_year: parseInt(formData().construction_year) || null,
        floors: parseInt(formData().floors) || null,
        risk_level: formData().risk_level,
      });
      setShowModal(false);
    } catch (err) {
      console.error('Failed to create building:', err);
      alert('创建建筑失败: ' + (err.message || '未知错误'));
    } finally {
      setSubmitting(false);
    }
  };

  createEffect(() => {
    if (showModal()) {
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          handleCloseModal();
        }
      };
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      onCleanup(() => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
      });
    }
  });

  return (
    <div>
      <div class="flex-between mb-lg">
        <h2>建筑管理</h2>
        <button class="btn btn-primary" onClick={handleOpenModal}>+ 添加建筑</button>
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

      {showModal() && (
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
          }}
          onClick={handleCloseModal}
        >
          <div
            style={{
              width: '90%',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'var(--color-bg-secondary)',
              borderRadius: 'var(--border-radius-lg)',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: 'var(--spacing-lg)',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: '600' }}>
                添加建筑
              </h2>
              <button
                onClick={handleCloseModal}
                disabled={submitting()}
                class="btn btn-sm"
                style={{ border: 'none', background: 'transparent', fontSize: '24px', padding: 0 }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: 'var(--spacing-lg)' }}>
              <div class="form-item">
                <label class="form-label">建筑名称 *</label>
                <input
                  class="form-input"
                  type="text"
                  value={formData().name}
                  onInput={(e) => setFormData({ ...formData(), name: e.target.value })}
                  placeholder="请输入建筑名称"
                  required
                />
              </div>

              <div class="form-item">
                <label class="form-label">建筑地址 *</label>
                <input
                  class="form-input"
                  type="text"
                  value={formData().address}
                  onInput={(e) => setFormData({ ...formData(), address: e.target.value })}
                  placeholder="请输入建筑地址"
                  required
                />
              </div>

              <div class="form-item">
                <label class="form-label">建筑描述</label>
                <textarea
                  class="form-textarea"
                  value={formData().description}
                  onInput={(e) => setFormData({ ...formData(), description: e.target.value })}
                  placeholder="请输入建筑描述"
                  rows="3"
                />
              </div>

              <div class="grid grid-2">
                <div class="form-item">
                  <label class="form-label">建筑类型</label>
                  <select
                    class="form-select"
                    value={formData().building_type}
                    onInput={(e) => setFormData({ ...formData(), building_type: e.target.value })}
                  >
                    <option value="宫殿建筑">宫殿建筑</option>
                    <option value="楼阁建筑">楼阁建筑</option>
                    <option value="钟楼建筑">钟楼建筑</option>
                    <option value="鼓楼建筑">鼓楼建筑</option>
                    <option value="角楼建筑">角楼建筑</option>
                    <option value="庙宇建筑">庙宇建筑</option>
                    <option value="其他">其他</option>
                  </select>
                </div>

                <div class="form-item">
                  <label class="form-label">风险等级</label>
                  <select
                    class="form-select"
                    value={formData().risk_level}
                    onInput={(e) => setFormData({ ...formData(), risk_level: e.target.value })}
                  >
                    <option value="low">低</option>
                    <option value="medium">中</option>
                    <option value="high">高</option>
                  </select>
                </div>
              </div>

              <div class="grid grid-2">
                <div class="form-item">
                  <label class="form-label">纬度</label>
                  <input
                    class="form-input"
                    type="number"
                    step="0.0001"
                    value={formData().latitude}
                    onInput={(e) => setFormData({ ...formData(), latitude: e.target.value })}
                  />
                </div>

                <div class="form-item">
                  <label class="form-label">经度</label>
                  <input
                    class="form-input"
                    type="number"
                    step="0.0001"
                    value={formData().longitude}
                    onInput={(e) => setFormData({ ...formData(), longitude: e.target.value })}
                  />
                </div>
              </div>

              <div class="grid grid-3">
                <div class="form-item">
                  <label class="form-label">建筑面积 (㎡)</label>
                  <input
                    class="form-input"
                    type="number"
                    value={formData().area}
                    onInput={(e) => setFormData({ ...formData(), area: e.target.value })}
                  />
                </div>

                <div class="form-item">
                  <label class="form-label">建造年份</label>
                  <input
                    class="form-input"
                    type="number"
                    value={formData().construction_year}
                    onInput={(e) => setFormData({ ...formData(), construction_year: e.target.value })}
                  />
                </div>

                <div class="form-item">
                  <label class="form-label">楼层数</label>
                  <input
                    class="form-input"
                    type="number"
                    value={formData().floors}
                    onInput={(e) => setFormData({ ...formData(), floors: e.target.value })}
                  />
                </div>
              </div>

              <div
                style={{
                  paddingTop: 'var(--spacing-md)',
                  borderTop: '1px solid var(--color-border)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 'var(--spacing-sm)',
                }}
              >
                <button
                  type="button"
                  class="btn"
                  onClick={handleCloseModal}
                  disabled={submitting()}
                >
                  取消
                </button>
                <button
                  type="submit"
                  class="btn btn-primary"
                  disabled={submitting()}
                >
                  {submitting() ? '提交中...' : '确认添加'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Buildings;
