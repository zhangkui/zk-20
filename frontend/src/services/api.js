const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const request = async (url, options = {}) => {
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const finalOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };

  if (finalOptions.body && typeof finalOptions.body !== 'string') {
    finalOptions.body = JSON.stringify(finalOptions.body);
  }

  const response = await fetch(`${API_BASE_URL}${url}`, finalOptions);
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Request failed');
  }

  return data.data;
};

const get = (url, params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  const fullUrl = queryString ? `${url}?${queryString}` : url;
  return request(fullUrl, { method: 'GET' });
};

const post = (url, body = {}) => {
  return request(url, { method: 'POST', body });
};

const put = (url, body = {}) => {
  return request(url, { method: 'PUT', body });
};

const del = (url) => {
  return request(url, { method: 'DELETE' });
};

export const buildings = {
  list: () => get('/buildings'),
  get: (id) => get(`/buildings/${id}`),
  create: (data) => post('/buildings', data),
  update: (id, data) => put(`/buildings/${id}`, data),
  delete: (id) => del(`/buildings/${id}`),
  toggleStatus: (id) => put(`/buildings/${id}/toggle-status`),
};

export const devices = {
  list: () => get('/devices'),
  get: (id) => get(`/devices/${id}`),
  getByBuilding: (buildingId) => get(`/devices/building/${buildingId}`),
  create: (data) => post('/devices', data),
  updateHeartbeat: (id) => put(`/devices/${id}/heartbeat`),
};

export const thermalData = {
  list: (params = {}) => get('/thermal-data', params),
  get: (id) => get(`/thermal-data/${id}`),
  getById: (id) => get(`/thermal-data/${id}`),
  getByDevice: (deviceId, params = {}) => get(`/thermal-data/device/${deviceId}`, params),
  getByBuilding: (buildingId, params = {}) => get(`/thermal-data/building/${buildingId}/time-range`, params),
  create: (data) => post('/thermal-data', data),
};

export const hotspots = {
  list: (params = {}) => get('/hotspots', params),
  getByBuilding: (buildingId, params = {}) => get(`/hotspots/building/${buildingId}`, params),
  getByRisk: (riskLevel) => get(`/hotspots/risk?level=${riskLevel}`),
  updateStatus: (id, status) => put(`/hotspots/${id}/status`, { status }),
  analyze: (thermalDataId) => post('/hotspots/analyze', { thermal_data_id: thermalDataId }),
};

export const patrolPersonnel = {
  list: () => get('/patrol-personnel'),
  get: (id) => get(`/patrol-personnel/${id}`),
  create: (data) => post('/patrol-personnel', data),
  updateStatus: (id, status) => put(`/patrol-personnel/${id}/status`, { status }),
  getLocations: (personnelId) => get(`/patrol-locations/personnel/${personnelId}`),
};

export const patrolLocations = {
  create: (data) => post('/patrol-locations', data),
  getByPersonnel: (personnelId, params = {}) => get(`/patrol-locations/personnel/${personnelId}`, params),
};

export const alerts = {
  list: (params = {}) => get('/alerts', params),
  get: (id) => get(`/alerts/${id}`),
  getByBuilding: (buildingId, params = {}) => get(`/alerts/building/${buildingId}`, params),
  create: (data) => post('/alerts', data),
  acknowledge: (id, personnelId) => put(`/alerts/${id}/acknowledge`, { personnel_id: personnelId }),
  resolve: (id, personnelId) => put(`/alerts/${id}/resolve`, { personnel_id: personnelId }),
  getPlayback: (id) => get(`/alerts/${id}/playback`),
  createPlayback: (id, data) => post(`/alerts/${id}/playback`, data),
  dispatch: (id, personnelId, dispatchReason) =>
    post(`/alerts/${id}/dispatch`, { personnel_id: personnelId, dispatch_reason: dispatchReason }),
  arrive: (id, personnelId) => put(`/alerts/${id}/arrive`, { personnel_id: personnelId }),
  escalate: (id, newLevel, escalationReason, notifiedPersonId) =>
    put(`/alerts/${id}/escalate`, {
      new_level: newLevel,
      escalation_reason: escalationReason,
      notified_person_id: notifiedPersonId,
    }),
};

export const alertDispatches = {
  list: (params = {}) => get('/alert-dispatches', params),
  get: (id) => get(`/alert-dispatches/${id}`),
  getByAlert: (alertId) => get(`/alert-dispatches/alert/${alertId}`),
  getByPersonnel: (personnelId) => get(`/alert-dispatches/personnel/${personnelId}`),
  create: (data) => post('/alert-dispatches', data),
  accept: (id) => put(`/alert-dispatches/${id}/accept`),
  arrive: (id) => put(`/alert-dispatches/${id}/arrive`),
  handle: (id, handlingNotes) => put(`/alert-dispatches/${id}/handle`, { handling_notes: handlingNotes }),
  close: (id, handlingNotes) => put(`/alert-dispatches/${id}/close`, { handling_notes: handlingNotes }),
  delete: (id) => del(`/alert-dispatches/${id}`),
};

export const patrolTasks = {
  list: (params = {}) => get('/patrol-tasks', params),
  get: (id) => get(`/patrol-tasks/${id}`),
  getByBuilding: (buildingId) => get(`/patrol-tasks/building/${buildingId}`),
  getByPersonnel: (personnelId) => get(`/patrol-tasks/personnel/${personnelId}`),
  getByStatus: (status) => get('/patrol-tasks/status', { status }),
  create: (data) => post('/patrol-tasks', data),
  update: (id, data) => put(`/patrol-tasks/${id}`, data),
  start: (id) => put(`/patrol-tasks/${id}/start`),
  complete: (id, data) => put(`/patrol-tasks/${id}/complete`, data),
  delete: (id) => del(`/patrol-tasks/${id}`),
  generateDaily: (date) => post('/patrol-tasks/generate-daily', { date }),
};

export const buildingInspections = {
  list: (params = {}) => get('/building-inspections', params),
  get: (id) => get(`/building-inspections/${id}`),
  getByBuilding: (buildingId) => get(`/building-inspections/building/${buildingId}`),
  getByRectificationStatus: (status) => get('/building-inspections/rectification-status', { status }),
  create: (data) => post('/building-inspections', data),
  update: (id, data) => put(`/building-inspections/${id}`, data),
  updateRectification: (id, data) => put(`/building-inspections/${id}/rectification`, data),
  delete: (id) => del(`/building-inspections/${id}`),
};

export const responsiblePersons = {
  list: () => get('/responsible-persons'),
  getByBuilding: (buildingId) => get(`/responsible-persons/building/${buildingId}`),
  create: (data) => post('/responsible-persons', data),
  deactivate: (id) => put(`/responsible-persons/${id}/deactivate`),
};

export const statistics = {
  getByBuilding: (buildingId, params = {}) => get(`/statistics/building/${buildingId}`, params),
  getByHour: (buildingId, params = {}) => get(`/statistics/building/${buildingId}/aggregate-by-hour`, params),
  getDailySummary: (buildingId) => get(`/statistics/building/${buildingId}/daily-summary`),
  aggregateByBuildingHour: (buildingId, params = {}) => get(`/statistics/building/${buildingId}/aggregate-by-hour`, params),
};

export default {
  buildings,
  devices,
  thermalData,
  hotspots,
  patrolPersonnel,
  patrolLocations,
  alerts,
  alertDispatches,
  patrolTasks,
  buildingInspections,
  responsiblePersons,
  statistics,
};
