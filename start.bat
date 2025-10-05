@echo off
echo Starting Traffic Management System...
echo.

echo Starting MongoDB...
net start MongoDB
if %errorlevel% neq 0 (
    echo MongoDB is already running or failed to start
)

echo.
echo Starting Backend Server...
cd backend
start "Backend Server" cmd /k "npm run dev"

echo.
echo Waiting for backend to start...
timeout /t 5 /nobreak > nul

echo.
echo Starting Frontend Server...
cd ../frontend
start "Frontend Server" cmd /k "npm start"

echo.
echo Traffic Management System is starting...
echo Backend: http://localhost:5001
echo Frontend: http://localhost:3000
echo.
echo Default credentials:
echo Super Admin: admin / admin123
echo Operator: operator / operator123
echo.
pause
