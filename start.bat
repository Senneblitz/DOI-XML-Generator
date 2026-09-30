@echo off
setlocal
title DataCite Maker

rem Startet den lokalen Webserver und oeffnet die Anwendung im Standardbrowser.
rem Fenster schliessen oder Strg+C beendet den Server.

cd /d "%~dp0"

if not exist "tools\serve.py" (
  echo FEHLER: tools\serve.py nicht gefunden. Liegt start.bat im Projektordner?
  echo.
  pause
  exit /b 1
)

rem Python suchen: erst der Launcher py, dann python.
set "PY="
where py >nul 2>&1 && set "PY=py -3"
if not defined PY (
  where python >nul 2>&1 && set "PY=python"
)
if not defined PY (
  echo FEHLER: Python wurde nicht gefunden.
  echo Von https://www.python.org/downloads/ installieren und dabei "Add python.exe to PATH" anhaken.
  echo.
  pause
  exit /b 1
)

rem serve.py sucht einen freien Port, startet den Server und oeffnet den Browser.
%PY% tools\serve.py %*
set "CODE=%ERRORLEVEL%"

if not "%CODE%"=="0" (
  echo.
  echo Start fehlgeschlagen ^(Code %CODE%^).
  pause
)

endlocal
