@echo off
title Hermes Laptop Worker (Tailscale Bridge)
cd /d "%~dp0"
echo ==================================================
echo   Starting Hermes Laptop Worker on port 20130...
echo ==================================================
node laptop_worker.js
pause
