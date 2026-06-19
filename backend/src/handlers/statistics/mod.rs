use actix_web::{web, HttpResponse, Responder};
use chrono::{DateTime, Duration, Utc};
use serde::Deserialize;
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::db;
use crate::handlers::{AnalyzeHotspotsRequest, ApiResponse};
use crate::models::RiskStatsSummary;

#[derive(Deserialize)]
pub struct TimeRangeQuery {
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
}

pub async fn list_by_building(
    pool: web::Data<SqlitePool>,
    building_id: web::Path<Uuid>,
) -> impl Responder {
    match db::high_risk_stats::list_by_building(pool.get_ref(), building_id.into_inner(), 168).await {
        Ok(stats) => HttpResponse::Ok().json(ApiResponse::success(stats)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<serde_json::Value>::error(&format!(
            "Failed to fetch stats: {}",
            e
        ))),
    }
}

pub async fn list_by_building_time_range(
    pool: web::Data<SqlitePool>,
    building_id: web::Path<Uuid>,
    query: web::Query<TimeRangeQuery>,
) -> impl Responder {
    match db::high_risk_stats::list_by_building_time_range(pool.get_ref(), building_id.into_inner(), query.start, query.end).await {
        Ok(stats) => HttpResponse::Ok().json(ApiResponse::success(stats)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<serde_json::Value>::error(&format!(
            "Failed to fetch stats: {}",
            e
        ))),
    }
}

pub async fn aggregate_by_hour(
    pool: web::Data<SqlitePool>,
    building_id: web::Path<Uuid>,
) -> impl Responder {
    let end = Utc::now();
    let start = end - Duration::days(7);
    match db::high_risk_stats::aggregate_by_hour(pool.get_ref(), building_id.into_inner(), start, end).await {
        Ok(stats) => HttpResponse::Ok().json(ApiResponse::success(stats)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Vec<RiskStatsSummary>>::error(&format!(
            "Failed to fetch stats by hour: {}",
            e
        ))),
    }
}

pub async fn get_daily_summary(
    pool: web::Data<SqlitePool>,
    building_id: web::Path<Uuid>,
) -> impl Responder {
    let today = Utc::now();
    match db::high_risk_stats::get_daily_summary(pool.get_ref(), building_id.into_inner(), today).await {
        Ok(summary) => HttpResponse::Ok().json(ApiResponse::success(summary)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<Vec<RiskStatsSummary>>::error(&format!(
            "Failed to fetch daily summary: {}",
            e
        ))),
    }
}

pub async fn analyze_hotspots(
    pool: web::Data<SqlitePool>,
    data: web::Json<AnalyzeHotspotsRequest>,
) -> impl Responder {
    let thermal_data_id = data.thermal_data_id;
    
    let thermal_data = match db::thermal_data::get_by_id(pool.get_ref(), thermal_data_id).await {
        Ok(Some(data)) => data,
        Ok(None) => return HttpResponse::NotFound().json(ApiResponse::<serde_json::Value>::error("Thermal data not found")),
        Err(e) => return HttpResponse::InternalServerError().json(ApiResponse::<serde_json::Value>::error(&format!(
            "Failed to fetch thermal data: {}",
            e
        ))),
    };

    let hotspots = match db::hotspots::list_by_building(pool.get_ref(), thermal_data.building_id, 10).await {
        Ok(h) => h,
        Err(e) => return HttpResponse::InternalServerError().json(ApiResponse::<serde_json::Value>::error(&format!(
            "Failed to fetch hotspots: {}",
            e
        ))),
    };

    let high_risk_count = hotspots.iter().filter(|h| h.risk_level == "high").count();
    let medium_risk_count = hotspots.iter().filter(|h| h.risk_level == "medium").count();
    let low_risk_count = hotspots.iter().filter(|h| h.risk_level == "low").count();

    let analysis_result = serde_json::json!({
        "thermal_data_id": thermal_data_id,
        "building_id": thermal_data.building_id,
        "device_id": thermal_data.device_id,
        "timestamp": thermal_data.timestamp,
        "min_temp": thermal_data.min_temp,
        "max_temp": thermal_data.max_temp,
        "avg_temp": thermal_data.avg_temp,
        "hotspot_count": hotspots.len(),
        "high_risk_count": high_risk_count,
        "medium_risk_count": medium_risk_count,
        "low_risk_count": low_risk_count,
        "hotspots": hotspots,
        "analysis_time": Utc::now()
    });

    HttpResponse::Ok().json(ApiResponse::success(analysis_result))
}
