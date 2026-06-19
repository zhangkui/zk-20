use actix_cors::Cors;
use actix_web::{middleware, web, App, HttpServer};
use dotenvy::dotenv;
use std::env;

mod db;
mod handlers;
mod models;
mod mqtt;
mod routes;
mod services;
mod websocket;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();
    env_logger::init();

    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let server_host = env::var("SERVER_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let server_port = env::var("SERVER_PORT").unwrap_or_else(|_| "8080".to_string());
    let server_addr = format!("{}:{}", server_host, server_port);

    let pool = db::init_pool(&database_url).await;

    log::info!("Running database migrations...");
    if let Err(e) = db::run_migrations(&pool).await {
        log::error!("Failed to run migrations: {}", e);
        return Err(std::io::Error::new(std::io::ErrorKind::Other, e.to_string()));
    }

    let ws_manager = websocket::WebSocketManager::new();
    let ws_manager_for_app = ws_manager.clone();
    let ws_manager_for_routes = ws_manager.clone();

    log::info!("Starting MQTT service...");
    let mqtt_pool = pool.clone();
    let mqtt_ws_manager = ws_manager.clone();
    tokio::spawn(async move {
        match mqtt::MqttService::new(mqtt_pool, mqtt_ws_manager).await {
            Ok(_mqtt_service) => {
                log::info!("MQTT service started successfully");
            }
            Err(e) => {
                log::warn!("Failed to start MQTT service (will continue without MQTT): {}", e);
            }
        }
    });

    log::info!("Starting server at http://{}", server_addr);

    HttpServer::new(move || {
        let cors = Cors::permissive();

        App::new()
            .app_data(web::Data::new(pool.clone()))
            .app_data(web::Data::new(ws_manager_for_app.clone()))
            .wrap(cors)
            .wrap(middleware::Logger::default())
            .configure(|cfg| routes::init(cfg, ws_manager_for_routes.clone()))
    })
    .bind(&server_addr)?
    .run()
    .await
}
