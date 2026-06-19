use actix_web::{web, HttpResponse, Responder};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::db;
use crate::handlers::ApiResponse;
use crate::models::{CreateThermalData, ThermalData};

#[derive(Deserialize)]
pub struct TimeRangeQuery {
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
}

pub async fn list(pool: web::Data<SqlitePool>) -> impl Responder {
    match db::thermal_data::list(pool.get_ref(), 100).await {
        Ok(data) => HttpResponse::Ok().json(ApiResponse::success(data)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Vec<ThermalData>>::error(&format!(
            "Failed to fetch thermal data: {}",
            e
        ))),
    }
}

pub async fn get_by_id(pool: web::Data<SqlitePool>, id: web::Path<Uuid>) -> impl Responder {
    match db::thermal_data::get_by_id(pool.get_ref(), id.into_inner()).await {
        Ok(Some(data)) => HttpResponse::Ok().json(ApiResponse::success(data)),
        Ok(None) => HttpResponse::NotFound().json(ApiResponse::<ThermalData>::error("Thermal data not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<ThermalData>::error(&format!(
            "Failed to fetch thermal data: {}",
            e
        ))),
    }
}

pub async fn list_by_device(
    pool: web::Data<SqlitePool>,
    device_id: web::Path<Uuid>,
) -> impl Responder {
    match db::thermal_data::list_by_device(pool.get_ref(), device_id.into_inner(), 100).await {
        Ok(data) => HttpResponse::Ok().json(ApiResponse::success(data)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Vec<ThermalData>>::error(&format!(
            "Failed to fetch thermal data: {}",
            e
        ))),
    }
}

pub async fn list_by_building_time_range(
    pool: web::Data<SqlitePool>,
    building_id: web::Path<Uuid>,
    query: web::Query<TimeRangeQuery>,
) -> impl Responder {
    match db::thermal_data::list_by_building_time_range(pool.get_ref(), building_id.into_inner(), query.start, query.end).await {
        Ok(data) => HttpResponse::Ok().json(ApiResponse::success(data)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Vec<ThermalData>>::error(&format!(
            "Failed to fetch thermal data: {}",
            e
        ))),
    }
}

pub async fn create(
    pool: web::Data<SqlitePool>,
    data: web::Json<CreateThermalData>,
) -> impl Responder {
    match db::thermal_data::create(pool.get_ref(), data.into_inner()).await {
        Ok(thermal_data) => HttpResponse::Created().json(ApiResponse::success(thermal_data)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<ThermalData>::error(&format!(
            "Failed to create thermal data: {}",
            e
        ))),
    }
}

pub async fn delete(pool: web::Data<SqlitePool>, id: web::Path<Uuid>) -> impl Responder {
    match db::thermal_data::delete(pool.get_ref(), id.into_inner()).await {
        Ok(true) => HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
            "deleted": true
        }))),
        Ok(false) => HttpResponse::NotFound().json(ApiResponse::<serde_json::Value>::error("Thermal data not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<serde_json::Value>::error(&format!(
            "Failed to delete thermal data: {}",
            e
        ))),
    }
}
