use actix_web::{web, dev::HttpServiceFactory};
use std::sync::Arc;

use crate::handlers;
use crate::websocket::{self, WebSocketManager};

pub fn init(cfg: &mut web::ServiceConfig, ws_manager: Arc<WebSocketManager>) {
    cfg.app_data(web::Data::new(ws_manager.clone()));

    cfg.route("/health", web::get().to(handlers::health_check));
    cfg.route("/ws", web::get().to(websocket::ws_handler));

    cfg.service(
        web::scope("/api")
            .service(buildings_routes())
            .service(devices_routes())
            .service(thermal_data_routes())
            .service(hotspots_routes())
            .service(patrol_personnel_routes())
            .service(patrol_locations_routes())
            .service(alerts_routes())
            .service(responsible_persons_routes())
            .service(statistics_routes())
    );
}

fn buildings_routes() -> impl HttpServiceFactory {
    web::scope("/buildings")
        .route("", web::post().to(handlers::buildings::create))
        .route("", web::get().to(handlers::buildings::list))
        .route("/{id}", web::get().to(handlers::buildings::get_by_id))
        .route("/{id}", web::put().to(handlers::buildings::update))
        .route("/{id}/toggle-status", web::put().to(handlers::buildings::toggle_status))
        .route("/{id}", web::delete().to(handlers::buildings::delete))
}

fn devices_routes() -> impl HttpServiceFactory {
    web::scope("/devices")
        .route("", web::post().to(handlers::devices::create))
        .route("", web::get().to(handlers::devices::list))
        .route("/{id}", web::get().to(handlers::devices::get_by_id))
        .route("/building/{building_id}", web::get().to(handlers::devices::list_by_building))
        .route("/{id}/heartbeat", web::put().to(handlers::devices::update_heartbeat))
        .route("/{id}", web::delete().to(handlers::devices::delete))
}

fn thermal_data_routes() -> impl HttpServiceFactory {
    web::scope("/thermal-data")
        .route("", web::post().to(handlers::thermal_data::create))
        .route("/{id}", web::get().to(handlers::thermal_data::get_by_id))
        .route("/device/{device_id}", web::get().to(handlers::thermal_data::list_by_device))
        .route("/building/{building_id}/time-range", web::get().to(handlers::thermal_data::list_by_building_time_range))
        .route("/{id}", web::delete().to(handlers::thermal_data::delete))
}

fn hotspots_routes() -> impl HttpServiceFactory {
    web::scope("/hotspots")
        .route("", web::post().to(handlers::hotspots::create))
        .route("", web::get().to(handlers::hotspots::list))
        .route("/{id}", web::get().to(handlers::hotspots::get_by_id))
        .route("/building/{building_id}", web::get().to(handlers::hotspots::list_by_building))
        .route("/risk", web::get().to(handlers::hotspots::list_by_risk))
        .route("/{id}/status", web::put().to(handlers::hotspots::update_status))
        .route("/{id}", web::delete().to(handlers::hotspots::delete))
}

fn patrol_personnel_routes() -> impl HttpServiceFactory {
    web::scope("/patrol-personnel")
        .route("", web::post().to(handlers::patrol_personnel::create))
        .route("", web::get().to(handlers::patrol_personnel::list))
        .route("/{id}", web::get().to(handlers::patrol_personnel::get_by_id))
        .route("/{id}/status", web::put().to(handlers::patrol_personnel::update_status))
        .route("/{id}/location", web::put().to(handlers::patrol_personnel::update_location))
        .route("/{id}", web::delete().to(handlers::patrol_personnel::delete))
}

fn patrol_locations_routes() -> impl HttpServiceFactory {
    web::scope("/patrol-locations")
        .route("", web::post().to(handlers::patrol_locations::create))
        .route("/{id}", web::get().to(handlers::patrol_locations::get_by_id))
        .route("/personnel/{personnel_id}", web::get().to(handlers::patrol_locations::list_by_personnel))
        .route("/personnel/{personnel_id}/time-range", web::get().to(handlers::patrol_locations::list_by_personnel_time_range))
        .route("/{id}", web::delete().to(handlers::patrol_locations::delete))
}

fn alerts_routes() -> impl HttpServiceFactory {
    web::scope("/alerts")
        .route("", web::post().to(handlers::alerts::create))
        .route("", web::get().to(handlers::alerts::list))
        .route("/{id}", web::get().to(handlers::alerts::get_by_id))
        .route("/building/{building_id}", web::get().to(handlers::alerts::list_by_building))
        .route("/status", web::get().to(handlers::alerts::list_by_status))
        .route("/{id}/acknowledge", web::put().to(handlers::alerts::acknowledge))
        .route("/{id}/resolve", web::put().to(handlers::alerts::resolve))
        .route("/{id}/playback", web::get().to(handlers::alert_playback::get_by_alert_id))
        .route("/{id}/playback", web::post().to(handlers::alert_playback::create))
        .route("/{id}", web::delete().to(handlers::alerts::delete))
}

fn responsible_persons_routes() -> impl HttpServiceFactory {
    web::scope("/responsible-persons")
        .route("", web::post().to(handlers::responsible_persons::create))
        .route("", web::get().to(handlers::responsible_persons::list))
        .route("/{id}", web::get().to(handlers::responsible_persons::get_by_id))
        .route("/building/{building_id}", web::get().to(handlers::responsible_persons::list_by_building))
        .route("/building/{building_id}/active", web::get().to(handlers::responsible_persons::list_active_by_building))
        .route("/{id}/deactivate", web::put().to(handlers::responsible_persons::deactivate))
        .route("/{id}", web::delete().to(handlers::responsible_persons::delete))
}

fn statistics_routes() -> impl HttpServiceFactory {
    web::scope("/statistics")
        .route("/building/{building_id}", web::get().to(handlers::statistics::list_by_building))
        .route("/building/{building_id}/time-range", web::get().to(handlers::statistics::list_by_building_time_range))
        .route("/building/{building_id}/aggregate-by-hour", web::get().to(handlers::statistics::aggregate_by_hour))
        .route("/building/{building_id}/daily-summary", web::get().to(handlers::statistics::get_daily_summary))
}
