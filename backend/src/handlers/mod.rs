use actix_web::{HttpResponse, Responder};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub message: Option<String>,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            message: None,
        }
    }

    pub fn error(message: &str) -> Self {
        Self {
            success: false,
            data: None,
            message: Some(message.to_string()),
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct UpdateStatusRequest {
    pub status: String,
}

#[derive(Serialize, Deserialize)]
pub struct AcknowledgeAlertRequest {
    pub personnel_id: Uuid,
}

#[derive(Serialize, Deserialize)]
pub struct ResolveAlertRequest {
    pub personnel_id: Uuid,
}

#[derive(Serialize, Deserialize)]
pub struct CreateAlertPlaybackRequest {
    pub thermal_data_id: Option<Uuid>,
    pub playback_data: String,
    pub duration_seconds: i32,
}

#[derive(Serialize, Deserialize)]
pub struct AnalyzeHotspotsRequest {
    pub thermal_data_id: Uuid,
}

#[derive(Serialize, Deserialize)]
pub struct DispatchAlertRequest {
    pub personnel_id: Uuid,
    pub dispatch_reason: String,
}

#[derive(Serialize, Deserialize)]
pub struct ArriveAlertRequest {
    pub personnel_id: Uuid,
}

#[derive(Serialize, Deserialize)]
pub struct HandleAlertRequest {
    pub personnel_id: Uuid,
    pub handling_notes: String,
}

#[derive(Serialize, Deserialize)]
pub struct CloseAlertRequest {
    pub personnel_id: Uuid,
    pub handling_notes: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct CreateAlertDispatchRequest {
    pub alert_id: Uuid,
    pub dispatched_by: Option<Uuid>,
    pub dispatched_to: Uuid,
    pub dispatch_reason: String,
}

#[derive(Serialize, Deserialize)]
pub struct CreatePatrolTaskRequest {
    pub building_id: Uuid,
    pub personnel_id: Option<Uuid>,
    pub task_name: String,
    pub task_type: String,
    pub risk_level: Option<String>,
    pub scheduled_start: chrono::DateTime<Utc>,
    pub scheduled_end: chrono::DateTime<Utc>,
    pub notes: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct UpdatePatrolTaskRequest {
    pub personnel_id: Option<Uuid>,
    pub task_name: Option<String>,
    pub task_type: Option<String>,
    pub risk_level: Option<String>,
    pub scheduled_start: Option<chrono::DateTime<Utc>>,
    pub scheduled_end: Option<chrono::DateTime<Utc>>,
    pub status: Option<String>,
    pub notes: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct CompletePatrolTaskRequest {
    pub inspection_result: String,
    pub findings: Option<String>,
    pub completed_risk_level: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct CreateBuildingInspectionRequest {
    pub building_id: Uuid,
    pub inspector_id: Option<Uuid>,
    pub inspection_date: chrono::DateTime<Utc>,
    pub risk_level_before: Option<String>,
    pub risk_level_after: Option<String>,
    pub findings: Option<String>,
    pub rectification_status: Option<String>,
    pub rectification_deadline: Option<chrono::DateTime<Utc>>,
    pub rectification_notes: Option<String>,
    pub alert_count: Option<i32>,
    pub hotspot_count: Option<i32>,
    pub notes: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct UpdateBuildingInspectionRequest {
    pub inspector_id: Option<Uuid>,
    pub inspection_date: Option<chrono::DateTime<Utc>>,
    pub risk_level_before: Option<String>,
    pub risk_level_after: Option<String>,
    pub findings: Option<String>,
    pub rectification_status: Option<String>,
    pub rectification_deadline: Option<chrono::DateTime<Utc>>,
    pub rectification_notes: Option<String>,
    pub alert_count: Option<i32>,
    pub hotspot_count: Option<i32>,
    pub notes: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct GeneratePatrolTasksRequest {
    pub date: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct EscalateAlertRequest {
    pub new_level: i32,
    pub escalation_reason: String,
    pub notified_person_id: Option<Uuid>,
}

pub mod buildings;
pub mod devices;
pub mod thermal_data;
pub mod hotspots;
pub mod patrol_personnel;
pub mod patrol_locations;
pub mod alerts;
pub mod responsible_persons;
pub mod statistics;
pub mod alert_playback;
pub mod alert_dispatches;
pub mod patrol_tasks;
pub mod alert_escalations;
pub mod building_inspections;

pub async fn health_check() -> impl Responder {
    HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
        "status": "healthy",
        "timestamp": Utc::now().to_rfc3339()
    })))
}
