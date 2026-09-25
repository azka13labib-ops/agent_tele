@echo off
title Hermes Services (9Router + Laptop Worker)
cd /d "%~dp0"

netstat -ano | findstr "20128" | findstr "LISTENING" >nul
if %errorlevel% neq 0 (
  start /min "" "C:\Program Files\nodejs\node.exe" "C:\Users\azka\AppData\Roaming\npm\node_modules\9router\cli.js" -p 20128 -H 0.0.0.0 -n --skip-update
)

node laptop_worker.js
