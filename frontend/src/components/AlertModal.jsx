import { createSignal, createEffect, onCleanup } from 'solid-js';

export default function AlertModal(props) {
  const [processing, setProcessing] = createSignal(false);
  const [remark, setRemark] = createSignal('');

  const alert = props.alert || {
    id: 1,
    type: 'danger',
    level: 'high',
    title: '温度异常告警',
    message: '5号楼3层东侧区域检测到异常高温',
    temperature: 75.5,
    threshold: 60,
    building: {
      id: 5,
      name: '5号实验楼',
      location: '校区东区',
      floors: 6,
    },
    hotSpot: {
      x: 15,
      y: 8,
      radius: 3,
      temp: 75.5,
    },
    time: '2024-01-15 14:32:18',
    status: 'pending',
    handler: null,
  };

  const getTypeInfo = (type) => {
    const types = {
      danger: { label: '危险', color: '#e53e3e', bgColor: '#fff5f5' },
      warning: { label: '警告', color: '#d69e2e', bgColor: '#fffff0' },
      info: { label: '提示', color: '#3182ce', bgColor: '#ebf8ff' },
    };
    return types[type] || types.info;
  };

  const getLevelInfo = (level) => {
    const levels = {
      high: { label: '高级', color: '#e53e3e' },
      medium: { label: '中级', color: '#d69e2e' },
      low: { label: '低级', color: '#38a169' },
    };
    return levels[level] || levels.low;
  };

  const getStatusInfo = (status) => {
    const statuses = {
      pending: { label: '待处理', color: '#e53e3e' },
      processing: { label: '处理中', color: '#d69e2e' },
      resolved: { label: '已解决', color: '#38a169' },
      ignored: { label: '已忽略', color: '#718096' },
    };
    return statuses[status] || statuses.pending;
  };

  const handleConfirm = async () => {
    setProcessing(true);
    try {
      if (props.onConfirm) {
        await props.onConfirm(alert, remark());
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleProcess = async () => {
    setProcessing(true);
    try {
      if (props.onProcess) {
        await props.onProcess(alert, remark());
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    if (!processing() && props.onClose) {
      props.onClose();
    }
  };

  createEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    onCleanup(() => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    });
  });

  if (!props.show) return null;

  const typeInfo = getTypeInfo(alert.type);
  const levelInfo = getLevelInfo(alert.level);
  const statusInfo = getStatusInfo(alert.status);

  return (
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
      onClick={handleClose}
    >
      <div
        style={{
          width: '90%',
          maxWidth: '600px',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: '#fff',
          borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '28px' }}>⚠️</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#2d3748' }}>
                {alert.title}
              </h2>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <span
                  style={{
                    padding: '2px 8px',
                    background: typeInfo.bgColor,
                    color: typeInfo.color,
                    fontSize: '12px',
                    borderRadius: '4px',
                    fontWeight: '500',
                  }}
                >
                  {typeInfo.label}
                </span>
                <span
                  style={{
                    padding: '2px 8px',
                    background: levelInfo.color + '20',
                    color: levelInfo.color,
                    fontSize: '12px',
                    borderRadius: '4px',
                    fontWeight: '500',
                  }}
                >
                  {levelInfo.label}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={processing()}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: processing() ? 'not-allowed' : 'pointer',
              color: '#a0aec0',
              padding: '4px',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '24px' }}>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', color: '#2d3748', marginBottom: '8px', fontWeight: '500' }}>
              告警描述
            </div>
            <div style={{ fontSize: '14px', color: '#4a5568', lineHeight: '1.6' }}>
              {alert.message}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '16px',
              marginBottom: '20px',
            }}
          >
            <div
              style={{
                padding: '16px',
                background: '#f7fafc',
                borderRadius: '8px',
              }}
            >
              <div style={{ fontSize: '12px', color: '#718096', marginBottom: '4px' }}>检测温度</div>
              <div style={{ fontSize: '24px', fontWeight: '600', color: '#e53e3e' }}>
                {alert.temperature}°C
              </div>
              <div style={{ fontSize: '12px', color: '#a0aec0', marginTop: '4px' }}>
                阈值: {alert.threshold}°C
              </div>
            </div>
            <div
              style={{
                padding: '16px',
                background: '#f7fafc',
                borderRadius: '8px',
              }}
            >
              <div style={{ fontSize: '12px', color: '#718096', marginBottom: '4px' }}>告警时间</div>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#2d3748' }}>
                {alert.time}
              </div>
              <div style={{ fontSize: '12px', color: '#a0aec0', marginTop: '4px' }}>
                状态: <span style={{ color: statusInfo.color }}>{statusInfo.label}</span>
              </div>
            </div>
          </div>

          {alert.building && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', color: '#2d3748', marginBottom: '12px', fontWeight: '500' }}>
                🏢 关联建筑
              </div>
              <div
                style={{
                  padding: '16px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '8px',
                  color: '#fff',
                }}
              >
                <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                  {alert.building.name}
                </div>
                <div style={{ fontSize: '13px', opacity: '0.9', marginBottom: '4px' }}>
                  📍 {alert.building.location}
                </div>
                <div style={{ fontSize: '13px', opacity: '0.9' }}>
                  🏗️ 共 {alert.building.floors} 层
                </div>
              </div>
            </div>
          )}

          {alert.hotSpot && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', color: '#2d3748', marginBottom: '12px', fontWeight: '500' }}>
                🔥 热点信息
              </div>
              <div
                style={{
                  padding: '16px',
                  background: '#fff5f5',
                  border: '1px solid #fed7d7',
                  borderRadius: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: '#718096' }}>坐标位置</span>
                  <span style={{ fontSize: '13px', color: '#2d3748', fontWeight: '500' }}>
                    ({alert.hotSpot.x}, {alert.hotSpot.y})
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: '#718096' }}>影响范围</span>
                  <span style={{ fontSize: '13px', color: '#2d3748', fontWeight: '500' }}>
                    半径 {alert.hotSpot.radius} 像素
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: '#718096' }}>最高温度</span>
                  <span style={{ fontSize: '13px', color: '#e53e3e', fontWeight: '600' }}>
                    {alert.hotSpot.temp}°C
                  </span>
                </div>
              </div>
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', color: '#2d3748', marginBottom: '8px', fontWeight: '500' }}>
              处理备注
            </div>
            <textarea
              value={remark()}
              onInput={(e) => setRemark(e.target.value)}
              placeholder="请输入处理备注信息..."
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
                resize: 'vertical',
                minHeight: '80px',
                outline: 'none',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#667eea')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
            />
          </div>
        </div>

        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
          }}
        >
          <button
            onClick={handleClose}
            disabled={processing()}
            style={{
              padding: '10px 20px',
              border: '1px solid #e2e8f0',
              background: '#fff',
              color: '#4a5568',
              borderRadius: '6px',
              cursor: processing() ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={processing()}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: '#e53e3e',
              color: '#fff',
              borderRadius: '6px',
              cursor: processing() ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              opacity: processing() ? '0.7' : '1',
            }}
          >
            {processing() ? '处理中...' : '确认告警'}
          </button>
          <button
            onClick={handleProcess}
            disabled={processing()}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff',
              borderRadius: '6px',
              cursor: processing() ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              opacity: processing() ? '0.7' : '1',
            }}
          >
            {processing() ? '处理中...' : '前往处理'}
          </button>
        </div>
      </div>
    </div>
  );
}
