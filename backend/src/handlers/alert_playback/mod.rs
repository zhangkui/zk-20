use actix_web::{web, HttpResponse, Responder};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::db;
use crate::handlers::{ApiResponse, CreateAlertPlaybackRequest};
use crate::models::AlertPlayback;

pub async fn create(
    pool: web::Data<SqlitePool>,
    id: web::Path<Uuid>,
    data: web::Json<CreateAlertPlaybackRequest>,
) -> impl Responder {
    let alert_id = id.into_inner();
    match db::alert_playback::create(
        pool.get_ref(),
        alert_id,
        data.thermal_data_id,
        data.playback_data.clone(),
        data.duration_seconds,
    ).await {
        Ok(playback) => HttpResponse::Created().json(ApiResponse::success(playback)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<AlertPlayback>::error(&format!(
            "Failed to create alert playback: {}",
            e
        ))),
    }
}

pub async fn get_by_alert_id(
    pool: web::Data<SqlitePool>,
    id: web::Path<Uuid>,
) -> impl Responder {
    match db::alert_playback::get_by_alert_id(pool.get_ref(), id.into_inner()).await {
        Ok(Some(playback)) => HttpResponse::Ok().json(ApiResponse::success(playback)),
        Ok(None) => HttpResponse::NotFound().json(ApiResponse::<AlertPlayback>::error("Playback not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<AlertPlayback>::error(&format!(
            "Failed to fetch alert playback: {}",
            e
        ))),
    }
}
