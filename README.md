# AddisAbabaSUMO Traffic Management System

A comprehensive traffic management system for Addis Ababa, integrating SUMO simulation with a modern React frontend and Node.js backend.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Setup Instructions](#setup-instructions)
  - [Backend](#backend)
  - [Frontend](#frontend)
  - [SUMO Integration](#sumo-integration)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [API Endpoints](#api-endpoints)
- [WebSocket Events](#websocket-events)
- [Contributing](#contributing)
- [License](#license)
- [Support](#support)

---

## Project Overview

This project provides a platform for visualizing and managing traffic simulations in Addis Ababa using SUMO.  
It consists of a Node.js backend (API, SUMO integration) and a React frontend (dashboard, controls).

---

## Tech Stack

- **Backend:** Node.js, Express.js, MongoDB, Socket.IO, JWT
- **Frontend:** React, JavaScript, HTML, CSS
- **Simulation:** SUMO (Simulation of Urban Mobility), TraCI API

---

## Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- npm (v8 or higher)
- MongoDB (local or Atlas)
- SUMO (Simulation of Urban Mobility)
- Git

---

### Backend

1. Navigate to the backend folder:

   ```sh
   cd backend
   ```

2. Install dependencies:

   ```sh
   npm install
   ```

3. Create a `.env` file in the backend directory:

   ```env
   ACCESS_TOKEN_SECRET=your_jwt_secret_key
   MONGODB_URI=mongodb://localhost:27017/traffic_management
   PORT=5000
   SUMO_CONFIG_PATH=../AddisAbabaSUMO/AddisAbaba.sumocfg
   SUMO_BINARY_PATH=C:/Program Files (x86)/Eclipse/Sumo/bin/sumo.exe
   ```

4. Start the backend server:
   ```sh
   npm run dev
   ```
   The backend will start on `http://localhost:5001`.

---

### Frontend

1. Navigate to the frontend folder:

   ```sh
   cd frontend
   ```

2. Install dependencies:

   ```sh
   npm install
   ```

3. Start the frontend development server:
   ```sh
   npm start
   ```
   The frontend will run on `http://localhost:3000`.

---

### SUMO Integration

Ensure your SUMO installation is properly configured and the config file path in the backend `.env` file points to your SUMO configuration file.

---

## Usage

- Open your browser and go to `http://localhost:3000`.
- Log in or register if required.
- Use the dashboard to start/stop SUMO simulations, view traffic data, and manage intersections.
- The backend API runs at `http://localhost:5001` and handles simulation logic and data.

---

## Project Structure

```
AddisAbabaSUMO-main/
├── backend/
│   ├── server.js
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── sumo_bridge.py
│   ├── package.json
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── styles/
│   │   ├── pages/
│   │   └── utils/
│   ├── public/
│   ├── package.json
│   └── README.md
├── README.md
└── ...other files
```

---

## API Endpoints

### Authentication

- `POST /api/register` - Register new user
- `POST /api/login` - User login

### Traffic Data

- `GET /api/traffic-data` - Get traffic data
- `POST /api/traffic-data` - Add traffic data

### SUMO Integration

- `GET /api/sumo/status` - Get simulation status
- `POST /api/sumo/control` - Control simulation (start/stop/pause/resume)

### User Management

- `GET /api/users` - Get all users (Super Admin only)

---

## WebSocket Events

- `simulationStatus` - Simulation status updates
- `trafficData` - Real-time traffic data updates

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

---

## License

MIT

---

## Support

For support and questions, please create an issue in the repository or contact the development team.
