const Map = () => {
  return (
    <div>
      <h2 class="mb-lg">地图展示</h2>
      <div class="card">
        <div class="card-header">建筑分布地图</div>
        <div class="card-body">
          <div
            style={{
              height: '500px',
              background: 'var(--color-bg)',
              borderRadius: 'var(--border-radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px dashed var(--color-border)',
            }}
          >
            <div class="text-center">
              <div style={{ fontSize: '64px', marginBottom: '16px' }}>🗺️</div>
              <div class="text-secondary mb-sm">地图组件将在这里显示</div>
              <div class="text-muted text-sm">集成 Leaflet 地图展示建筑分布和实时数据</div>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-2 mt-lg">
        <div class="card">
          <div class="card-header">地图图例</div>
          <div class="card-body">
            <div class="thermal-legend">
              <div class="thermal-legend-item">
                <div class="thermal-legend-color" style={{ background: 'var(--color-success)' }}></div>
                <span>正常运行</span>
              </div>
              <div class="thermal-legend-item">
                <div class="thermal-legend-color" style={{ background: 'var(--color-warning)' }}></div>
                <span>温度异常</span>
              </div>
              <div class="thermal-legend-item">
                <div class="thermal-legend-color" style={{ background: 'var(--color-error)' }}></div>
                <span>告警中</span>
              </div>
              <div class="thermal-legend-item">
                <div class="thermal-legend-color" style={{ background: 'var(--color-text-tertiary)' }}></div>
                <span>离线</span>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">巡防人员位置</div>
          <div class="card-body">
            <div style={{ padding: '20px 0' }}>
              <div class="text-center text-secondary">
                实时显示巡防人员位置和巡逻轨迹
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Map;
