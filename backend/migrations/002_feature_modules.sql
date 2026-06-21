
-- 告警派单记录表
CREATE TABLE IF NOT EXISTS alert_dispatches (
    id TEXT PRIMARY KEY,
    alert_id TEXT NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    dispatched_by TEXT REFERENCES patrol_personnel(id) ON DELETE SET NULL,
    dispatched_to TEXT NOT NULL REFERENCES patrol_personnel(id) ON DELETE CASCADE,
    dispatch_reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    dispatched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    accepted_at TEXT,
    arrived_at TEXT,
    handled_at TEXT,
    closed_at TEXT,
    handling_notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alert_dispatches_alert ON alert_dispatches(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_dispatches_personnel ON alert_dispatches(dispatched_to, status);

-- 巡防任务表
CREATE TABLE IF NOT EXISTS patrol_tasks (
    id TEXT PRIMARY KEY,
    building_id TEXT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    personnel_id TEXT REFERENCES patrol_personnel(id) ON DELETE SET NULL,
    task_name TEXT NOT NULL,
    task_type TEXT NOT NULL,
    risk_level TEXT NOT NULL DEFAULT 'medium',
    scheduled_start TEXT NOT NULL,
    scheduled_end TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    started_at TEXT,
    completed_at TEXT,
    inspection_result TEXT,
    findings TEXT,
    completed_risk_level TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_patrol_tasks_building ON patrol_tasks(building_id, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_patrol_tasks_personnel ON patrol_tasks(personnel_id, status);
CREATE INDEX IF NOT EXISTS idx_patrol_tasks_status ON patrol_tasks(status, scheduled_start);

-- 告警升级记录表
CREATE TABLE IF NOT EXISTS alert_escalations (
    id TEXT PRIMARY KEY,
    alert_id TEXT NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    previous_level INTEGER NOT NULL DEFAULT 0,
    new_level INTEGER NOT NULL DEFAULT 1,
    escalation_reason TEXT NOT NULL,
    notified_person_id TEXT REFERENCES responsible_persons(id) ON DELETE SET NULL,
    notified_at TEXT,
    escalation_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alert_escalations_alert ON alert_escalations(alert_id, escalation_time DESC);

-- 建筑巡检记录表
CREATE TABLE IF NOT EXISTS building_inspection_records (
    id TEXT PRIMARY KEY,
    building_id TEXT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    inspector_id TEXT REFERENCES patrol_personnel(id) ON DELETE SET NULL,
    inspection_date TEXT NOT NULL,
    risk_level_before TEXT,
    risk_level_after TEXT,
    findings TEXT,
    rectification_status TEXT NOT NULL DEFAULT 'pending',
    rectification_deadline TEXT,
    rectification_completed_at TEXT,
    rectification_notes TEXT,
    alert_count INTEGER NOT NULL DEFAULT 0,
    hotspot_count INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_building_inspection_building ON building_inspection_records(building_id, inspection_date DESC);
CREATE INDEX IF NOT EXISTS idx_building_inspection_status ON building_inspection_records(rectification_status);

-- 扩展 alerts 表新增字段
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS dispatched_to TEXT REFERENCES patrol_personnel(id) ON DELETE SET NULL;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS dispatched_at TEXT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS arrived_at TEXT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS handling_notes TEXT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS escalation_level INTEGER NOT NULL DEFAULT 0;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS ack_timeout_minutes INTEGER NOT NULL DEFAULT 30;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS resolve_timeout_minutes INTEGER NOT NULL DEFAULT 120;
