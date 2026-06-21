import { createSignal, createEffect, onCleanup } from 'solid-js';
import { state, actions } from '../store/appStore';
import { formatDateTime } from '../utils/date';
import LocationPickerModal from '../components/LocationPickerModal';

const ICON_OPTIONS = ['🏛️', '🏯', '🏰', '⛩️', '🛕', '🕍', '⛪', '🕌', '📚', '🔔', '🥁', '🏘️', '🏢', '🏬', '🏨', '🏠'];

const BUILDING_TYPES = [
  { value: '宫殿建筑', label: '宫殿建筑' },
  { value: '楼阁建筑', label: '楼阁建筑' },
  { value: '钟楼建筑', label: '钟楼建筑' },
  { value: '鼓楼建筑', label: '鼓楼建筑' },
  { value: '角楼建筑', label: '角楼建筑' },
  { value: '庙宇建筑', label: '庙宇建筑' },
  { value: '其他', label: '其他' },
];

const RISK_LEVELS = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
];

const riskBadgeClass = (level) => {
  switch (level) {
    case 'high': return 'badge-error';
    case 'medium': return 'badge-warning';
    case 'low': return 'badge-success';
    default: return 'badge-default';
  }
};

const riskLabel = (level) => {
  switch (level) {
    case 'high': return '高';
    case 'medium': return '中';
    case 'low': return '低';
    default: return '-';
  }
};

const defaultFormData = () => ({
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
  icon: '🏛️',
});

const Buildings = () => {
  const [modalMode, setModalMode] = createSignal(null);
  const [editingId, setEditingId] = createSignal(null);
  const [detailBuilding, setDetailBuilding] = createSignal(null);
  const [submitting, setSubmitting] = createSignal(false);
  const [formData, setFormData] = createSignal(defaultFormData());
  const [showLocationPicker, setShowLocationPicker] = createSignal(false);
  const [showIconPicker, setShowIconPicker] = createSignal(false);

  const handleOpenAdd = () => {
    setFormData(defaultFormData());
    setEditingId(null);
    setModalMode('add');
  };

  const handleOpenEdit = (building) => {
    setEditingId(building.id);
    setFormData({
      name: building.name,
      address: building.address,
      description: building.description || '',
      building_type: building.building_type,
      latitude: building.latitude,
      longitude: building.longitude,
      area: building.area,
      construction_year: building.construction_year || '',
      floors: building.floors || '',
      risk_level: building.risk_level || 'medium',
      icon: building.icon || '🏛️',
    });
    setModalMode('edit');
  };

  const handleOpenDetail = (building) => {
    setDetailBuilding(building);
    setModalMode('detail');
  };

  const handleCloseModal = () => {
    if (!submitting()) {
      setModalMode(null);
      setEditingId(null);
      setDetailBuilding(null);
      setShowIconPicker(false);
    }
  };

  const handleDelete = async (building) => {
    if (!confirm(`确定删除建筑"${building.name}"吗？此操作不可恢复。`)) return;
    try {
      await actions.deleteBuilding(building.id);
    } catch (err) {
      alert('删除失败: ' + (err.message || '未知错误'));
    }
  };

  const handleToggleStatus = async (building) => {
    try {
      await actions.toggleBuildingStatus(building.id);
    } catch (err) {
      alert('操作失败: ' + (err.message || '未知错误'));
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
      const payload = {
        name: formData().name,
        address: formData().address,
        description: formData().description || null,
        building_type: formData().building_type,
        latitude: parseFloat(formData().latitude),
        longitude: parseFloat(formData().longitude),
        area: parseFloat(formData().area),
        construction_year: formData().construction_year ? parseInt(formData().construction_year) : null,
        floors: formData().floors ? parseInt(formData().floors) : null,
        risk_level: formData().risk_level || null,
        icon: formData().icon || null,
      };
      if (modalMode() === 'edit' && editingId()) {
        await actions.updateBuilding(editingId(), payload);
      } else {
        await actions.createBuilding(payload);
      }
      handleCloseModal();
    } catch (err) {
      console.error('Submit failed:', err);
      alert(`${modalMode() === 'edit' ? '更新' : '创建'}建筑失败: ` + (err.message || '未知错误'));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePickLocation = () => {
    setShowLocationPicker(true);
  };

  const handleLocationConfirm = (loc) => {
    setFormData({
      ...formData(),
      address: loc.address,
      latitude: loc.latitude,
      longitude: loc.longitude,
    });
    setShowLocationPicker(false);
  };

  const handleSelectIcon = (icon) => {
    setFormData({ ...formData(), icon });
    setShowIconPicker(false);
  };

  createEffect(() => {
    if (modalMode()) {
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          if (showIconPicker()) {
            setShowIconPicker(false);
          } else if (showLocationPicker()) {
            setShowLocationPicker(false);
          } else {
            handleCloseModal();
          }
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

  const modalTitle = () => {
    if (modalMode() === 'add') return '添加建筑';
    if (modalMode() === 'edit') return '编辑建筑';
    if (modalMode() === 'detail') return '建筑详情';
    return '';
  };

  return (
    <div>
      <div class="flex-between mb-lg">
        <h2>建筑管理</h2>
        <button class="btn btn-primary" onClick={handleOpenAdd}>+ 添加建筑</button>
      </div>

      <div class="grid grid-3">
        {state.buildings.map((building) => (
          <div
            class="card"
            style={{
              outline: state.selectedBuilding?.id === building.id ? '2px solid var(--color-primary)' : 'none',
              transition: 'var(--transition-base)',
            }}
          >
            <div class="card-header" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              <span style={{ fontSize: '24px' }}>{building.icon || '🏛️'}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {building.name}
              </span>
              <span class={`badge ${building.status === 'active' ? 'badge-success' : 'badge-default'}`}>
                {building.status === 'active' ? '运行中' : '停用'}
              </span>
            </div>
            <div class="card-body">
              <div class="mb-sm">
                <span class="text-secondary">地址：</span>
                <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {building.address || '-'}
                </span>
              </div>
              <div class="grid grid-2 mb-sm">
                <div>
                  <span class="text-secondary">类型：</span>
                  <span>{building.building_type || '-'}</span>
                </div>
                <div>
                  <span class="text-secondary">风险：</span>
                  <span class={`badge ${riskBadgeClass(building.risk_level)}`} style={{ fontSize: '11px', padding: '1px 6px' }}>
                    {riskLabel(building.risk_level)}
                  </span>
                </div>
                <div>
                  <span class="text-secondary">面积：</span>
                  <span>{building.area || 0} ㎡</span>
                </div>
                <div>
                  <span class="text-secondary">楼层：</span>
                  <span>{building.floors || '-'} 层</span>
                </div>
              </div>
              <div class="text-muted text-sm mt-md mb-md">
                创建时间：{formatDateTime(building.created_at)}
              </div>
              <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
                <button
                  class="btn btn-sm btn-primary"
                  onClick={() => handleOpenDetail(building)}
                  style={{ flex: 1, minWidth: '60px' }}
                >
                  详情
                </button>
                <button
                  class="btn btn-sm"
                  onClick={() => handleOpenEdit(building)}
                  style={{ flex: 1, minWidth: '60px' }}
                >
                  编辑
                </button>
                <button
                  class={`btn btn-sm ${building.status === 'active' ? 'btn-warning' : 'btn-success'}`}
                  onClick={() => handleToggleStatus(building)}
                  style={{ flex: 1, minWidth: '60px' }}
                >
                  {building.status === 'active' ? '停用' : '启用'}
                </button>
                <button
                  class="btn btn-sm btn-danger"
                  onClick={() => handleDelete(building)}
                  style={{ flex: 1, minWidth: '60px' }}
                >
                  删除
                </button>
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

      {modalMode() && modalMode() !== 'detail' && (
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
              maxWidth: '480px',
              maxHeight: '88vh',
              overflowY: 'auto',
              background: 'var(--color-bg-secondary)',
              borderRadius: 'var(--border-radius-lg)',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: 'var(--spacing-md) var(--spacing-lg)',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: '600' }}>
                {modalTitle()}
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
                <label class="form-label">建筑图标</label>
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    class="btn"
                    onClick={() => setShowIconPicker(!showIconPicker())}
                    style={{
                      width: '100%',
                      justifyContent: 'flex-start',
                      padding: 'var(--spacing-sm) var(--spacing-md)',
                      fontSize: '20px',
                      textAlign: 'left',
                    }}
                  >
                    {formData().icon || '🏛️'} <span style={{ fontSize: '13px', marginLeft: '8px', color: 'var(--color-text-tertiary)' }}>点击选择图标</span>
                  </button>
                  {showIconPicker() && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: '4px',
                        background: 'var(--color-bg-secondary)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--border-radius-md)',
                        padding: 'var(--spacing-sm)',
                        zIndex: 10,
                        boxShadow: 'var(--shadow-md)',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(8, 1fr)',
                        gap: '4px',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {ICON_OPTIONS.map((icon) => (
                        <button
                          type="button"
                          onClick={() => handleSelectIcon(icon)}
                          style={{
                            fontSize: '22px',
                            padding: '6px',
                            border: formData().icon === icon ? '2px solid var(--color-primary)' : '1px solid transparent',
                            borderRadius: 'var(--border-radius-sm)',
                            background: formData().icon === icon ? 'rgba(24,144,255,0.1)' : 'transparent',
                            cursor: 'pointer',
                          }}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div class="form-item">
                <label class="form-label">建筑地址 *</label>
                <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                  <input
                    class="form-input"
                    type="text"
                    value={formData().address}
                    placeholder="点击右侧按钮通过地图选择"
                    readonly
                    required
                    style={{ margin: 0, flex: 1 }}
                  />
                  <button
                    type="button"
                    class="btn btn-primary"
                    onClick={handlePickLocation}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    📍 地图选址
                  </button>
                </div>
              </div>

              <div class="grid grid-2">
                <div class="form-item">
                  <label class="form-label">纬度</label>
                  <input
                    class="form-input"
                    type="text"
                    value={Number(formData().latitude).toFixed(6)}
                    readonly
                    style={{ background: 'var(--color-bg)' }}
                  />
                </div>
                <div class="form-item">
                  <label class="form-label">经度</label>
                  <input
                    class="form-input"
                    type="text"
                    value={Number(formData().longitude).toFixed(6)}
                    readonly
                    style={{ background: 'var(--color-bg)' }}
                  />
                </div>
              </div>

              <div class="form-item">
                <label class="form-label">建筑描述</label>
                <textarea
                  class="form-textarea"
                  value={formData().description}
                  onInput={(e) => setFormData({ ...formData(), description: e.target.value })}
                  placeholder="请输入建筑描述"
                  rows="2"
                  style={{ minHeight: '60px' }}
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
                    {BUILDING_TYPES.map((t) => (
                      <option value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div class="form-item">
                  <label class="form-label">风险等级</label>
                  <select
                    class="form-select"
                    value={formData().risk_level}
                    onInput={(e) => setFormData({ ...formData(), risk_level: e.target.value })}
                  >
                    {RISK_LEVELS.map((r) => (
                      <option value={r.value}>{r.label}</option>
                    ))}
                  </select>
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
                  {submitting() ? '提交中...' : (modalMode() === 'edit' ? '确认更新' : '确认添加')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalMode() === 'detail' && detailBuilding() && (
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
              maxWidth: '480px',
              maxHeight: '88vh',
              overflowY: 'auto',
              background: 'var(--color-bg-secondary)',
              borderRadius: 'var(--border-radius-lg)',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: 'var(--spacing-md) var(--spacing-lg)',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <span style={{ fontSize: '28px' }}>{detailBuilding().icon || '🏛️'}</span>
                <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: '600' }}>
                  {modalTitle()}
                </h2>
              </div>
              <button
                onClick={handleCloseModal}
                class="btn btn-sm"
                style={{ border: 'none', background: 'transparent', fontSize: '24px', padding: 0 }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: 'var(--spacing-lg)' }}>
              <div class="mb-md" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '18px', margin: 0 }}>{detailBuilding().name}</h3>
                <span class={`badge ${detailBuilding().status === 'active' ? 'badge-success' : 'badge-default'}`}>
                  {detailBuilding().status === 'active' ? '运行中' : '已停用'}
                </span>
              </div>

              <div style={{ lineHeight: 2 }}>
                <div class="grid grid-2">
                  <div>
                    <span class="text-secondary">建筑类型：</span>
                    <span>{detailBuilding().building_type || '-'}</span>
                  </div>
                  <div>
                    <span class="text-secondary">风险等级：</span>
                    <span class={`badge ${riskBadgeClass(detailBuilding().risk_level)}`}>
                      {riskLabel(detailBuilding().risk_level)}
                    </span>
                  </div>
                  <div>
                    <span class="text-secondary">建筑面积：</span>
                    <span>{detailBuilding().area || 0} ㎡</span>
                  </div>
                  <div>
                    <span class="text-secondary">建造年份：</span>
                    <span>{detailBuilding().construction_year || '-'}</span>
                  </div>
                  <div>
                    <span class="text-secondary">楼层数：</span>
                    <span>{detailBuilding().floors || '-'} 层</span>
                  </div>
                  <div>
                    <span class="text-secondary">ID：</span>
                    <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{detailBuilding().id.slice(0, 8)}...</span>
                  </div>
                </div>
                <div class="mt-sm">
                  <span class="text-secondary">详细地址：</span>
                  <div style={{ marginTop: '4px', padding: 'var(--spacing-sm)', background: 'var(--color-bg)', borderRadius: 'var(--border-radius-sm)', fontSize: '13px' }}>
                    {detailBuilding().address || '-'}
                  </div>
                </div>
                <div class="mt-sm">
                  <span class="text-secondary">经纬度：</span>
                  <span class="text-primary" style={{ fontFamily: 'monospace' }}>
                    {Number(detailBuilding().latitude).toFixed(6)}, {Number(detailBuilding().longitude).toFixed(6)}
                  </span>
                </div>
                {detailBuilding().description && (
                  <div class="mt-sm">
                    <span class="text-secondary">建筑描述：</span>
                    <div style={{ marginTop: '4px', padding: 'var(--spacing-sm)', background: 'var(--color-bg)', borderRadius: 'var(--border-radius-sm)', fontSize: '13px' }}>
                      {detailBuilding().description}
                    </div>
                  </div>
                )}
                <div class="mt-sm grid grid-2">
                  <div>
                    <span class="text-secondary">创建时间：</span>
                    <div style={{ fontSize: '13px' }}>{formatDateTime(detailBuilding().created_at)}</div>
                  </div>
                  <div>
                    <span class="text-secondary">更新时间：</span>
                    <div style={{ fontSize: '13px' }}>{formatDateTime(detailBuilding().updated_at)}</div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  paddingTop: 'var(--spacing-md)',
                  marginTop: 'var(--spacing-md)',
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
                >
                  关闭
                </button>
                <button
                  type="button"
                  class="btn btn-primary"
                  onClick={() => {
                    handleCloseModal();
                    setTimeout(() => handleOpenEdit(detailBuilding()), 50);
                  }}
                >
                  编辑
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <LocationPickerModal
        show={showLocationPicker()}
        initialLat={formData().latitude}
        initialLng={formData().longitude}
        initialAddress={formData().address}
        onClose={() => setShowLocationPicker(false)}
        onConfirm={handleLocationConfirm}
      />
    </div>
  );
};

export default Buildings;
