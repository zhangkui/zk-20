use chrono::{DateTime, Utc};
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool, Row};
use std::time::Duration;
use uuid::Uuid;

use crate::models::{
    AlertDispatch, AlertEscalation, Building, BuildingInspectionRecord, CompletePatrolTask, CreateAlert,
    CreateAlertDispatch, CreateAlertEscalation, CreateBuilding, CreateBuildingInspectionRecord, CreateHotspot,
    CreatePatrolLocation, CreatePatrolPersonnel, CreatePatrolTask, CreateResponsiblePerson,
    CreateThermalData, CreateThermalDevice, HighRiskStats, Hotspot, PatrolLocation, PatrolPersonnel,
    PatrolTask, ResponsiblePerson, RiskStatsSummary, ThermalData, ThermalDevice,
    UpdateBuilding, UpdateBuildingInspectionRecord, UpdatePatrolTask,
};

pub type DbPool = SqlitePool;

fn ensure_data_dir(database_url: &str) {
    let url = database_url.strip_prefix("sqlite://").unwrap_or(database_url);
    let url = url.strip_prefix("sqlite:").unwrap_or(url);
    let path_str = url.split('?').next().unwrap_or("");
    
    if path_str.is_empty() {
        return;
    }

    let path = std::path::Path::new(path_str);
    if let Some(parent) = path.parent() {
        let parent_str = parent.to_string_lossy();
        if !parent_str.is_empty() && parent_str != "." && parent_str != ".." {
            if let Err(e) = std::fs::create_dir_all(parent) {
                eprintln!("Warning: Failed to create data directory {:?}: {}", parent, e);
            }
        }
    }
}

pub async fn init_pool(database_url: &str) -> DbPool {
    ensure_data_dir(database_url);
    
    let connect_url = if database_url.starts_with("sqlite://") || database_url.starts_with("sqlite:") {
        database_url.to_string()
    } else {
        format!("sqlite:{}", database_url)
    };

    SqlitePoolOptions::new()
        .max_connections(10)
        .acquire_timeout(Duration::from_secs(30))
        .connect(&connect_url)
        .await
        .expect("Failed to create database pool")
}

pub async fn run_migrations(pool: &DbPool) -> Result<(), sqlx::Error> {
    let migration_files = vec![
        "./migrations/001_initial_schema.sql",
        "./migrations/002_feature_modules.sql",
    ];

    for migration_file in migration_files {
        let migration_sql = std::fs::read_to_string(migration_file)
            .map_err(|e| sqlx::Error::Configuration(Box::new(e)))?;
        for statement in migration_sql.split(';') {
            let trimmed = statement.trim();
            if !trimmed.is_empty() {
                sqlx::query(trimmed).execute(pool).await?;
            }
        }
    }

    let rows = sqlx::query("PRAGMA table_info(buildings)")
        .fetch_all(pool)
        .await?;

    let mut has_status = false;
    let mut has_icon = false;
    for row in rows {
        let name: String = row.try_get("name")?;
        if name == "status" {
            has_status = true;
        }
        if name == "icon" {
            has_icon = true;
        }
    }

    if !has_status {
        log::info!("Adding 'status' column to buildings table...");
        sqlx::query("ALTER TABLE buildings ADD COLUMN status TEXT NOT NULL DEFAULT 'active'")
            .execute(pool)
            .await?;
    }

    if !has_icon {
        log::info!("Adding 'icon' column to buildings table...");
        sqlx::query("ALTER TABLE buildings ADD COLUMN icon TEXT")
            .execute(pool)
            .await?;
    }

    let alert_rows = sqlx::query("PRAGMA table_info(alerts)")
        .fetch_all(pool)
        .await?;

    let alert_cols: Vec<String> = alert_rows
        .iter()
        .map(|r| r.try_get::<String, _>("name").unwrap_or_default())
        .collect();

    if !alert_cols.iter().any(|c| c == "dispatched_to") {
        log::info!("Adding 'dispatched_to' column to alerts table...");
        sqlx::query("ALTER TABLE alerts ADD COLUMN dispatched_to TEXT REFERENCES patrol_personnel(id) ON DELETE SET NULL")
            .execute(pool)
            .await?;
    }
    if !alert_cols.iter().any(|c| c == "dispatched_at") {
        log::info!("Adding 'dispatched_at' column to alerts table...");
        sqlx::query("ALTER TABLE alerts ADD COLUMN dispatched_at TEXT")
            .execute(pool)
            .await?;
    }
    if !alert_cols.iter().any(|c| c == "arrived_at") {
        log::info!("Adding 'arrived_at' column to alerts table...");
        sqlx::query("ALTER TABLE alerts ADD COLUMN arrived_at TEXT")
            .execute(pool)
            .await?;
    }
    if !alert_cols.iter().any(|c| c == "handling_notes") {
        log::info!("Adding 'handling_notes' column to alerts table...");
        sqlx::query("ALTER TABLE alerts ADD COLUMN handling_notes TEXT")
            .execute(pool)
            .await?;
    }
    if !alert_cols.iter().any(|c| c == "escalation_level") {
        log::info!("Adding 'escalation_level' column to alerts table...");
        sqlx::query("ALTER TABLE alerts ADD COLUMN escalation_level INTEGER NOT NULL DEFAULT 0")
            .execute(pool)
            .await?;
    }
    if !alert_cols.iter().any(|c| c == "ack_timeout_minutes") {
        log::info!("Adding 'ack_timeout_minutes' column to alerts table...");
        sqlx::query("ALTER TABLE alerts ADD COLUMN ack_timeout_minutes INTEGER NOT NULL DEFAULT 30")
            .execute(pool)
            .await?;
    }
    if !alert_cols.iter().any(|c| c == "resolve_timeout_minutes") {
        log::info!("Adding 'resolve_timeout_minutes' column to alerts table...");
        sqlx::query("ALTER TABLE alerts ADD COLUMN resolve_timeout_minutes INTEGER NOT NULL DEFAULT 120")
            .execute(pool)
            .await?;
    }

    Ok(())
}

pub mod buildings {
    use super::*;

    pub async fn create(pool: &DbPool, data: CreateBuilding) -> Result<Building, sqlx::Error> {
        let id = Uuid::new_v4();
        let now = Utc::now();
        let status = data.status.unwrap_or_else(|| "active".to_string());
        sqlx::query_as::<_, Building>(
            r#"
            INSERT INTO buildings (
                id, name, description, address, latitude, longitude,
                area, building_type, construction_year, floors, risk_level,
                geometry, status, icon, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING
                id,
                name,
                description,
                address,
                latitude,
                longitude,
                area,
                building_type,
                construction_year,
                floors,
                risk_level,
                geometry,
                status,
                icon,
                created_at,
                updated_at
            "#
        )
        .bind(id)
        .bind(&data.name)
        .bind(&data.description)
        .bind(&data.address)
        .bind(data.latitude)
        .bind(data.longitude)
        .bind(data.area)
        .bind(&data.building_type)
        .bind(data.construction_year)
        .bind(data.floors)
        .bind(&data.risk_level)
        .bind(&data.geometry)
        .bind(&status)
        .bind(&data.icon)
        .bind(now)
        .bind(now)
        .fetch_one(pool)
        .await
    }

    pub async fn get_by_id(pool: &DbPool, id: Uuid) -> Result<Option<Building>, sqlx::Error> {
        sqlx::query_as::<_, Building>(
            r#"
            SELECT
                id,
                name,
                description,
                address,
                latitude,
                longitude,
                area,
                building_type,
                construction_year,
                floors,
                risk_level,
                geometry,
                status,
                icon,
                created_at,
                updated_at
            FROM buildings WHERE id = ?
            "#
        )
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    pub async fn list(pool: &DbPool) -> Result<Vec<Building>, sqlx::Error> {
        sqlx::query_as::<_, Building>(
            r#"
            SELECT
                id,
                name,
                description,
                address,
                latitude,
                longitude,
                area,
                building_type,
                construction_year,
                floors,
                risk_level,
                geometry,
                status,
                icon,
                created_at,
                updated_at
            FROM buildings ORDER BY created_at DESC
            "#
        )
        .fetch_all(pool)
        .await
    }

    pub async fn update(
        pool: &DbPool,
        id: Uuid,
        data: UpdateBuilding,
    ) -> Result<Option<Building>, sqlx::Error> {
        let existing = get_by_id(pool, id).await?;
        if existing.is_none() {
            return Ok(None);
        }
        let existing = existing.unwrap();
        let now = Utc::now();

        sqlx::query_as::<_, Building>(
            r#"
            UPDATE buildings SET
                name = COALESCE(?, name),
                description = COALESCE(?, description),
                address = COALESCE(?, address),
                latitude = COALESCE(?, latitude),
                longitude = COALESCE(?, longitude),
                area = COALESCE(?, area),
                building_type = COALESCE(?, building_type),
                construction_year = COALESCE(?, construction_year),
                floors = COALESCE(?, floors),
                risk_level = COALESCE(?, risk_level),
                geometry = COALESCE(?, geometry),
                status = COALESCE(?, status),
                icon = COALESCE(?, icon),
                updated_at = ?
            WHERE id = ?
            RETURNING
                id,
                name,
                description,
                address,
                latitude,
                longitude,
                area,
                building_type,
                construction_year,
                floors,
                risk_level,
                geometry,
                status,
                icon,
                created_at,
                updated_at
            "#
        )
        .bind(data.name.unwrap_or(existing.name))
        .bind(data.description.or(existing.description))
        .bind(data.address.unwrap_or(existing.address))
        .bind(data.latitude.unwrap_or(existing.latitude))
        .bind(data.longitude.unwrap_or(existing.longitude))
        .bind(data.area.unwrap_or(existing.area))
        .bind(data.building_type.unwrap_or(existing.building_type))
        .bind(data.construction_year.or(existing.construction_year))
        .bind(data.floors.or(existing.floors))
        .bind(data.risk_level.or(existing.risk_level))
        .bind(data.geometry.or(existing.geometry))
        .bind(data.status.unwrap_or(existing.status))
        .bind(data.icon.or(existing.icon))
        .bind(now)
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    pub async fn toggle_status(pool: &DbPool, id: Uuid) -> Result<Option<Building>, sqlx::Error> {
        let existing = get_by_id(pool, id).await?;
        if existing.is_none() {
            return Ok(None);
        }
        let existing = existing.unwrap();
        let new_status = if existing.status == "active" { "inactive" } else { "active" };
        let now = Utc::now();

        sqlx::query_as::<_, Building>(
            r#"
            UPDATE buildings SET
                status = ?,
                updated_at = ?
            WHERE id = ?
            RETURNING
                id,
                name,
                description,
                address,
                latitude,
                longitude,
                area,
                building_type,
                construction_year,
                floors,
                risk_level,
                geometry,
                status,
                icon,
                created_at,
                updated_at
            "#
        )
        .bind(new_status)
        .bind(now)
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    pub async fn delete(pool: &DbPool, id: Uuid) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("DELETE FROM buildings WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }
}

pub mod thermal_devices {
    use super::*;

    pub async fn list(pool: &DbPool) -> Result<Vec<ThermalDevice>, sqlx::Error> {
        sqlx::query_as::<_, ThermalDevice>(
            r#"
            SELECT
                id,
                building_id,
                name,
                device_code,
                model,
                ip_address,
                latitude,
                longitude,
                fov_width,
                fov_height,
                installation_height,
                status,
                last_heartbeat,
                created_at,
                updated_at
            FROM thermal_devices ORDER BY created_at DESC
            "#
        )
        .fetch_all(pool)
        .await
    }

    pub async fn create(
        pool: &DbPool,
        data: CreateThermalDevice,
    ) -> Result<ThermalDevice, sqlx::Error> {
        let id = Uuid::new_v4();
        let now = Utc::now();
        sqlx::query_as::<_, ThermalDevice>(
            r#"
            INSERT INTO thermal_devices (
                id, building_id, name, device_code, model, ip_address,
                latitude, longitude, fov_width, fov_height, installation_height,
                status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'online', ?, ?)
            RETURNING
                id,
                building_id,
                name,
                device_code,
                model,
                ip_address,
                latitude,
                longitude,
                fov_width,
                fov_height,
                installation_height,
                status,
                last_heartbeat,
                created_at,
                updated_at
            "#
        )
        .bind(id)
        .bind(data.building_id)
        .bind(&data.name)
        .bind(&data.device_code)
        .bind(&data.model)
        .bind(&data.ip_address)
        .bind(data.latitude)
        .bind(data.longitude)
        .bind(data.fov_width)
        .bind(data.fov_height)
        .bind(data.installation_height)
        .bind(now)
        .bind(now)
        .fetch_one(pool)
        .await
    }

    pub async fn get_by_id(
        pool: &DbPool,
        id: Uuid,
    ) -> Result<Option<ThermalDevice>, sqlx::Error> {
        sqlx::query_as::<_, ThermalDevice>(
            r#"
            SELECT
                id,
                building_id,
                name,
                device_code,
                model,
                ip_address,
                latitude,
                longitude,
                fov_width,
                fov_height,
                installation_height,
                status,
                last_heartbeat,
                created_at,
                updated_at
            FROM thermal_devices WHERE id = ?
            "#
        )
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    pub async fn list_by_building(
        pool: &DbPool,
        building_id: Uuid,
    ) -> Result<Vec<ThermalDevice>, sqlx::Error> {
        sqlx::query_as::<_, ThermalDevice>(
            r#"
            SELECT
                id,
                building_id,
                name,
                device_code,
                model,
                ip_address,
                latitude,
                longitude,
                fov_width,
                fov_height,
                installation_height,
                status,
                last_heartbeat,
                created_at,
                updated_at
            FROM thermal_devices WHERE building_id = ? ORDER BY created_at DESC
            "#
        )
        .bind(building_id)
        .fetch_all(pool)
        .await
    }

    pub async fn update_heartbeat(
        pool: &DbPool,
        id: Uuid,
        status: &str,
    ) -> Result<bool, sqlx::Error> {
        let now = Utc::now();
        let result = sqlx::query(
            r#"
            UPDATE thermal_devices
            SET status = ?, last_heartbeat = ?, updated_at = ?
            WHERE id = ?
            "#
        )
        .bind(status)
        .bind(now)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;
        Ok(result.rows_affected() > 0)
    }

    pub async fn delete(pool: &DbPool, id: Uuid) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("DELETE FROM thermal_devices WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }
}

pub mod thermal_data {
    use super::*;

    pub async fn list(pool: &DbPool, limit: i32) -> Result<Vec<ThermalData>, sqlx::Error> {
        sqlx::query_as::<_, ThermalData>(
            r#"
            SELECT
                id,
                device_id,
                building_id,
                timestamp,
                temperature_matrix,
                min_temp,
                max_temp,
                avg_temp,
                resolution_width,
                resolution_height,
                is_night,
                created_at
            FROM thermal_data ORDER BY timestamp DESC LIMIT ?
            "#
        )
        .bind(limit)
        .fetch_all(pool)
        .await
    }

    pub async fn list_by_building(
        pool: &DbPool,
        building_id: Uuid,
        limit: i32,
    ) -> Result<Vec<ThermalData>, sqlx::Error> {
        sqlx::query_as::<_, ThermalData>(
            r#"
            SELECT
                id,
                device_id,
                building_id,
                timestamp,
                temperature_matrix,
                min_temp,
                max_temp,
                avg_temp,
                resolution_width,
                resolution_height,
                is_night,
                created_at
            FROM thermal_data WHERE building_id = ? ORDER BY timestamp DESC LIMIT ?
            "#
        )
        .bind(building_id)
        .bind(limit)
        .fetch_all(pool)
        .await
    }

    pub async fn create(
        pool: &DbPool,
        data: CreateThermalData,
    ) -> Result<ThermalData, sqlx::Error> {
        let id = Uuid::new_v4();
        let now = Utc::now();
        sqlx::query_as::<_, ThermalData>(
            r#"
            INSERT INTO thermal_data (
                id, device_id, building_id, timestamp, temperature_matrix,
                min_temp, max_temp, avg_temp, resolution_width, resolution_height,
                is_night, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING
                id,
                device_id,
                building_id,
                timestamp,
                temperature_matrix,
                min_temp,
                max_temp,
                avg_temp,
                resolution_width,
                resolution_height,
                is_night,
                created_at
            "#
        )
        .bind(id)
        .bind(data.device_id)
        .bind(data.building_id)
        .bind(now)
        .bind(&data.temperature_matrix)
        .bind(data.min_temp)
        .bind(data.max_temp)
        .bind(data.avg_temp)
        .bind(data.resolution_width)
        .bind(data.resolution_height)
        .bind(data.is_night)
        .bind(now)
        .fetch_one(pool)
        .await
    }

    pub async fn get_by_id(
        pool: &DbPool,
        id: Uuid,
    ) -> Result<Option<ThermalData>, sqlx::Error> {
        sqlx::query_as::<_, ThermalData>(
            r#"
            SELECT
                id,
                device_id,
                building_id,
                timestamp,
                temperature_matrix,
                min_temp,
                max_temp,
                avg_temp,
                resolution_width,
                resolution_height,
                is_night,
                created_at
            FROM thermal_data WHERE id = ?
            "#
        )
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    pub async fn list_by_device(
        pool: &DbPool,
        device_id: Uuid,
        limit: i32,
    ) -> Result<Vec<ThermalData>, sqlx::Error> {
        sqlx::query_as::<_, ThermalData>(
            r#"
            SELECT
                id,
                device_id,
                building_id,
                timestamp,
                temperature_matrix,
                min_temp,
                max_temp,
                avg_temp,
                resolution_width,
                resolution_height,
                is_night,
                created_at
            FROM thermal_data WHERE device_id = ? ORDER BY timestamp DESC LIMIT ?
            "#
        )
        .bind(device_id)
        .bind(limit)
        .fetch_all(pool)
        .await
    }

    pub async fn list_by_building_time_range(
        pool: &DbPool,
        building_id: Uuid,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
    ) -> Result<Vec<ThermalData>, sqlx::Error> {
        sqlx::query_as::<_, ThermalData>(
            r#"
            SELECT
                id,
                device_id,
                building_id,
                timestamp,
                temperature_matrix,
                min_temp,
                max_temp,
                avg_temp,
                resolution_width,
                resolution_height,
                is_night,
                created_at
            FROM thermal_data
            WHERE building_id = ? AND timestamp >= ? AND timestamp <= ?
            ORDER BY timestamp DESC
            "#
        )
        .bind(building_id)
        .bind(start)
        .bind(end)
        .fetch_all(pool)
        .await
    }

    pub async fn delete(pool: &DbPool, id: Uuid) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("DELETE FROM thermal_data WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }
}

pub mod hotspots {
    use super::*;

    pub async fn list(pool: &DbPool, limit: i32) -> Result<Vec<Hotspot>, sqlx::Error> {
        sqlx::query_as::<_, Hotspot>(
            r#"
            SELECT
                id,
                thermal_data_id,
                building_id,
                device_id,
                timestamp,
                center_x,
                center_y,
                temperature,
                area,
                risk_level,
                status,
                description,
                created_at
            FROM hotspots ORDER BY timestamp DESC LIMIT ?
            "#
        )
        .bind(limit)
        .fetch_all(pool)
        .await
    }

    pub async fn create(pool: &DbPool, data: CreateHotspot) -> Result<Hotspot, sqlx::Error> {
        let id = Uuid::new_v4();
        let now = Utc::now();
        sqlx::query_as::<_, Hotspot>(
            r#"
            INSERT INTO hotspots (
                id, thermal_data_id, building_id, device_id, timestamp,
                center_x, center_y, temperature, area, risk_level,
                status, description, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'detected', ?, ?)
            RETURNING
                id,
                thermal_data_id,
                building_id,
                device_id,
                timestamp,
                center_x,
                center_y,
                temperature,
                area,
                risk_level,
                status,
                description,
                created_at
            "#
        )
        .bind(id)
        .bind(data.thermal_data_id)
        .bind(data.building_id)
        .bind(data.device_id)
        .bind(now)
        .bind(data.center_x)
        .bind(data.center_y)
        .bind(data.temperature)
        .bind(data.area)
        .bind(&data.risk_level)
        .bind(&data.description)
        .bind(now)
        .fetch_one(pool)
        .await
    }

    pub async fn get_by_id(pool: &DbPool, id: Uuid) -> Result<Option<Hotspot>, sqlx::Error> {
        sqlx::query_as::<_, Hotspot>(
            r#"
            SELECT
                id,
                thermal_data_id,
                building_id,
                device_id,
                timestamp,
                center_x,
                center_y,
                temperature,
                area,
                risk_level,
                status,
                description,
                created_at
            FROM hotspots WHERE id = ?
            "#
        )
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    pub async fn list_by_building(
        pool: &DbPool,
        building_id: Uuid,
        limit: i32,
    ) -> Result<Vec<Hotspot>, sqlx::Error> {
        sqlx::query_as::<_, Hotspot>(
            r#"
            SELECT
                id,
                thermal_data_id,
                building_id,
                device_id,
                timestamp,
                center_x,
                center_y,
                temperature,
                area,
                risk_level,
                status,
                description,
                created_at
            FROM hotspots WHERE building_id = ? ORDER BY timestamp DESC LIMIT ?
            "#
        )
        .bind(building_id)
        .bind(limit)
        .fetch_all(pool)
        .await
    }

    pub async fn list_by_risk(
        pool: &DbPool,
        risk_level: &str,
        limit: i32,
    ) -> Result<Vec<Hotspot>, sqlx::Error> {
        sqlx::query_as::<_, Hotspot>(
            r#"
            SELECT
                id,
                thermal_data_id,
                building_id,
                device_id,
                timestamp,
                center_x,
                center_y,
                temperature,
                area,
                risk_level,
                status,
                description,
                created_at
            FROM hotspots WHERE risk_level = ? ORDER BY timestamp DESC LIMIT ?
            "#
        )
        .bind(risk_level)
        .bind(limit)
        .fetch_all(pool)
        .await
    }

    pub async fn update_status(
        pool: &DbPool,
        id: Uuid,
        status: &str,
    ) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("UPDATE hotspots SET status = ? WHERE id = ?")
            .bind(status)
            .bind(id)
            .execute(pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }

    pub async fn delete(pool: &DbPool, id: Uuid) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("DELETE FROM hotspots WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }
}

pub mod patrol_personnel {
    use super::*;

    pub async fn create(
        pool: &DbPool,
        data: CreatePatrolPersonnel,
    ) -> Result<PatrolPersonnel, sqlx::Error> {
        let id = Uuid::new_v4();
        let now = Utc::now();
        sqlx::query_as::<_, PatrolPersonnel>(
            r#"
            INSERT INTO patrol_personnel (
                id, name, employee_id, phone, department, position,
                status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'idle', ?, ?)
            RETURNING
                id,
                name,
                employee_id,
                phone,
                department,
                position,
                status,
                last_location_lat,
                last_location_lng,
                last_location_time,
                created_at,
                updated_at
            "#
        )
        .bind(id)
        .bind(&data.name)
        .bind(&data.employee_id)
        .bind(&data.phone)
        .bind(&data.department)
        .bind(&data.position)
        .bind(now)
        .bind(now)
        .fetch_one(pool)
        .await
    }

    pub async fn get_by_id(
        pool: &DbPool,
        id: Uuid,
    ) -> Result<Option<PatrolPersonnel>, sqlx::Error> {
        sqlx::query_as::<_, PatrolPersonnel>(
            r#"
            SELECT
                id,
                name,
                employee_id,
                phone,
                department,
                position,
                status,
                last_location_lat,
                last_location_lng,
                last_location_time,
                created_at,
                updated_at
            FROM patrol_personnel WHERE id = ?
            "#
        )
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    pub async fn list(pool: &DbPool) -> Result<Vec<PatrolPersonnel>, sqlx::Error> {
        sqlx::query_as::<_, PatrolPersonnel>(
            r#"
            SELECT
                id,
                name,
                employee_id,
                phone,
                department,
                position,
                status,
                last_location_lat,
                last_location_lng,
                last_location_time,
                created_at,
                updated_at
            FROM patrol_personnel ORDER BY created_at DESC
            "#
        )
        .fetch_all(pool)
        .await
    }

    pub async fn update_status(
        pool: &DbPool,
        id: Uuid,
        status: &str,
    ) -> Result<bool, sqlx::Error> {
        let now = Utc::now();
        let result = sqlx::query(
            "UPDATE patrol_personnel SET status = ?, updated_at = ? WHERE id = ?"
        )
        .bind(status)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;
        Ok(result.rows_affected() > 0)
    }

    pub async fn update_location(
        pool: &DbPool,
        id: Uuid,
        lat: f64,
        lng: f64,
    ) -> Result<bool, sqlx::Error> {
        let now = Utc::now();
        let result = sqlx::query(
            r#"
            UPDATE patrol_personnel
            SET last_location_lat = ?, last_location_lng = ?, last_location_time = ?, updated_at = ?
            WHERE id = ?
            "#
        )
        .bind(lat)
        .bind(lng)
        .bind(now)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;
        Ok(result.rows_affected() > 0)
    }

    pub async fn delete(pool: &DbPool, id: Uuid) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("DELETE FROM patrol_personnel WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }
}

pub mod patrol_locations {
    use super::*;

    pub async fn create(
        pool: &DbPool,
        data: CreatePatrolLocation,
    ) -> Result<PatrolLocation, sqlx::Error> {
        let id = Uuid::new_v4();
        let now = Utc::now();
        sqlx::query_as::<_, PatrolLocation>(
            r#"
            INSERT INTO patrol_locations (
                id, personnel_id, latitude, longitude, timestamp,
                accuracy, battery_level, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING
                id,
                personnel_id,
                latitude,
                longitude,
                timestamp,
                accuracy,
                battery_level,
                created_at
            "#
        )
        .bind(id)
        .bind(data.personnel_id)
        .bind(data.latitude)
        .bind(data.longitude)
        .bind(now)
        .bind(data.accuracy)
        .bind(data.battery_level)
        .bind(now)
        .fetch_one(pool)
        .await
    }

    pub async fn get_by_id(
        pool: &DbPool,
        id: Uuid,
    ) -> Result<Option<PatrolLocation>, sqlx::Error> {
        sqlx::query_as::<_, PatrolLocation>(
            r#"
            SELECT
                id,
                personnel_id,
                latitude,
                longitude,
                timestamp,
                accuracy,
                battery_level,
                created_at
            FROM patrol_locations WHERE id = ?
            "#
        )
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    pub async fn list_by_personnel(
        pool: &DbPool,
        personnel_id: Uuid,
        limit: i32,
    ) -> Result<Vec<PatrolLocation>, sqlx::Error> {
        sqlx::query_as::<_, PatrolLocation>(
            r#"
            SELECT
                id,
                personnel_id,
                latitude,
                longitude,
                timestamp,
                accuracy,
                battery_level,
                created_at
            FROM patrol_locations WHERE personnel_id = ? ORDER BY timestamp DESC LIMIT ?
            "#
        )
        .bind(personnel_id)
        .bind(limit)
        .fetch_all(pool)
        .await
    }

    pub async fn list_by_personnel_time_range(
        pool: &DbPool,
        personnel_id: Uuid,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
    ) -> Result<Vec<PatrolLocation>, sqlx::Error> {
        sqlx::query_as::<_, PatrolLocation>(
            r#"
            SELECT
                id,
                personnel_id,
                latitude,
                longitude,
                timestamp,
                accuracy,
                battery_level,
                created_at
            FROM patrol_locations
            WHERE personnel_id = ? AND timestamp >= ? AND timestamp <= ?
            ORDER BY timestamp DESC
            "#
        )
        .bind(personnel_id)
        .bind(start)
        .bind(end)
        .fetch_all(pool)
        .await
    }

    pub async fn delete(pool: &DbPool, id: Uuid) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("DELETE FROM patrol_locations WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }
}

pub mod alerts {
    use super::*;
    use crate::models::Alert;

    pub async fn create(pool: &DbPool, data: CreateAlert) -> Result<Alert, sqlx::Error> {
        let id = Uuid::new_v4();
        let now = Utc::now();
        sqlx::query_as::<_, Alert>(
            r#"
            INSERT INTO alerts (
                id, hotspot_id, building_id, alert_type, title, description,
                severity, status, latitude, longitude, escalation_level,
                ack_timeout_minutes, resolve_timeout_minutes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, 0, 30, 120, ?, ?)
            RETURNING
                id,
                hotspot_id,
                building_id,
                alert_type,
                title,
                description,
                severity,
                status,
                latitude,
                longitude,
                acknowledged_by,
                acknowledged_at,
                resolved_by,
                resolved_at,
                dispatched_to,
                dispatched_at,
                arrived_at,
                handling_notes,
                escalation_level,
                ack_timeout_minutes,
                resolve_timeout_minutes,
                created_at,
                updated_at
            "#
        )
        .bind(id)
        .bind(data.hotspot_id)
        .bind(data.building_id)
        .bind(&data.alert_type)
        .bind(&data.title)
        .bind(&data.description)
        .bind(&data.severity)
        .bind(data.latitude)
        .bind(data.longitude)
        .bind(now)
        .bind(now)
        .fetch_one(pool)
        .await
    }

    pub async fn get_by_id(pool: &DbPool, id: Uuid) -> Result<Option<Alert>, sqlx::Error> {
        sqlx::query_as::<_, Alert>(
            r#"
            SELECT
                id,
                hotspot_id,
                building_id,
                alert_type,
                title,
                description,
                severity,
                status,
                latitude,
                longitude,
                acknowledged_by,
                acknowledged_at,
                resolved_by,
                resolved_at,
                dispatched_to,
                dispatched_at,
                arrived_at,
                handling_notes,
                escalation_level,
                ack_timeout_minutes,
                resolve_timeout_minutes,
                created_at,
                updated_at
            FROM alerts WHERE id = ?
            "#
        )
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    pub async fn list(pool: &DbPool, limit: i32) -> Result<Vec<Alert>, sqlx::Error> {
        sqlx::query_as::<_, Alert>(
            r#"
            SELECT
                id,
                hotspot_id,
                building_id,
                alert_type,
                title,
                description,
                severity,
                status,
                latitude,
                longitude,
                acknowledged_by,
                acknowledged_at,
                resolved_by,
                resolved_at,
                dispatched_to,
                dispatched_at,
                arrived_at,
                handling_notes,
                escalation_level,
                ack_timeout_minutes,
                resolve_timeout_minutes,
                created_at,
                updated_at
            FROM alerts ORDER BY created_at DESC LIMIT ?
            "#
        )
        .bind(limit)
        .fetch_all(pool)
        .await
    }

    pub async fn list_by_building(
        pool: &DbPool,
        building_id: Uuid,
        limit: i32,
    ) -> Result<Vec<Alert>, sqlx::Error> {
        sqlx::query_as::<_, Alert>(
            r#"
            SELECT
                id,
                hotspot_id,
                building_id,
                alert_type,
                title,
                description,
                severity,
                status,
                latitude,
                longitude,
                acknowledged_by,
                acknowledged_at,
                resolved_by,
                resolved_at,
                dispatched_to,
                dispatched_at,
                arrived_at,
                handling_notes,
                escalation_level,
                ack_timeout_minutes,
                resolve_timeout_minutes,
                created_at,
                updated_at
            FROM alerts WHERE building_id = ? ORDER BY created_at DESC LIMIT ?
            "#
        )
        .bind(building_id)
        .bind(limit)
        .fetch_all(pool)
        .await
    }

    pub async fn list_by_status(
        pool: &DbPool,
        status: &str,
        limit: i32,
    ) -> Result<Vec<Alert>, sqlx::Error> {
        sqlx::query_as::<_, Alert>(
            r#"
            SELECT
                id,
                hotspot_id,
                building_id,
                alert_type,
                title,
                description,
                severity,
                status,
                latitude,
                longitude,
                acknowledged_by,
                acknowledged_at,
                resolved_by,
                resolved_at,
                dispatched_to,
                dispatched_at,
                arrived_at,
                handling_notes,
                escalation_level,
                ack_timeout_minutes,
                resolve_timeout_minutes,
                created_at,
                updated_at
            FROM alerts WHERE status = ? ORDER BY created_at DESC LIMIT ?
            "#
        )
        .bind(status)
        .bind(limit)
        .fetch_all(pool)
        .await
    }

    pub async fn acknowledge(
        pool: &DbPool,
        id: Uuid,
        personnel_id: Uuid,
    ) -> Result<bool, sqlx::Error> {
        let now = Utc::now();
        let result = sqlx::query(
            r#"
            UPDATE alerts
            SET status = 'acknowledged', acknowledged_by = ?, acknowledged_at = ?, updated_at = ?
            WHERE id = ?
            "#
        )
        .bind(personnel_id)
        .bind(now)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;
        Ok(result.rows_affected() > 0)
    }

    pub async fn dispatch(
        pool: &DbPool,
        alert_id: Uuid,
        personnel_id: Uuid,
        reason: &str,
    ) -> Result<AlertDispatch, sqlx::Error> {
        let now = Utc::now();
        let dispatch = alert_dispatches::create(
            pool,
            CreateAlertDispatch {
                alert_id,
                dispatched_by: None,
                dispatched_to: personnel_id,
                dispatch_reason: reason.to_string(),
            },
        )
        .await?;
        sqlx::query(
            r#"
            UPDATE alerts
            SET dispatched_to = ?, dispatched_at = ?, status = 'dispatched', updated_at = ?
            WHERE id = ?
            "#
        )
        .bind(personnel_id)
        .bind(now)
        .bind(now)
        .bind(alert_id)
        .execute(pool)
        .await?;
        Ok(dispatch)
    }

    pub async fn arrive(
        pool: &DbPool,
        alert_id: Uuid,
    ) -> Result<bool, sqlx::Error> {
        let now = Utc::now();
        let result = sqlx::query(
            r#"
            UPDATE alerts
            SET arrived_at = ?, status = 'handling', updated_at = ?
            WHERE id = ?
            "#
        )
        .bind(now)
        .bind(now)
        .bind(alert_id)
        .execute(pool)
        .await?;
        Ok(result.rows_affected() > 0)
    }

    pub async fn escalate(
        pool: &DbPool,
        alert_id: Uuid,
        new_level: i32,
        reason: &str,
        notified_person_id: Option<Uuid>,
    ) -> Result<AlertEscalation, sqlx::Error> {
        let alert = get_by_id(pool, alert_id)
            .await?
            .ok_or_else(|| sqlx::Error::RowNotFound)?;
        let previous_level = alert.escalation_level;
        let escalation = alert_escalations::create(
            pool,
            CreateAlertEscalation {
                alert_id,
                previous_level,
                new_level,
                escalation_reason: reason.to_string(),
                notified_person_id,
            },
        )
        .await?;
        let now = Utc::now();
        sqlx::query(
            r#"
            UPDATE alerts
            SET escalation_level = ?, updated_at = ?
            WHERE id = ?
            "#
        )
        .bind(new_level)
        .bind(now)
        .bind(alert_id)
        .execute(pool)
        .await?;
        Ok(escalation)
    }

    pub async fn resolve(
        pool: &DbPool,
        id: Uuid,
        personnel_id: Uuid,
    ) -> Result<bool, sqlx::Error> {
        let now = Utc::now();
        let result = sqlx::query(
            r#"
            UPDATE alerts
            SET status = 'resolved', resolved_by = ?, resolved_at = ?, updated_at = ?
            WHERE id = ?
            "#
        )
        .bind(personnel_id)
        .bind(now)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;
        Ok(result.rows_affected() > 0)
    }

    pub async fn delete(pool: &DbPool, id: Uuid) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("DELETE FROM alerts WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }
}

pub mod responsible_persons {
    use super::*;

    pub async fn list(pool: &DbPool) -> Result<Vec<ResponsiblePerson>, sqlx::Error> {
        sqlx::query_as::<_, ResponsiblePerson>(
            r#"
            SELECT
                id,
                building_id,
                name,
                position,
                phone,
                email,
                responsibility,
                is_active,
                start_date,
                end_date,
                created_at,
                updated_at
            FROM responsible_persons ORDER BY is_active DESC, created_at DESC
            "#
        )
        .fetch_all(pool)
        .await
    }

    pub async fn create(
        pool: &DbPool,
        data: CreateResponsiblePerson,
    ) -> Result<ResponsiblePerson, sqlx::Error> {
        let id = Uuid::new_v4();
        let now = Utc::now();
        sqlx::query_as::<_, ResponsiblePerson>(
            r#"
            INSERT INTO responsible_persons (
                id, building_id, name, position, phone, email,
                responsibility, is_active, start_date, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
            RETURNING
                id,
                building_id,
                name,
                position,
                phone,
                email,
                responsibility,
                is_active,
                start_date,
                end_date,
                created_at,
                updated_at
            "#
        )
        .bind(id)
        .bind(data.building_id)
        .bind(&data.name)
        .bind(&data.position)
        .bind(&data.phone)
        .bind(&data.email)
        .bind(&data.responsibility)
        .bind(now)
        .bind(now)
        .bind(now)
        .fetch_one(pool)
        .await
    }

    pub async fn get_by_id(
        pool: &DbPool,
        id: Uuid,
    ) -> Result<Option<ResponsiblePerson>, sqlx::Error> {
        sqlx::query_as::<_, ResponsiblePerson>(
            r#"
            SELECT
                id,
                building_id,
                name,
                position,
                phone,
                email,
                responsibility,
                is_active,
                start_date,
                end_date,
                created_at,
                updated_at
            FROM responsible_persons WHERE id = ?
            "#
        )
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    pub async fn list_by_building(
        pool: &DbPool,
        building_id: Uuid,
    ) -> Result<Vec<ResponsiblePerson>, sqlx::Error> {
        sqlx::query_as::<_, ResponsiblePerson>(
            r#"
            SELECT
                id,
                building_id,
                name,
                position,
                phone,
                email,
                responsibility,
                is_active,
                start_date,
                end_date,
                created_at,
                updated_at
            FROM responsible_persons WHERE building_id = ? ORDER BY is_active DESC, created_at DESC
            "#
        )
        .bind(building_id)
        .fetch_all(pool)
        .await
    }

    pub async fn list_active_by_building(
        pool: &DbPool,
        building_id: Uuid,
    ) -> Result<Vec<ResponsiblePerson>, sqlx::Error> {
        sqlx::query_as::<_, ResponsiblePerson>(
            r#"
            SELECT
                id,
                building_id,
                name,
                position,
                phone,
                email,
                responsibility,
                is_active,
                start_date,
                end_date,
                created_at,
                updated_at
            FROM responsible_persons WHERE building_id = ? AND is_active = 1 ORDER BY created_at DESC
            "#
        )
        .bind(building_id)
        .fetch_all(pool)
        .await
    }

    pub async fn deactivate(pool: &DbPool, id: Uuid) -> Result<bool, sqlx::Error> {
        let now = Utc::now();
        let result = sqlx::query(
            r#"
            UPDATE responsible_persons
            SET is_active = 0, end_date = ?, updated_at = ?
            WHERE id = ?
            "#
        )
        .bind(now)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;
        Ok(result.rows_affected() > 0)
    }

    pub async fn delete(pool: &DbPool, id: Uuid) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("DELETE FROM responsible_persons WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }
}

pub mod high_risk_stats {
    use super::*;

    pub async fn create_or_update(
        pool: &DbPool,
        building_id: Uuid,
        hour_of_day: i32,
        date: DateTime<Utc>,
        alert_count: i32,
        hotspot_count: i32,
        avg_max_temp: f64,
    ) -> Result<HighRiskStats, sqlx::Error> {
        let id = Uuid::new_v4();
        let now = Utc::now();

        sqlx::query_as::<_, HighRiskStats>(
            r#"
            INSERT INTO high_risk_stats (
                id, building_id, hour_of_day, date, alert_count, hotspot_count, avg_max_temp, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(building_id, date, hour_of_day) DO UPDATE SET
                alert_count = excluded.alert_count,
                hotspot_count = excluded.hotspot_count,
                avg_max_temp = excluded.avg_max_temp
            RETURNING
                id,
                building_id,
                hour_of_day,
                date,
                alert_count,
                hotspot_count,
                avg_max_temp,
                created_at
            "#
        )
        .bind(id)
        .bind(building_id)
        .bind(hour_of_day)
        .bind(date)
        .bind(alert_count)
        .bind(hotspot_count)
        .bind(avg_max_temp)
        .bind(now)
        .fetch_one(pool)
        .await
    }

    pub async fn get_by_id(
        pool: &DbPool,
        id: Uuid,
    ) -> Result<Option<HighRiskStats>, sqlx::Error> {
        sqlx::query_as::<_, HighRiskStats>(
            r#"
            SELECT
                id,
                building_id,
                hour_of_day,
                date,
                alert_count,
                hotspot_count,
                avg_max_temp,
                created_at
            FROM high_risk_stats WHERE id = ?
            "#
        )
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    pub async fn list_by_building(
        pool: &DbPool,
        building_id: Uuid,
        limit: i32,
    ) -> Result<Vec<HighRiskStats>, sqlx::Error> {
        sqlx::query_as::<_, HighRiskStats>(
            r#"
            SELECT
                id,
                building_id,
                hour_of_day,
                date,
                alert_count,
                hotspot_count,
                avg_max_temp,
                created_at
            FROM high_risk_stats WHERE building_id = ? ORDER BY date DESC, hour_of_day DESC LIMIT ?
            "#
        )
        .bind(building_id)
        .bind(limit)
        .fetch_all(pool)
        .await
    }

    pub async fn list_by_building_time_range(
        pool: &DbPool,
        building_id: Uuid,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
    ) -> Result<Vec<HighRiskStats>, sqlx::Error> {
        sqlx::query_as::<_, HighRiskStats>(
            r#"
            SELECT
                id,
                building_id,
                hour_of_day,
                date,
                alert_count,
                hotspot_count,
                avg_max_temp,
                created_at
            FROM high_risk_stats
            WHERE building_id = ? AND date >= ? AND date <= ?
            ORDER BY date DESC, hour_of_day DESC
            "#
        )
        .bind(building_id)
        .bind(start)
        .bind(end)
        .fetch_all(pool)
        .await
    }

    pub async fn aggregate_by_hour(
        pool: &DbPool,
        building_id: Uuid,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
    ) -> Result<Vec<RiskStatsSummary>, sqlx::Error> {
        let rows = sqlx::query(
            r#"
            SELECT
                hour_of_day,
                CAST(SUM(alert_count) AS INTEGER) as total_alerts,
                CAST(SUM(hotspot_count) AS INTEGER) as total_hotspots,
                AVG(avg_max_temp) as avg_max_temp
            FROM high_risk_stats
            WHERE building_id = ? AND date >= ? AND date <= ?
            GROUP BY hour_of_day
            ORDER BY hour_of_day
            "#
        )
        .bind(building_id)
        .bind(start)
        .bind(end)
        .fetch_all(pool)
        .await?;

        let mut result = Vec::new();
        for row in rows {
            result.push(RiskStatsSummary {
                hour_of_day: row.try_get("hour_of_day")?,
                total_alerts: row.try_get("total_alerts")?,
                total_hotspots: row.try_get("total_hotspots")?,
                avg_max_temp: row.try_get("avg_max_temp")?,
            });
        }
        Ok(result)
    }

    pub async fn get_daily_summary(
        pool: &DbPool,
        building_id: Uuid,
        date: DateTime<Utc>,
    ) -> Result<Vec<RiskStatsSummary>, sqlx::Error> {
        let rows = sqlx::query(
            r#"
            SELECT
                hour_of_day,
                CAST(SUM(alert_count) AS INTEGER) as total_alerts,
                CAST(SUM(hotspot_count) AS INTEGER) as total_hotspots,
                AVG(avg_max_temp) as avg_max_temp
            FROM high_risk_stats
            WHERE building_id = ? AND date(date) = date(?)
            GROUP BY hour_of_day
            ORDER BY hour_of_day
            "#
        )
        .bind(building_id)
        .bind(date)
        .fetch_all(pool)
        .await?;

        let mut result = Vec::new();
        for row in rows {
            result.push(RiskStatsSummary {
                hour_of_day: row.try_get("hour_of_day")?,
                total_alerts: row.try_get("total_alerts")?,
                total_hotspots: row.try_get("total_hotspots")?,
                avg_max_temp: row.try_get("avg_max_temp")?,
            });
        }
        Ok(result)
    }

    pub async fn delete(pool: &DbPool, id: Uuid) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("DELETE FROM high_risk_stats WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }

    pub async fn aggregate_all_by_hour(
        pool: &DbPool,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
    ) -> Result<Vec<RiskStatsSummary>, sqlx::Error> {
        let rows = sqlx::query(
            r#"
            SELECT
                hour_of_day,
                CAST(SUM(alert_count) AS INTEGER) as total_alerts,
                CAST(SUM(hotspot_count) AS INTEGER) as total_hotspots,
                AVG(avg_max_temp) as avg_max_temp
            FROM high_risk_stats
            WHERE date >= ? AND date <= ?
            GROUP BY hour_of_day
            ORDER BY hour_of_day
            "#
        )
        .bind(start)
        .bind(end)
        .fetch_all(pool)
        .await?;

        let mut result = Vec::new();
        for row in rows {
            result.push(RiskStatsSummary {
                hour_of_day: row.try_get("hour_of_day")?,
                total_alerts: row.try_get("total_alerts")?,
                total_hotspots: row.try_get("total_hotspots")?,
                avg_max_temp: row.try_get("avg_max_temp")?,
            });
        }
        Ok(result)
    }

    pub async fn get_daily_summary_all(
        pool: &DbPool,
        date: DateTime<Utc>,
    ) -> Result<Vec<RiskStatsSummary>, sqlx::Error> {
        let rows = sqlx::query(
            r#"
            SELECT
                hour_of_day,
                CAST(SUM(alert_count) AS INTEGER) as total_alerts,
                CAST(SUM(hotspot_count) AS INTEGER) as total_hotspots,
                AVG(avg_max_temp) as avg_max_temp
            FROM high_risk_stats
            WHERE date(date) = date(?)
            GROUP BY hour_of_day
            ORDER BY hour_of_day
            "#
        )
        .bind(date)
        .fetch_all(pool)
        .await?;

        let mut result = Vec::new();
        for row in rows {
            result.push(RiskStatsSummary {
                hour_of_day: row.try_get("hour_of_day")?,
                total_alerts: row.try_get("total_alerts")?,
                total_hotspots: row.try_get("total_hotspots")?,
                avg_max_temp: row.try_get("avg_max_temp")?,
            });
        }
        Ok(result)
    }
}

pub mod alert_playback {
    use super::*;
    use crate::models::AlertPlayback;

    pub async fn create(
        pool: &DbPool,
        alert_id: Uuid,
        thermal_data_id: Option<Uuid>,
        playback_data: String,
        duration_seconds: i32,
    ) -> Result<AlertPlayback, sqlx::Error> {
        let id = Uuid::new_v4();
        let now = Utc::now();
        sqlx::query_as::<_, AlertPlayback>(
            r#"
            INSERT INTO alert_playback (
                id, alert_id, thermal_data_id, playback_data, duration_seconds, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            RETURNING
                id,
                alert_id,
                thermal_data_id,
                playback_data,
                duration_seconds,
                created_at
            "#
        )
        .bind(id)
        .bind(alert_id)
        .bind(thermal_data_id)
        .bind(&playback_data)
        .bind(duration_seconds)
        .bind(now)
        .fetch_one(pool)
        .await
    }

    pub async fn get_by_alert_id(
        pool: &DbPool,
        alert_id: Uuid,
    ) -> Result<Option<AlertPlayback>, sqlx::Error> {
        sqlx::query_as::<_, AlertPlayback>(
            r#"
            SELECT
                id,
                alert_id,
                thermal_data_id,
                playback_data,
                duration_seconds,
                created_at
            FROM alert_playback WHERE alert_id = ?
            "#
        )
        .bind(alert_id)
        .fetch_optional(pool)
        .await
    }
}

pub mod alert_dispatches {
    use super::*;

    pub async fn create(pool: &DbPool, data: CreateAlertDispatch) -> Result<AlertDispatch, sqlx::Error> {
        let id = Uuid::new_v4();
        let now = Utc::now();
        sqlx::query_as::<_, AlertDispatch>(
            r#"
            INSERT INTO alert_dispatches (
                id, alert_id, dispatched_by, dispatched_to, dispatch_reason,
                status, dispatched_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)
            RETURNING
                id,
                alert_id,
                dispatched_by,
                dispatched_to,
                dispatch_reason,
                status,
                dispatched_at,
                accepted_at,
                arrived_at,
                handled_at,
                closed_at,
                handling_notes,
                created_at,
                updated_at
            "#
        )
        .bind(id)
        .bind(data.alert_id)
        .bind(data.dispatched_by)
        .bind(data.dispatched_to)
        .bind(&data.dispatch_reason)
        .bind(now)
        .bind(now)
        .bind(now)
        .fetch_one(pool)
        .await
    }

    pub async fn get_by_id(pool: &DbPool, id: Uuid) -> Result<Option<AlertDispatch>, sqlx::Error> {
        sqlx::query_as::<_, AlertDispatch>(
            r#"
            SELECT
                id,
                alert_id,
                dispatched_by,
                dispatched_to,
                dispatch_reason,
                status,
                dispatched_at,
                accepted_at,
                arrived_at,
                handled_at,
                closed_at,
                handling_notes,
                created_at,
                updated_at
            FROM alert_dispatches WHERE id = ?
            "#
        )
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    pub async fn list_by_alert(pool: &DbPool, alert_id: Uuid) -> Result<Vec<AlertDispatch>, sqlx::Error> {
        sqlx::query_as::<_, AlertDispatch>(
            r#"
            SELECT
                id,
                alert_id,
                dispatched_by,
                dispatched_to,
                dispatch_reason,
                status,
                dispatched_at,
                accepted_at,
                arrived_at,
                handled_at,
                closed_at,
                handling_notes,
                created_at,
                updated_at
            FROM alert_dispatches WHERE alert_id = ? ORDER BY dispatched_at DESC
            "#
        )
        .bind(alert_id)
        .fetch_all(pool)
        .await
    }

    pub async fn list_by_personnel(pool: &DbPool, personnel_id: Uuid) -> Result<Vec<AlertDispatch>, sqlx::Error> {
        sqlx::query_as::<_, AlertDispatch>(
            r#"
            SELECT
                id,
                alert_id,
                dispatched_by,
                dispatched_to,
                dispatch_reason,
                status,
                dispatched_at,
                accepted_at,
                arrived_at,
                handled_at,
                closed_at,
                handling_notes,
                created_at,
                updated_at
            FROM alert_dispatches WHERE dispatched_to = ? ORDER BY dispatched_at DESC
            "#
        )
        .bind(personnel_id)
        .fetch_all(pool)
        .await
    }

    pub async fn list(pool: &DbPool, limit: i32) -> Result<Vec<AlertDispatch>, sqlx::Error> {
        sqlx::query_as::<_, AlertDispatch>(
            r#"
            SELECT
                id,
                alert_id,
                dispatched_by,
                dispatched_to,
                dispatch_reason,
                status,
                dispatched_at,
                accepted_at,
                arrived_at,
                handled_at,
                closed_at,
                handling_notes,
                created_at,
                updated_at
            FROM alert_dispatches ORDER BY dispatched_at DESC LIMIT ?
            "#
        )
        .bind(limit)
        .fetch_all(pool)
        .await
    }

    pub async fn accept(pool: &DbPool, id: Uuid) -> Result<Option<AlertDispatch>, sqlx::Error> {
        let now = Utc::now();
        sqlx::query_as::<_, AlertDispatch>(
            r#"
            UPDATE alert_dispatches
            SET status = 'accepted', accepted_at = ?, updated_at = ?
            WHERE id = ?
            RETURNING
                id,
                alert_id,
                dispatched_by,
                dispatched_to,
                dispatch_reason,
                status,
                dispatched_at,
                accepted_at,
                arrived_at,
                handled_at,
                closed_at,
                handling_notes,
                created_at,
                updated_at
            "#
        )
        .bind(now)
        .bind(now)
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    pub async fn arrive(pool: &DbPool, id: Uuid, notes: Option<String>) -> Result<Option<AlertDispatch>, sqlx::Error> {
        let now = Utc::now();
        sqlx::query_as::<_, AlertDispatch>(
            r#"
            UPDATE alert_dispatches
            SET status = 'arrived', arrived_at = ?, handling_notes = COALESCE(?, handling_notes), updated_at = ?
            WHERE id = ?
            RETURNING
                id,
                alert_id,
                dispatched_by,
                dispatched_to,
                dispatch_reason,
                status,
                dispatched_at,
                accepted_at,
                arrived_at,
                handled_at,
                closed_at,
                handling_notes,
                created_at,
                updated_at
            "#
        )
        .bind(now)
        .bind(notes)
        .bind(now)
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    pub async fn handle(pool: &DbPool, id: Uuid, notes: Option<String>) -> Result<Option<AlertDispatch>, sqlx::Error> {
        let now = Utc::now();
        sqlx::query_as::<_, AlertDispatch>(
            r#"
            UPDATE alert_dispatches
            SET status = 'handled', handled_at = ?, handling_notes = COALESCE(?, handling_notes), updated_at = ?
            WHERE id = ?
            RETURNING
                id,
                alert_id,
                dispatched_by,
                dispatched_to,
                dispatch_reason,
                status,
                dispatched_at,
                accepted_at,
                arrived_at,
                handled_at,
                closed_at,
                handling_notes,
                created_at,
                updated_at
            "#
        )
        .bind(now)
        .bind(notes)
        .bind(now)
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    pub async fn close(pool: &DbPool, id: Uuid, notes: Option<String>) -> Result<Option<AlertDispatch>, sqlx::Error> {
        let now = Utc::now();
        sqlx::query_as::<_, AlertDispatch>(
            r#"
            UPDATE alert_dispatches
            SET status = 'closed', closed_at = ?, handling_notes = COALESCE(?, handling_notes), updated_at = ?
            WHERE id = ?
            RETURNING
                id,
                alert_id,
                dispatched_by,
                dispatched_to,
                dispatch_reason,
                status,
                dispatched_at,
                accepted_at,
                arrived_at,
                handled_at,
                closed_at,
                handling_notes,
                created_at,
                updated_at
            "#
        )
        .bind(now)
        .bind(notes)
        .bind(now)
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    pub async fn update_status(pool: &DbPool, id: Uuid, status: &str, notes: Option<String>) -> Result<Option<AlertDispatch>, sqlx::Error> {
        let now = Utc::now();
        sqlx::query_as::<_, AlertDispatch>(
            r#"
            UPDATE alert_dispatches
            SET status = ?, handling_notes = COALESCE(?, handling_notes), updated_at = ?
            WHERE id = ?
            RETURNING
                id,
                alert_id,
                dispatched_by,
                dispatched_to,
                dispatch_reason,
                status,
                dispatched_at,
                accepted_at,
                arrived_at,
                handled_at,
                closed_at,
                handling_notes,
                created_at,
                updated_at
            "#
        )
        .bind(status)
        .bind(notes)
        .bind(now)
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    pub async fn delete(pool: &DbPool, id: Uuid) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("DELETE FROM alert_dispatches WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }
}

pub mod patrol_tasks {
    use super::*;
    use chrono::{Datelike, Timelike};

    pub async fn create(pool: &DbPool, data: CreatePatrolTask) -> Result<PatrolTask, sqlx::Error> {
        let id = Uuid::new_v4();
        let now = Utc::now();
        let risk_level = data.risk_level.unwrap_or_else(|| "medium".to_string());
        sqlx::query_as::<_, PatrolTask>(
            r#"
            INSERT INTO patrol_tasks (
                id, building_id, personnel_id, task_name, task_type, risk_level,
                scheduled_start, scheduled_end, status, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
            RETURNING
                id,
                building_id,
                personnel_id,
                task_name,
                task_type,
                risk_level,
                scheduled_start,
                scheduled_end,
                status,
                started_at,
                completed_at,
                inspection_result,
                findings,
                completed_risk_level,
                notes,
                created_at,
                updated_at
            "#
        )
        .bind(id)
        .bind(data.building_id)
        .bind(data.personnel_id)
        .bind(&data.task_name)
        .bind(&data.task_type)
        .bind(&risk_level)
        .bind(data.scheduled_start)
        .bind(data.scheduled_end)
        .bind(&data.notes)
        .bind(now)
        .bind(now)
        .fetch_one(pool)
        .await
    }

    pub async fn get_by_id(pool: &DbPool, id: Uuid) -> Result<Option<PatrolTask>, sqlx::Error> {
        sqlx::query_as::<_, PatrolTask>(
            r#"
            SELECT
                id,
                building_id,
                personnel_id,
                task_name,
                task_type,
                risk_level,
                scheduled_start,
                scheduled_end,
                status,
                started_at,
                completed_at,
                inspection_result,
                findings,
                completed_risk_level,
                notes,
                created_at,
                updated_at
            FROM patrol_tasks WHERE id = ?
            "#
        )
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    pub async fn list_by_building(pool: &DbPool, building_id: Uuid) -> Result<Vec<PatrolTask>, sqlx::Error> {
        sqlx::query_as::<_, PatrolTask>(
            r#"
            SELECT
                id,
                building_id,
                personnel_id,
                task_name,
                task_type,
                risk_level,
                scheduled_start,
                scheduled_end,
                status,
                started_at,
                completed_at,
                inspection_result,
                findings,
                completed_risk_level,
                notes,
                created_at,
                updated_at
            FROM patrol_tasks WHERE building_id = ? ORDER BY scheduled_start DESC
            "#
        )
        .bind(building_id)
        .fetch_all(pool)
        .await
    }

    pub async fn list_by_personnel(pool: &DbPool, personnel_id: Uuid) -> Result<Vec<PatrolTask>, sqlx::Error> {
        sqlx::query_as::<_, PatrolTask>(
            r#"
            SELECT
                id,
                building_id,
                personnel_id,
                task_name,
                task_type,
                risk_level,
                scheduled_start,
                scheduled_end,
                status,
                started_at,
                completed_at,
                inspection_result,
                findings,
                completed_risk_level,
                notes,
                created_at,
                updated_at
            FROM patrol_tasks WHERE personnel_id = ? ORDER BY scheduled_start DESC
            "#
        )
        .bind(personnel_id)
        .fetch_all(pool)
        .await
    }

    pub async fn list_by_status(pool: &DbPool, status: &str) -> Result<Vec<PatrolTask>, sqlx::Error> {
        sqlx::query_as::<_, PatrolTask>(
            r#"
            SELECT
                id,
                building_id,
                personnel_id,
                task_name,
                task_type,
                risk_level,
                scheduled_start,
                scheduled_end,
                status,
                started_at,
                completed_at,
                inspection_result,
                findings,
                completed_risk_level,
                notes,
                created_at,
                updated_at
            FROM patrol_tasks WHERE status = ? ORDER BY scheduled_start DESC
            "#
        )
        .bind(status)
        .fetch_all(pool)
        .await
    }

    pub async fn list(pool: &DbPool, limit: i32) -> Result<Vec<PatrolTask>, sqlx::Error> {
        sqlx::query_as::<_, PatrolTask>(
            r#"
            SELECT
                id,
                building_id,
                personnel_id,
                task_name,
                task_type,
                risk_level,
                scheduled_start,
                scheduled_end,
                status,
                started_at,
                completed_at,
                inspection_result,
                findings,
                completed_risk_level,
                notes,
                created_at,
                updated_at
            FROM patrol_tasks ORDER BY scheduled_start DESC LIMIT ?
            "#
        )
        .bind(limit)
        .fetch_all(pool)
        .await
    }

    pub async fn start(pool: &DbPool, id: Uuid) -> Result<Option<PatrolTask>, sqlx::Error> {
        let now = Utc::now();
        sqlx::query_as::<_, PatrolTask>(
            r#"
            UPDATE patrol_tasks
            SET status = 'in_progress', started_at = ?, updated_at = ?
            WHERE id = ?
            RETURNING
                id,
                building_id,
                personnel_id,
                task_name,
                task_type,
                risk_level,
                scheduled_start,
                scheduled_end,
                status,
                started_at,
                completed_at,
                inspection_result,
                findings,
                completed_risk_level,
                notes,
                created_at,
                updated_at
            "#
        )
        .bind(now)
        .bind(now)
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    pub async fn complete(
        pool: &DbPool,
        id: Uuid,
        data: CompletePatrolTask,
    ) -> Result<Option<PatrolTask>, sqlx::Error> {
        let now = Utc::now();
        sqlx::query_as::<_, PatrolTask>(
            r#"
            UPDATE patrol_tasks
            SET status = 'completed', completed_at = ?, inspection_result = ?, findings = ?, completed_risk_level = ?, updated_at = ?
            WHERE id = ?
            RETURNING
                id,
                building_id,
                personnel_id,
                task_name,
                task_type,
                risk_level,
                scheduled_start,
                scheduled_end,
                status,
                started_at,
                completed_at,
                inspection_result,
                findings,
                completed_risk_level,
                notes,
                created_at,
                updated_at
            "#
        )
        .bind(now)
        .bind(&data.inspection_result)
        .bind(&data.findings)
        .bind(&data.completed_risk_level)
        .bind(now)
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    pub async fn update(
        pool: &DbPool,
        id: Uuid,
        data: UpdatePatrolTask,
    ) -> Result<Option<PatrolTask>, sqlx::Error> {
        let existing = get_by_id(pool, id).await?;
        if existing.is_none() {
            return Ok(None);
        }
        let existing = existing.unwrap();
        let now = Utc::now();

        sqlx::query_as::<_, PatrolTask>(
            r#"
            UPDATE patrol_tasks SET
                personnel_id = COALESCE(?, personnel_id),
                task_name = COALESCE(?, task_name),
                task_type = COALESCE(?, task_type),
                risk_level = COALESCE(?, risk_level),
                scheduled_start = COALESCE(?, scheduled_start),
                scheduled_end = COALESCE(?, scheduled_end),
                status = COALESCE(?, status),
                notes = COALESCE(?, notes),
                updated_at = ?
            WHERE id = ?
            RETURNING
                id,
                building_id,
                personnel_id,
                task_name,
                task_type,
                risk_level,
                scheduled_start,
                scheduled_end,
                status,
                started_at,
                completed_at,
                inspection_result,
                findings,
                completed_risk_level,
                notes,
                created_at,
                updated_at
            "#
        )
        .bind(data.personnel_id.or(existing.personnel_id))
        .bind(data.task_name.unwrap_or(existing.task_name))
        .bind(data.task_type.unwrap_or(existing.task_type))
        .bind(data.risk_level.unwrap_or(existing.risk_level))
        .bind(data.scheduled_start.unwrap_or(existing.scheduled_start))
        .bind(data.scheduled_end.unwrap_or(existing.scheduled_end))
        .bind(data.status.unwrap_or(existing.status))
        .bind(data.notes.or(existing.notes))
        .bind(now)
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    pub async fn delete(pool: &DbPool, id: Uuid) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("DELETE FROM patrol_tasks WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }

    pub async fn generate_daily_tasks(
        pool: &DbPool,
        date: DateTime<Utc>,
    ) -> Result<Vec<PatrolTask>, sqlx::Error> {
        let buildings = buildings::list(pool).await?;
        let personnel = patrol_personnel::list(pool).await?;
        let mut created_tasks = Vec::new();

        if personnel.is_empty() {
            return Ok(created_tasks);
        }

        let mut personnel_idx = 0;
        for building in &buildings {
            let risk = building.risk_level.as_deref().unwrap_or("medium");
            let task_count = match risk {
                "high" | "critical" => 2,
                "medium" => 1,
                "low" => {
                    let day_of_year = date.ordinal();
                    if day_of_year % 2 == 0 { 1 } else { 0 }
                }
                _ => 1,
            };

            for i in 0..task_count {
                let start_hour = if task_count == 1 { 9 } else { if i == 0 { 9 } else { 15 } };
                let scheduled_start = date
                    .with_hour(start_hour)
                    .unwrap_or(date)
                    .with_minute(0)
                    .unwrap_or(date)
                    .with_second(0)
                    .unwrap_or(date);
                let scheduled_end = scheduled_start + chrono::Duration::hours(2);
                let assigned_personnel = &personnel[personnel_idx % personnel.len()];
                personnel_idx += 1;

                let task = create(
                    pool,
                    CreatePatrolTask {
                        building_id: building.id,
                        personnel_id: Some(assigned_personnel.id),
                        task_name: format!("{} 日常巡防 - 第{}次", building.name, i + 1),
                        task_type: "routine".to_string(),
                        risk_level: building.risk_level.clone(),
                        scheduled_start,
                        scheduled_end,
                        notes: None,
                    },
                )
                .await?;
                created_tasks.push(task);
            }
        }

        Ok(created_tasks)
    }
}

pub mod alert_escalations {
    use super::*;

    pub async fn create(pool: &DbPool, data: CreateAlertEscalation) -> Result<AlertEscalation, sqlx::Error> {
        let id = Uuid::new_v4();
        let now = Utc::now();
        let notified_at = if data.notified_person_id.is_some() { Some(now) } else { None };
        sqlx::query_as::<_, AlertEscalation>(
            r#"
            INSERT INTO alert_escalations (
                id, alert_id, previous_level, new_level, escalation_reason,
                notified_person_id, notified_at, escalation_time, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING
                id,
                alert_id,
                previous_level,
                new_level,
                escalation_reason,
                notified_person_id,
                notified_at,
                escalation_time,
                created_at
            "#
        )
        .bind(id)
        .bind(data.alert_id)
        .bind(data.previous_level)
        .bind(data.new_level)
        .bind(&data.escalation_reason)
        .bind(data.notified_person_id)
        .bind(notified_at)
        .bind(now)
        .bind(now)
        .fetch_one(pool)
        .await
    }

    pub async fn get_by_id(pool: &DbPool, id: Uuid) -> Result<Option<AlertEscalation>, sqlx::Error> {
        sqlx::query_as::<_, AlertEscalation>(
            r#"
            SELECT
                id,
                alert_id,
                previous_level,
                new_level,
                escalation_reason,
                notified_person_id,
                notified_at,
                escalation_time,
                created_at
            FROM alert_escalations WHERE id = ?
            "#
        )
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    pub async fn list_by_alert(pool: &DbPool, alert_id: Uuid) -> Result<Vec<AlertEscalation>, sqlx::Error> {
        sqlx::query_as::<_, AlertEscalation>(
            r#"
            SELECT
                id,
                alert_id,
                previous_level,
                new_level,
                escalation_reason,
                notified_person_id,
                notified_at,
                escalation_time,
                created_at
            FROM alert_escalations WHERE alert_id = ? ORDER BY escalation_time DESC
            "#
        )
        .bind(alert_id)
        .fetch_all(pool)
        .await
    }

    pub async fn list(pool: &DbPool, limit: i32) -> Result<Vec<AlertEscalation>, sqlx::Error> {
        sqlx::query_as::<_, AlertEscalation>(
            r#"
            SELECT
                id,
                alert_id,
                previous_level,
                new_level,
                escalation_reason,
                notified_person_id,
                notified_at,
                escalation_time,
                created_at
            FROM alert_escalations ORDER BY escalation_time DESC LIMIT ?
            "#
        )
        .bind(limit)
        .fetch_all(pool)
        .await
    }
}

pub mod building_inspection_records {
    use super::*;

    pub async fn create(pool: &DbPool, data: CreateBuildingInspectionRecord) -> Result<BuildingInspectionRecord, sqlx::Error> {
        let id = Uuid::new_v4();
        let now = Utc::now();
        let rectification_status = data.rectification_status.unwrap_or_else(|| "pending".to_string());
        let alert_count = data.alert_count.unwrap_or(0);
        let hotspot_count = data.hotspot_count.unwrap_or(0);
        sqlx::query_as::<_, BuildingInspectionRecord>(
            r#"
            INSERT INTO building_inspection_records (
                id, building_id, inspector_id, inspection_date, risk_level_before, risk_level_after,
                findings, rectification_status, rectification_deadline, rectification_notes,
                alert_count, hotspot_count, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING
                id,
                building_id,
                inspector_id,
                inspection_date,
                risk_level_before,
                risk_level_after,
                findings,
                rectification_status,
                rectification_deadline,
                rectification_completed_at,
                rectification_notes,
                alert_count,
                hotspot_count,
                notes,
                created_at,
                updated_at
            "#
        )
        .bind(id)
        .bind(data.building_id)
        .bind(data.inspector_id)
        .bind(data.inspection_date)
        .bind(&data.risk_level_before)
        .bind(&data.risk_level_after)
        .bind(&data.findings)
        .bind(&rectification_status)
        .bind(data.rectification_deadline)
        .bind(&data.rectification_notes)
        .bind(alert_count)
        .bind(hotspot_count)
        .bind(&data.notes)
        .bind(now)
        .bind(now)
        .fetch_one(pool)
        .await
    }

    pub async fn get_by_id(pool: &DbPool, id: Uuid) -> Result<Option<BuildingInspectionRecord>, sqlx::Error> {
        sqlx::query_as::<_, BuildingInspectionRecord>(
            r#"
            SELECT
                id,
                building_id,
                inspector_id,
                inspection_date,
                risk_level_before,
                risk_level_after,
                findings,
                rectification_status,
                rectification_deadline,
                rectification_completed_at,
                rectification_notes,
                alert_count,
                hotspot_count,
                notes,
                created_at,
                updated_at
            FROM building_inspection_records WHERE id = ?
            "#
        )
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    pub async fn list_by_building(pool: &DbPool, building_id: Uuid) -> Result<Vec<BuildingInspectionRecord>, sqlx::Error> {
        sqlx::query_as::<_, BuildingInspectionRecord>(
            r#"
            SELECT
                id,
                building_id,
                inspector_id,
                inspection_date,
                risk_level_before,
                risk_level_after,
                findings,
                rectification_status,
                rectification_deadline,
                rectification_completed_at,
                rectification_notes,
                alert_count,
                hotspot_count,
                notes,
                created_at,
                updated_at
            FROM building_inspection_records WHERE building_id = ? ORDER BY inspection_date DESC
            "#
        )
        .bind(building_id)
        .fetch_all(pool)
        .await
    }

    pub async fn list_by_status(pool: &DbPool, status: &str) -> Result<Vec<BuildingInspectionRecord>, sqlx::Error> {
        sqlx::query_as::<_, BuildingInspectionRecord>(
            r#"
            SELECT
                id,
                building_id,
                inspector_id,
                inspection_date,
                risk_level_before,
                risk_level_after,
                findings,
                rectification_status,
                rectification_deadline,
                rectification_completed_at,
                rectification_notes,
                alert_count,
                hotspot_count,
                notes,
                created_at,
                updated_at
            FROM building_inspection_records WHERE rectification_status = ? ORDER BY inspection_date DESC
            "#
        )
        .bind(status)
        .fetch_all(pool)
        .await
    }

    pub async fn list(pool: &DbPool, limit: i32) -> Result<Vec<BuildingInspectionRecord>, sqlx::Error> {
        sqlx::query_as::<_, BuildingInspectionRecord>(
            r#"
            SELECT
                id,
                building_id,
                inspector_id,
                inspection_date,
                risk_level_before,
                risk_level_after,
                findings,
                rectification_status,
                rectification_deadline,
                rectification_completed_at,
                rectification_notes,
                alert_count,
                hotspot_count,
                notes,
                created_at,
                updated_at
            FROM building_inspection_records ORDER BY inspection_date DESC LIMIT ?
            "#
        )
        .bind(limit)
        .fetch_all(pool)
        .await
    }

    pub async fn update(
        pool: &DbPool,
        id: Uuid,
        data: UpdateBuildingInspectionRecord,
    ) -> Result<Option<BuildingInspectionRecord>, sqlx::Error> {
        let existing = get_by_id(pool, id).await?;
        if existing.is_none() {
            return Ok(None);
        }
        let existing = existing.unwrap();
        let now = Utc::now();

        sqlx::query_as::<_, BuildingInspectionRecord>(
            r#"
            UPDATE building_inspection_records SET
                inspector_id = COALESCE(?, inspector_id),
                inspection_date = COALESCE(?, inspection_date),
                risk_level_before = COALESCE(?, risk_level_before),
                risk_level_after = COALESCE(?, risk_level_after),
                findings = COALESCE(?, findings),
                rectification_status = COALESCE(?, rectification_status),
                rectification_deadline = COALESCE(?, rectification_deadline),
                rectification_notes = COALESCE(?, rectification_notes),
                alert_count = COALESCE(?, alert_count),
                hotspot_count = COALESCE(?, hotspot_count),
                notes = COALESCE(?, notes),
                updated_at = ?
            WHERE id = ?
            RETURNING
                id,
                building_id,
                inspector_id,
                inspection_date,
                risk_level_before,
                risk_level_after,
                findings,
                rectification_status,
                rectification_deadline,
                rectification_completed_at,
                rectification_notes,
                alert_count,
                hotspot_count,
                notes,
                created_at,
                updated_at
            "#
        )
        .bind(data.inspector_id.or(existing.inspector_id))
        .bind(data.inspection_date.unwrap_or(existing.inspection_date))
        .bind(data.risk_level_before.or(existing.risk_level_before))
        .bind(data.risk_level_after.or(existing.risk_level_after))
        .bind(data.findings.or(existing.findings))
        .bind(data.rectification_status.unwrap_or(existing.rectification_status))
        .bind(data.rectification_deadline.or(existing.rectification_deadline))
        .bind(data.rectification_notes.or(existing.rectification_notes))
        .bind(data.alert_count.unwrap_or(existing.alert_count))
        .bind(data.hotspot_count.unwrap_or(existing.hotspot_count))
        .bind(data.notes.or(existing.notes))
        .bind(now)
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    pub async fn update_rectification(
        pool: &DbPool,
        id: Uuid,
        status: &str,
        notes: Option<String>,
    ) -> Result<Option<BuildingInspectionRecord>, sqlx::Error> {
        let now = Utc::now();
        let completed_at = if status == "completed" { Some(now) } else { None };
        sqlx::query_as::<_, BuildingInspectionRecord>(
            r#"
            UPDATE building_inspection_records
            SET rectification_status = ?, rectification_notes = COALESCE(?, rectification_notes),
                rectification_completed_at = COALESCE(?, rectification_completed_at), updated_at = ?
            WHERE id = ?
            RETURNING
                id,
                building_id,
                inspector_id,
                inspection_date,
                risk_level_before,
                risk_level_after,
                findings,
                rectification_status,
                rectification_deadline,
                rectification_completed_at,
                rectification_notes,
                alert_count,
                hotspot_count,
                notes,
                created_at,
                updated_at
            "#
        )
        .bind(status)
        .bind(notes)
        .bind(completed_at)
        .bind(now)
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    pub async fn delete(pool: &DbPool, id: Uuid) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("DELETE FROM building_inspection_records WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }
}

pub mod seed {
    use super::*;
    use crate::models::{
        CreateBuilding, CreateThermalDevice, CreatePatrolPersonnel,
        CreateResponsiblePerson, CreateAlert,
    };

    async fn check_and_seed_buildings(pool: &DbPool) -> Result<Vec<Uuid>, sqlx::Error> {
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM buildings")
            .fetch_one(pool)
            .await?;

        if count > 0 {
            let ids: Vec<Uuid> = sqlx::query_scalar("SELECT id FROM buildings ORDER BY created_at ASC")
                .fetch_all(pool)
                .await?;
            return Ok(ids);
        }

        log::info!("Seeding buildings data...");
        let buildings_data = vec![
            ("大雄宝殿", "北京市东城区景山前街4号", 39.9163, 116.3972, "宫殿建筑", 1500.0, 1750, 3, "high", "🏛️"),
            ("藏经阁", "北京市东城区景山前街4号", 39.9165, 116.3975, "楼阁建筑", 800.0, 1800, 2, "medium", "📚"),
            ("钟楼", "北京市东城区景山前街4号", 39.9167, 116.3978, "钟楼建筑", 300.0, 1760, 2, "medium", "🔔"),
            ("鼓楼", "北京市东城区钟楼湾临字9号", 39.9424, 116.4025, "鼓楼建筑", 400.0, 1770, 2, "low", "🥁"),
            ("故宫角楼", "北京市东城区景山前街4号", 39.9140, 116.3910, "角楼建筑", 200.0, 1780, 1, "high", "🏯"),
        ];

        let mut building_ids = Vec::new();
        for (name, address, lat, lng, btype, area, year, floors, risk, icon) in buildings_data {
            let building = buildings::create(pool, CreateBuilding {
                name: name.to_string(),
                description: Some(format!("{} - 古建筑", name)),
                address: address.to_string(),
                latitude: lat,
                longitude: lng,
                area,
                building_type: btype.to_string(),
                construction_year: Some(year),
                floors: Some(floors),
                risk_level: Some(risk.to_string()),
                geometry: None,
                status: Some("active".to_string()),
                icon: Some(icon.to_string()),
            }).await?;
            building_ids.push(building.id);
        }

        Ok(building_ids)
    }

    async fn check_and_seed_devices(pool: &DbPool, building_ids: &[Uuid]) -> Result<Vec<Uuid>, sqlx::Error> {
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM thermal_devices")
            .fetch_one(pool)
            .await?;

        if count > 0 {
            let ids: Vec<Uuid> = sqlx::query_scalar("SELECT id FROM thermal_devices ORDER BY created_at ASC")
                .fetch_all(pool)
                .await?;
            return Ok(ids);
        }

        log::info!("Seeding thermal devices data...");
        let mut device_ids = Vec::new();

        for (idx, building_id) in building_ids.iter().enumerate() {
            for i in 0..2 {
                let device = thermal_devices::create(pool, CreateThermalDevice {
                    building_id: *building_id,
                    name: format!("建筑{}-热成像-{}", idx + 1, i + 1),
                    device_code: format!("CAM-{:02}-{:02}", idx + 1, i + 1),
                    model: Some("FLIR-Tau-2".to_string()),
                    ip_address: Some(format!("192.168.1.{}", 100 + idx * 2 + i)),
                    latitude: 39.9 + (idx as f64) * 0.001,
                    longitude: 116.4 + (idx as f64) * 0.001,
                    fov_width: 45.0,
                    fov_height: 37.5,
                    installation_height: 3.5,
                }).await?;
                device_ids.push(device.id);
            }
        }

        Ok(device_ids)
    }

    async fn check_and_seed_personnel(pool: &DbPool) -> Result<Vec<Uuid>, sqlx::Error> {
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM patrol_personnel")
            .fetch_one(pool)
            .await?;

        if count > 0 {
            let ids: Vec<Uuid> = sqlx::query_scalar("SELECT id FROM patrol_personnel ORDER BY created_at ASC")
                .fetch_all(pool)
                .await?;
            return Ok(ids);
        }

        log::info!("Seeding patrol personnel data...");
        let personnel_data = vec![
            ("张三", "XF20240001", "13812345671", "巡防队长"),
            ("李四", "XF20240002", "13812345672", "巡防队员"),
            ("王五", "XF20240003", "13812345673", "巡防队员"),
            ("赵六", "XF20240004", "13812345674", "安全员"),
        ];

        let mut personnel_ids = Vec::new();
        for (name, emp_id, phone, position) in personnel_data {
            let personnel = patrol_personnel::create(pool, CreatePatrolPersonnel {
                name: name.to_string(),
                employee_id: emp_id.to_string(),
                phone: phone.to_string(),
                department: "消防安保部".to_string(),
                position: position.to_string(),
            }).await?;
            personnel_ids.push(personnel.id);
        }

        Ok(personnel_ids)
    }

    async fn check_and_seed_responsible_persons(pool: &DbPool, building_ids: &[Uuid]) -> Result<(), sqlx::Error> {
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM responsible_persons")
            .fetch_one(pool)
            .await?;

        if count > 0 {
            return Ok(());
        }

        log::info!("Seeding responsible persons data...");
        let names = vec!["王刚", "李强", "杨伟", "刘军", "陈明"];

        for (idx, building_id) in building_ids.iter().enumerate() {
            responsible_persons::create(pool, CreateResponsiblePerson {
                building_id: *building_id,
                name: names[idx % names.len()].to_string(),
                position: "消防安全管理员".to_string(),
                phone: format!("139{:08}", idx * 1000 + 1),
                email: Some(format!("admin{}@example.com", idx + 1)),
                responsibility: "全面负责建筑消防安全管理工作".to_string(),
            }).await?;
        }

        Ok(())
    }

    async fn check_and_seed_alerts(pool: &DbPool, building_ids: &[Uuid]) -> Result<(), sqlx::Error> {
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM alerts")
            .fetch_one(pool)
            .await?;

        if count > 0 {
            return Ok(());
        }

        log::info!("Seeding alerts data...");
        let alert_types = vec![
            ("hotspot", "检测到异常热点", "critical"),
            ("fire", "火灾隐患告警", "high"),
            ("device_offline", "设备离线告警", "medium"),
            ("patrol_missing", "巡防人员异常", "low"),
        ];

        for (idx, building_id) in building_ids.iter().enumerate() {
            for i in 0..2 {
                let (alert_type, title, severity) = &alert_types[(idx + i) % alert_types.len()];
                alerts::create(pool, CreateAlert {
                    building_id: *building_id,
                    hotspot_id: None,
                    alert_type: alert_type.to_string(),
                    title: title.to_string(),
                    description: Some(format!("{}，请及时处理", title)),
                    severity: severity.to_string(),
                    latitude: Some(39.9 + (idx as f64) * 0.001),
                    longitude: Some(116.4 + (idx as f64) * 0.001),
                }).await?;
            }
        }

        Ok(())
    }

    async fn check_and_seed_thermal_data(pool: &DbPool, building_ids: &[Uuid], device_ids: &[Uuid]) -> Result<(), sqlx::Error> {
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM thermal_data")
            .fetch_one(pool)
            .await?;

        if count > 0 {
            return Ok(());
        }

        log::info!("Seeding thermal data...");
        for (i, device_id) in device_ids.iter().take(3).enumerate() {
            let building_id = building_ids[i / 2 % building_ids.len()];
            let width = 32;
            let height = 24;
            let mut matrix = Vec::new();
            let mut flat = Vec::new();
            for y in 0..height {
                let mut row = Vec::new();
                for x in 0..width {
                    let temp = 25.0 + ((x + y) as f64) * 0.2 + (i as f64) * 2.0;
                    row.push(temp);
                    flat.push(temp);
                }
                matrix.push(row);
            }

            use crate::models::CreateThermalData;
            thermal_data::create(pool, CreateThermalData {
                device_id: *device_id,
                building_id,
                temperature_matrix: serde_json::to_string(&matrix).unwrap(),
                min_temp: flat.iter().cloned().fold(f64::INFINITY, f64::min),
                max_temp: flat.iter().cloned().fold(f64::NEG_INFINITY, f64::max),
                avg_temp: flat.iter().sum::<f64>() / flat.len() as f64,
                resolution_width: width,
                resolution_height: height,
                is_night: false,
            }).await?;
        }

        Ok(())
    }

    pub async fn seed_if_empty(pool: &DbPool) -> Result<(), sqlx::Error> {
        let building_ids = check_and_seed_buildings(pool).await?;
        let device_ids = check_and_seed_devices(pool, &building_ids).await?;
        check_and_seed_personnel(pool).await?;
        check_and_seed_responsible_persons(pool, &building_ids).await?;
        check_and_seed_thermal_data(pool, &building_ids, &device_ids).await?;
        check_and_seed_alerts(pool, &building_ids).await?;
        log::info!("Database seeding completed.");
        Ok(())
    }
}
