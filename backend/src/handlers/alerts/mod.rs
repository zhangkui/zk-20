use actix_web::{web, HttpResponse, Responder};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::db;
use crate::handlers::{AcknowledgeAlertRequest, ApiResponse, ResolveAlertRequest};
use crate::models::{Alert, CreateAlert};

pub async fn list(pool: web::Data<SqlitePool>) -> impl Responder {
    match db::alerts::list(pool.get_ref(), 100).await {
        Ok(alerts) => HttpResponse::Ok().json(ApiResponse::success(alerts)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Vec<Alert>>::error(&format!(
            "Failed to fetch alerts: {}",
            e
        ))),
    }
}

pub async fn get_by_id(pool: web::Data<SqlitePool>, id: web::Path<Uuid>) -> impl Responder {
    match db::alerts::get_by_id(pool.get_ref(), id.into_inner()).await {
        Ok(Some(alert)) => HttpResponse::Ok().json(ApiResponse::success(alert)),
        Ok(None) => HttpResponse::NotFound().json(ApiResponse::<Alert>::error("Alert not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Alert>::error(&format!(
            "Failed to fetch alert: {}",
            e
        ))),
    }
}

pub async fn list_by_building(
    pool: web::Data<SqlitePool>,
    building_id: web::Path<Uuid>,
) -> impl Responder {
    match db::alerts::list_by_building(pool.get_ref(), building_id.into_inner(), 100).await {
        Ok(alerts) => HttpResponse::Ok().json(ApiResponse::success(alerts)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Vec<Alert>>::error(&format!(
            "Failed to fetch alerts: {}",
            e
        ))),
    }
}

pub async fn list_by_status(
    pool: web::Data<SqlitePool>,
    status: web::Query<std::collections::HashMap<String, String>>,
) -> impl Responder {
    let status_value = status.get("status").cloned().unwrap_or_else(|| "pending".to_string());
    match db::alerts::list_by_status(pool.get_ref(), &status_value, 100).await {
        Ok(alerts) => HttpResponse::Ok().json(ApiResponse::success(alerts)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Vec<Alert>>::error(&format!(
            "Failed to fetch alerts: {}",
            e
        ))),
    }
}

pub async fn create(
    pool: web::Data<SqlitePool>,
    data: web::Json<CreateAlert>,
) -> impl Responder {
    match db::alerts::create(pool.get_ref(), data.into_inner()).await {
        Ok(alert) => HttpResponse::Created().json(ApiResponse::success(alert)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Alert>::error(&format!(
            "Failed to create alert: {}",
            e
        ))),
    }
}

pub async fn acknowledge(
    pool: web::Data<SqlitePool>,
    id: web::Path<Uuid>,
    data: web::Json<AcknowledgeAlertRequest>,
) -> impl Responder {
    match db::alerts::acknowledge(pool.get_ref(), id.into_inner(), data.personnel_id).await {
        Ok(true) => HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
            "acknowledged": true
        }))),
        Ok(false) => HttpResponse::NotFound().json(ApiResponse::<serde_json::Value>::error("Alert not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<serde_json::Value>::error(&format!(
            "Failed to acknowledge alert: {}",
            e
        ))),
    }
}

pub async fn resolve(
    pool: web::Data<SqlitePool>,
    id: web::Path<Uuid>,
    data: web::Json<ResolveAlertRequest>,
) -> impl Responder {
    match db::alerts::resolve(pool.get_ref(), id.into_inner(), data.personnel_id).await {
        Ok(true) => HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
            "resolved": true
        }))),
        Ok(false) => HttpResponse::NotFound().json(ApiResponse::<serde_json::Value>::error("Alert not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<serde_json::Value>::error(&format!(
            "Failed to resolve alert: {}",
            e
        ))),
    }
}

pub async fn delete(pool: web::Data<SqlitePool>, id: web::Path<Uuid>) -> impl Responder {
    match db::alerts::delete(pool.get_ref(), id.into_inner()).await {
        Ok(true) => HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
            "deleted": true
        }))),
        Ok(false) => HttpResponse::NotFound().json(ApiResponse::<serde_json::Value>::error("Alert not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<serde_json::Value>::error(&format!(
            "Failed to delete alert: {}",
            e
        ))),
    }
}
