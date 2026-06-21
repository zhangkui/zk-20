use actix_web::{web, HttpResponse, Responder};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::db;
use crate::handlers::ApiResponse;
use crate::models::{Building, CreateBuilding, UpdateBuilding};

pub async fn list(pool: web::Data<SqlitePool>) -> impl Responder {
    match db::buildings::list(pool.get_ref()).await {
        Ok(buildings) => HttpResponse::Ok().json(ApiResponse::success(buildings)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Vec<Building>>::error(&format!(
            "Failed to fetch buildings: {}",
            e
        ))),
    }
}

pub async fn get_by_id(pool: web::Data<SqlitePool>, id: web::Path<Uuid>) -> impl Responder {
    match db::buildings::get_by_id(pool.get_ref(), id.into_inner()).await {
        Ok(Some(building)) => HttpResponse::Ok().json(ApiResponse::success(building)),
        Ok(None) => HttpResponse::NotFound().json(ApiResponse::<Building>::error("Building not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Building>::error(&format!(
            "Failed to fetch building: {}",
            e
        ))),
    }
}

pub async fn create(
    pool: web::Data<SqlitePool>,
    data: web::Json<CreateBuilding>,
) -> impl Responder {
    match db::buildings::create(pool.get_ref(), data.into_inner()).await {
        Ok(building) => HttpResponse::Created().json(ApiResponse::success(building)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Building>::error(&format!(
            "Failed to create building: {}",
            e
        ))),
    }
}

pub async fn update(
    pool: web::Data<SqlitePool>,
    id: web::Path<Uuid>,
    data: web::Json<UpdateBuilding>,
) -> impl Responder {
    match db::buildings::update(pool.get_ref(), id.into_inner(), data.into_inner()).await {
        Ok(Some(building)) => HttpResponse::Ok().json(ApiResponse::success(building)),
        Ok(None) => HttpResponse::NotFound().json(ApiResponse::<Building>::error("Building not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Building>::error(&format!(
            "Failed to update building: {}",
            e
        ))),
    }
}

pub async fn toggle_status(
    pool: web::Data<SqlitePool>,
    id: web::Path<Uuid>,
) -> impl Responder {
    match db::buildings::toggle_status(pool.get_ref(), id.into_inner()).await {
        Ok(Some(building)) => HttpResponse::Ok().json(ApiResponse::success(building)),
        Ok(None) => HttpResponse::NotFound().json(ApiResponse::<Building>::error("Building not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Building>::error(&format!(
            "Failed to toggle building status: {}",
            e
        ))),
    }
}

pub async fn delete(pool: web::Data<SqlitePool>, id: web::Path<Uuid>) -> impl Responder {
    match db::buildings::delete(pool.get_ref(), id.into_inner()).await {
        Ok(true) => HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
            "deleted": true
        }))),
        Ok(false) => HttpResponse::NotFound().json(ApiResponse::<serde_json::Value>::error("Building not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<serde_json::Value>::error(&format!(
            "Failed to delete building: {}",
            e
        ))),
    }
}
