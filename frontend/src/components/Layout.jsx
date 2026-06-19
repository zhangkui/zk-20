import { children } from 'solid-js';
import { A, useLocation } from '@solidjs/router';
import { state, actions } from '../store/appStore';

const menuItems = [
  { path: '/', icon: '🏠', label: '首页' },
  { path: '/dashboard', icon: '📊', label: '数据看板' },
  { path: '/buildings', icon: '🏢', label: '建筑管理' },
  { path: '/map', icon: '🗺️', label: '地图展示' },
  { path: '/devices', icon: '📡', label: '设备管理' },
  { path: '/alerts', icon: '🔔', label: '告警中心' },
  { path: '/patrol', icon: '👮', label: '巡防管理' },
];

const Layout = (props) => {
  const location = useLocation();
  const c = children(() => props.children);

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const getConnectionStatusText = () => {
    if (state.ws.isConnecting) return '连接中...';
    if (state.ws.isConnected) return '已连接';
    return '已断开';
  };

  const getConnectionStatusClass = () => {
    if (state.ws.isConnecting) return 'status-warning';
    if (state.ws.isConnected) return 'status-online';
    return 'status-offline';
  };

  return (
    <div class="layout">
      <aside class={`layout-sidebar ${state.ui.sidebarOpen ? 'open' : ''}`}>
        <div class="sidebar-logo">
          <span class="sidebar-logo-icon">🔥</span>
          <span class="sidebar-logo-text">热成像监控</span>
        </div>
        <nav class="sidebar-menu">
          {menuItems.map((item) => (
            <A
              href={item.path}
              class={`sidebar-menu-item ${isActive(item.path) ? 'active' : ''}`}
            >
              <span class="sidebar-menu-item-icon">{item.icon}</span>
              <span class="sidebar-menu-item-text">{item.label}</span>
            </A>
          ))}
        </nav>
      </aside>

      <div class="layout-main">
        <header class="layout-header">
          <div class="flex-center">
            <button
              class="btn btn-sm"
              onClick={() => actions.toggleSidebar()}
              style={{ marginRight: '16px' }}
            >
              ☰
            </button>
            <span class="header-title">
              {menuItems.find((item) => isActive(item.path))?.label || '热成像监控系统'}
            </span>
          </div>
          <div class="header-actions">
            <div class="flex-center" style={{ gap: '8px' }}>
              <span class={`status-dot ${getConnectionStatusClass()}`}></span>
              <span class="text-secondary">{getConnectionStatusText()}</span>
            </div>
            {state.ws.lastUpdate && (
              <span class="text-muted text-sm">
                更新: {new Date(state.ws.lastUpdate).toLocaleTimeString()}
              </span>
            )}
            <button
              class="btn btn-sm"
              onClick={() => actions.toggleTheme()}
              title={state.ui.theme === 'light' ? '切换深色模式' : '切换浅色模式'}
            >
              {state.ui.theme === 'light' ? '🌙' : '☀️'}
            </button>
            <button
              class="btn btn-sm"
              onClick={() => actions.setTemperatureUnit(
                state.ui.temperatureUnit === 'celsius' ? 'fahrenheit' : 'celsius'
              )}
              title={`切换温度单位 (当前: ${state.ui.temperatureUnit === 'celsius' ? '°C' : '°F'})`}
            >
              {state.ui.temperatureUnit === 'celsius' ? '°C' : '°F'}
            </button>
            {state.alerts.length > 0 && (
              <span class="badge badge-error" style={{ position: 'relative' }}>
                🔔 {state.alerts.filter((a) => a.status === 'pending').length}
              </span>
            )}
          </div>
        </header>

        <main class="layout-content">
          {c()}
        </main>
      </div>
    </div>
  );
};

export default Layout;
