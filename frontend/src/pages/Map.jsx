import { createEffect, onCleanup, createSignal } from 'solid-js';
import { state, actions } from '../store/appStore';
import L from 'leaflet';
import { formatDateTime } from '../utils/date';

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

const createEmojiIcon = (emoji, isActive) => {
  return L.divIcon({
    className: 'custom-building-marker',
    html: `
      <div style="
        position: relative;
        width: 44px;
        height: 54px;
        display: flex;
        flex-direction: column;
        align-items: center;
        opacity: ${isActive ? 1 : 0.5};
      ">
        <div style="
          font-size: 28px;
          background: white;
          border: 3px solid ${isActive ? '#1890ff' : '#8c8c8c'};
          border-radius: 50%;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          z-index: 2;
        ">${emoji || '🏛️'}</div>
        <div style="
          width: 0;
          height: 0;
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
          border-top: 12px solid ${isActive ? '#1890ff' : '#8c8c8c'};
          margin-top: -4px;
          z-index: 1;
        "></div>
      </div>
    `,
    iconSize: [44, 54],
    iconAnchor: [22, 54],
    popupAnchor: [0, -50],
  });
};

const Map = () => {
  let mapContainer = null;
  let mapInstance = null;
  const markersRef = [];
  const [selectedBuildingPopup, setSelectedBuildingPopup] = createSignal(null);

  const buildPopupContent = (building) => {
    return `
      <div style="min-width: 220px; font-family: inherit;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <span style="font-size: 24px;">${building.icon || '🏛️'}</span>
          <div style="flex: 1;">
            <div style="font-weight: 600; font-size: 14px; color: var(--color-text);">${building.name}</div>
            <span class="badge ${building.status === 'active' ? 'badge-success' : 'badge-default'}" style="font-size: 11px;">
              ${building.status === 'active' ? '运行中' : '停用'}
            </span>
          </div>
        </div>
        <div style="font-size: 12px; line-height: 1.8; color: var(--color-text-secondary);">
          <div style="display: flex; justify-content: space-between; gap: 8px;">
            <span>类型：</span><span style="color: var(--color-text);">${building.building_type || '-'}</span>
          </div>
          <div style="display: flex; justify-content: space-between; gap: 8px;">
            <span>风险：</span><span class="badge ${riskBadgeClass(building.risk_level)}" style="font-size: 10px; padding: 1px 6px;">${riskLabel(building.risk_level)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; gap: 8px;">
            <span>面积：</span><span style="color: var(--color-text);">${building.area || 0} ㎡</span>
          </div>
          <div style="margin-top: 4px; padding-top: 6px; border-top: 1px solid var(--color-border);">
            <div style="font-weight: 500; margin-bottom: 2px;">地址：</div>
            <div style="color: var(--color-text); line-height: 1.4;">${building.address || '-'}</div>
          </div>
          <div style="margin-top: 8px; color: var(--color-text-tertiary); font-size: 11px;">
            创建：${formatDateTime(building.created_at)}
          </div>
        </div>
      </div>
    `;
  };

  const renderMarkers = () => {
    if (!mapInstance) return;

    markersRef.forEach((m) => mapInstance.removeLayer(m));
    markersRef.length = 0;

    const activeBuildings = state.buildings.filter((b) => b.status === 'active');
    const inactiveBuildings = state.buildings.filter((b) => b.status !== 'active');
    const allBuildings = [...activeBuildings, ...inactiveBuildings];

    allBuildings.forEach((building) => {
      if (building.latitude && building.longitude) {
        const icon = createEmojiIcon(building.icon, building.status === 'active');
        const marker = L.marker([building.latitude, building.longitude], { icon })
          .addTo(mapInstance)
          .bindPopup(buildPopupContent(building), {
            maxWidth: 300,
            className: 'building-popup',
          });

        marker.on('click', () => {
          setSelectedBuildingPopup(building);
          actions.selectBuilding(building);
        });

        markersRef.push(marker);
      }
    });

    if (allBuildings.length > 0) {
      const bounds = L.latLngBounds(
        allBuildings
          .filter((b) => b.latitude && b.longitude)
          .map((b) => [b.latitude, b.longitude])
      );
      if (bounds.isValid()) {
        mapInstance.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      }
    }
  };

  createEffect(() => {
    if (mapContainer && !mapInstance) {
      mapInstance = L.map(mapContainer, {
        center: [39.9163, 116.3972],
        zoom: 13,
        scrollWheelZoom: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(mapInstance);

      setTimeout(() => {
        mapInstance.invalidateSize();
        renderMarkers();
      }, 100);
    }
  });

  createEffect(() => {
    if (mapInstance && state.buildings.length > 0) {
      renderMarkers();
    }
  });

  onCleanup(() => {
    if (mapInstance) {
      mapInstance.remove();
      mapInstance = null;
    }
  });

  const stats = {
    total: state.buildings.length,
    active: state.buildings.filter((b) => b.status === 'active').length,
    inactive: state.buildings.filter((b) => b.status !== 'active').length,
    highRisk: state.buildings.filter((b) => b.risk_level === 'high').length,
  };

  return (
    <div>
      <h2 class="mb-lg">地图展示</h2>

      <div class="grid grid-4 mb-md">
        <div class="card" style={{ padding: 'var(--spacing-md)' }}>
          <div class="text-secondary text-sm mb-sm">建筑总数</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--color-primary)' }}>{stats.total}</div>
        </div>
        <div class="card" style={{ padding: 'var(--spacing-md)' }}>
          <div class="text-secondary text-sm mb-sm">运行中</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--color-success)' }}>{stats.active}</div>
        </div>
        <div class="card" style={{ padding: 'var(--spacing-md)' }}>
          <div class="text-secondary text-sm mb-sm">已停用</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--color-text-tertiary)' }}>{stats.inactive}</div>
        </div>
        <div class="card" style={{ padding: 'var(--spacing-md)' }}>
          <div class="text-secondary text-sm mb-sm">高风险</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--color-error)' }}>{stats.highRisk}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header flex-between">
          <span>建筑分布地图</span>
          <span class="text-muted text-sm">点击建筑标记查看详情</span>
        </div>
        <div class="card-body" style={{ padding: 0 }}>
          <div
            ref={(el) => (mapContainer = el)}
            style={{
              height: '550px',
              width: '100%',
              borderRadius: '0 0 var(--border-radius-md) var(--border-radius-md)',
            }}
          />
        </div>
      </div>

      <div class="grid grid-2 mt-lg">
        <div class="card">
          <div class="card-header">地图图例</div>
          <div class="card-body">
            <div class="thermal-legend">
              <div class="thermal-legend-item">
                <div class="thermal-legend-color" style={{ background: 'var(--color-primary)', width: '20px', height: '20px', borderRadius: '50%' }}></div>
                <span>正常运行</span>
              </div>
              <div class="thermal-legend-item">
                <div class="thermal-legend-color" style={{ background: 'var(--color-text-tertiary)', width: '20px', height: '20px', borderRadius: '50%', opacity: 0.5 }}></div>
                <span>已停用</span>
              </div>
              <div class="thermal-legend-item">
                <div class="thermal-legend-color" style={{ background: 'var(--color-error)' }}></div>
                <span>高风险建筑</span>
              </div>
              <div class="thermal-legend-item">
                <div class="thermal-legend-color" style={{ background: 'var(--color-warning)' }}></div>
                <span>中风险建筑</span>
              </div>
              <div class="thermal-legend-item">
                <div class="thermal-legend-color" style={{ background: 'var(--color-success)' }}></div>
                <span>低风险建筑</span>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">建筑列表</div>
          <div class="card-body" style={{ maxHeight: '300px', overflowY: 'auto', padding: 0 }}>
            {state.buildings.length === 0 ? (
              <div class="text-center text-secondary" style={{ padding: '40px 20px' }}>
                暂无建筑数据
              </div>
            ) : (
              state.buildings.map((building, idx) => (
                <div
                  onClick={() => {
                    if (mapInstance && building.latitude && building.longitude) {
                      mapInstance.setView([building.latitude, building.longitude], 16);
                      actions.selectBuilding(building);
                    }
                  }}
                  style={{
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    borderBottom: idx < state.buildings.length - 1 ? '1px solid var(--color-border)' : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-sm)',
                    background: state.selectedBuilding?.id === building.id ? 'rgba(24,144,255,0.05)' : 'transparent',
                  }}
                >
                  <span style={{ fontSize: '20px' }}>{building.icon || '🏛️'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: 500, fontSize: '13px' }}>{building.name}</span>
                      <span class={`badge ${building.status === 'active' ? 'badge-success' : 'badge-default'}`} style={{ fontSize: '10px', padding: '1px 5px' }}>
                        {building.status === 'active' ? '运行' : '停用'}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {building.address || '-'}
                    </div>
                  </div>
                  <span class={`badge ${riskBadgeClass(building.risk_level)}`} style={{ fontSize: '10px', padding: '1px 5px' }}>
                    {riskLabel(building.risk_level)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Map;
