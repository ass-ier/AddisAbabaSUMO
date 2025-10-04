#!/bin/bash

echo "Starting Traffic Management System..."
echo

echo "Starting MongoDB..."
sudo systemctl start mongod
if [ $? -ne 0 ]; then
    echo "MongoDB is already running or failed to start"
fi

echo
echo "Starting Backend Server..."
cd backend
npm run dev &
BACKEND_PID=$!

echo
echo "Waiting for backend to start..."
sleep 5

echo
echo "Starting Frontend Server..."
cd ../frontend
npm start &
FRONTEND_PID=$!

echo
echo "Traffic Management System is starting..."
echo "Backend: http://localhost:5000"
echo "Frontend: http://localhost:3000"
echo
echo "Default credentials:"
echo "Super Admin: admin / admin123"
echo "Operator: operator / operator123"
echo
echo "Press Ctrl+C to stop all services"

# Function to cleanup on exit
cleanup() {
    echo
    echo "Stopping services..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Wait for processes
wait
