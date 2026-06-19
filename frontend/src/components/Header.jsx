import { createSignal, createEffect, onCleanup } from 'solid-js';

export default function Header(props) {
  const [currentTime, setCurrentTime] = createSignal(new Date());
  const [alertDropdownOpen, setAlertDropdownOpen] = createSignal(false);
  const [userDropdownOpen, setUserDropdownOpen] = createSignal(false);

  const alerts = props.alerts || [
    { id: 1, type: 'warning', message: '3号楼3层温度异常', time: '2分钟前' },
    { id: 2, type: 'danger', message: '5号楼热成像检测到高温点', time: '5分钟前' },
    { id: 3, type: 'info', message: '巡防人员已到达2号楼', time: '10分钟前' },
  ];

  const unreadCount = alerts.filter((a) => !a.read).length;

  createEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    const handleClickOutside = (e) => {
      if (!e.target.closest('.alert-dropdown-container')) {
        setAlertDropdownOpen(false);
      }
      if (!e.target.closest('.user-dropdown-container')) {
        setUserDropdownOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);

    onCleanup(() => {
      clearInterval(timer);
      document.removeEventListener('click', handleClickOutside);
    });
  });

  const formatTime = (date) => {
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case 'danger':
        return '🔴';
      case 'warning':
        return '🟡';
      default:
        return '🔵';
    }
  };

  const getConnectionStatus = () => {
    return props.connected !== false;
  };

  return (
    <header
      class="header"
      style={{
        height: '60px',
        background: '#fff',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <div class="header-left" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: '600', color: '#2d3748', margin: 0 }}>
          {props.title || '消防监测预警系统'}
        </h1>
      </div>

      <div class="header-right" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div
          class="connection-status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            background: getConnectionStatus() ? '#f0fff4' : '#fff5f5',
            borderRadius: '20px',
            fontSize: '12px',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: getConnectionStatus() ? '#48bb78' : '#f56565',
              animation: getConnectionStatus() ? 'pulse 2s infinite' : 'none',
            }}
          />
          <span style={{ color: getConnectionStatus() ? '#2f855a' : '#c53030' }}>
            {getConnectionStatus() ? '已连接' : '断开'}
          </span>
        </div>

        <div style={{ fontSize: '13px', color: '#718096', whiteSpace: 'nowrap' }}>
          {formatTime(currentTime())}
        </div>

        <div
          class="alert-dropdown-container"
          style={{ position: 'relative' }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setAlertDropdownOpen(!alertDropdownOpen());
              setUserDropdownOpen(false);
            }}
            style={{
              position: 'relative',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
              fontSize: '20px',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f7fafc')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            🔔
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '2px',
                  right: '2px',
                  minWidth: '18px',
                  height: '18px',
                  background: '#e53e3e',
                  color: '#fff',
                  fontSize: '11px',
                  borderRadius: '9px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          {alertDropdownOpen() && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '8px',
                width: '320px',
                background: '#fff',
                borderRadius: '8px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                overflow: 'hidden',
                border: '1px solid #e2e8f0',
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #e2e8f0',
                  fontWeight: '600',
                  color: '#2d3748',
                }}
              >
                告警通知 ({alerts.length})
              </div>
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid #f7fafc',
                      cursor: 'pointer',
                      display: 'flex',
                      gap: '10px',
                      background: alert.read ? '#fff' : '#f7fafc',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f7fafc')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = alert.read ? '#fff' : '#f7fafc')}
                    onClick={() => props.onAlertClick && props.onAlertClick(alert)}
                  >
                    <span style={{ fontSize: '16px' }}>{getAlertIcon(alert.type)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', color: '#2d3748', marginBottom: '4px' }}>
                        {alert.message}
                      </div>
                      <div style={{ fontSize: '11px', color: '#a0aec0' }}>{alert.time}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div
                style={{
                  padding: '10px 16px',
                  textAlign: 'center',
                  borderTop: '1px solid #e2e8f0',
                }}
              >
                <button
                  onClick={() => props.onViewAllAlerts && props.onViewAllAlerts()}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#1976d2',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  查看全部告警
                </button>
              </div>
            </div>
          )}
        </div>

        <div
          class="user-dropdown-container"
          style={{ position: 'relative' }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setUserDropdownOpen(!userDropdownOpen());
              setAlertDropdownOpen(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '6px 12px',
              borderRadius: '8px',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f7fafc')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #1976d2, #1565c0)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '14px',
                fontWeight: '600',
              }}
            >
              管
            </div>
            <span style={{ fontSize: '14px', color: '#2d3748' }}>管理员</span>
            <span style={{ color: '#a0aec0' }}>▼</span>
          </button>

          {userDropdownOpen() && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '8px',
                width: '180px',
                background: '#fff',
                borderRadius: '8px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                overflow: 'hidden',
                border: '1px solid #e2e8f0',
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: '#2d3748',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f7fafc')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                👤 个人中心
              </div>
              <div
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: '#2d3748',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f7fafc')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                ⚙️ 系统设置
              </div>
              <div
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: '#e53e3e',
                  borderTop: '1px solid #e2e8f0',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f7fafc')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                🚪 退出登录
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
