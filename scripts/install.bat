@echo off
setlocal enabledelayedexpansion

echo ============================================================
echo ZK-20 古建筑消防预警平台 - Windows 安装脚本
echo ============================================================
echo.

echo [1/4] 初始化后端...
cd /d "%~dp0.."

echo.
echo [2/4] 安装后端依赖...
cd backend
if not exist "data" mkdir data
copy .env.example .env
cargo build --release
if errorlevel 1 (
    echo 后端编译失败！
    pause
    exit /b 1
)
echo 后端编译成功！

echo.
echo [3/4] 安装前端依赖...
cd ..\frontend
if not exist ".env" copy .env.example .env
call npm install
if errorlevel 1 (
    echo 前端依赖安装失败！
    pause
    exit /b 1
)
call npm run build
if errorlevel 1 (
    echo 前端构建失败！
    pause
    exit /b 1
)
echo 前端构建成功！

echo.
echo [4/4] 配置完成！
echo.
echo ============================================================
echo 安装完成！
echo.
echo 启动方式：
echo   后端: cd backend && cargo run --release
echo   前端: cd frontend && npm run dev
echo.
echo 访问地址: http://localhost:3000
echo ============================================================
pause
