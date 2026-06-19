use actix_web::{
    web, Error, HttpRequest, HttpResponse,
    web::Payload,
};
use actix_ws::{Message, Session, MessageStream};
use chrono::{DateTime, Utc};
use futures_util::StreamExt;
use log::{debug, error, info, warn};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{broadcast, Mutex, RwLock};
use uuid::Uuid;

use crate::models::{Alert, ThermalFrame};

const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(30);
const CLIENT_TIMEOUT: Duration = Duration::from_secs(60);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertNotification {
    pub alert: Alert,
    pub building_name: Option<String>,
    pub hotspot_temperature: Option<f64>,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatrolLocationUpdate {
    pub personnel_id: Uuid,
    pub personnel_name: String,
    pub latitude: f64,
    pub longitude: f64,
    pub timestamp: DateTime<Utc>,
    pub accuracy: Option<f64>,
    pub battery_level: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceStatus {
    pub device_id: Uuid,
    pub device_name: String,
    pub building_id: Uuid,
    pub status: String,
    pub last_heartbeat: Option<DateTime<Utc>>,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "action", content = "data")]
pub enum ClientMessage {
    Subscribe { building_id: Uuid },
    Unsubscribe { building_id: Uuid },
    SubscribeAll,
    UnsubscribeAll,
    Heartbeat,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum ServerMessage {
    ThermalFrame(ThermalFrame),
    Alert(AlertNotification),
    PatrolLocation(PatrolLocationUpdate),
    DeviceStatus(DeviceStatus),
    HeartbeatAck,
    Error { message: String },
    Success { message: String },
}

#[derive(Debug, Clone)]
pub enum BroadcastMessage {
    ThermalFrame { building_id: Uuid, frame: ThermalFrame },
    Alert { building_id: Uuid, notification: AlertNotification },
    PatrolLocation { building_id: Uuid, update: PatrolLocationUpdate },
    DeviceStatus { building_id: Uuid, status: DeviceStatus },
}

struct ClientState {
    id: Uuid,
    subscriptions: Vec<Uuid>,
    last_heartbeat: Instant,
    session: Session,
}

struct BuildingChannel {
    sender: broadcast::Sender<BroadcastMessage>,
    subscriber_count: usize,
}

pub struct WebSocketManager {
    building_channels: RwLock<HashMap<Uuid, BuildingChannel>>,
    clients: Mutex<HashMap<Uuid, ClientState>>,
}

impl WebSocketManager {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            building_channels: RwLock::new(HashMap::new()),
            clients: Mutex::new(HashMap::new()),
        })
    }

    async fn get_or_create_channel(
        &self,
        building_id: Uuid,
    ) -> broadcast::Sender<BroadcastMessage> {
        let mut channels = self.building_channels.write().await;
        if let Some(channel) = channels.get(&building_id) {
            return channel.sender.clone();
        }
        let (sender, _) = broadcast::channel(1000);
        channels.insert(
            building_id,
            BuildingChannel {
                sender: sender.clone(),
                subscriber_count: 0,
            },
        );
        sender
    }

    async fn add_client(&self, client_id: Uuid, session: Session) {
        let mut clients = self.clients.lock().await;
        clients.insert(
            client_id,
            ClientState {
                id: client_id,
                subscriptions: Vec::new(),
                last_heartbeat: Instant::now(),
                session,
            },
        );
        info!("Client connected: {}", client_id);
    }

    async fn remove_client(&self, client_id: Uuid) {
        let mut clients = self.clients.lock().await;
        if let Some(client) = clients.remove(&client_id) {
            let mut channels = self.building_channels.write().await;
            for building_id in &client.subscriptions {
                if let Some(channel) = channels.get_mut(building_id) {
                    channel.subscriber_count = channel.subscriber_count.saturating_sub(1);
                    if channel.subscriber_count == 0 {
                        channels.remove(building_id);
                        debug!("Removed empty channel for building: {}", building_id);
                    }
                }
            }
            info!("Client disconnected: {}", client_id);
        }
    }

    async fn subscribe(&self, client_id: Uuid, building_id: Uuid) -> Result<(), String> {
        let mut clients = self.clients.lock().await;
        let client = clients
            .get_mut(&client_id)
            .ok_or_else(|| "Client not found".to_string())?;

        if client.subscriptions.contains(&building_id) {
            return Ok(());
        }

        client.subscriptions.push(building_id);

        let mut channels = self.building_channels.write().await;
        if let Some(channel) = channels.get_mut(&building_id) {
            channel.subscriber_count += 1;
        } else {
            let (sender, _) = broadcast::channel(1000);
            channels.insert(
                building_id,
                BuildingChannel {
                    sender,
                    subscriber_count: 1,
                },
            );
        }

        debug!("Client {} subscribed to building {}", client_id, building_id);
        Ok(())
    }

    async fn unsubscribe(&self, client_id: Uuid, building_id: Uuid) -> Result<(), String> {
        let mut clients = self.clients.lock().await;
        let client = clients
            .get_mut(&client_id)
            .ok_or_else(|| "Client not found".to_string())?;

        client.subscriptions.retain(|&id| id != building_id);

        let mut channels = self.building_channels.write().await;
        if let Some(channel) = channels.get_mut(&building_id) {
            channel.subscriber_count = channel.subscriber_count.saturating_sub(1);
            if channel.subscriber_count == 0 {
                channels.remove(&building_id);
            }
        }

        debug!("Client {} unsubscribed from building {}", client_id, building_id);
        Ok(())
    }

    async fn unsubscribe_all(&self, client_id: Uuid) -> Result<(), String> {
        let mut clients = self.clients.lock().await;
        let client = clients
            .get_mut(&client_id)
            .ok_or_else(|| "Client not found".to_string())?;

        let building_ids: Vec<Uuid> = client.subscriptions.drain(..).collect();
        let mut channels = self.building_channels.write().await;

        for building_id in building_ids {
            if let Some(channel) = channels.get_mut(&building_id) {
                channel.subscriber_count = channel.subscriber_count.saturating_sub(1);
                if channel.subscriber_count == 0 {
                    channels.remove(&building_id);
                }
            }
        }

        debug!("Client {} unsubscribed from all buildings", client_id);
        Ok(())
    }

    async fn update_heartbeat(&self, client_id: Uuid) -> Result<(), String> {
        let mut clients = self.clients.lock().await;
        let client = clients
            .get_mut(&client_id)
            .ok_or_else(|| "Client not found".to_string())?;
        client.last_heartbeat = Instant::now();
        Ok(())
    }

    pub async fn broadcast(&self, message: BroadcastMessage) {
        let building_id = match &message {
            BroadcastMessage::ThermalFrame { building_id, .. } => *building_id,
            BroadcastMessage::Alert { building_id, .. } => *building_id,
            BroadcastMessage::PatrolLocation { building_id, .. } => *building_id,
            BroadcastMessage::DeviceStatus { building_id, .. } => *building_id,
        };

        let channels = self.building_channels.read().await;
        if let Some(channel) = channels.get(&building_id) {
            if channel.subscriber_count > 0 {
                if let Err(e) = channel.sender.send(message) {
                    error!("Failed to broadcast message: {}", e);
                }
            }
        }
    }

    async fn get_client_subscriptions(&self, client_id: Uuid) -> Vec<Uuid> {
        let clients = self.clients.lock().await;
        clients
            .get(&client_id)
            .map(|c| c.subscriptions.clone())
            .unwrap_or_default()
    }
}

async fn send_message(session: &mut Session, message: ServerMessage) -> Result<(), Error> {
    let text = serde_json::to_string(&message)?;
    session.text(text).await.map_err(|e| Error::from(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;
    Ok(())
}

async fn handle_client_message(
    msg: ClientMessage,
    client_id: Uuid,
    manager: Arc<WebSocketManager>,
    session: &mut Session,
) -> Result<(), Error> {
    match msg {
        ClientMessage::Subscribe { building_id } => {
            match manager.subscribe(client_id, building_id).await {
                Ok(_) => {
                    send_message(
                        session,
                        ServerMessage::Success {
                            message: format!("Subscribed to building {}", building_id),
                        },
                    )
                    .await?;
                }
                Err(e) => {
                    send_message(session, ServerMessage::Error { message: e }).await?;
                }
            }
        }
        ClientMessage::Unsubscribe { building_id } => {
            match manager.unsubscribe(client_id, building_id).await {
                Ok(_) => {
                    send_message(
                        session,
                        ServerMessage::Success {
                            message: format!("Unsubscribed from building {}", building_id),
                        },
                    )
                    .await?;
                }
                Err(e) => {
                    send_message(session, ServerMessage::Error { message: e }).await?;
                }
            }
        }
        ClientMessage::SubscribeAll => {
            send_message(
                session,
                ServerMessage::Success {
                    message: "SubscribeAll not implemented for specific buildings".to_string(),
                },
            )
            .await?;
        }
        ClientMessage::UnsubscribeAll => {
            match manager.unsubscribe_all(client_id).await {
                Ok(_) => {
                    send_message(
                        session,
                        ServerMessage::Success {
                            message: "Unsubscribed from all buildings".to_string(),
                        },
                    )
                    .await?;
                }
                Err(e) => {
                    send_message(session, ServerMessage::Error { message: e }).await?;
                }
            }
        }
        ClientMessage::Heartbeat => {
            let _ = manager.update_heartbeat(client_id).await;
            send_message(session, ServerMessage::HeartbeatAck).await?;
        }
    }
    Ok(())
}

fn broadcast_to_server_message(broadcast: BroadcastMessage) -> ServerMessage {
    match broadcast {
        BroadcastMessage::ThermalFrame { frame, .. } => ServerMessage::ThermalFrame(frame),
        BroadcastMessage::Alert { notification, .. } => ServerMessage::Alert(notification),
        BroadcastMessage::PatrolLocation { update, .. } => ServerMessage::PatrolLocation(update),
        BroadcastMessage::DeviceStatus { status, .. } => ServerMessage::DeviceStatus(status),
    }
}

pub async fn ws_handler(
    req: HttpRequest,
    stream: Payload,
    manager: web::Data<Arc<WebSocketManager>>,
) -> Result<HttpResponse, Error> {
    let (response, session, stream) = actix_ws::handle(&req, stream)?;

    let manager = manager.get_ref().clone();
    let client_id = Uuid::new_v4();

    manager.add_client(client_id, session.clone()).await;

    actix_web::rt::spawn(async move {
        if let Err(e) = ws_client(client_id, manager, session, stream).await {
            error!("WebSocket client error for {}: {}", client_id, e);
        }
    });

    Ok(response)
}

async fn ws_client(
    client_id: Uuid,
    manager: Arc<WebSocketManager>,
    mut session: Session,
    stream: MessageStream,
) -> Result<(), Error> {
    let mut stream = stream.fuse();
    let mut last_heartbeat = Instant::now();
    let mut heartbeat_interval = tokio::time::interval(HEARTBEAT_INTERVAL);
    let mut receivers: HashMap<Uuid, broadcast::Receiver<BroadcastMessage>> = HashMap::new();

    loop {
        tokio::select! {
            msg = stream.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        debug!("Received text from client {}: {}", client_id, text);
                        match serde_json::from_str::<ClientMessage>(&text) {
                            Ok(client_msg) => {
                                if let Err(e) = handle_client_message(
                                    client_msg,
                                    client_id,
                                    manager.clone(),
                                    &mut session,
                                )
                                .await
                                {
                                    error!("Error handling client message: {}", e);
                                }
                            }
                            Err(e) => {
                                warn!("Invalid message from client {}: {}", client_id, e);
                                let _ = send_message(
                                    &mut session,
                                    ServerMessage::Error {
                                        message: format!("Invalid message: {}", e),
                                    },
                                )
                                .await;
                            }
                        }
                    }
                    Some(Ok(Message::Binary(bin))) => {
                        debug!("Received binary from client {}: {} bytes", client_id, bin.len());
                    }
                    Some(Ok(Message::Ping(bytes))) => {
                        if let Err(e) = session.pong(&bytes).await {
                            error!("Error sending pong: {}", e);
                            break;
                        }
                        last_heartbeat = Instant::now();
                        let _ = manager.update_heartbeat(client_id).await;
                    }
                    Some(Ok(Message::Pong(_))) => {
                        last_heartbeat = Instant::now();
                        let _ = manager.update_heartbeat(client_id).await;
                    }
                    Some(Ok(Message::Close(reason))) => {
                        info!("Client {} closing connection: {:?}", client_id, reason);
                        break;
                    }
                    Some(Ok(Message::Continuation(_))) => {
                        debug!("Received continuation frame from {}", client_id);
                    }
                    Some(Ok(Message::Nop)) => {
                        debug!("Received nop from {}", client_id);
                    }
                    Some(Err(e)) => {
                        error!("WebSocket stream error for {}: {}", client_id, e);
                        break;
                    }
                    None => {
                        debug!("WebSocket stream ended for {}", client_id);
                        break;
                    }
                }
            }

            _ = heartbeat_interval.tick() => {
                if last_heartbeat.elapsed() > CLIENT_TIMEOUT {
                    warn!("Client {} timed out", client_id);
                    break;
                }

                let current_subs = manager.get_client_subscriptions(client_id).await;

                for building_id in &current_subs {
                    if !receivers.contains_key(building_id) {
                        let channels = manager.building_channels.read().await;
                        if let Some(channel) = channels.get(building_id) {
                            receivers.insert(*building_id, channel.sender.subscribe());
                        }
                    }
                }

                let mut to_remove = Vec::new();
                for building_id in receivers.keys() {
                    if !current_subs.contains(building_id) {
                        to_remove.push(*building_id);
                    }
                }
                for building_id in to_remove {
                    receivers.remove(&building_id);
                }

                if let Err(e) = session.ping(b"").await {
                    error!("Error sending ping: {}", e);
                    break;
                }
            }

            else => {
                for (building_id, receiver) in receivers.iter_mut() {
                    match receiver.try_recv() {
                        Ok(msg) => {
                            let server_msg = broadcast_to_server_message(msg);
                            if let Err(e) = send_message(&mut session, server_msg).await {
                                error!("Error sending broadcast message to client {}: {}", client_id, e);
                            }
                        }
                        Err(broadcast::error::TryRecvError::Empty) => {}
                        Err(broadcast::error::TryRecvError::Lagged(n)) => {
                            warn!("Client {} lagged {} messages on building {}", client_id, n, building_id);
                        }
                        Err(broadcast::error::TryRecvError::Closed) => {
                            debug!("Channel closed for building {}", building_id);
                        }
                    }
                }
            }
        }
    }

    manager.remove_client(client_id).await;
    let _ = session.close(None).await;
    Ok(())
}

pub fn init(cfg: &mut web::ServiceConfig, manager: Arc<WebSocketManager>) {
    cfg.app_data(web::Data::new(manager));
    cfg.route("/ws", web::get().to(ws_handler));
}
