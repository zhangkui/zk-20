use chrono::{DateTime, Datelike, Duration, Timelike, Utc};
use sqlx::SqlitePool;

use crate::db;
use crate::models::{CreatePatrolTask, PatrolTask};

pub async fn generate_daily_patrol_tasks(
    pool: &SqlitePool,
    date: Option<DateTime<Utc>>,
) -> Result<Vec<PatrolTask>, Box<dyn std::error::Error>> {
    let target_date = date.unwrap_or_else(|| Utc::now());
    let buildings = db::buildings::list(pool).await?;
    let personnel = db::patrol_personnel::list(pool).await?;
    let mut created_tasks = Vec::new();

    if personnel.is_empty() {
        return Ok(created_tasks);
    }

    let mut personnel_idx = 0;

    for building in &buildings {
        let risk = building.risk_level.as_deref().unwrap_or("medium");
        let task_count = match risk {
            "high" | "critical" => 2,
            "medium" => 1,
            "low" => {
                let day_of_year = target_date.ordinal();
                if day_of_year % 2 == 0 { 1 } else { 0 }
            }
            _ => 1,
        };

        for i in 0..task_count {
            let start_hour = if task_count == 1 {
                9 } else { if i == 0 { 9 } else { 15 } };

            let scheduled_start = target_date
                .with_hour(start_hour)
                .unwrap_or(target_date)
                .with_minute(0)
                .unwrap_or(target_date)
                .with_second(0)
                .unwrap_or(target_date)
                .with_nanosecond(0)
                .unwrap_or(target_date);

            let scheduled_end = scheduled_start + Duration::hours(2);

            let assigned_personnel = &personnel[personnel_idx % personnel.len()];
            personnel_idx += 1;

            let task = db::patrol_tasks::create(
                pool,
                CreatePatrolTask {
                    building_id: building.id,
                    personnel_id: Some(assigned_personnel.id),
                    task_name: format!("{} 日常巡防 - 第{}次", building.name, i + 1),
                    task_type: "routine".to_string(),
                    risk_level: building.risk_level.clone(),
                    scheduled_start,
                    scheduled_end,
                    notes: None,
                },
            )
            .await?;

            created_tasks.push(task);
        }
    }

    Ok(created_tasks)
}
