use actix_web::{web, HttpResponse, Responder};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::db;
use crate::handlers::{ApiResponse, CreateAlertDispatchRequest, HandleAlertRequest, CloseAlertRequest};
use crate::models::{AlertDispatch, CreateAlertDispatch};

pub async fn list(pool: web::Data<SqlitePool>) -> impl Responder {
    match db::alert_dispatches::list(pool.get_ref(), 100).await {
        Ok(items) => HttpResponse::Ok().json(ApiResponse::success(items)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Vec<AlertDispatch>>::error(&format!(
            "Failed to fetch alert dispatches: {}",
            e
        ))),
    }
}

pub async fn get_by_id(pool: web::Data<SqlitePool>, id: web::Path<Uuid>) -> impl Responder {
    match db::alert_dispatches::get_by_id(pool.get_ref(), id.into_inner()).await {
        Ok(Some(item)) => HttpResponse::Ok().json(ApiResponse::success(item)),
        Ok(None) => HttpResponse::NotFound().json(ApiResponse::<AlertDispatch>::error("Alert dispatch not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<AlertDispatch>::error(&format!(
            "Failed to fetch alert dispatch: {}",
            e
        ))),
    }
}

pub async fn list_by_alert(
    pool: web::Data<SqlitePool>,
    alert_id: web::Path<Uuid>,
) -> impl Responder {
    match db::alert_dispatches::list_by_alert(pool.get_ref(), alert_id.into_inner()).await {
        Ok(items) => HttpResponse::Ok().json(ApiResponse::success(items)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Vec<AlertDispatch>>::error(&format!(
            "Failed to fetch alert dispatches: {}",
            e
        ))),
    }
}

pub async fn list_by_personnel(
    pool: web::Data<SqlitePool>,
    personnel_id: web::Path<Uuid>,
) -> impl Responder {
    match db::alert_dispatches::list_by_personnel(pool.get_ref(), personnel_id.into_inner()).await {
        Ok(items) => HttpResponse::Ok().json(ApiResponse::success(items)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Vec<AlertDispatch>>::error(&format!(
            "Failed to fetch alert dispatches: {}",
            e
        ))),
    }
}

pub async fn create(
    pool: web::Data<SqlitePool>,
    data: web::Json<CreateAlertDispatchRequest>,
) -> impl Responder {
    let req = data.into_inner();
    let dispatch_data = CreateAlertDispatch {
        alert_id: req.alert_id,
        dispatched_by: req.dispatched_by,
        dispatched_to: req.dispatched_to,
        dispatch_reason: req.dispatch_reason,
    };
    match db::alert_dispatches::create(pool.get_ref(), dispatch_data).await {
        Ok(item) => HttpResponse::Created().json(ApiResponse::success(item)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<AlertDispatch>::error(&format!(
            "Failed to create alert dispatch: {}",
            e
        ))),
    }
}

pub async fn accept(pool: web::Data<SqlitePool>, id: web::Path<Uuid>) -> impl Responder {
    match db::alert_dispatches::accept(pool.get_ref(), id.into_inner()).await {
        Ok(Some(item)) => HttpResponse::Ok().json(ApiResponse::success(item)),
        Ok(None) => HttpResponse::NotFound().json(ApiResponse::<AlertDispatch>::error("Alert dispatch not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<AlertDispatch>::error(&format!(
            "Failed to accept alert dispatch: {}",
            e
        ))),
    }
}

pub async fn arrive(
    pool: web::Data<SqlitePool>,
    id: web::Path<Uuid>,
    data: web::Json<HandleAlertRequest>,
) -> impl Responder {
    match db::alert_dispatches::arrive(pool.get_ref(), id.into_inner(), Some(data.handling_notes.clone())).await {
        Ok(Some(item)) => HttpResponse::Ok().json(ApiResponse::success(item)),
        Ok(None) => HttpResponse::NotFound().json(ApiResponse::<AlertDispatch>::error("Alert dispatch not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<AlertDispatch>::error(&format!(
            "Failed to mark arrived: {}",
            e
        ))),
    }
}

pub async fn handle(
    pool: web::Data<SqlitePool>,
    id: web::Path<Uuid>,
    data: web::Json<HandleAlertRequest>,
) -> impl Responder {
    match db::alert_dispatches::handle(pool.get_ref(), id.into_inner(), Some(data.handling_notes.clone())).await {
        Ok(Some(item)) => HttpResponse::Ok().json(ApiResponse::success(item)),
        Ok(None) => HttpResponse::NotFound().json(ApiResponse::<AlertDispatch>::error("Alert dispatch not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<AlertDispatch>::error(&format!(
            "Failed to handle alert dispatch: {}",
            e
        ))),
    }
}

pub async fn close(
    pool: web::Data<SqlitePool>,
    id: web::Path<Uuid>,
    data: web::Json<CloseAlertRequest>,
) -> impl Responder {
    match db::alert_dispatches::close(pool.get_ref(), id.into_inner(), data.handling_notes.clone()).await {
        Ok(Some(item)) => HttpResponse::Ok().json(ApiResponse::success(item)),
        Ok(None) => HttpResponse::NotFound().json(ApiResponse::<AlertDispatch>::error("Alert dispatch not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<AlertDispatch>::error(&format!(
            "Failed to close alert dispatch: {}",
            e
        ))),
    }
}

pub async fn delete(pool: web::Data<SqlitePool>, id: web::Path<Uuid>) -> impl Responder {
    match db::alert_dispatches::delete(pool.get_ref(), id.into_inner()).await {
        Ok(true) => HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
            "deleted": true
        }))),
        Ok(false) => HttpResponse::NotFound().json(ApiResponse::<serde_json::Value>::error("Alert dispatch not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<serde_json::Value>::error(&format!(
            "Failed to delete alert dispatch: {}",
            e
        ))),
    }
}
