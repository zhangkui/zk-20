const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws';
const HEARTBEAT_INTERVAL = 30000;
const RECONNECT_DELAY = 5000;

class WebSocketClient {
  constructor() {
    this.ws = null;
    this.url = WS_URL;
    this.listeners = new Map();
    this.subscriptions = new Set();
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
    this.shouldReconnect = true;
    this.isConnected = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
        resolve();
        return;
      }

      this.shouldReconnect = true;

      try {
        this.ws = new WebSocket(this.url);
      } catch (error) {
        this.emit('error', error);
        reject(error);
        return;
      }

      this.ws.onopen = () => {
        this.isConnected = true;
        this.startHeartbeat();
        this.emit('connected');

        for (const buildingId of this.subscriptions) {
          this.sendSubscribe(buildingId);
        }

        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          this.emit('error', new Error('Failed to parse message: ' + error.message));
        }
      };

      this.ws.onerror = (error) => {
        this.emit('error', error);
        reject(error);
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.stopHeartbeat();
        this.emit('disconnected');

        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      };
    });
  }

  disconnect() {
    this.shouldReconnect = false;
    this.stopHeartbeat();
    this.stopReconnect();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.subscriptions.clear();
  }

  subscribe(buildingId) {
    this.subscriptions.add(buildingId);
    if (this.isConnected) {
      this.sendSubscribe(buildingId);
    }
  }

  unsubscribe(buildingId) {
    this.subscriptions.delete(buildingId);
    if (this.isConnected) {
      this.sendUnsubscribe(buildingId);
    }
  }

  subscribeAll() {
    if (this.isConnected) {
      this.send({
        action: 'SubscribeAll',
      });
    }
  }

  unsubscribeAll() {
    this.subscriptions.clear();
    if (this.isConnected) {
      this.send({
        action: 'UnsubscribeAll',
      });
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  off(event, callback) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
    }
  }

  sendSubscribe(buildingId) {
    this.send({
      action: 'Subscribe',
      data: {
        building_id: buildingId,
      },
    });
  }

  sendUnsubscribe(buildingId) {
    this.send({
      action: 'Unsubscribe',
      data: {
        building_id: buildingId,
      },
    });
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  handleMessage(message) {
    const { type, data } = message;

    switch (type) {
      case 'ThermalFrame':
        this.emit('thermal_frame', data);
        break;
      case 'Alert':
        this.emit('alert', data);
        break;
      case 'PatrolLocation':
        this.emit('patrol_location', data);
        break;
      case 'DeviceStatus':
        this.emit('device_status', data);
        break;
      case 'HeartbeatAck':
        break;
      case 'Error':
        this.emit('error', new Error(data.message));
        break;
      case 'Success':
        break;
      default:
        break;
    }
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send({
        action: 'Heartbeat',
      });
    }, HEARTBEAT_INTERVAL);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  scheduleReconnect() {
    this.stopReconnect();
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {});
    }, RECONNECT_DELAY);
  }

  stopReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  emit(event, data) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      for (const callback of eventListeners) {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      }
    }
  }
}

const wsClient = new WebSocketClient();

export default wsClient;
