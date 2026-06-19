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

pub async fn health_check() -> impl Responder {
    HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
        "status": "healthy",
        "timestamp": Utc::now().to_rfc3339()
    })))
}
