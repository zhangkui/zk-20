CREATE TABLE IF NOT EXISTS buildings (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    address TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    area REAL NOT NULL,
    building_type TEXT NOT NULL,
    construction_year INTEGER,
    floors INTEGER,
    risk_level TEXT,
    geometry TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS thermal_devices (
    id TEXT PRIMARY KEY,
    building_id TEXT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    device_code TEXT NOT NULL UNIQUE,
    model TEXT,
    ip_address TEXT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    fov_width REAL NOT NULL,
    fov_height REAL NOT NULL,
    installation_height REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'online',
    last_heartbeat TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS thermal_data (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL REFERENCES thermal_devices(id) ON DELETE CASCADE,
    building_id TEXT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    timestamp TEXT NOT NULL,
    temperature_matrix TEXT NOT NULL,
    min_temp REAL NOT NULL,
    max_temp REAL NOT NULL,
    avg_temp REAL NOT NULL,
    resolution_width INTEGER NOT NULL,
    resolution_height INTEGER NOT NULL,
    is_night INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_thermal_data_device_time ON thermal_data(device_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_thermal_data_building_time ON thermal_data(building_id, timestamp DESC);

CREATE TABLE IF NOT EXISTS hotspots (
    id TEXT PRIMARY KEY,
    thermal_data_id TEXT NOT NULL REFERENCES thermal_data(id) ON DELETE CASCADE,
    building_id TEXT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL REFERENCES thermal_devices(id) ON DELETE CASCADE,
    timestamp TEXT NOT NULL,
    center_x INTEGER NOT NULL,
    center_y INTEGER NOT NULL,
    temperature REAL NOT NULL,
    area REAL NOT NULL,
    risk_level TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'detected',
    description TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hotspots_building_time ON hotspots(building_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_hotspots_risk ON hotspots(risk_level);

CREATE TABLE IF NOT EXISTS patrol_personnel (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    employee_id TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    department TEXT NOT NULL,
    position TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'idle',
    last_location_lat REAL,
    last_location_lng REAL,
    last_location_time TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS patrol_locations (
    id TEXT PRIMARY KEY,
    personnel_id TEXT NOT NULL REFERENCES patrol_personnel(id) ON DELETE CASCADE,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    timestamp TEXT NOT NULL,
    accuracy REAL,
    battery_level REAL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_patrol_locations_personnel_time ON patrol_locations(personnel_id, timestamp DESC);

CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    hotspot_id TEXT REFERENCES hotspots(id) ON DELETE SET NULL,
    building_id TEXT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    latitude REAL,
    longitude REAL,
    acknowledged_by TEXT REFERENCES patrol_personnel(id) ON DELETE SET NULL,
    acknowledged_at TEXT,
    resolved_by TEXT REFERENCES patrol_personnel(id) ON DELETE SET NULL,
    resolved_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alerts_building_time ON alerts(building_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);

CREATE TABLE IF NOT EXISTS alert_playback (
    id TEXT PRIMARY KEY,
    alert_id TEXT NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    thermal_data_id TEXT REFERENCES thermal_data(id) ON DELETE SET NULL,
    playback_data TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS responsible_persons (
    id TEXT PRIMARY KEY,
    building_id TEXT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    position TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    responsibility TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    start_date TEXT NOT NULL,
    end_date TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_responsible_persons_building ON responsible_persons(building_id, is_active);

CREATE TABLE IF NOT EXISTS high_risk_stats (
    id TEXT PRIMARY KEY,
    building_id TEXT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    hour_of_day INTEGER NOT NULL,
    date TEXT NOT NULL,
    alert_count INTEGER NOT NULL DEFAULT 0,
    hotspot_count INTEGER NOT NULL DEFAULT 0,
    avg_max_temp REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_high_risk_stats_unique ON high_risk_stats(building_id, date, hour_of_day);
CREATE INDEX IF NOT EXISTS idx_high_risk_stats_building ON high_risk_stats(building_id, date DESC);
