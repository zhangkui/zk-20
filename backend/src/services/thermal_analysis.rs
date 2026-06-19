use chrono::{DateTime, Timelike, Utc};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

const DANGER_THRESHOLD: f64 = 60.0;
const WARNING_THRESHOLD: f64 = 45.0;
const ATTENTION_THRESHOLD: f64 = 35.0;

const NIGHT_START_HOUR: u32 = 20;
const NIGHT_END_HOUR: u32 = 6;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Hotspot {
    pub center_x: i32,
    pub center_y: i32,
    pub temperature: f64,
    pub area: f64,
    pub risk_level: String,
    pub points: Vec<(i32, i32, f64)>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemperatureStats {
    pub min: f64,
    pub max: f64,
    pub avg: f64,
    pub median: f64,
    pub std_dev: f64,
    pub percentile_25: f64,
    pub percentile_75: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemperatureTrend {
    pub direction: String,
    pub slope: f64,
    pub correlation: f64,
    pub prediction_next: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HotspotRiskResult {
    pub risk_level: String,
    pub risk_score: f64,
    pub factors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildingRiskResult {
    pub overall_score: f64,
    pub risk_level: String,
    pub hotspot_count: usize,
    pub danger_count: usize,
    pub warning_count: usize,
    pub attention_count: usize,
    pub recommendations: Vec<String>,
}

#[derive(Clone)]
pub struct HotspotDetector {
    pub danger_threshold: f64,
    pub warning_threshold: f64,
    pub attention_threshold: f64,
    pub min_area: f64,
    pub window_size: usize,
}

impl Default for HotspotDetector {
    fn default() -> Self {
        Self {
            danger_threshold: DANGER_THRESHOLD,
            warning_threshold: WARNING_THRESHOLD,
            attention_threshold: ATTENTION_THRESHOLD,
            min_area: 1.0,
            window_size: 3,
        }
    }
}

impl HotspotDetector {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_thresholds(
        danger: f64,
        warning: f64,
        attention: f64,
    ) -> Self {
        Self {
            danger_threshold: danger,
            warning_threshold: warning,
            attention_threshold: attention,
            min_area: 1.0,
            window_size: 3,
        }
    }

    pub fn detect_hotspots(
        &self,
        temperature_matrix_json: &str,
    ) -> Result<Vec<Hotspot>, String> {
        let matrix: Vec<Vec<f64>> = serde_json::from_str(temperature_matrix_json)
            .map_err(|e| format!("解析温度矩阵失败: {}", e))?;

        if matrix.is_empty() || matrix[0].is_empty() {
            return Ok(Vec::new());
        }

        let denoised_matrix = self.apply_sliding_window_denoise(&matrix);

        let hotspots = self.find_connected_regions(&denoised_matrix);

        Ok(hotspots
            .into_iter()
            .filter(|h| h.area >= self.min_area)
            .collect())
    }

    fn apply_sliding_window_denoise(
        &self,
        matrix: &[Vec<f64>],
    ) -> Vec<Vec<f64>> {
        let rows = matrix.len();
        let cols = matrix[0].len();
        let mut result = vec![vec![0.0; cols]; rows];
        let half_window = self.window_size / 2;

        for i in 0..rows {
            for j in 0..cols {
                let mut sum = 0.0;
                let mut count = 0;

                for di in (0..self.window_size).map(|x| x as i32 - half_window as i32) {
                    for dj in (0..self.window_size).map(|x| x as i32 - half_window as i32) {
                        let ni = i as i32 + di;
                        let nj = j as i32 + dj;

                        if ni >= 0 && ni < rows as i32 && nj >= 0 && nj < cols as i32 {
                            sum += matrix[ni as usize][nj as usize];
                            count += 1;
                        }
                    }
                }

                result[i][j] = if count > 0 { sum / count as f64 } else { matrix[i][j] };
            }
        }

        result
    }

    fn find_connected_regions(
        &self,
        matrix: &[Vec<f64>],
    ) -> Vec<Hotspot> {
        let rows = matrix.len();
        let cols = matrix[0].len();
        let mut visited = vec![vec![false; cols]; rows];
        let mut hotspots = Vec::new();

        for i in 0..rows {
            for j in 0..cols {
                if !visited[i][j] && matrix[i][j] >= self.attention_threshold {
                    let region = self.bfs(matrix, &mut visited, i, j);
                    if !region.is_empty() {
                        let hotspot = self.create_hotspot_from_region(&region);
                        hotspots.push(hotspot);
                    }
                }
            }
        }

        hotspots
    }

    fn bfs(
        &self,
        matrix: &[Vec<f64>],
        visited: &mut [Vec<bool>],
        start_i: usize,
        start_j: usize,
    ) -> Vec<(i32, i32, f64)> {
        let rows = matrix.len() as i32;
        let cols = matrix[0].len() as i32;
        let mut queue = VecDeque::new();
        let mut region = Vec::new();

        queue.push_back((start_i as i32, start_j as i32));
        visited[start_i][start_j] = true;

        let directions = [
            (-1, 0),
            (1, 0),
            (0, -1),
            (0, 1),
            (-1, -1),
            (-1, 1),
            (1, -1),
            (1, 1),
        ];

        while let Some((i, j)) = queue.pop_front() {
            let temp = matrix[i as usize][j as usize];
            region.push((j, i, temp));

            for (di, dj) in directions.iter() {
                let ni = i + di;
                let nj = j + dj;

                if ni >= 0
                    && ni < rows
                    && nj >= 0
                    && nj < cols
                    && !visited[ni as usize][nj as usize]
                    && matrix[ni as usize][nj as usize] >= self.attention_threshold
                {
                    visited[ni as usize][nj as usize] = true;
                    queue.push_back((ni, nj));
                }
            }
        }

        region
    }

    fn create_hotspot_from_region(
        &self,
        region: &[(i32, i32, f64)],
    ) -> Hotspot {
        let mut sum_x = 0.0;
        let mut sum_y = 0.0;
        let mut max_temp = 0.0;
        let mut sum_temp = 0.0;

        for (x, y, temp) in region {
            sum_x += *x as f64;
            sum_y += *y as f64;
            sum_temp += temp;
            if *temp > max_temp {
                max_temp = *temp;
            }
        }

        let count = region.len() as f64;
        let center_x = (sum_x / count).round() as i32;
        let center_y = (sum_y / count).round() as i32;
        let _avg_temp = sum_temp / count;
        let area = count;

        let risk_level = if max_temp >= self.danger_threshold {
            "danger".to_string()
        } else if max_temp >= self.warning_threshold {
            "warning".to_string()
        } else {
            "attention".to_string()
        };

        Hotspot {
            center_x,
            center_y,
            temperature: max_temp,
            area,
            risk_level,
            points: region.to_vec(),
        }
    }
}

#[derive(Clone)]
pub struct ThermalAnalyzer;

impl ThermalAnalyzer {
    pub fn new() -> Self {
        Self
    }

    pub fn calculate_stats(
        &self,
        temperature_matrix_json: &str,
    ) -> Result<TemperatureStats, String> {
        let matrix: Vec<Vec<f64>> = serde_json::from_str(temperature_matrix_json)
            .map_err(|e| format!("解析温度矩阵失败: {}", e))?;

        if matrix.is_empty() || matrix[0].is_empty() {
            return Err("温度矩阵为空".to_string());
        }

        let mut all_temps: Vec<f64> = matrix.iter().flatten().copied().collect();
        all_temps.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

        let count = all_temps.len() as f64;
        let sum: f64 = all_temps.iter().sum();
        let avg = sum / count;

        let min = all_temps[0];
        let max = all_temps[all_temps.len() - 1];
        let median = Self::percentile(&all_temps, 50.0);
        let percentile_25 = Self::percentile(&all_temps, 25.0);
        let percentile_75 = Self::percentile(&all_temps, 75.0);

        let variance: f64 = all_temps.iter().map(|t| (t - avg).powi(2)).sum::<f64>() / count;
        let std_dev = variance.sqrt();

        Ok(TemperatureStats {
            min,
            max,
            avg,
            median,
            std_dev,
            percentile_25,
            percentile_75,
        })
    }

    pub fn is_night_time(
        &self,
        timestamp: DateTime<Utc>,
    ) -> bool {
        let hour = timestamp.hour();
        hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR
    }

    pub fn analyze_temperature_trend(
        &self,
        historical_temps: &[f64],
    ) -> Result<TemperatureTrend, String> {
        if historical_temps.len() < 2 {
            return Err("历史数据不足，至少需要2个数据点".to_string());
        }

        let n = historical_temps.len() as f64;
        let indices: Vec<f64> = (0..historical_temps.len()).map(|i| i as f64).collect();

        let sum_x: f64 = indices.iter().sum();
        let sum_y: f64 = historical_temps.iter().sum();
        let sum_xy: f64 = indices.iter().zip(historical_temps.iter()).map(|(x, y)| x * y).sum();
        let sum_x2: f64 = indices.iter().map(|x| x * x).sum();
        let sum_y2: f64 = historical_temps.iter().map(|y| y * y).sum();

        let slope = (n * sum_xy - sum_x * sum_y) / (n * sum_x2 - sum_x * sum_x);

        let numerator = n * sum_xy - sum_x * sum_y;
        let denominator = ((n * sum_x2 - sum_x * sum_x) * (n * sum_y2 - sum_y * sum_y)).sqrt();
        let correlation = if denominator.abs() < 1e-10 {
            0.0
        } else {
            numerator / denominator
        };

        let prediction_next = if historical_temps.len() >= 2 {
            let last_idx = (historical_temps.len() - 1) as f64;
            let intercept = (sum_y - slope * sum_x) / n;
            slope * (last_idx + 1.0) + intercept
        } else {
            historical_temps.last().copied().unwrap_or(0.0)
        };

        let direction = if slope > 0.5 {
            "rising".to_string()
        } else if slope < -0.5 {
            "falling".to_string()
        } else {
            "stable".to_string()
        };

        Ok(TemperatureTrend {
            direction,
            slope,
            correlation,
            prediction_next,
        })
    }

    fn percentile(sorted_data: &[f64], p: f64) -> f64 {
        if sorted_data.is_empty() {
            return 0.0;
        }
        if sorted_data.len() == 1 {
            return sorted_data[0];
        }

        let rank = (p / 100.0) * (sorted_data.len() - 1) as f64;
        let lower = rank.floor() as usize;
        let upper = rank.ceil() as usize;
        let weight = rank - rank.floor();

        if lower == upper {
            sorted_data[lower]
        } else {
            sorted_data[lower] * (1.0 - weight) + sorted_data[upper] * weight
        }
    }
}

impl Default for ThermalAnalyzer {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Clone)]
pub struct RiskAssessment {
    pub danger_weight: f64,
    pub warning_weight: f64,
    pub attention_weight: f64,
    pub area_factor: f64,
    pub night_bonus: f64,
}

impl Default for RiskAssessment {
    fn default() -> Self {
        Self {
            danger_weight: 1.0,
            warning_weight: 0.6,
            attention_weight: 0.3,
            area_factor: 0.1,
            night_bonus: 1.3,
        }
    }
}

impl RiskAssessment {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn assess_hotspot_risk(
        &self,
        hotspot: &Hotspot,
        is_night: bool,
    ) -> HotspotRiskResult {
        let mut score = 0.0;
        let mut factors = Vec::new();

        if hotspot.temperature >= DANGER_THRESHOLD {
            score += 80.0;
            factors.push(format!("温度达到危险级别: {:.1}°C", hotspot.temperature));
        } else if hotspot.temperature >= WARNING_THRESHOLD {
            score += 50.0;
            factors.push(format!("温度达到警告级别: {:.1}°C", hotspot.temperature));
        } else if hotspot.temperature >= ATTENTION_THRESHOLD {
            score += 25.0;
            factors.push(format!("温度达到注意级别: {:.1}°C", hotspot.temperature));
        }

        let area_score = (hotspot.area * self.area_factor).min(20.0);
        score += area_score;
        if area_score > 5.0 {
            factors.push(format!("热点面积较大: {:.0} 像素", hotspot.area));
        }

        if is_night {
            score *= self.night_bonus;
            factors.push("夜间时段，风险等级提升".to_string());
        }

        let risk_level = if score >= 80.0 {
            "critical".to_string()
        } else if score >= 60.0 {
            "high".to_string()
        } else if score >= 40.0 {
            "medium".to_string()
        } else if score >= 20.0 {
            "low".to_string()
        } else {
            "normal".to_string()
        };

        HotspotRiskResult {
            risk_level,
            risk_score: score.min(100.0),
            factors,
        }
    }

    pub fn calculate_building_risk_score(
        &self,
        hotspots: &[Hotspot],
        is_night: bool,
        building_area: Option<f64>,
    ) -> BuildingRiskResult {
        let mut danger_count = 0;
        let mut warning_count = 0;
        let mut attention_count = 0;
        let mut total_score = 0.0;
        let mut max_hotspot_score = 0.0;
        let mut recommendations = Vec::new();

        for hotspot in hotspots {
            let risk = self.assess_hotspot_risk(hotspot, is_night);

            match hotspot.risk_level.as_str() {
                "danger" => danger_count += 1,
                "warning" => warning_count += 1,
                "attention" => attention_count += 1,
                _ => {}
            }

            total_score += risk.risk_score;
            if risk.risk_score > max_hotspot_score {
                max_hotspot_score = risk.risk_score;
            }
        }

        let hotspot_count = hotspots.len();
        let density_factor = if let Some(area) = building_area {
            if area > 0.0 {
                (hotspot_count as f64 / area) * 1000.0
            } else {
                0.0
            }
        } else {
            0.0
        };

        let weighted_score = total_score * self.danger_weight
            + danger_count as f64 * 30.0
            + warning_count as f64 * 15.0
            + attention_count as f64 * 5.0
            + density_factor * 2.0;

        let night_multiplier = if is_night { self.night_bonus } else { 1.0 };
        let overall_score = (weighted_score * night_multiplier).min(100.0);

        let risk_level = if overall_score >= 80.0 {
            "critical".to_string()
        } else if overall_score >= 60.0 {
            "high".to_string()
        } else if overall_score >= 40.0 {
            "medium".to_string()
        } else if overall_score >= 20.0 {
            "low".to_string()
        } else {
            "normal".to_string()
        };

        if danger_count > 0 {
            recommendations.push(format!(
                "发现 {} 个危险级热点，请立即处理",
                danger_count
            ));
        }
        if warning_count > 0 {
            recommendations.push(format!(
                "发现 {} 个警告级热点，建议尽快检查",
                warning_count
            ));
        }
        if attention_count > 0 {
            recommendations.push(format!(
                "发现 {} 个注意级热点，请持续关注",
                attention_count
            ));
        }
        if is_night && hotspot_count > 0 {
            recommendations.push("夜间检测到热点，建议加强夜间巡查".to_string());
        }
        if recommendations.is_empty() {
            recommendations.push("建筑热状态正常，继续保持监测".to_string());
        }

        BuildingRiskResult {
            overall_score,
            risk_level,
            hotspot_count,
            danger_count,
            warning_count,
            attention_count,
            recommendations,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_hotspots() {
        let detector = HotspotDetector::new();
        let matrix = vec![
            vec![20.0, 25.0, 30.0, 35.0, 40.0],
            vec![22.0, 28.0, 50.0, 55.0, 45.0],
            vec![24.0, 30.0, 65.0, 70.0, 50.0],
            vec![23.0, 27.0, 48.0, 52.0, 42.0],
            vec![21.0, 24.0, 32.0, 38.0, 36.0],
        ];
        let json = serde_json::to_string(&matrix).unwrap();
        let hotspots = detector.detect_hotspots(&json).unwrap();

        assert!(!hotspots.is_empty());
        let hotspot = &hotspots[0];
        assert!(hotspot.temperature >= 35.0);
        assert!(hotspot.area > 0.0);
    }

    #[test]
    fn test_calculate_stats() {
        let analyzer = ThermalAnalyzer::new();
        let matrix = vec![
            vec![20.0, 25.0, 30.0],
            vec![35.0, 40.0, 45.0],
            vec![50.0, 55.0, 60.0],
        ];
        let json = serde_json::to_string(&matrix).unwrap();
        let stats = analyzer.calculate_stats(&json).unwrap();

        assert_eq!(stats.min, 20.0);
        assert_eq!(stats.max, 60.0);
        assert!((stats.avg - 40.0).abs() < 1e-10);
    }

    #[test]
    fn test_is_night_time() {
        let analyzer = ThermalAnalyzer::new();

        let day_time = chrono::DateTime::parse_from_rfc3339("2024-01-01T12:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        assert!(!analyzer.is_night_time(day_time));

        let night_time = chrono::DateTime::parse_from_rfc3339("2024-01-01T22:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        assert!(analyzer.is_night_time(night_time));

        let early_morning = chrono::DateTime::parse_from_rfc3339("2024-01-01T05:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        assert!(analyzer.is_night_time(early_morning));
    }

    #[test]
    fn test_analyze_temperature_trend() {
        let analyzer = ThermalAnalyzer::new();
        let temps = vec![20.0, 22.0, 24.0, 26.0, 28.0];
        let trend = analyzer.analyze_temperature_trend(&temps).unwrap();

        assert_eq!(trend.direction, "rising");
        assert!(trend.slope > 0.0);
    }

    #[test]
    fn test_assess_hotspot_risk() {
        let assessment = RiskAssessment::new();
        let hotspot = Hotspot {
            center_x: 10,
            center_y: 10,
            temperature: 65.0,
            area: 25.0,
            risk_level: "danger".to_string(),
            points: Vec::new(),
        };

        let result = assessment.assess_hotspot_risk(&hotspot, false);
        assert_eq!(result.risk_level, "critical");
        assert!(result.risk_score >= 80.0);

        let night_result = assessment.assess_hotspot_risk(&hotspot, true);
        assert!(night_result.risk_score > result.risk_score);
    }

    #[test]
    fn test_calculate_building_risk_score() {
        let assessment = RiskAssessment::new();
        let hotspots = vec![
            Hotspot {
                center_x: 5,
                center_y: 5,
                temperature: 65.0,
                area: 15.0,
                risk_level: "danger".to_string(),
                points: Vec::new(),
            },
            Hotspot {
                center_x: 15,
                center_y: 15,
                temperature: 50.0,
                area: 10.0,
                risk_level: "warning".to_string(),
                points: Vec::new(),
            },
        ];

        let result = assessment.calculate_building_risk_score(&hotspots, false, Some(1000.0));

        assert_eq!(result.hotspot_count, 2);
        assert_eq!(result.danger_count, 1);
        assert_eq!(result.warning_count, 1);
        assert!(result.overall_score > 0.0);
    }

    #[test]
    fn test_sliding_window_denoise() {
        let detector = HotspotDetector::new();
        let matrix = vec![
            vec![20.0, 100.0, 20.0],
            vec![20.0, 20.0, 20.0],
            vec![20.0, 20.0, 20.0],
        ];

        let denoised = detector.apply_sliding_window_denoise(&matrix);

        assert!(denoised[0][1] < 100.0);
        assert!(denoised[0][1] > 20.0);
    }

    #[test]
    fn test_empty_matrix() {
        let detector = HotspotDetector::new();
        let empty_matrix: Vec<Vec<f64>> = Vec::new();
        let json = serde_json::to_string(&empty_matrix).unwrap();
        let hotspots = detector.detect_hotspots(&json).unwrap();
        assert!(hotspots.is_empty());
    }

    #[test]
    fn test_no_hotspots() {
        let detector = HotspotDetector::new();
        let matrix = vec![
            vec![20.0, 21.0, 22.0],
            vec![23.0, 24.0, 25.0],
            vec![26.0, 27.0, 28.0],
        ];
        let json = serde_json::to_string(&matrix).unwrap();
        let hotspots = detector.detect_hotspots(&json).unwrap();
        assert!(hotspots.is_empty());
    }
}
