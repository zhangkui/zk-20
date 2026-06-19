#!/usr/bin/env python3
import json
import random
import time
import uuid
from datetime import datetime, timezone
import paho.mqtt.client as mqtt
import numpy as np

MQTT_HOST = "localhost"
MQTT_PORT = 1883
MQTT_TOPIC_THERMAL = "thermal/{device_id}/data"
MQTT_TOPIC_PATROL = "patrol/{personnel_id}/location"
MQTT_TOPIC_HEARTBEAT = "device/{device_id}/heartbeat"

BUILDINGS = [
    {"id": "550e8400-e29b-41d4-a716-446655440000", "name": "大雄宝殿"},
    {"id": "550e8400-e29b-41d4-a716-446655440001", "name": "藏经阁"},
]

DEVICES = [
    {"id": "660e8400-e29b-41d4-a716-446655440000", "building_id": "550e8400-e29b-41d4-a716-446655440000", "code": "CAM-001"},
    {"id": "660e8400-e29b-41d4-a716-446655440001", "building_id": "550e8400-e29b-41d4-a716-446655440001", "code": "CAM-002"},
]

PERSONNEL = [
    {"id": "770e8400-e29b-41d4-a716-446655440000", "name": "张三"},
    {"id": "770e8400-e29b-41d4-a716-446655440001", "name": "李四"},
]

def generate_temperature_matrix(width=32, height=24, anomaly_chance=0.1):
    base_temp = random.uniform(20, 35)
    
    matrix = np.random.normal(base_temp, 3, (height, width))
    
    if random.random() < anomaly_chance:
        anomaly_x = random.randint(0, width-1)
        anomaly_y = random.randint(0, height-1)
        anomaly_temp = random.uniform(50, 80)
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                ny, nx = anomaly_y + dy, anomaly_x + dx
                if 0 <= ny < height and 0 <= nx < width:
                    distance = np.sqrt(dx**2 + dy**2)
                    matrix[ny, nx] = max(matrix[ny, nx] + (anomaly_temp - base_temp) * np.exp(-distance**2 / 2), matrix[ny, nx])
    
    return matrix.tolist()

def on_connect(client, userdata, flags, rc):
    print(f"Connected with result code {rc}")

def main():
    client = mqtt.Client()
    client.on_connect = on_connect
    client.connect(MQTT_HOST, MQTT_PORT, 60)
    client.loop_start()

    print("MQTT Simulator started. Press Ctrl+C to stop.")
    print(f"Publishing to {MQTT_HOST}:{MQTT_PORT}")
    
    frame_count = 0
    
    try:
        while True:
            for device in DEVICES:
                matrix = generate_temperature_matrix(anomaly_chance=0.3)
                flat_matrix = [item for sublist in matrix for item in sublist]
                min_temp = min(flat_matrix)
                max_temp = max(flat_matrix)
                avg_temp = sum(flat_matrix) / len(flat_matrix)

                thermal_msg = {
                    "device_id": device["id"],
                    "building_id": device["building_id"],
                    "temperature_matrix": json.dumps(matrix),
                    "min_temp": min_temp,
                    "max_temp": max_temp,
                    "avg_temp": avg_temp,
                    "resolution_width": 32,
                    "resolution_height": 24,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
                
                topic = MQTT_TOPIC_THERMAL.format(device_id=device["id"])
                client.publish(topic, json.dumps(thermal_msg))
                print(f"[{frame_count}] Published thermal data for {device['code']}, max_temp={max_temp:.1f}°C")

                heartbeat_msg = {
                    "device_id": device["id"],
                    "status": "online",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
                heartbeat_topic = MQTT_TOPIC_HEARTBEAT.format(device_id=device["id"])
                client.publish(heartbeat_topic, json.dumps(heartbeat_msg))
            
            if frame_count % 5 == 0:
                for personnel in PERSONNEL:
                    location_msg = {
                        "personnel_id": personnel["id"],
                        "latitude": 39.9 + random.uniform(-0.001, 0.001),
                        "longitude": 116.4 + random.uniform(-0.001, 0.001),
                        "accuracy": random.uniform(1, 5),
                        "battery_level": random.uniform(50, 100),
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }
                    topic = MQTT_TOPIC_PATROL.format(personnel_id=personnel["id"])
                    client.publish(topic, json.dumps(location_msg))
                    print(f"    Published location for {personnel['name']}")

            frame_count += 1
            time.sleep(2)
            
    except KeyboardInterrupt:
        print("\nSimulator stopped.")
        client.loop_stop()
        client.disconnect()

if __name__ == "__main__":
    main()
