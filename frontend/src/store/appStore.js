import { createStore } from 'solid-js/store';
import api from '../services/api';
import wsClient from '../services/websocket';

const initialState = {
  buildings: [],
  devices: [],
  alerts: [],
  patrolPersonnel: [],
  hotspots: [],
  thermalData: {},
  selectedBuilding: null,
  selectedDevice: null,
  ws: {
    isConnected: false,
    isConnecting: false,
    lastUpdate: null,
  },
  ui: {
    theme: 'light',
    sidebarOpen: true,
    temperatureUnit: 'celsius',
    loading: {
      buildings: false,
      devices: false,
      alerts: false,
      patrolPersonnel: false,
    },
  },
};

export const [state, setState] = createStore(initialState);

export const actions = {
  async loadBuildings() {
    setState('ui', 'loading', 'buildings', true);
    try {
      const data = await api.buildings.list();
      setState('buildings', data);
      if (data.length > 0 && !state.selectedBuilding) {
        setState('selectedBuilding', data[0]);
      }
    } catch (error) {
      console.error('Failed to load buildings:', error);
    } finally {
      setState('ui', 'loading', 'buildings', false);
    }
  },

  async loadDevices() {
    setState('ui', 'loading', 'devices', true);
    try {
      const data = await api.devices.list();
      setState('devices', data);
    } catch (error) {
      console.error('Failed to load devices:', error);
    } finally {
      setState('ui', 'loading', 'devices', false);
    }
  },

  async loadAlerts(params = {}) {
    setState('ui', 'loading', 'alerts', true);
    try {
      const data = await api.alerts.list(params);
      setState('alerts', data);
    } catch (error) {
      console.error('Failed to load alerts:', error);
    } finally {
      setState('ui', 'loading', 'alerts', false);
    }
  },

  async loadPatrolPersonnel() {
    setState('ui', 'loading', 'patrolPersonnel', true);
    try {
      const data = await api.patrolPersonnel.list();
      setState('patrolPersonnel', data);
    } catch (error) {
      console.error('Failed to load patrol personnel:', error);
    } finally {
      setState('ui', 'loading', 'patrolPersonnel', false);
    }
  },

  async loadHotspots(params = {}) {
    try {
      const data = await api.hotspots.list(params);
      setState('hotspots', data);
    } catch (error) {
      console.error('Failed to load hotspots:', error);
    }
  },

  selectBuilding(building) {
    setState('selectedBuilding', building);
    if (building) {
      wsClient.subscribe(building.id);
    }
  },

  selectDevice(device) {
    setState('selectedDevice', device);
  },

  addAlert(alert) {
    setState('alerts', (alerts) => [alert, ...alerts]);
  },

  updateAlert(alertId, updates) {
    setState('alerts', (alerts) =>
      alerts.map((a) => (a.id === alertId ? { ...a, ...updates } : a))
    );
  },

  updateDeviceStatus(deviceId, status) {
    setState('devices', (devices) =>
      devices.map((d) => (d.id === deviceId ? { ...d, status, lastHeartbeat: new Date().toISOString() } : d))
    );
  },

  updatePatrolLocation(data) {
    setState('patrolPersonnel', (personnel) =>
      personnel.map((p) =>
        p.id === data.personnel_id
          ? { ...p, lastLocation: { lat: data.lat, lng: data.lng, timestamp: data.timestamp } }
          : p
      )
    );
  },

  updateThermalData(thermalFrame) {
    const { device_id, data } = thermalFrame;
    setState('thermalData', device_id, {
      ...state.thermalData[device_id],
      ...data,
      lastUpdate: new Date().toISOString(),
    });
  },

  addHotspot(hotspot) {
    setState('hotspots', (hotspots) => {
      const exists = hotspots.some((h) => h.id === hotspot.id);
      if (exists) {
        return hotspots.map((h) => (h.id === hotspot.id ? hotspot : h));
      }
      return [...hotspots, hotspot];
    });
  },

  async connectWebSocket() {
    setState('ws', 'isConnecting', true);
    try {
      await wsClient.connect();
      setState('ws', 'isConnected', true);
      setState('ws', 'isConnecting', false);
      setState('ws', 'lastUpdate', new Date().toISOString());

      wsClient.on('connected', () => {
        setState('ws', 'isConnected', true);
        setState('ws', 'lastUpdate', new Date().toISOString());
      });

      wsClient.on('disconnected', () => {
        setState('ws', 'isConnected', false);
      });

      wsClient.on('thermal_frame', (data) => {
        actions.updateThermalData(data);
        setState('ws', 'lastUpdate', new Date().toISOString());
      });

      wsClient.on('alert', (data) => {
        actions.addAlert(data);
      });

      wsClient.on('patrol_location', (data) => {
        actions.updatePatrolLocation(data);
      });

      wsClient.on('device_status', (data) => {
        actions.updateDeviceStatus(data.device_id, data.status);
      });

      wsClient.on('error', (error) => {
        console.error('WebSocket error:', error);
      });

      if (state.selectedBuilding) {
        wsClient.subscribe(state.selectedBuilding.id);
      }
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setState('ws', 'isConnecting', false);
    }
  },

  disconnectWebSocket() {
    wsClient.disconnect();
    setState('ws', 'isConnected', false);
  },

  setTheme(theme) {
    setState('ui', 'theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  },

  toggleTheme() {
    const newTheme = state.ui.theme === 'light' ? 'dark' : 'light';
    actions.setTheme(newTheme);
  },

  toggleSidebar() {
    setState('ui', 'sidebarOpen', !state.ui.sidebarOpen);
  },

  setTemperatureUnit(unit) {
    setState('ui', 'temperatureUnit', unit);
    localStorage.setItem('temperatureUnit', unit);
  },

  initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    actions.setTheme(savedTheme);
  },

  initTemperatureUnit() {
    const savedUnit = localStorage.getItem('temperatureUnit') || 'celsius';
    setState('ui', 'temperatureUnit', savedUnit);
  },

  async initAll() {
    actions.initTheme();
    actions.initTemperatureUnit();
    await Promise.all([
      actions.loadBuildings(),
      actions.loadDevices(),
      actions.loadAlerts({ limit: 20 }),
      actions.loadPatrolPersonnel(),
    ]);
    await actions.connectWebSocket();
  },

  resetAll() {
    setState(initialState);
  },
};

export default { state, setState, actions };
