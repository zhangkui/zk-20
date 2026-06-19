#!/usr/bin/env python3
import requests
import json
import uuid
import random
from datetime import datetime, timezone, timedelta

BASE_URL = "http://localhost:8080/api"

def create_building(name, address, lat, lng, building_type):
    data = {
        "name": name,
        "description": f"{name} - 古建筑",
        "address": address,
        "latitude": lat,
        "longitude": lng,
        "area": random.uniform(500, 5000),
        "building_type": building_type,
        "construction_year": random.randint(1800, 1950),
        "floors": random.randint(1, 5),
        "risk_level": random.choice(["low", "medium", "high"]),
    }
    response = requests.post(f"{BASE_URL}/buildings", json=data)
    if response.status_code == 201:
        result = response.json()
        print(f"✓ Created building: {name} (ID: {result['data']['id']})
        return result['data']
    else:
        print(f"✗ Failed to create building {name}: {response.status_code} - {response.text}")
        return None

def create_device(building_id, name, device_code):
    data = {
        "building_id": building_id,
        "name": name,
        "device_code": device_code,
        "model": "FLIR-Tau-2",
        "ip_address": f"192.168.1.{random.randint(100, 200}",
        "latitude": 39.9 + random.uniform(-0.002, 0.002),
        "longitude": 116.4 + random.uniform(-0.002, 0.002),
        "fov_width": 45.0,
        "fov_height": 37.5,
        "installation_height": 3.5,
    }
    response = requests.post(f"{BASE_URL}/devices", json=data)
    if response.status_code == 201:
        result = response.json()
        print(f"  ✓ Created device: {name}")
        return result['data']
    else:
        print(f"  ✗ Failed to create device {name}: {response.status_code}")
        return None

def create_personnel(name, employee_id):
    data = {
        "name": name,
        "employee_id": employee_id,
        "phone": f"138{random.randint(10000000, 99999999)}",
        "department": "消防安保部",
        "position": random.choice(["巡防队长", "巡防队员", "安全员"]),
    }
    response = requests.post(f"{BASE_URL}/patrol-personnel", json=data)
    if response.status_code == 201:
        result = response.json()
        print(f"  ✓ Created personnel: {name}")
        return result['data']
    else:
        print(f"  ✗ Failed to create personnel {name}: {response.status_code}")
        return None

def create_responsible_person(building_id, name, position):
    data = {
        "building_id": building_id,
        "name": name,
        "position": position,
        "phone": f"139{random.randint(10000000, 99999999)}",
        "email": f"{name.lower().replace(' ', '.')}@example.com",
        "responsibility": random.choice([
            "全面负责建筑消防安全管理工作",
            "负责日常消防安全检查",
            "负责消防设施维护保养",
            "负责消防安全教育培训工作",
        ]),
    }
    response = requests.post(f"{BASE_URL}/responsible-persons", json=data)
    if response.status_code == 201:
        print(f"  ✓ Created responsible person: {name}")
        return response.json()['data']
    else:
        print(f"  ✗ Failed to create responsible person {name}: {response.status_code}")
        return None

def create_thermal_data(device_id, building_id):
    import numpy as np
    width, height = 32, 24
    base_temp = random.uniform(20, 35)
    matrix = np.random.normal(base_temp, 3, (height, width)).tolist()
    
    flat = [item for sublist in matrix for item in sublist]
    data = {
        "device_id": device_id,
        "building_id": building_id,
        "temperature_matrix": json.dumps(matrix),
        "min_temp": min(flat),
        "max_temp": max(flat),
        "avg_temp": sum(flat) / len(flat),
        "resolution_width": width,
        "resolution_height": height,
        "is_night": datetime.now().hour >= 20 or datetime.now().hour < 6,
    }
    response = requests.post(f"{BASE_URL}/thermal-data", json=data)
    if response.status_code == 201:
        return response.json()['data']
    return None

def main():
    print("=" * 60)
    print("ZK-20 古建筑消防预警平台 - 测试数据生成工具")
    print("=" * 60)
    print()

    buildings_data = [
        ("大雄宝殿", "北京市东城区景山前街4号", 39.9163, 116.3972, "宫殿建筑"),
        ("藏经阁", "北京市东城区景山前街4号", 39.9165, 116.3975, "楼阁建筑"),
        ("钟楼", "北京市东城区景山前街4号", 39.9167, 116.3978, "钟楼建筑"),
        ("鼓楼", "北京市东城区钟楼湾临字9号", 39.9424, 116.4025, "鼓楼建筑"),
        ("故宫角楼", "北京市东城区景山前街4号", 39.9140, 116.3910, "角楼建筑"),
    ]

    buildings = []
    for name, address, lat, lng, btype in buildings_data:
        building = create_building(name, address, lat, lng, btype)
        if building:
            buildings.append(building)

    print()

    for building in buildings:
        print(f"\n设备 for {building['name']}:")
        for i in range(2):
            create_device(building['id'], f"{building['name']}-热成像-{i+1}", f"CAM-{building['name'][:2]}-{i+1:02d}")

    print("\n巡防人员:")
    personnel_names = ["张三", "李四", "王五", "赵六"]
    for i, name in enumerate(personnel_names):
        create_personnel(name, f"XF{2024:04d}")

    print("\n责任人员:")
    for building in buildings:
        print(f"\n  {building['name']}:")
        create_responsible_person(building['id'], f"王{random.choice(['刚', '强', '伟', '军'])}", "消防安全管理员")
        create_responsible_person(building['id'], f"李{random.choice(['明', '华', '丽', '芳'])}", "消防安全员")

    print("\n" + "=" * 60)
    print("测试数据生成完成！")
    print("=" * 60)

if __name__ == "__main__":
    main()
