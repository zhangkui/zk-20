use actix_web::{web, HttpResponse, Responder};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::db;
use crate::handlers::ApiResponse;
use crate::models::AlertEscalation;

pub async fn list(pool: web::Data<SqlitePool>) -> impl Responder {
    match db::alert_escalations::list(pool.get_ref(), 100).await {
        Ok(items) => HttpResponse::Ok().json(ApiResponse::success(items)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Vec<AlertEscalation>>::error(&format!(
            "Failed to fetch alert escalations: {}",
            e
        ))),
    }
}

pub async fn get_by_id(pool: web::Data<SqlitePool>, id: web::Path<Uuid>) -> impl Responder {
    match db::alert_escalations::get_by_id(pool.get_ref(), id.into_inner()).await {
        Ok(Some(item)) => HttpResponse::Ok().json(ApiResponse::success(item)),
        Ok(None) => HttpResponse::NotFound().json(ApiResponse::<AlertEscalation>::error("Alert escalation not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<AlertEscalation>::error(&format!(
            "Failed to fetch alert escalation: {}",
            e
        ))),
    }
}

pub async fn list_by_alert(
    pool: web::Data<SqlitePool>,
    alert_id: web::Path<Uuid>,
) -> impl Responder {
    match db::alert_escalations::list_by_alert(pool.get_ref(), alert_id.into_inner()).await {
        Ok(items) => HttpResponse::Ok().json(ApiResponse::success(items)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Vec<AlertEscalation>>::error(&format!(
            "Failed to fetch alert escalations: {}",
            e
        ))),
    }
}
