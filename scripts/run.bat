@echo off
title ZK-20 古建筑消防预警平台

echo ============================================================
echo 启动 ZK-20 服务
echo ============================================================
echo.

cd /d "%~dp0.."

echo 启动后端服务...
start "ZK-20 Backend" cmd /k "cd backend && cargo run --release"

timeout /t 3

echo 启动前端开发服务器...
start "ZK-20 Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ============================================================
echo 服务启动完成！
echo.
echo 后端 API: http://localhost:8080
echo 前端界面: http://localhost:3000
echo ============================================================
echo.
pause
