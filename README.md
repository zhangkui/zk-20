# ZK-20 古建筑消防隐患热成像识别与夜间巡防预警平台

## 项目简介

ZK-20 是一个专为古建筑消防安全设计的智能预警平台，集成热成像监测、异常热点识别、人员定位追踪和数据统计分析功能，实现对古建筑的全天候消防监控和智能巡防管理。

## 功能特性

### 核心功能

1. **建筑区域建模**
   - 古建筑地理信息录入与管理
   - 建筑边界绘制与区域划分
   - 风险等级评估与标记
   - 建筑信息档案管理

2. **热成像数据接入**
   - 多设备热成像摄像头接入
   - 实时温度矩阵采集
   - MQTT 协议数据传输
   - 设备状态在线监控

3. **异常热点识别**
   - 智能温度异常检测算法
   - 3x3 滑动窗口去噪处理
   - BFS 连通区域分析
   - 三级风险评估（注意/警告/危险）

4. **巡防人员定位**
   - GPS/北斗实时定位追踪
   - 巡防路线规划与记录
   - 人员状态在线监控
   - 紧急情况一键呼叫

5. **告警事件回放**
   - 告警事件完整记录
   - 热成像视频帧回放
   - 时间轴精确导航
   - 事件处理流程追溯

6. **责任人员归档**
   - 消防安全责任人管理
   - 责任区域划分
   - 联系方式快速检索
   - 人员档案数字化管理

7. **高风险时段统计分析**
   - 告警时段热力图分析
   - 温度趋势预测
   - 多维度数据报表
   - 风险预警建议

## 技术架构

### 后端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Rust | 1.96+ | 后端开发语言 |
| Actix Web | 4.x | Web 框架 |
| Tokio | 1.x | 异步运行时 |
| SQLx | 0.7 | 数据库 ORM |
| SQLite | 3.x | 关系型数据库 |
| rumqttc | 0.24 | MQTT 客户端 |
| actix-ws | 0.3 | WebSocket 支持 |

### 前端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| SolidJS | 1.8+ | 前端框架 |
| @solidjs/router | 0.13 | 路由管理 |
| Chart.js | 4.4 | 图表可视化 |
| Leaflet | 1.9 | 地图组件 |
| Vite | 5.x | 构建工具 |

### 通信协议

- **HTTP REST API**: 标准数据交互
- **WebSocket**: 实时数据推送
- **MQTT**: 物联网设备数据接入

## 快速开始

### 环境要求

- Rust 1.96+
- Node.js 20+
- Python 3.10+ (测试脚本)
- SQLite 3.34+
- Mosquitto 或其他 MQTT Broker

### 一键安装 (Windows)

```bash
cd scripts
install.bat
```

### 手动安装

#### 后端

```bash
cd backend
cargo build --release
```

#### 前端

```bash
cd frontend
npm install
npm run build
```

### 配置

1. 复制环境变量文件：
   ```bash
   cd backend
   copy .env.example .env
   ```

2. 修改 `.env` 配置：
   ```env
   DATABASE_URL=sqlite:./data/zk-20.db
   SERVER_HOST=0.0.0.0
   SERVER_PORT=8080
   MQTT_HOST=localhost
   MQTT_PORT=1883
   MQTT_CLIENT_ID=zk-20-backend
   ```

### 启动服务

#### Windows 一键启动

```bash
cd scripts
run.bat
```

#### 手动启动

```bash
# 终端 1: 后端服务
cd backend
cargo run --release

# 终端 2: 前端服务
cd frontend
npm run dev
```

### 访问应用

- 前端界面: http://localhost:3000
- 后端 API: http://localhost:8080
- 健康检查: http://localhost:8080/health

## 测试数据

### 生成测试数据

启动后端服务后，运行数据生成脚本：

```bash
cd scripts
python seed_data.py
```

### MQTT 数据模拟器

启动 MQTT broker 后，运行模拟器：

```bash
cd scripts
python mqtt_simulator.py
```

模拟器会每隔 2 秒发送模拟的热成像数据和人员定位信息。

## 部署

### Docker 部署

```bash
cd deploy
docker-compose up -d
```

### Systemd 部署 (Linux)

1. 复制服务文件：
   ```bash
   sudo cp deploy/systemd/zk-20-backend.service /etc/systemd/system/
   sudo cp deploy/systemd/zk-20-frontend.service /etc/systemd/system/
   ```

2. 启用并启动服务：
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now zk-20-backend
   sudo systemctl enable --now zk-20-frontend
   ```

### 边缘服务器部署建议

- 硬件配置：4核 CPU，8GB 内存，100GB SSD
- 操作系统：Debian 12 / Ubuntu 22.04 LTS
- 网络环境：稳定的局域网连接，MQTT broker 本地部署
- 数据备份：每日自动备份 SQLite 数据库到外部存储

## API 文档

### 建筑管理

- `POST /api/buildings` - 创建建筑
- `GET /api/buildings` - 获取建筑列表
- `GET /api/buildings/{id}` - 获取建筑详情
- `PUT /api/buildings/{id}` - 更新建筑信息
- `DELETE /api/buildings/{id}` - 删除建筑

### 热成像设备

- `POST /api/devices` - 创建设备
- `GET /api/devices/{id}` - 获取设备详情
- `GET /api/devices/building/{building_id}` - 获取建筑下的设备列表
- `PUT /api/devices/{id}/heartbeat` - 更新设备心跳

### 热成像数据

- `POST /api/thermal-data` - 上传热成像数据
- `GET /api/thermal-data/{id}` - 获取数据详情
- `GET /api/thermal-data/device/{device_id}` - 获取设备数据历史

### 异常热点

- `POST /api/hotspots` - 创建热点记录
- `GET /api/hotspots/building/{building_id}` - 获取建筑热点列表
- `GET /api/hotspots/risk` - 按风险等级筛选热点

### 巡防人员

- `POST /api/patrol-personnel` - 创建巡防人员
- `GET /api/patrol-personnel` - 获取人员列表
- `PUT /api/patrol-personnel/{id}/location` - 更新人员位置

### 告警管理

- `GET /api/alerts` - 获取告警列表
- `PUT /api/alerts/{id}/acknowledge` - 确认告警
- `PUT /api/alerts/{id}/resolve` - 解决告警

### 责任人员

- `POST /api/responsible-persons` - 创建责任人员
- `GET /api/responsible-persons/building/{building_id}` - 获取建筑责任人员

### 统计分析

- `GET /api/statistics/building/{building_id}/aggregate-by-hour` - 按小时聚合统计
- `GET /api/statistics/building/{building_id}/daily-summary` - 每日汇总统计

## WebSocket 实时通信

### 连接

```
ws://localhost:8080/ws
```

### 客户端消息

```json
{
  "type": "subscribe",
  "building_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### 服务端消息

- `thermal_frame` - 热成像数据帧
- `alert_notification` - 告警通知
- `patrol_location_update` - 人员位置更新
- `device_status` - 设备状态更新

## MQTT 主题

### 订阅主题

- `thermal/+/data` - 热成像数据
- `patrol/+/location` - 巡防人员位置
- `device/+/heartbeat` - 设备心跳
- `device/+/status` - 设备状态

### 消息格式示例

热成像数据：
```json
{
  "device_id": "660e8400-e29b-41d4-a716-446655440000",
  "building_id": "550e8400-e29b-41d4-a716-446655440000",
  "temperature_matrix": "[[25.3, 26.1, ...], ...]",
  "max_temp": 45.6,
  "timestamp": "2024-01-15T20:30:00Z"
}
```

## 目录结构

```
zk-20/
├── backend/                 # 后端 Rust 项目
│   ├── src/
│   │   ├── models/          # 数据模型
│   │   ├── db/              # 数据库操作
│   │   ├── handlers/        # API 处理器
│   │   ├── routes/          # 路由配置
│   │   ├── services/        # 业务逻辑服务
│   │   ├── mqtt/            # MQTT 客户端
│   │   ├── websocket/       # WebSocket 服务
│   │   └── main.rs          # 应用入口
│   ├── migrations/          # 数据库迁移
│   └── Cargo.toml
├── frontend/                # 前端 SolidJS 项目
│   ├── src/
│   │   ├── components/      # 公共组件
│   │   ├── pages/           # 页面组件
│   │   ├── services/        # API 和 WebSocket 服务
│   │   ├── store/           # 状态管理
│   │   ├── utils/           # 工具函数
│   │   └── styles/          # 样式文件
│   └── package.json
├── deploy/                  # 部署配置
│   ├── docker-compose.yml
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   ├── nginx.conf
│   └── systemd/             # Systemd 服务文件
├── scripts/                 # 辅助脚本
│   ├── mqtt_simulator.py    # MQTT 数据模拟器
│   ├── seed_data.py         # 测试数据生成
│   ├── install.bat          # Windows 安装脚本
│   └── run.bat              # Windows 启动脚本
└── README.md
```

## 热成像算法说明

### 异常热点检测流程

1. **数据预处理**
   - 解析 32x24 温度矩阵
   - 3x3 滑动窗口去噪
   - 温度数据插值平滑

2. **异常检测**
   - 计算全局温度统计量
   - 识别超过阈值的高温像素
   - BFS 算法进行连通区域分析

3. **风险评估**
   - > 60°C: 危险（红色）
   - > 45°C: 警告（橙色）
   - > 35°C: 注意（黄色）
   - < 35°C: 正常（蓝色）

4. **告警判定**
   - 连续 3 帧检测到异常
   - 结合夜间时段增加权重
   - 历史数据趋势分析

## 安全建议

1. **网络安全**
   - 使用 TLS 加密 MQTT 和 WebSocket 连接
   - 部署在专用局域网内，限制公网访问
   - 定期更新系统和依赖库

2. **数据安全**
   - 启用 SQLite 数据库加密
   - 定期备份数据库到安全存储
   - 敏感信息使用环境变量配置

3. **访问控制**
   - 启用用户认证和权限管理
   - 记录操作日志用于审计
   - 实施 IP 白名单访问控制

## 许可证

MIT License

## 技术支持

如有问题或建议，请提交 Issue 或联系开发团队。
