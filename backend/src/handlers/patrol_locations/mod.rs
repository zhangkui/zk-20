use actix_web::{web, HttpResponse, Responder};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::db;
use crate::handlers::ApiResponse;
use crate::models::{CreatePatrolLocation, PatrolLocation};

#[derive(Deserialize)]
pub struct TimeRangeQuery {
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
}

pub async fn create(
    pool: web::Data<SqlitePool>,
    data: web::Json<CreatePatrolLocation>,
) -> impl Responder {
    match db::patrol_locations::create(pool.get_ref(), data.into_inner()).await {
        Ok(location) => HttpResponse::Created().json(ApiResponse::success(location)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<PatrolLocation>::error(&format!(
            "Failed to create patrol location: {}",
            e
        ))),
    }
}

pub async fn get_by_id(
    pool: web::Data<SqlitePool>,
    id: web::Path<Uuid>,
) -> impl Responder {
    match db::patrol_locations::get_by_id(pool.get_ref(), id.into_inner()).await {
        Ok(Some(location)) => HttpResponse::Ok().json(ApiResponse::success(location)),
        Ok(None) => HttpResponse::NotFound().json(ApiResponse::<PatrolLocation>::error("Patrol location not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<PatrolLocation>::error(&format!(
            "Failed to fetch patrol location: {}",
            e
        ))),
    }
}

pub async fn list_by_personnel(
    pool: web::Data<SqlitePool>,
    personnel_id: web::Path<Uuid>,
) -> impl Responder {
    match db::patrol_locations::list_by_personnel(pool.get_ref(), personnel_id.into_inner(), 100).await {
        Ok(locations) => HttpResponse::Ok().json(ApiResponse::success(locations)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Vec<PatrolLocation>>::error(&format!(
            "Failed to fetch patrol locations: {}",
            e
        ))),
    }
}

pub async fn list_by_personnel_time_range(
    pool: web::Data<SqlitePool>,
    personnel_id: web::Path<Uuid>,
    query: web::Query<TimeRangeQuery>,
) -> impl Responder {
    match db::patrol_locations::list_by_personnel_time_range(pool.get_ref(), personnel_id.into_inner(), query.start, query.end).await {
        Ok(locations) => HttpResponse::Ok().json(ApiResponse::success(locations)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Vec<PatrolLocation>>::error(&format!(
            "Failed to fetch patrol locations: {}",
            e
        ))),
    }
}

pub async fn delete(pool: web::Data<SqlitePool>, id: web::Path<Uuid>) -> impl Responder {
    match db::patrol_locations::delete(pool.get_ref(), id.into_inner()).await {
        Ok(true) => HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
            "deleted": true
        }))),
        Ok(false) => HttpResponse::NotFound().json(ApiResponse::<serde_json::Value>::error("Patrol location not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<serde_json::Value>::error(&format!(
            "Failed to delete patrol location: {}",
            e
        ))),
    }
}
