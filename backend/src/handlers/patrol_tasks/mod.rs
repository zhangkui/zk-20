use actix_web::{web, HttpResponse, Responder};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::db;
use crate::handlers::{
    ApiResponse, CompletePatrolTaskRequest, CreatePatrolTaskRequest, GeneratePatrolTasksRequest,
    UpdatePatrolTaskRequest,
};
use crate::models::{CompletePatrolTask, CreatePatrolTask, PatrolTask, UpdatePatrolTask};

pub async fn list(pool: web::Data<SqlitePool>) -> impl Responder {
    match db::patrol_tasks::list(pool.get_ref(), 100).await {
        Ok(items) => HttpResponse::Ok().json(ApiResponse::success(items)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Vec<PatrolTask>>::error(&format!(
            "Failed to fetch patrol tasks: {}",
            e
        ))),
    }
}

pub async fn get_by_id(pool: web::Data<SqlitePool>, id: web::Path<Uuid>) -> impl Responder {
    match db::patrol_tasks::get_by_id(pool.get_ref(), id.into_inner()).await {
        Ok(Some(item)) => HttpResponse::Ok().json(ApiResponse::success(item)),
        Ok(None) => HttpResponse::NotFound().json(ApiResponse::<PatrolTask>::error("Patrol task not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<PatrolTask>::error(&format!(
            "Failed to fetch patrol task: {}",
            e
        ))),
    }
}

pub async fn list_by_building(
    pool: web::Data<SqlitePool>,
    building_id: web::Path<Uuid>,
) -> impl Responder {
    match db::patrol_tasks::list_by_building(pool.get_ref(), building_id.into_inner()).await {
        Ok(items) => HttpResponse::Ok().json(ApiResponse::success(items)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Vec<PatrolTask>>::error(&format!(
            "Failed to fetch patrol tasks: {}",
            e
        ))),
    }
}

pub async fn list_by_personnel(
    pool: web::Data<SqlitePool>,
    personnel_id: web::Path<Uuid>,
) -> impl Responder {
    match db::patrol_tasks::list_by_personnel(pool.get_ref(), personnel_id.into_inner()).await {
        Ok(items) => HttpResponse::Ok().json(ApiResponse::success(items)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Vec<PatrolTask>>::error(&format!(
            "Failed to fetch patrol tasks: {}",
            e
        ))),
    }
}

pub async fn list_by_status(
    pool: web::Data<SqlitePool>,
    query: web::Query<std::collections::HashMap<String, String>>,
) -> impl Responder {
    let status = query.get("status").cloned().unwrap_or_else(|| "pending".to_string());
    match db::patrol_tasks::list_by_status(pool.get_ref(), &status).await {
        Ok(items) => HttpResponse::Ok().json(ApiResponse::success(items)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Vec<PatrolTask>>::error(&format!(
            "Failed to fetch patrol tasks: {}",
            e
        ))),
    }
}

pub async fn create(
    pool: web::Data<SqlitePool>,
    data: web::Json<CreatePatrolTaskRequest>,
) -> impl Responder {
    let req = data.into_inner();
    let task_data = CreatePatrolTask {
        building_id: req.building_id,
        personnel_id: req.personnel_id,
        task_name: req.task_name,
        task_type: req.task_type,
        risk_level: req.risk_level,
        scheduled_start: req.scheduled_start,
        scheduled_end: req.scheduled_end,
        notes: req.notes,
    };
    match db::patrol_tasks::create(pool.get_ref(), task_data).await {
        Ok(item) => HttpResponse::Created().json(ApiResponse::success(item)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<PatrolTask>::error(&format!(
            "Failed to create patrol task: {}",
            e
        ))),
    }
}

pub async fn update(
    pool: web::Data<SqlitePool>,
    id: web::Path<Uuid>,
    data: web::Json<UpdatePatrolTaskRequest>,
) -> impl Responder {
    let req = data.into_inner();
    let task_data = UpdatePatrolTask {
        personnel_id: req.personnel_id,
        task_name: req.task_name,
        task_type: req.task_type,
        risk_level: req.risk_level,
        scheduled_start: req.scheduled_start,
        scheduled_end: req.scheduled_end,
        status: req.status,
        notes: req.notes,
    };
    match db::patrol_tasks::update(pool.get_ref(), id.into_inner(), task_data).await {
        Ok(Some(item)) => HttpResponse::Ok().json(ApiResponse::success(item)),
        Ok(None) => HttpResponse::NotFound().json(ApiResponse::<PatrolTask>::error("Patrol task not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<PatrolTask>::error(&format!(
            "Failed to update patrol task: {}",
            e
        ))),
    }
}

pub async fn start(pool: web::Data<SqlitePool>, id: web::Path<Uuid>) -> impl Responder {
    match db::patrol_tasks::start(pool.get_ref(), id.into_inner()).await {
        Ok(Some(item)) => HttpResponse::Ok().json(ApiResponse::success(item)),
        Ok(None) => HttpResponse::NotFound().json(ApiResponse::<PatrolTask>::error("Patrol task not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<PatrolTask>::error(&format!(
            "Failed to start patrol task: {}",
            e
        ))),
    }
}

pub async fn complete(
    pool: web::Data<SqlitePool>,
    id: web::Path<Uuid>,
    data: web::Json<CompletePatrolTaskRequest>,
) -> impl Responder {
    let req = data.into_inner();
    let complete_data = CompletePatrolTask {
        inspection_result: req.inspection_result,
        findings: req.findings,
        completed_risk_level: req.completed_risk_level,
    };
    match db::patrol_tasks::complete(pool.get_ref(), id.into_inner(), complete_data).await {
        Ok(Some(item)) => HttpResponse::Ok().json(ApiResponse::success(item)),
        Ok(None) => HttpResponse::NotFound().json(ApiResponse::<PatrolTask>::error("Patrol task not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<PatrolTask>::error(&format!(
            "Failed to complete patrol task: {}",
            e
        ))),
    }
}

pub async fn delete(pool: web::Data<SqlitePool>, id: web::Path<Uuid>) -> impl Responder {
    match db::patrol_tasks::delete(pool.get_ref(), id.into_inner()).await {
        Ok(true) => HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
            "deleted": true
        }))),
        Ok(false) => HttpResponse::NotFound().json(ApiResponse::<serde_json::Value>::error("Patrol task not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<serde_json::Value>::error(&format!(
            "Failed to delete patrol task: {}",
            e
        ))),
    }
}

pub async fn generate_daily(
    pool: web::Data<SqlitePool>,
    data: web::Json<GeneratePatrolTasksRequest>,
) -> impl Responder {
    let date = match &data.date {
        Some(d) => match chrono::DateTime::parse_from_rfc3339(d) {
            Ok(dt) => dt.with_timezone(&chrono::Utc),
            Err(_) => chrono::Utc::now(),
        },
        None => chrono::Utc::now(),
    };
    match db::patrol_tasks::generate_daily_tasks(pool.get_ref(), date).await {
        Ok(items) => HttpResponse::Ok().json(ApiResponse::success(items)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Vec<PatrolTask>>::error(&format!(
            "Failed to generate daily patrol tasks: {}",
            e
        ))),
    }
}
