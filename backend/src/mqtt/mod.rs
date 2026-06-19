use chrono::{DateTime, Utc};
use log::{debug, error, info, warn};
use rumqttc::{AsyncClient, Event, EventLoop, MqttOptions, Packet, QoS};
use serde::{Deserialize, Serialize};
use std::env;
use std::sync::Arc;
use uuid::Uuid;

use crate::db::DbPool;
use crate::models::{
    Alert, CreateAlert, CreateHotspot, CreatePatrolLocation, CreateThermalData, Hotspot,
};
use crate::services::thermal_analysis::{HotspotDetector, RiskAssessment, ThermalAnalyzer};
use crate::websocket::{
    AlertNotification, BroadcastMessage, DeviceStatus, PatrolLocationUpdate, WebSocketManager,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThermalDataMessage {
    pub device_id: Uuid,
    pub building_id: Uuid,
    pub temperature_matrix: String,
    pub min_temp: f64,
    pub max_temp: f64,
    pub avg_temp: f64,
    pub resolution_width: i32,
    pub resolution_height: i32,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatrolLocationMessage {
    pub personnel_id: Uuid,
    pub latitude: f64,
    pub longitude: f64,
    pub accuracy: Option<f64>,
    pub battery_level: Option<f64>,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceHeartbeatMessage {
    pub device_id: Uuid,
    pub status: String,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceStatusMessage {
    pub device_id: Uuid,
    pub status: String,
    pub timestamp: DateTime<Utc>,
}

pub struct MqttService {
    client: AsyncClient,
    pool: DbPool,
    ws_manager: Arc<WebSocketManager>,
    hotspot_detector: HotspotDetector,
    thermal_analyzer: ThermalAnalyzer,
    risk_assessment: RiskAssessment,
}

impl MqttService {
    pub async fn new(pool: DbPool, ws_manager: Arc<WebSocketManager>) -> Result<Self, String> {
        let host = env::var("MQTT_HOST").unwrap_or_else(|_| "localhost".to_string());
        let port = env::var("MQTT_PORT")
            .ok()
            .and_then(|p| p.parse::<u16>().ok())
            .unwrap_or(1883);
        let client_id =
            env::var("MQTT_CLIENT_ID").unwrap_or_else(|_| format!("zk-20-backend-{}", Uuid::new_v4()));

        let mut mqtt_options = MqttOptions::new(client_id, host, port);
        mqtt_options.set_keep_alive(std::time::Duration::from_secs(30));

        let (client, eventloop) = AsyncClient::new(mqtt_options, 100);

        let service = Self {
            client,
            pool,
            ws_manager,
            hotspot_detector: HotspotDetector::new(),
            thermal_analyzer: ThermalAnalyzer::new(),
            risk_assessment: RiskAssessment::new(),
        };

        service.subscribe_topics().await?;
        service.spawn_event_loop(eventloop);

        Ok(service)
    }

    async fn subscribe_topics(&self) -> Result<(), String> {
        let topics = [
            "thermal/+/data",
            "patrol/+/location",
            "device/+/heartbeat",
            "device/+/status",
        ];

        for topic in topics.iter() {
            self.client
                .subscribe(*topic, QoS::AtLeastOnce)
                .await
                .map_err(|e| format!("订阅主题 {} 失败: {}", topic, e))?;
            info!("已订阅 MQTT 主题: {}", topic);
        }

        Ok(())
    }

    fn spawn_event_loop(&self, mut eventloop: EventLoop) {
        let pool = self.pool.clone();
        let ws_manager = self.ws_manager.clone();
        let hotspot_detector = self.hotspot_detector.clone();
        let thermal_analyzer = self.thermal_analyzer.clone();
        let risk_assessment = self.risk_assessment.clone();

        tokio::spawn(async move {
            loop {
                match eventloop.poll().await {
                    Ok(Event::Incoming(Packet::Publish(publish))) => {
                        let topic = publish.topic.clone();
                        let payload = publish.payload.to_vec();

                        let pool_clone = pool.clone();
                        let ws_manager_clone = ws_manager.clone();
                        let hotspot_detector_clone = hotspot_detector.clone();
                        let thermal_analyzer_clone = thermal_analyzer.clone();
                        let risk_assessment_clone = risk_assessment.clone();

                        tokio::spawn(async move {
                            if let Err(e) = handle_message(
                                topic,
                                payload,
                                pool_clone,
                                ws_manager_clone,
                                hotspot_detector_clone,
                                thermal_analyzer_clone,
                                risk_assessment_clone,
                            )
                            .await
                            {
                                error!("处理 MQTT 消息失败: {}", e);
                            }
                        });
                    }
                    Ok(Event::Incoming(_)) => {}
                    Ok(Event::Outgoing(_)) => {}
                    Err(e) => {
                        error!("MQTT 事件循环错误: {}", e);
                        tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                    }
                }
            }
        });
    }

    pub fn client(&self) -> &AsyncClient {
        &self.client
    }
}

async fn handle_message(
    topic: String,
    payload: Vec<u8>,
    pool: DbPool,
    ws_manager: Arc<WebSocketManager>,
    hotspot_detector: HotspotDetector,
    thermal_analyzer: ThermalAnalyzer,
    risk_assessment: RiskAssessment,
) -> Result<(), String> {
    debug!("收到 MQTT 消息，主题: {}, 长度: {} 字节", topic, payload.len());

    let topic_parts: Vec<&str> = topic.split('/').collect();

    match topic_parts.as_slice() {
        ["thermal", _, "data"] => {
            handle_thermal_data(&payload, &pool, &ws_manager, &hotspot_detector, &thermal_analyzer, &risk_assessment)
                .await
        }
        ["patrol", _, "location"] => {
            handle_patrol_location(&payload, &pool, &ws_manager).await
        }
        ["device", _, "heartbeat"] => {
            handle_device_heartbeat(&payload, &pool, &ws_manager).await
        }
        ["device", _, "status"] => {
            handle_device_status(&payload, &pool, &ws_manager).await
        }
        _ => {
            warn!("未知的 MQTT 主题: {}", topic);
            Ok(())
        }
    }
}

async fn handle_thermal_data(
    payload: &[u8],
    pool: &DbPool,
    ws_manager: &Arc<WebSocketManager>,
    hotspot_detector: &HotspotDetector,
    thermal_analyzer: &ThermalAnalyzer,
    risk_assessment: &RiskAssessment,
) -> Result<(), String> {
    let message: ThermalDataMessage = serde_json::from_slice(payload)
        .map_err(|e| format!("解析热成像数据失败: {}", e))?;

    debug!("处理热成像数据，设备: {}, 建筑: {}", message.device_id, message.building_id);

    let is_night = thermal_analyzer.is_night_time(message.timestamp);

    let thermal_data = crate::db::thermal_data::create(
        pool,
        CreateThermalData {
            device_id: message.device_id,
            building_id: message.building_id,
            temperature_matrix: message.temperature_matrix.clone(),
            min_temp: message.min_temp,
            max_temp: message.max_temp,
            avg_temp: message.avg_temp,
            resolution_width: message.resolution_width,
            resolution_height: message.resolution_height,
            is_night,
        },
    )
    .await
    .map_err(|e| format!("保存热成像数据失败: {}", e))?;

    let hotspots = hotspot_detector
        .detect_hotspots(&message.temperature_matrix)
        .map_err(|e| format!("热点检测失败: {}", e))?;

    debug!("检测到 {} 个热点", hotspots.len());

    let building = crate::db::buildings::get_by_id(pool, message.building_id)
        .await
        .map_err(|e| format!("获取建筑信息失败: {}", e))?;

    for hotspot in hotspots {
        let risk_result = risk_assessment.assess_hotspot_risk(&hotspot, is_night);

        let db_hotspot = crate::db::hotspots::create(
            pool,
            CreateHotspot {
                thermal_data_id: thermal_data.id,
                building_id: message.building_id,
                device_id: message.device_id,
                center_x: hotspot.center_x,
                center_y: hotspot.center_y,
                temperature: hotspot.temperature,
                area: hotspot.area,
                risk_level: risk_result.risk_level.clone(),
                description: Some(format!(
                    "温度: {:.1}°C, 面积: {:.0} 像素, 风险评分: {:.1}",
                    hotspot.temperature,
                    hotspot.area,
                    risk_result.risk_score
                )),
            },
        )
        .await
        .map_err(|e| format!("保存热点失败: {}", e))?;

        if risk_result.risk_level == "critical" || risk_result.risk_level == "high" {
            let alert = create_alert_for_hotspot(
                pool,
                &db_hotspot,
                message.building_id,
                &hotspot,
                &risk_result.risk_level,
                building.as_ref(),
            )
            .await?;

            let notification = AlertNotification {
                alert: alert.clone(),
                building_name: building.as_ref().map(|b| b.name.clone()),
                hotspot_temperature: Some(hotspot.temperature),
                timestamp: Utc::now(),
            };

            ws_manager
                .broadcast(BroadcastMessage::Alert {
                    building_id: message.building_id,
                    notification,
                })
                .await;

            info!(
                "创建告警: 设备 {}, 热点温度 {:.1}°C, 风险级别 {}",
                message.device_id,
                hotspot.temperature,
                risk_result.risk_level
            );
        }
    }

    let temperatures: Result<Vec<Vec<f64>>, _> = serde_json::from_str(&message.temperature_matrix);
    if let Ok(temperatures) = temperatures {
        let thermal_frame = crate::models::ThermalFrame {
            device_id: message.device_id,
            timestamp: message.timestamp,
            resolution: (message.resolution_width, message.resolution_height),
            temperatures,
        };

        ws_manager
            .broadcast(BroadcastMessage::ThermalFrame {
                building_id: message.building_id,
                frame: thermal_frame,
            })
            .await;
    }

    Ok(())
}

async fn create_alert_for_hotspot(
    pool: &DbPool,
    hotspot: &Hotspot,
    building_id: Uuid,
    detected_hotspot: &crate::services::thermal_analysis::Hotspot,
    risk_level: &str,
    building: Option<&crate::models::Building>,
) -> Result<Alert, String> {
    let severity = match risk_level {
        "critical" => "critical".to_string(),
        "high" => "high".to_string(),
        "medium" => "medium".to_string(),
        _ => "low".to_string(),
    };

    let title = format!(
        "热成像热点异常 - {:.1}°C",
        detected_hotspot.temperature
    );

    let description = format!(
        "检测到温度异常热点，温度 {:.1}°C，面积 {:.0} 像素，位于位置 ({}, {})",
        detected_hotspot.temperature,
        detected_hotspot.area,
        detected_hotspot.center_x,
        detected_hotspot.center_y
    );

    let (latitude, longitude) = if let Some(b) = building {
        (Some(b.latitude), Some(b.longitude))
    } else {
        (None, None)
    };

    let alert = crate::db::alerts::create(
        pool,
        CreateAlert {
            hotspot_id: Some(hotspot.id),
            building_id,
            alert_type: "thermal_hotspot".to_string(),
            title,
            description: Some(description),
            severity,
            latitude,
            longitude,
        },
    )
    .await
    .map_err(|e| format!("创建告警失败: {}", e))?;

    Ok(alert)
}

async fn handle_patrol_location(
    payload: &[u8],
    pool: &DbPool,
    ws_manager: &Arc<WebSocketManager>,
) -> Result<(), String> {
    let message: PatrolLocationMessage = serde_json::from_slice(payload)
        .map_err(|e| format!("解析巡防定位数据失败: {}", e))?;

    debug!(
        "处理巡防定位数据，人员: {}, 位置: ({}, {})",
        message.personnel_id, message.latitude, message.longitude
    );

    let _location = crate::db::patrol_locations::create(
        pool,
        CreatePatrolLocation {
            personnel_id: message.personnel_id,
            latitude: message.latitude,
            longitude: message.longitude,
            accuracy: message.accuracy,
            battery_level: message.battery_level,
        },
    )
    .await
    .map_err(|e| format!("保存巡防定位失败: {}", e))?;

    let _ = crate::db::patrol_personnel::update_location(
        pool,
        message.personnel_id,
        message.latitude,
        message.longitude,
    )
    .await;

    let personnel = crate::db::patrol_personnel::get_by_id(pool, message.personnel_id)
        .await
        .map_err(|e| format!("获取巡防人员信息失败: {}", e))?;

    if let Some(personnel) = personnel {
        let update = PatrolLocationUpdate {
            personnel_id: message.personnel_id,
            personnel_name: personnel.name,
            latitude: message.latitude,
            longitude: message.longitude,
            timestamp: message.timestamp,
            accuracy: message.accuracy,
            battery_level: message.battery_level,
        };

        let buildings = crate::db::buildings::list(pool)
            .await
            .unwrap_or_default();

        for building in buildings {
            ws_manager
                .broadcast(BroadcastMessage::PatrolLocation {
                    building_id: building.id,
                    update: update.clone(),
                })
                .await;
        }
    }

    Ok(())
}

async fn handle_device_heartbeat(
    payload: &[u8],
    pool: &DbPool,
    ws_manager: &Arc<WebSocketManager>,
) -> Result<(), String> {
    let message: DeviceHeartbeatMessage = serde_json::from_slice(payload)
        .map_err(|e| format!("解析设备心跳数据失败: {}", e))?;

    debug!("处理设备心跳，设备: {}, 状态: {}", message.device_id, message.status);

    let updated = crate::db::thermal_devices::update_heartbeat(
        pool,
        message.device_id,
        &message.status,
    )
    .await
    .map_err(|e| format!("更新设备心跳失败: {}", e))?;

    if updated {
        info!("设备心跳已更新: {}", message.device_id);
    } else {
        warn!("设备未找到，心跳更新失败: {}", message.device_id);
    }

    broadcast_device_status(pool, ws_manager, message.device_id).await?;

    Ok(())
}

async fn handle_device_status(
    payload: &[u8],
    pool: &DbPool,
    ws_manager: &Arc<WebSocketManager>,
) -> Result<(), String> {
    let message: DeviceStatusMessage = serde_json::from_slice(payload)
        .map_err(|e| format!("解析设备状态数据失败: {}", e))?;

    debug!("处理设备状态，设备: {}, 状态: {}", message.device_id, message.status);

    let updated = crate::db::thermal_devices::update_heartbeat(
        pool,
        message.device_id,
        &message.status,
    )
    .await
    .map_err(|e| format!("更新设备状态失败: {}", e))?;

    if updated {
        info!("设备状态已更新: {} -> {}", message.device_id, message.status);
    } else {
        warn!("设备未找到，状态更新失败: {}", message.device_id);
    }

    broadcast_device_status(pool, ws_manager, message.device_id).await?;

    Ok(())
}

async fn broadcast_device_status(
    pool: &DbPool,
    ws_manager: &Arc<WebSocketManager>,
    device_id: Uuid,
) -> Result<(), String> {
    let device = crate::db::thermal_devices::get_by_id(pool, device_id)
        .await
        .map_err(|e| format!("获取设备信息失败: {}", e))?;

    if let Some(device) = device {
        let status = DeviceStatus {
            device_id: device.id,
            device_name: device.name,
            building_id: device.building_id,
            status: device.status,
            last_heartbeat: device.last_heartbeat,
            timestamp: Utc::now(),
        };

        ws_manager
            .broadcast(BroadcastMessage::DeviceStatus {
                building_id: device.building_id,
                status,
            })
            .await;
    }

    Ok(())
}
