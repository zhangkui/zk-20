use chrono::{Duration, Utc};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::db;
use crate::models::{AlertDispatch, AlertEscalation, CreateAlertDispatch, CreateAlertEscalation};

pub async fn auto_dispatch_alert(
    pool: &SqlitePool,
    alert_id: Uuid,
) -> Result<AlertDispatch, Box<dyn std::error::Error>> {
    let alert = db::alerts::get_by_id(pool, alert_id)
        .await?
        .ok_or_else(|| sqlx::Error::RowNotFound)?;

    let personnel_list = db::patrol_personnel::list(pool).await?;
    if personnel_list.is_empty() {
        return Err("No patrol personnel available".into());
    }

    let building = db::buildings::get_by_id(pool, alert.building_id).await?;
    let mut nearest_personnel = None;
    let mut min_distance = f64::MAX;

    for person in &personnel_list {
        if person.status != "idle" && person.status != "on_duty" {
            continue;
        }

        let distance = if let (Some(p_lat), Some(p_lng)) = (person.last_location_lat, person.last_location_lng) {
            if let Some(b) = &building {
                let d_lat = p_lat - b.latitude;
                let d_lng = p_lng - b.longitude;
                (d_lat * d_lat + d_lng * d_lng).sqrt()
            } else {
                0.0
            }
        } else {
            f64::MAX / 2.0
        };

        if distance < min_distance {
            min_distance = distance;
            nearest_personnel = Some(person.clone());
        }
    }

    let dispatched_to = nearest_personnel
        .unwrap_or_else(|| personnel_list[0].clone())
        .id;

    let dispatch = db::alert_dispatches::create(
        pool,
        CreateAlertDispatch {
            alert_id,
            dispatched_by: None,
            dispatched_to,
            dispatch_reason: "自动派单 - 就近分配".to_string(),
        },
    )
    .await?;

    let now = Utc::now();
    sqlx::query(
        r#"
        UPDATE alerts
        SET dispatched_to = ?, dispatched_at = ?, status = 'dispatched', updated_at = ?
        WHERE id = ?
        "#,
    )
    .bind(dispatched_to)
    .bind(now)
    .bind(now)
    .bind(alert_id)
    .execute(pool)
    .await?;

    Ok(dispatch)
}

pub async fn check_and_escalate_timed_out_alerts(
    pool: &SqlitePool,
) -> Result<Vec<AlertEscalation>, Box<dyn std::error::Error>> {
    let now = Utc::now();
    let mut escalations = Vec::new();

    let pending_alerts = db::alerts::list_by_status(pool, "pending", 1000).await?;
    let dispatched_alerts = db::alerts::list_by_status(pool, "dispatched", 1000).await?;
    let acknowledged_alerts = db::alerts::list_by_status(pool, "acknowledged", 1000).await?;
    let handling_alerts = db::alerts::list_by_status(pool, "handling", 1000).await?;

    let mut all_alerts = Vec::new();
    all_alerts.extend(pending_alerts);
    all_alerts.extend(dispatched_alerts);
    all_alerts.extend(acknowledged_alerts);
    all_alerts.extend(handling_alerts);

    for alert in &all_alerts {
        let should_escalate_ack = match (alert.status.as_str(), alert.dispatched_at) {
            ("pending", _) => {
                let elapsed = now.signed_duration_since(alert.created_at);
                elapsed > Duration::minutes(alert.ack_timeout_minutes as i64)
            }
            ("dispatched", Some(dispatched)) => {
                let elapsed = now.signed_duration_since(dispatched);
                elapsed > Duration::minutes(alert.ack_timeout_minutes as i64)
            }
            _ => false,
        };

        let should_escalate_resolve = match alert.status.as_str() {
            "acknowledged" | "handling" => {
                let base_time = alert.acknowledged_at.unwrap_or(alert.created_at);
                let elapsed = now.signed_duration_since(base_time);
                elapsed > Duration::minutes(alert.resolve_timeout_minutes as i64)
            }
            _ => false,
        };

        if should_escalate_ack || should_escalate_resolve {
            let new_level = alert.escalation_level + 1;
            let reason = if should_escalate_ack {
                format!("告警确认超时 ({}分钟)", alert.ack_timeout_minutes)
            } else {
                format!("告警处置超时 ({}分钟)", alert.resolve_timeout_minutes)
            };

            let escalation = db::alert_escalations::create(
                pool,
                CreateAlertEscalation {
                    alert_id: alert.id,
                    previous_level: alert.escalation_level,
                    new_level,
                    escalation_reason: reason,
                    notified_person_id: None,
                },
            )
            .await?;

            sqlx::query(
                r#"
                UPDATE alerts
                SET escalation_level = ?, updated_at = ?
                WHERE id = ?
                "#,
            )
            .bind(new_level)
            .bind(now)
            .bind(alert.id)
            .execute(pool)
            .await?;

            escalations.push(escalation);
        }
    }

    Ok(escalations)
}
