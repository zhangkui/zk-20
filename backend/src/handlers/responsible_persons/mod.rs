use actix_web::{web, HttpResponse, Responder};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::db;
use crate::handlers::ApiResponse;
use crate::models::{CreateResponsiblePerson, ResponsiblePerson};

pub async fn list(pool: web::Data<SqlitePool>) -> impl Responder {
    match db::responsible_persons::list(pool.get_ref()).await {
        Ok(persons) => HttpResponse::Ok().json(ApiResponse::success(persons)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Vec<ResponsiblePerson>>::error(&format!(
            "Failed to fetch responsible persons: {}",
            e
        ))),
    }
}

pub async fn get_by_id(
    pool: web::Data<SqlitePool>,
    id: web::Path<Uuid>,
) -> impl Responder {
    match db::responsible_persons::get_by_id(pool.get_ref(), id.into_inner()).await {
        Ok(Some(person)) => HttpResponse::Ok().json(ApiResponse::success(person)),
        Ok(None) => HttpResponse::NotFound().json(ApiResponse::<ResponsiblePerson>::error("Responsible person not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<ResponsiblePerson>::error(&format!(
            "Failed to fetch responsible person: {}",
            e
        ))),
    }
}

pub async fn list_by_building(
    pool: web::Data<SqlitePool>,
    building_id: web::Path<Uuid>,
) -> impl Responder {
    match db::responsible_persons::list_by_building(pool.get_ref(), building_id.into_inner()).await {
        Ok(persons) => HttpResponse::Ok().json(ApiResponse::success(persons)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Vec<ResponsiblePerson>>::error(&format!(
            "Failed to fetch responsible persons: {}",
            e
        ))),
    }
}

pub async fn list_active_by_building(
    pool: web::Data<SqlitePool>,
    building_id: web::Path<Uuid>,
) -> impl Responder {
    match db::responsible_persons::list_active_by_building(pool.get_ref(), building_id.into_inner()).await {
        Ok(persons) => HttpResponse::Ok().json(ApiResponse::success(persons)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Vec<ResponsiblePerson>>::error(&format!(
            "Failed to fetch responsible persons: {}",
            e
        ))),
    }
}

pub async fn create(
    pool: web::Data<SqlitePool>,
    data: web::Json<CreateResponsiblePerson>,
) -> impl Responder {
    match db::responsible_persons::create(pool.get_ref(), data.into_inner()).await {
        Ok(person) => HttpResponse::Created().json(ApiResponse::success(person)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<ResponsiblePerson>::error(&format!(
            "Failed to create responsible person: {}",
            e
        ))),
    }
}

pub async fn deactivate(
    pool: web::Data<SqlitePool>,
    id: web::Path<Uuid>,
) -> impl Responder {
    match db::responsible_persons::deactivate(pool.get_ref(), id.into_inner()).await {
        Ok(true) => HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
            "deactivated": true
        }))),
        Ok(false) => HttpResponse::NotFound().json(ApiResponse::<serde_json::Value>::error("Responsible person not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<serde_json::Value>::error(&format!(
            "Failed to deactivate responsible person: {}",
            e
        ))),
    }
}

pub async fn delete(pool: web::Data<SqlitePool>, id: web::Path<Uuid>) -> impl Responder {
    match db::responsible_persons::delete(pool.get_ref(), id.into_inner()).await {
        Ok(true) => HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
            "deleted": true
        }))),
        Ok(false) => HttpResponse::NotFound().json(ApiResponse::<serde_json::Value>::error("Responsible person not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<serde_json::Value>::error(&format!(
            "Failed to delete responsible person: {}",
            e
        ))),
    }
}
