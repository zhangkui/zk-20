use actix_web::{web, HttpResponse, Responder};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::db;
use crate::handlers::{ApiResponse, UpdateStatusRequest};
use crate::models::{CreateHotspot, Hotspot};

pub async fn list(pool: web::Data<SqlitePool>) -> impl Responder {
    match db::hotspots::list(pool.get_ref(), 100).await {
        Ok(hotspots) => HttpResponse::Ok().json(ApiResponse::success(hotspots)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Vec<Hotspot>>::error(&format!(
            "Failed to fetch hotspots: {}",
            e
        ))),
    }
}

pub async fn get_by_id(pool: web::Data<SqlitePool>, id: web::Path<Uuid>) -> impl Responder {
    match db::hotspots::get_by_id(pool.get_ref(), id.into_inner()).await {
        Ok(Some(hotspot)) => HttpResponse::Ok().json(ApiResponse::success(hotspot)),
        Ok(None) => HttpResponse::NotFound().json(ApiResponse::<Hotspot>::error("Hotspot not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Hotspot>::error(&format!(
            "Failed to fetch hotspot: {}",
            e
        ))),
    }
}

pub async fn list_by_building(
    pool: web::Data<SqlitePool>,
    building_id: web::Path<Uuid>,
) -> impl Responder {
    match db::hotspots::list_by_building(pool.get_ref(), building_id.into_inner(), 100).await {
        Ok(hotspots) => HttpResponse::Ok().json(ApiResponse::success(hotspots)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Vec<Hotspot>>::error(&format!(
            "Failed to fetch hotspots: {}",
            e
        ))),
    }
}

pub async fn list_by_risk(
    pool: web::Data<SqlitePool>,
    level: web::Path<String>,
) -> impl Responder {
    match db::hotspots::list_by_risk(pool.get_ref(), &level.into_inner(), 100).await {
        Ok(hotspots) => HttpResponse::Ok().json(ApiResponse::success(hotspots)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Vec<Hotspot>>::error(&format!(
            "Failed to fetch hotspots: {}",
            e
        ))),
    }
}

pub async fn create(
    pool: web::Data<SqlitePool>,
    data: web::Json<CreateHotspot>,
) -> impl Responder {
    match db::hotspots::create(pool.get_ref(), data.into_inner()).await {
        Ok(hotspot) => HttpResponse::Created().json(ApiResponse::success(hotspot)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Hotspot>::error(&format!(
            "Failed to create hotspot: {}",
            e
        ))),
    }
}

pub async fn update_status(
    pool: web::Data<SqlitePool>,
    id: web::Path<Uuid>,
    data: web::Json<UpdateStatusRequest>,
) -> impl Responder {
    match db::hotspots::update_status(pool.get_ref(), id.into_inner(), &data.status).await {
        Ok(true) => HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
            "updated": true
        }))),
        Ok(false) => HttpResponse::NotFound().json(ApiResponse::<serde_json::Value>::error("Hotspot not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<serde_json::Value>::error(&format!(
            "Failed to update hotspot status: {}",
            e
        ))),
    }
}

pub async fn delete(pool: web::Data<SqlitePool>, id: web::Path<Uuid>) -> impl Responder {
    match db::hotspots::delete(pool.get_ref(), id.into_inner()).await {
        Ok(true) => HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
            "deleted": true
        }))),
        Ok(false) => HttpResponse::NotFound().json(ApiResponse::<serde_json::Value>::error("Hotspot not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<serde_json::Value>::error(&format!(
            "Failed to delete hotspot: {}",
            e
        ))),
    }
}
