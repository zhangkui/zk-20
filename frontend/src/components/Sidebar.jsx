import { createSignal, createEffect } from 'solid-js';
import { useLocation, useNavigate } from '@solidjs/router';

const menuItems = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/buildings', label: '建筑管理', icon: '🏢' },
  { path: '/thermal', label: '热成像监控', icon: '🌡️' },
  { path: '/patrol', label: '巡防定位', icon: '📍' },
  { path: '/alerts', label: '告警管理', icon: '⚠️' },
  { path: '/personnel', label: '责任人员', icon: '👥' },
  { path: '/statistics', label: '统计分析', icon: '📈' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = createSignal(false);
  const [mobileOpen, setMobileOpen] = createSignal(false);
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const handleMenuClick = (path) => {
    navigate(path);
    setMobileOpen(false);
  };

  createEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  });

  return (
    <>
      <div
        class="sidebar-overlay"
        style={{
          display: mobileOpen() ? 'block' : 'none',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 998,
        }}
        onClick={() => setMobileOpen(false)}
      />

      <aside
        class="sidebar"
        style={{
          width: collapsed() ? '64px' : '240px',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          background: 'linear-gradient(180deg, #1a2332 0%, #0f1722 100%)',
          color: '#fff',
          transition: 'width 0.3s ease',
          zIndex: 999,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
          transform: mobileOpen() ? 'translateX(0)' : 'translateX(-100%)',
          '@media (min-width: 768px)': {
            transform: 'translateX(0)',
          },
        }}
      >
        <div
          class="sidebar-header"
          style={{
            height: '60px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed() ? 'center' : 'space-between',
            padding: collapsed() ? '0 12px' : '0 20px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {!collapsed() && (
            <span style={{ fontSize: '18px', fontWeight: '600', color: '#4fc3f7' }}>
              🔥 消防监测
            </span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed())}
            style={{
              background: 'none',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '20px',
              padding: '4px 8px',
              borderRadius: '4px',
              display: window.innerWidth < 768 ? 'none' : 'block',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
          >
            {collapsed() ? '→' : '←'}
          </button>
        </div>

        <nav class="sidebar-menu" style={{ flex: 1, padding: '16px 8px', overflowY: 'auto' }}>
          {menuItems.map((item) => (
            <div
              onClick={() => handleMenuClick(item.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: collapsed() ? '12px' : '12px 16px',
                margin: '4px 0',
                borderRadius: '8px',
                cursor: 'pointer',
                background: isActive(item.path)
                  ? 'linear-gradient(90deg, #1976d2 0%, #1565c0 100%)'
                  : 'transparent',
                color: isActive(item.path) ? '#fff' : '#a0aec0',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive(item.path)) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.color = '#fff';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive(item.path)) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#a0aec0';
                }
              }}
            >
              <span style={{ fontSize: '20px', marginRight: collapsed() ? '0' : '12px' }}>
                {item.icon}
              </span>
              {!collapsed() && (
                <span style={{ fontSize: '14px', fontWeight: '500' }}>{item.label}</span>
              )}
              {!collapsed() && isActive(item.path) && (
                <span
                  style={{
                    marginLeft: 'auto',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#4fc3f7',
                    boxShadow: '0 0 8px rgba(79,195,247,0.6)',
                  }}
                />
              )}
            </div>
          ))}
        </nav>

        <div
          class="sidebar-footer"
          style={{
            padding: '16px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            display: collapsed() ? 'none' : 'block',
          }}
        >
          <div style={{ fontSize: '12px', color: '#718096' }}>
            版本 v1.0.0
          </div>
        </div>
      </aside>

      <button
        class="mobile-menu-btn"
        style={{
          display: window.innerWidth < 768 ? 'flex' : 'none',
          position: 'fixed',
          top: '12px',
          left: '12px',
          zIndex: 1000,
          background: '#1a2332',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          padding: '10px 14px',
          fontSize: '20px',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}
        onClick={() => setMobileOpen(!mobileOpen())}
      >
        ☰
      </button>
    </>
  );
}
