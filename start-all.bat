@echo off
setlocal ENABLEDELAYEDEXPANSION

REM ==================================================================
REM Traffic Management System Launcher (MongoDB + Backend + Frontend)
REM ==================================================================

REM Ensure we run from the directory of this script
pushd "%~dp0" >nul 2>&1

set "MONGO_STARTED=0"

echo [1/3] Checking/starting MongoDB...
REM Check if MongoDB service exists and is running; otherwise try to start it.
sc query "MongoDB" >nul 2>&1
if !errorlevel! EQU 0 (
    sc query "MongoDB" | find /I "RUNNING" >nul 2>&1
    if !errorlevel! EQU 0 (
        echo - MongoDB service is already RUNNING.
        set "MONGO_STARTED=1"
    ) else (
        echo - Starting MongoDB service...
        net start MongoDB >nul 2>&1
        if !errorlevel! EQU 0 (
            echo - MongoDB service started.
            set "MONGO_STARTED=1"
        ) else (
            echo - Failed to start MongoDB service. Will try mongod fallback.
        )
    )
) else (
    echo - MongoDB service not found on this machine.
)

if "!MONGO_STARTED!"=="0" (
    where mongod >nul 2>&1
    if !errorlevel! EQU 0 (
        set "MONGO_DATA=%ProgramData%\MongoDB\data"
        set "MONGO_LOGS=%ProgramData%\MongoDB\logs"
        if not exist "%MONGO_DATA%" mkdir "%MONGO_DATA%" >nul 2>&1
        if not exist "%MONGO_LOGS%" mkdir "%MONGO_LOGS%" >nul 2>&1
echo - Launching mongod - no Windows service - in a new window...
        start "MongoDB mongod" cmd /k "mongod --dbpath \"%MONGO_DATA%\" --logpath \"%MONGO_LOGS%\mongod.log\" --bind_ip 127.0.0.1 --port 27017"
        set "MONGO_STARTED=1"
    ) else (
        echo - Could not find mongod.exe in PATH. Please start MongoDB manually.
    )
)

echo.
echo [2/3] Starting Backend...
pushd "%~dp0backend" >nul 2>&1
if exist package.json (
    if not exist node_modules (
        echo - Installing backend dependencies: npm install
        call npm install
    ) else (
        echo - Backend dependencies already present.
    )
    echo - Launching backend: npm run dev in a new window...
    start "Backend Server" cmd /k "npm run dev"
) else (
    echo - backend/package.json not found. Skipping backend start.
)
popd >nul 2>&1

echo.
echo [3/3] Starting Frontend...
pushd "%~dp0frontend" >nul 2>&1
if exist package.json (
    if not exist node_modules (
        echo - Installing frontend dependencies: npm install
        call npm install
    ) else (
        echo - Frontend dependencies already present.
    )
    echo - Launching frontend: npm start in a new window...
    start "Frontend Server" cmd /k "npm start"
) else (
    echo - frontend/package.json not found. Skipping frontend start.
)
popd >nul 2>&1

echo.
echo ------------------------------------------------------------
echo Launch initiated.
echo - Backend:  http://localhost:5000/
echo - Frontend: http://localhost:3000/
echo If windows did not open, check for errors above.
echo ------------------------------------------------------------

echo.
popd >nul 2>&1
endlocal

pause