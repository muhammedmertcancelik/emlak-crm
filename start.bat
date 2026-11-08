@echo off
title Emlak Takip CRM Web Sunucusu
cd /d "%~dp0"
echo ===================================================
echo   EMLAK TAKIP CRM - ONLİNE WEB SUNUCUSU
echo ===================================================
echo PC ve Mobilden online erisim baslatiliyor...
echo.
node server/index.js
pause
