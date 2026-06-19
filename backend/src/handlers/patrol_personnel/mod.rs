use actix_web::{web, HttpResponse, Responder};
use serde::Deserialize;
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::db;
use crate::handlers::{ApiResponse, UpdateStatusRequest};
use crate::models::{CreatePatrolPersonnel, PatrolPersonnel};

#[derive(Deserialize)]
pub struct UpdateLocationRequest {
    pub latitude: f64,
    pub longitude: f64,
}

pub async fn list(pool: web::Data<SqlitePool>) -> impl Responder {
    match db::patrol_personnel::list(pool.get_ref()).await {
        Ok(personnel) => HttpResponse::Ok().json(ApiResponse::success(personnel)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Vec<PatrolPersonnel>>::error(&format!(
            "Failed to fetch patrol personnel: {}",
            e
        ))),
    }
}

pub async fn get_by_id(
    pool: web::Data<SqlitePool>,
    id: web::Path<Uuid>,
) -> impl Responder {
    match db::patrol_personnel::get_by_id(pool.get_ref(), id.into_inner()).await {
        Ok(Some(person)) => HttpResponse::Ok().json(ApiResponse::success(person)),
        Ok(None) => HttpResponse::NotFound().json(ApiResponse::<PatrolPersonnel>::error("Patrol personnel not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<PatrolPersonnel>::error(&format!(
            "Failed to fetch patrol personnel: {}",
            e
        ))),
    }
}

pub async fn create(
    pool: web::Data<SqlitePool>,
    data: web::Json<CreatePatrolPersonnel>,
) -> impl Responder {
    match db::patrol_personnel::create(pool.get_ref(), data.into_inner()).await {
        Ok(person) => HttpResponse::Created().json(ApiResponse::success(person)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<PatrolPersonnel>::error(&format!(
            "Failed to create patrol personnel: {}",
            e
        ))),
    }
}

pub async fn update_status(
    pool: web::Data<SqlitePool>,
    id: web::Path<Uuid>,
    data: web::Json<UpdateStatusRequest>,
) -> impl Responder {
    match db::patrol_personnel::update_status(pool.get_ref(), id.into_inner(), &data.status).await {
        Ok(true) => HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
            "updated": true
        }))),
        Ok(false) => HttpResponse::NotFound().json(ApiResponse::<serde_json::Value>::error("Patrol personnel not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<serde_json::Value>::error(&format!(
            "Failed to update patrol status: {}",
            e
        ))),
    }
}

pub async fn update_location(
    pool: web::Data<SqlitePool>,
    id: web::Path<Uuid>,
    data: web::Json<UpdateLocationRequest>,
) -> impl Responder {
    match db::patrol_personnel::update_location(pool.get_ref(), id.into_inner(), data.latitude, data.longitude).await {
        Ok(true) => HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
            "updated": true
        }))),
        Ok(false) => HttpResponse::NotFound().json(ApiResponse::<serde_json::Value>::error("Patrol personnel not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<serde_json::Value>::error(&format!(
            "Failed to update patrol location: {}",
            e
        ))),
    }
}

pub async fn delete(pool: web::Data<SqlitePool>, id: web::Path<Uuid>) -> impl Responder {
    match db::patrol_personnel::delete(pool.get_ref(), id.into_inner()).await {
        Ok(true) => HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
            "deleted": true
        }))),
        Ok(false) => HttpResponse::NotFound().json(ApiResponse::<serde_json::Value>::error("Patrol personnel not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<serde_json::Value>::error(&format!(
            "Failed to delete patrol personnel: {}",
            e
        ))),
    }
}
