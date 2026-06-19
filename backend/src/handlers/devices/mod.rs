use actix_web::{web, HttpResponse, Responder};
use serde::Deserialize;
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::db;
use crate::handlers::ApiResponse;
use crate::models::{CreateThermalDevice, ThermalDevice};

#[derive(Deserialize)]
pub struct UpdateHeartbeatRequest {
    pub status: String,
}

pub async fn list(pool: web::Data<SqlitePool>) -> impl Responder {
    match db::thermal_devices::list(pool.get_ref()).await {
        Ok(devices) => HttpResponse::Ok().json(ApiResponse::success(devices)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Vec<ThermalDevice>>::error(&format!(
            "Failed to fetch devices: {}",
            e
        ))),
    }
}

pub async fn get_by_id(pool: web::Data<SqlitePool>, id: web::Path<Uuid>) -> impl Responder {
    match db::thermal_devices::get_by_id(pool.get_ref(), id.into_inner()).await {
        Ok(Some(device)) => HttpResponse::Ok().json(ApiResponse::success(device)),
        Ok(None) => HttpResponse::NotFound().json(ApiResponse::<ThermalDevice>::error("Device not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<ThermalDevice>::error(&format!(
            "Failed to fetch device: {}",
            e
        ))),
    }
}

pub async fn list_by_building(
    pool: web::Data<SqlitePool>,
    building_id: web::Path<Uuid>,
) -> impl Responder {
    match db::thermal_devices::list_by_building(pool.get_ref(), building_id.into_inner()).await {
        Ok(devices) => HttpResponse::Ok().json(ApiResponse::success(devices)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Vec<ThermalDevice>>::error(&format!(
            "Failed to fetch devices: {}",
            e
        ))),
    }
}

pub async fn create(
    pool: web::Data<SqlitePool>,
    data: web::Json<CreateThermalDevice>,
) -> impl Responder {
    match db::thermal_devices::create(pool.get_ref(), data.into_inner()).await {
        Ok(device) => HttpResponse::Created().json(ApiResponse::success(device)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<ThermalDevice>::error(&format!(
            "Failed to create device: {}",
            e
        ))),
    }
}

pub async fn update_heartbeat(
    pool: web::Data<SqlitePool>,
    id: web::Path<Uuid>,
    data: web::Json<UpdateHeartbeatRequest>,
) -> impl Responder {
    match db::thermal_devices::update_heartbeat(pool.get_ref(), id.into_inner(), &data.status).await {
        Ok(true) => HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
            "updated": true
        }))),
        Ok(false) => HttpResponse::NotFound().json(ApiResponse::<serde_json::Value>::error("Device not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<serde_json::Value>::error(&format!(
            "Failed to update device heartbeat: {}",
            e
        ))),
    }
}

pub async fn delete(pool: web::Data<SqlitePool>, id: web::Path<Uuid>) -> impl Responder {
    match db::thermal_devices::delete(pool.get_ref(), id.into_inner()).await {
        Ok(true) => HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
            "deleted": true
        }))),
        Ok(false) => HttpResponse::NotFound().json(ApiResponse::<serde_json::Value>::error("Device not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<serde_json::Value>::error(&format!(
            "Failed to delete device: {}",
            e
        ))),
    }
}
