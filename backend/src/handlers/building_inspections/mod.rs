use actix_web::{web, HttpResponse, Responder};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::db;
use crate::handlers::{
    ApiResponse, CreateBuildingInspectionRequest, UpdateBuildingInspectionRequest,
    UpdateStatusRequest,
};
use crate::models::{BuildingInspectionRecord, CreateBuildingInspectionRecord, UpdateBuildingInspectionRecord};

pub async fn list(pool: web::Data<SqlitePool>) -> impl Responder {
    match db::building_inspection_records::list(pool.get_ref(), 100).await {
        Ok(items) => HttpResponse::Ok().json(ApiResponse::success(items)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Vec<BuildingInspectionRecord>>::error(&format!(
            "Failed to fetch building inspection records: {}",
            e
        ))),
    }
}

pub async fn get_by_id(pool: web::Data<SqlitePool>, id: web::Path<Uuid>) -> impl Responder {
    match db::building_inspection_records::get_by_id(pool.get_ref(), id.into_inner()).await {
        Ok(Some(item)) => HttpResponse::Ok().json(ApiResponse::success(item)),
        Ok(None) => HttpResponse::NotFound().json(ApiResponse::<BuildingInspectionRecord>::error("Building inspection record not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<BuildingInspectionRecord>::error(&format!(
            "Failed to fetch building inspection record: {}",
            e
        ))),
    }
}

pub async fn list_by_building(
    pool: web::Data<SqlitePool>,
    building_id: web::Path<Uuid>,
) -> impl Responder {
    match db::building_inspection_records::list_by_building(pool.get_ref(), building_id.into_inner()).await {
        Ok(items) => HttpResponse::Ok().json(ApiResponse::success(items)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Vec<BuildingInspectionRecord>>::error(&format!(
            "Failed to fetch building inspection records: {}",
            e
        ))),
    }
}

pub async fn list_by_rectification_status(
    pool: web::Data<SqlitePool>,
    query: web::Query<std::collections::HashMap<String, String>>,
) -> impl Responder {
    let status = query.get("status").cloned().unwrap_or_else(|| "pending".to_string());
    match db::building_inspection_records::list_by_status(pool.get_ref(), &status).await {
        Ok(items) => HttpResponse::Ok().json(ApiResponse::success(items)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Vec<BuildingInspectionRecord>>::error(&format!(
            "Failed to fetch building inspection records: {}",
            e
        ))),
    }
}

pub async fn create(
    pool: web::Data<SqlitePool>,
    data: web::Json<CreateBuildingInspectionRequest>,
) -> impl Responder {
    let req = data.into_inner();
    let record_data = CreateBuildingInspectionRecord {
        building_id: req.building_id,
        inspector_id: req.inspector_id,
        inspection_date: req.inspection_date,
        risk_level_before: req.risk_level_before,
        risk_level_after: req.risk_level_after,
        findings: req.findings,
        rectification_status: req.rectification_status,
        rectification_deadline: req.rectification_deadline,
        rectification_notes: req.rectification_notes,
        alert_count: req.alert_count,
        hotspot_count: req.hotspot_count,
        notes: req.notes,
    };
    match db::building_inspection_records::create(pool.get_ref(), record_data).await {
        Ok(item) => HttpResponse::Created().json(ApiResponse::success(item)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<BuildingInspectionRecord>::error(&format!(
            "Failed to create building inspection record: {}",
            e
        ))),
    }
}

pub async fn update(
    pool: web::Data<SqlitePool>,
    id: web::Path<Uuid>,
    data: web::Json<UpdateBuildingInspectionRequest>,
) -> impl Responder {
    let req = data.into_inner();
    let record_data = UpdateBuildingInspectionRecord {
        inspector_id: req.inspector_id,
        inspection_date: req.inspection_date,
        risk_level_before: req.risk_level_before,
        risk_level_after: req.risk_level_after,
        findings: req.findings,
        rectification_status: req.rectification_status,
        rectification_deadline: req.rectification_deadline,
        rectification_notes: req.rectification_notes,
        alert_count: req.alert_count,
        hotspot_count: req.hotspot_count,
        notes: req.notes,
    };
    match db::building_inspection_records::update(pool.get_ref(), id.into_inner(), record_data).await {
        Ok(Some(item)) => HttpResponse::Ok().json(ApiResponse::success(item)),
        Ok(None) => HttpResponse::NotFound().json(ApiResponse::<BuildingInspectionRecord>::error("Building inspection record not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<BuildingInspectionRecord>::error(&format!(
            "Failed to update building inspection record: {}",
            e
        ))),
    }
}

pub async fn update_rectification(
    pool: web::Data<SqlitePool>,
    id: web::Path<Uuid>,
    data: web::Json<UpdateStatusRequest>,
) -> impl Responder {
    match db::building_inspection_records::update_rectification(pool.get_ref(), id.into_inner(), &data.status, None).await {
        Ok(Some(item)) => HttpResponse::Ok().json(ApiResponse::success(item)),
        Ok(None) => HttpResponse::NotFound().json(ApiResponse::<BuildingInspectionRecord>::error("Building inspection record not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<BuildingInspectionRecord>::error(&format!(
            "Failed to update rectification status: {}",
            e
        ))),
    }
}

pub async fn delete(pool: web::Data<SqlitePool>, id: web::Path<Uuid>) -> impl Responder {
    match db::building_inspection_records::delete(pool.get_ref(), id.into_inner()).await {
        Ok(true) => HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
            "deleted": true
        }))),
        Ok(false) => HttpResponse::NotFound().json(ApiResponse::<serde_json::Value>::error("Building inspection record not found")),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<serde_json::Value>::error(&format!(
            "Failed to delete building inspection record: {}",
            e
        ))),
    }
}
