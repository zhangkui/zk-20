use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Building {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub address: String,
    pub latitude: f64,
    pub longitude: f64,
    pub area: f64,
    pub building_type: String,
    pub construction_year: Option<i32>,
    pub floors: Option<i32>,
    pub risk_level: Option<String>,
    pub geometry: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct CreateBuilding {
    #[validate(length(min = 1, max = 255))]
    pub name: String,
    pub description: Option<String>,
    #[validate(length(min = 1))]
    pub address: String,
    pub latitude: f64,
    pub longitude: f64,
    pub area: f64,
    #[validate(length(min = 1))]
    pub building_type: String,
    pub construction_year: Option<i32>,
    pub floors: Option<i32>,
    pub risk_level: Option<String>,
    pub geometry: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct UpdateBuilding {
    #[validate(length(min = 1, max = 255))]
    pub name: Option<String>,
    pub description: Option<String>,
    pub address: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub area: Option<f64>,
    pub building_type: Option<String>,
    pub construction_year: Option<i32>,
    pub floors: Option<i32>,
    pub risk_level: Option<String>,
    pub geometry: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ThermalDevice {
    pub id: Uuid,
    pub building_id: Uuid,
    pub name: String,
    pub device_code: String,
    pub model: Option<String>,
    pub ip_address: Option<String>,
    pub latitude: f64,
    pub longitude: f64,
    pub fov_width: f64,
    pub fov_height: f64,
    pub installation_height: f64,
    pub status: String,
    pub last_heartbeat: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct CreateThermalDevice {
    pub building_id: Uuid,
    #[validate(length(min = 1))]
    pub name: String,
    #[validate(length(min = 1))]
    pub device_code: String,
    pub model: Option<String>,
    pub ip_address: Option<String>,
    pub latitude: f64,
    pub longitude: f64,
    pub fov_width: f64,
    pub fov_height: f64,
    pub installation_height: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ThermalData {
    pub id: Uuid,
    pub device_id: Uuid,
    pub building_id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub temperature_matrix: String,
    pub min_temp: f64,
    pub max_temp: f64,
    pub avg_temp: f64,
    pub resolution_width: i32,
    pub resolution_height: i32,
    pub is_night: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateThermalData {
    pub device_id: Uuid,
    pub building_id: Uuid,
    pub temperature_matrix: String,
    pub min_temp: f64,
    pub max_temp: f64,
    pub avg_temp: f64,
    pub resolution_width: i32,
    pub resolution_height: i32,
    pub is_night: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Hotspot {
    pub id: Uuid,
    pub thermal_data_id: Uuid,
    pub building_id: Uuid,
    pub device_id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub center_x: i32,
    pub center_y: i32,
    pub temperature: f64,
    pub area: f64,
    pub risk_level: String,
    pub status: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateHotspot {
    pub thermal_data_id: Uuid,
    pub building_id: Uuid,
    pub device_id: Uuid,
    pub center_x: i32,
    pub center_y: i32,
    pub temperature: f64,
    pub area: f64,
    pub risk_level: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PatrolPersonnel {
    pub id: Uuid,
    pub name: String,
    pub employee_id: String,
    pub phone: String,
    pub department: String,
    pub position: String,
    pub status: String,
    pub last_location_lat: Option<f64>,
    pub last_location_lng: Option<f64>,
    pub last_location_time: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct CreatePatrolPersonnel {
    #[validate(length(min = 1))]
    pub name: String,
    #[validate(length(min = 1))]
    pub employee_id: String,
    #[validate(length(min = 1))]
    pub phone: String,
    pub department: String,
    pub position: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PatrolLocation {
    pub id: Uuid,
    pub personnel_id: Uuid,
    pub latitude: f64,
    pub longitude: f64,
    pub timestamp: DateTime<Utc>,
    pub accuracy: Option<f64>,
    pub battery_level: Option<f64>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePatrolLocation {
    pub personnel_id: Uuid,
    pub latitude: f64,
    pub longitude: f64,
    pub accuracy: Option<f64>,
    pub battery_level: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Alert {
    pub id: Uuid,
    pub hotspot_id: Option<Uuid>,
    pub building_id: Uuid,
    pub alert_type: String,
    pub title: String,
    pub description: Option<String>,
    pub severity: String,
    pub status: String,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub acknowledged_by: Option<Uuid>,
    pub acknowledged_at: Option<DateTime<Utc>>,
    pub resolved_by: Option<Uuid>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAlert {
    pub hotspot_id: Option<Uuid>,
    pub building_id: Uuid,
    pub alert_type: String,
    pub title: String,
    pub description: Option<String>,
    pub severity: String,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AlertPlayback {
    pub id: Uuid,
    pub alert_id: Uuid,
    pub thermal_data_id: Option<Uuid>,
    pub playback_data: String,
    pub duration_seconds: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ResponsiblePerson {
    pub id: Uuid,
    pub building_id: Uuid,
    pub name: String,
    pub position: String,
    pub phone: String,
    pub email: Option<String>,
    pub responsibility: String,
    pub is_active: bool,
    pub start_date: DateTime<Utc>,
    pub end_date: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct CreateResponsiblePerson {
    pub building_id: Uuid,
    #[validate(length(min = 1))]
    pub name: String,
    pub position: String,
    #[validate(length(min = 1))]
    pub phone: String,
    pub email: Option<String>,
    pub responsibility: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct HighRiskStats {
    pub id: Uuid,
    pub building_id: Uuid,
    pub hour_of_day: i32,
    pub date: DateTime<Utc>,
    pub alert_count: i32,
    pub hotspot_count: i32,
    pub avg_max_temp: f64,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskStatsSummary {
    pub hour_of_day: i32,
    pub total_alerts: i64,
    pub total_hotspots: i64,
    pub avg_max_temp: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThermalDataPoint {
    pub x: i32,
    pub y: i32,
    pub temperature: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThermalFrame {
    pub device_id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub resolution: (i32, i32),
    pub temperatures: Vec<Vec<f64>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RealtimeAlert {
    pub alert: Alert,
    pub building: Option<Building>,
    pub hotspot: Option<Hotspot>,
}
