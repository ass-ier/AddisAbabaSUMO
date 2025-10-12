import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import io from "socket.io-client";
import PageLayout from "./PageLayout";
import connectionTest from "../utils/connectionTest";
import "./EnhancedSUMOIntegration.css";

// API base URL configuration
const API_BASE_URL = process.env.REACT_APP_API_BASE || "http://localhost:5001";

const EnhancedSUMOIntegration = () => {
  // Simulation State
  const [simulationStatus, setSimulationStatus] = useState({
    isRunning: false,
    status: 'stopped',
    startTime: null,
    endTime: null,
    currentStep: 0,
    totalSteps: 0,
    currentTime: 0,
    speed: 1.0,
    stepLength: 1.0, // SUMO step length in seconds
    mode: "fixed", // fixed, rl (UI label only)
    scenario: "default",
    networkFile: 'default.net.xml',
    simulationId: null,
  });

  // Light control toggle: 'fixed' (SUMO default programs from net.xml) or 'rl' (PPO BestModel)
  const [lightControlMode, setLightControlMode] = useState("fixed");

  // Configuration State
  const [config, setConfig] = useState({
    stepLength: 1.0,
    startWithGui: true,
    maxSpeed: 13.89, // 50 km/h
    minGap: 2.5,
    accel: 2.6,
    decel: 4.5,
    emergencyDecel: 4.5,
    sigma: 0.5,
    tau: 1.0,
    lcStrategic: 1.0,
    lcCooperative: 1.0,
    lcSpeedGain: 1.0,
    lcKeepRight: 1.0,
    lcLookahead: 2.0,
    lcSublane: 1.0,
    lcPushy: 0.0,
    lcPushyGap: 0.0,
    lcAssertive: 1.0,
    lcImpatience: 0.0,
    lcTimeToImpatience: 1.0,
    lcAccelLat: 1.0,
    lcTurnAlignmentDistance: 0.0,
    lcOvertakeRight: 0.0,
    lcKeepRightAcceptanceTime: 0.0,
    jmIgnoreFoeProb: 0.0,
    jmIgnoreFoeSpeed: 0.0,
    jmSigmaStep: 0.0,
    jmTimeGapMinor: 1.0,
    jmTimeGapMinor2: 1.0,
    jmMaxSpeedMinor: 1.0,
    jmMaxSpeedMinor2: 1.0,
    jmTimeGapMajor: 1.0,
    jmTimeGapMajor2: 1.0,
    jmMaxSpeedMajor: 1.0,
    jmMaxSpeedMajor2: 1.0,
    jmTimeGapMinor3: 1.0,
    jmTimeGapMinor4: 1.0,
    jmMaxSpeedMinor3: 1.0,
    jmMaxSpeedMinor4: 1.0,
    jmTimeGapMinor5: 1.0,
    jmTimeGapMinor6: 1.0,
    jmMaxSpeedMinor5: 1.0,
    jmMaxSpeedMinor6: 1.0,
    jmTimeGapMinor7: 1.0,
    jmTimeGapMinor8: 1.0,
    jmMaxSpeedMinor7: 1.0,
    jmMaxSpeedMinor8: 1.0,
    jmTimeGapMinor9: 1.0,
    jmTimeGapMinor10: 1.0,
    jmMaxSpeedMinor9: 1.0,
    jmMaxSpeedMinor10: 1.0,
    jmTimeGapMinor11: 1.0,
    jmTimeGapMinor12: 1.0,
    jmMaxSpeedMinor11: 1.0,
    jmMaxSpeedMinor12: 1.0,
    jmTimeGapMinor13: 1.0,
    jmTimeGapMinor14: 1.0,
    jmMaxSpeedMinor13: 1.0,
    jmMaxSpeedMinor14: 1.0,
    jmTimeGapMinor15: 1.0,
    jmTimeGapMinor16: 1.0,
    jmMaxSpeedMinor15: 1.0,
    jmMaxSpeedMinor16: 1.0,
    jmTimeGapMinor17: 1.0,
    jmTimeGapMinor18: 1.0,
    jmMaxSpeedMinor17: 1.0,
    jmMaxSpeedMinor18: 1.0,
    jmTimeGapMinor19: 1.0,
    jmTimeGapMinor20: 1.0,
    jmMaxSpeedMinor19: 1.0,
    jmMaxSpeedMinor20: 1.0,
    jmTimeGapMinor21: 1.0,
    jmTimeGapMinor22: 1.0,
    jmMaxSpeedMinor21: 1.0,
    jmMaxSpeedMinor22: 1.0,
    jmTimeGapMinor23: 1.0,
    jmTimeGapMinor24: 1.0,
    jmMaxSpeedMinor23: 1.0,
    jmMaxSpeedMinor24: 1.0,
    jmTimeGapMinor25: 1.0,
    jmTimeGapMinor26: 1.0,
    jmMaxSpeedMinor25: 1.0,
    jmMaxSpeedMinor26: 1.0,
    jmTimeGapMinor27: 1.0,
    jmTimeGapMinor28: 1.0,
    jmMaxSpeedMinor27: 1.0,
    jmMaxSpeedMinor28: 1.0,
    jmTimeGapMinor29: 1.0,
    jmTimeGapMinor30: 1.0,
    jmMaxSpeedMinor29: 1.0,
    jmMaxSpeedMinor30: 1.0,
    jmTimeGapMinor31: 1.0,
    jmTimeGapMinor32: 1.0,
    jmMaxSpeedMinor31: 1.0,
    jmMaxSpeedMinor32: 1.0,
    jmTimeGapMinor33: 1.0,
    jmTimeGapMinor34: 1.0,
    jmMaxSpeedMinor33: 1.0,
    jmMaxSpeedMinor34: 1.0,
    jmTimeGapMinor35: 1.0,
    jmTimeGapMinor36: 1.0,
    jmMaxSpeedMinor35: 1.0,
    jmMaxSpeedMinor36: 1.0,
    jmTimeGapMinor37: 1.0,
    jmTimeGapMinor38: 1.0,
    jmMaxSpeedMinor37: 1.0,
    jmMaxSpeedMinor38: 1.0,
    jmTimeGapMinor39: 1.0,
    jmTimeGapMinor40: 1.0,
    jmMaxSpeedMinor39: 1.0,
    jmMaxSpeedMinor40: 1.0,
    jmTimeGapMinor41: 1.0,
    jmTimeGapMinor42: 1.0,
    jmMaxSpeedMinor41: 1.0,
    jmMaxSpeedMinor42: 1.0,
    jmTimeGapMinor43: 1.0,
    jmTimeGapMinor44: 1.0,
    jmMaxSpeedMinor43: 1.0,
    jmMaxSpeedMinor44: 1.0,
    jmTimeGapMinor45: 1.0,
    jmTimeGapMinor46: 1.0,
    jmMaxSpeedMinor45: 1.0,
    jmMaxSpeedMinor46: 1.0,
    jmTimeGapMinor47: 1.0,
    jmTimeGapMinor48: 1.0,
    jmMaxSpeedMinor47: 1.0,
    jmMaxSpeedMinor48: 1.0,
    jmTimeGapMinor49: 1.0,
    jmTimeGapMinor50: 1.0,
    jmMaxSpeedMinor49: 1.0,
    jmMaxSpeedMinor50: 1.0,
    jmTimeGapMinor51: 1.0,
    jmTimeGapMinor52: 1.0,
    jmMaxSpeedMinor51: 1.0,
    jmMaxSpeedMinor52: 1.0,
    jmTimeGapMinor53: 1.0,
    jmTimeGapMinor54: 1.0,
    jmMaxSpeedMinor53: 1.0,
    jmMaxSpeedMinor54: 1.0,
    jmTimeGapMinor55: 1.0,
    jmTimeGapMinor56: 1.0,
    jmMaxSpeedMinor55: 1.0,
    jmMaxSpeedMinor56: 1.0,
    jmTimeGapMinor57: 1.0,
    jmTimeGapMinor58: 1.0,
    jmMaxSpeedMinor57: 1.0,
    jmMaxSpeedMinor58: 1.0,
    jmTimeGapMinor59: 1.0,
    jmTimeGapMinor60: 1.0,
    jmMaxSpeedMinor59: 1.0,
    jmMaxSpeedMinor60: 1.0,
    jmTimeGapMinor61: 1.0,
    jmTimeGapMinor62: 1.0,
    jmMaxSpeedMinor61: 1.0,
    jmMaxSpeedMinor62: 1.0,
    jmTimeGapMinor63: 1.0,
    jmTimeGapMinor64: 1.0,
    jmMaxSpeedMinor63: 1.0,
    jmMaxSpeedMinor64: 1.0,
    jmTimeGapMinor65: 1.0,
    jmTimeGapMinor66: 1.0,
    jmMaxSpeedMinor65: 1.0,
    jmMaxSpeedMinor66: 1.0,
    jmTimeGapMinor67: 1.0,
    jmTimeGapMinor68: 1.0,
    jmMaxSpeedMinor67: 1.0,
    jmMaxSpeedMinor68: 1.0,
    jmTimeGapMinor69: 1.0,
    jmTimeGapMinor70: 1.0,
    jmMaxSpeedMinor69: 1.0,
    jmMaxSpeedMinor70: 1.0,
    jmTimeGapMinor71: 1.0,
    jmTimeGapMinor72: 1.0,
    jmMaxSpeedMinor71: 1.0,
    jmMaxSpeedMinor72: 1.0,
    jmTimeGapMinor73: 1.0,
    jmTimeGapMinor74: 1.0,
    jmMaxSpeedMinor73: 1.0,
    jmMaxSpeedMinor74: 1.0,
    jmTimeGapMinor75: 1.0,
    jmTimeGapMinor76: 1.0,
    jmMaxSpeedMinor75: 1.0,
    jmMaxSpeedMinor76: 1.0,
    jmTimeGapMinor77: 1.0,
    jmTimeGapMinor78: 1.0,
    jmMaxSpeedMinor77: 1.0,
    jmMaxSpeedMinor78: 1.0,
    jmTimeGapMinor79: 1.0,
    jmTimeGapMinor80: 1.0,
    jmMaxSpeedMinor79: 1.0,
    jmMaxSpeedMinor80: 1.0,
    jmTimeGapMinor81: 1.0,
    jmTimeGapMinor82: 1.0,
    jmMaxSpeedMinor81: 1.0,
    jmMaxSpeedMinor82: 1.0,
    jmTimeGapMinor83: 1.0,
    jmTimeGapMinor84: 1.0,
    jmMaxSpeedMinor83: 1.0,
    jmMaxSpeedMinor84: 1.0,
    jmTimeGapMinor85: 1.0,
    jmTimeGapMinor86: 1.0,
    jmMaxSpeedMinor85: 1.0,
    jmMaxSpeedMinor86: 1.0,
    jmTimeGapMinor87: 1.0,
    jmTimeGapMinor88: 1.0,
    jmMaxSpeedMinor87: 1.0,
    jmMaxSpeedMinor88: 1.0,
    jmTimeGapMinor89: 1.0,
    jmTimeGapMinor90: 1.0,
    jmMaxSpeedMinor89: 1.0,
    jmMaxSpeedMinor90: 1.0,
    jmTimeGapMinor91: 1.0,
    jmTimeGapMinor92: 1.0,
    jmMaxSpeedMinor91: 1.0,
    jmMaxSpeedMinor92: 1.0,
    jmTimeGapMinor93: 1.0,
    jmTimeGapMinor94: 1.0,
    jmMaxSpeedMinor93: 1.0,
    jmMaxSpeedMinor94: 1.0,
    jmTimeGapMinor95: 1.0,
    jmTimeGapMinor96: 1.0,
    jmMaxSpeedMinor95: 1.0,
    jmMaxSpeedMinor96: 1.0,
    jmTimeGapMinor97: 1.0,
    jmTimeGapMinor98: 1.0,
    jmMaxSpeedMinor97: 1.0,
    jmMaxSpeedMinor98: 1.0,
    jmTimeGapMinor99: 1.0,
    jmTimeGapMinor100: 1.0,
    jmMaxSpeedMinor99: 1.0,
    jmMaxSpeedMinor100: 1.0,
  });

  // Real-time Data
  const [realTimeData, setRealTimeData] = useState({
    vehicleCount: 0,
    averageSpeed: 0,
    simulationTime: 0,
    totalVehicles: 0,
    runningVehicles: 0,
    waitingVehicles: 0,
    teleportingVehicles: 0,
    collisions: 0,
    emergencyStops: 0,
    fuelConsumption: 0,
    emissions: {
      CO2: 0,
      CO: 0,
      HC: 0,
      NOx: 0,
      PMx: 0,
    },
  });

  // UI State
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("control");
  const [logs, setLogs] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [originalConfig, setOriginalConfig] = useState(null);
  const [scenarios] = useState([
    {
      id: "default",
      name: "Default Scenario",
      description: "Standard traffic simulation",
    },
    {
      id: "rush_hour",
      name: "Rush Hour",
      description: "High density traffic simulation",
    },
    {
      id: "night",
      name: "Night Traffic",
      description: "Low density night simulation",
    },
  ]);

  const socketRef = useRef(null);

  // Scenario-specific default configurations
  const scenarioConfigs = {
    default: {
      stepLength: 1.0,
      startWithGui: true,
      maxSpeed: 13.89, // 50 km/h
      minGap: 2.5,
      accel: 2.6,
      decel: 4.5,
      sigma: 0.5,
      lcStrategic: 1.0,
      lcCooperative: 1.0,
      lcSpeedGain: 1.0,
      lcKeepRight: 1.0,
    },
    rush_hour: {
      stepLength: 0.8,
      startWithGui: true,
      maxSpeed: 11.11, // 40 km/h (slower in peak)
      minGap: 2.0, // Tighter gaps
      accel: 2.2, // Slower acceleration
      decel: 5.0, // Faster deceleration
      sigma: 0.7, // More randomness
      lcStrategic: 1.5, // More strategic
      lcCooperative: 0.8, // Less cooperative
      lcSpeedGain: 1.2,
      lcKeepRight: 0.8,
    },
    night: {
      stepLength: 1.2,
      startWithGui: true,
      maxSpeed: 16.67, // 60 km/h (faster at night)
      minGap: 3.0, // Larger gaps
      accel: 2.8,
      decel: 4.0,
      sigma: 0.3, // Less randomness
      lcStrategic: 0.8,
      lcCooperative: 1.2, // More cooperative
      lcSpeedGain: 0.8,
      lcKeepRight: 1.2,
    },
  };

  // Helper function to get auth headers
  const getAuthHeaders = () => {
    const token = sessionStorage.getItem("token");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  };

  // SUMO config setter removed - now using dynamic scenario-based config selection

  useEffect(() => {
    // Initialize socket connection with proper configuration
    socketRef.current = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true
    });

    // Listen for simulation status updates
    socketRef.current.on("simulationStatus", (status) => {
      console.log('Received simulationStatus:', status); // Debug log
      // Safely extract only the expected properties to avoid object rendering issues
      const data = status || {};
      const config = data.configuration || {};
      
      const currentStep = Number(config.currentStep) || Number(data.currentStep) || 0;
      const stepLength = Number(config.stepLength) || 1.0; // Get step length from config
      const currentTime = currentStep * stepLength; // Calculate SUMO simulation time
      
      console.log('Status update - Step:', currentStep, 'StepLength:', stepLength, 'Time:', currentTime);
      
      const statusUpdate = {
        isRunning: Boolean(data.isRunning),
        status: data.status || 'stopped',
        currentStep: currentStep,
        totalSteps: Number(config.totalSteps) || Number(data.totalSteps) || 0,
        currentTime: currentTime, // Use calculated SUMO simulation time
        speed: Number(data.speed) || 1.0,
        stepLength: stepLength, // Store step length for calculations
        mode: typeof data.mode === 'string' ? data.mode : 'fixed',
        // Don't override user-selected scenario with backend data
        // scenario: preserve existing scenario selection
        startTime: data.startTime,
        endTime: data.endTime,
        networkFile: config.networkFile || 'default.net.xml',
        simulationId: data.simulationId || null
      };
      
      setSimulationStatus((prev) => {
        console.log('Socket status update - preserving scenario:', prev.scenario);
        
        // Check if simulation was running but now stopped - reset metrics
        if (!data.isRunning && prev.isRunning) {
          console.log('Simulation stopped - resetting metrics');
          setRealTimeData({
            vehicleCount: 0,
            averageSpeed: 0,
            simulationTime: 0,
            totalVehicles: 0,
            runningVehicles: 0,
            waitingVehicles: 0,
            teleportingVehicles: 0,
            collisions: 0,
            emergencyStops: 0,
            fuelConsumption: 0,
            emissions: {
              CO2: 0,
              CO: 0,
              HC: 0,
              NOx: 0,
              PMx: 0,
            },
          });
        }
        return { ...prev, ...statusUpdate };
      });
    });

    // Listen for real-time traffic data
    socketRef.current.on("trafficData", (data) => {
      setRealTimeData((prev) => ({ ...prev, ...data }));
    });
    
    // Listen for SUMO visualization data
    socketRef.current.on("sumoData", (vizData) => {
      if (vizData && typeof vizData === 'object' && vizData.type === 'viz') {
        console.log('Received sumoData:', vizData.step); // Debug log
        
        const currentStep = vizData.step || 0;
        const vehicles = vizData.vehicles || [];
        
        // Update simulation step and time only if simulation is running
        setSimulationStatus(prev => {
          if (prev.isRunning) {
            // Calculate SUMO simulation time using step length from config
            const stepLength = Number(prev.stepLength) || 1.0;
            const simulationTime = currentStep * stepLength;
            
            console.log('sumoData update - Step:', currentStep, 'StepLength:', stepLength, 'SimTime:', simulationTime);
            
            return {
              ...prev,
              currentStep,
              currentTime: simulationTime,
            };
          }
          return prev;
        });
        
        // Update real-time vehicle data only if simulation is running
        setSimulationStatus(prevStatus => {
          if (prevStatus.isRunning && vehicles.length >= 0) {
            // Calculate average speed
            let averageSpeed = 0;
            if (vehicles.length > 0) {
              const totalSpeed = vehicles.reduce((sum, v) => sum + (v.speed || 0), 0);
              averageSpeed = totalSpeed / vehicles.length;
            }
            
            const runningVehicles = vehicles.filter(v => v.speed > 0.1).length;
            const waitingVehicles = vehicles.filter(v => v.speed <= 0.1).length;
            const teleportingVehicles = vehicles.filter(v => v.speed < 0).length;
            
            setRealTimeData(prev => {
              const collisions = 0;
              const emergencyStops = vehicles.filter(v => v.speed === 0 && prev.averageSpeed > 0).length;
              const fuelConsumption = prev.fuelConsumption + (vehicles.length * averageSpeed * 0.001);
              
              const emissionFactor = 1.0 + (averageSpeed / 50);
              const co2Increment = vehicles.length * emissionFactor * 0.1;
              const coIncrement = vehicles.length * emissionFactor * 0.05;
              const noxIncrement = vehicles.length * emissionFactor * 0.02;
              const pmxIncrement = vehicles.length * emissionFactor * 0.01;
              
              return {
                ...prev,
                totalVehicles: vehicles.length,
                runningVehicles,
                waitingVehicles,
                teleportingVehicles,
                averageSpeed: averageSpeed * 3.6, // Convert m/s to km/h
                collisions: prev.collisions + collisions,
                emergencyStops: prev.emergencyStops + Math.max(0, emergencyStops),
                fuelConsumption: Math.max(0, fuelConsumption),
                emissions: {
                  CO2: prev.emissions.CO2 + co2Increment,
                  CO: prev.emissions.CO + coIncrement,
                  NOx: prev.emissions.NOx + noxIncrement,
                  PMx: prev.emissions.PMx + pmxIncrement,
                  HC: prev.emissions.HC + (coIncrement * 0.5),
                },
              };
            });
          }
          return prevStatus;
        });
      }
    });
    
    // Also listen for 'viz' event as backup
    socketRef.current.on("viz", (vizData) => {
      if (vizData && typeof vizData === 'object') {
        console.log('Received viz data:', vizData.step); // Debug log
        
        const currentStep = vizData.step || 0;
        
        setSimulationStatus(prev => {
          if (prev.isRunning) {
            const stepLength = Number(prev.stepLength) || 1.0;
            const simulationTime = currentStep * stepLength;
            
            console.log('viz update - Step:', currentStep, 'StepLength:', stepLength, 'SimTime:', simulationTime);
            
            return {
              ...prev,
              currentStep,
              currentTime: simulationTime,
            };
          }
          return prev;
        });
      }
    });

    // Listen for simulation logs
    socketRef.current.on("simulationLog", (log) => {
      setLogs((prev) => [
        ...prev.slice(-99),
        { ...log, timestamp: new Date() },
      ]);
    });
    
    // Debug: Connection events
    socketRef.current.on('connect', () => {
      console.log('Socket connected to backend');
    });
    
    socketRef.current.on('disconnect', () => {
      console.log('Socket disconnected from backend');
    });

    // Fetch initial status
    fetchSimulationStatus();
    
    // Poll simulation status every 5 seconds - scenario preservation will handle overwrites
    const statusInterval = setInterval(() => {
      fetchSimulationStatus();
    }, 5000);

    return () => {
      clearInterval(statusInterval);
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);
  
  // Load initial scenario configuration
  useEffect(() => {
    const initialScenario = simulationStatus.scenario || "default";
    loadScenarioConfig(initialScenario);
  }, []); // Only run once on mount

  const fetchSimulationStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/sumo/status`, {
        headers: getAuthHeaders(),
        withCredentials: true
      });
      // Debug: Log the status response
      console.log('Fetched simulation status:', response.data);
      
      // Safely extract properties from SimulationStatus model
      const data = response.data || {};
      const config = data.configuration || {};
      
      const currentStep = Number(config.currentStep) || Number(data.currentStep) || 0;
      const stepLength = Number(config.stepLength) || 1.0;
      const currentTime = currentStep * stepLength;
      
      const statusUpdate = {
        isRunning: Boolean(data.isRunning),
        status: data.status || 'stopped',
        currentStep: currentStep,
        totalSteps: Number(config.totalSteps) || Number(data.totalSteps) || 0,
        currentTime: currentTime,
        speed: Number(data.speed) || 1.0,
        stepLength: stepLength,
        mode: typeof data.mode === 'string' ? data.mode : 'fixed',
        // Don't override user-selected scenario with backend data
        // scenario: preserve existing scenario selection
        startTime: data.startTime,
        endTime: data.endTime,
        networkFile: config.networkFile || 'default.net.xml',
        simulationId: data.simulationId || null
      };
      
      setSimulationStatus((prev) => {
        console.log('API status update - preserving scenario:', prev.scenario);
        
        // Reset real-time data if simulation stopped since last check
        if (!data.isRunning && prev.isRunning) {
          console.log('Status fetch shows simulation stopped - resetting metrics');
          setRealTimeData({
            vehicleCount: 0,
            averageSpeed: 0,
            simulationTime: 0,
            totalVehicles: 0,
            runningVehicles: 0,
            waitingVehicles: 0,
            teleportingVehicles: 0,
            collisions: 0,
            emergencyStops: 0,
            fuelConsumption: 0,
            emissions: {
              CO2: 0,
              CO: 0,
              HC: 0,
              NOx: 0,
              PMx: 0,
            },
          });
        }
        return { ...prev, ...statusUpdate };
      });
    } catch (error) {
      console.error("Error fetching simulation status:", error);
      addLog(`Failed to fetch simulation status: ${error.response?.data?.message || error.message}`, "error");
    }
  };

  const handleSimulationControl = async (action) => {
    setIsLoading(true);
    addLog(`${action === 'start' ? 'Starting' : 'Stopping'} simulation...`, "info");
    
    try {
      // Align with backend API: expects { command: "start_simulation" | ... }
      const commandMap = {
        start: "start_simulation",
        stop: "stop_simulation",
      };
      const command = commandMap[action];
      if (!command) throw new Error("Invalid action");

      const payload = { command, parameters: {} };
      if (action === "start") {
        // Get current scenario for dynamic config selection
        const sc = simulationStatus.scenario || "default";
        console.log(`Starting ${sc} scenario with dynamic config selection`);
        addLog(`Starting simulation with ${sc} scenario`, "info");
        
        // Base SUMO parameters; do not include RL switches unless RL is selected
        payload.parameters = {
          scenario: sc, // Send scenario to backend for dynamic config selection
          stepLength: config.stepLength,
          startWithGui: config.startWithGui,
        };

        if (lightControlMode === "rl") {
          // Use BestModel for RL; relative to project root so backend can resolve
          // You can adjust this path if you prefer a different model
          payload.parameters.useRL = true;
          payload.parameters.rlModelPath = "Sumoconfigs/experiments/targeted_addis_ppo_20251003_031746/models/best_model/best_model.zip";
          payload.parameters.rlDelta = 15; // decision interval (s)
        }
      }
      
      const response = await axios.post(`${API_BASE_URL}/api/sumo/control`, payload, {
        headers: getAuthHeaders(),
        withCredentials: true,
        timeout: 30000, // 30 second timeout
      });
      // Safely handle response data
      const responseData = response.data?.data || response.data || {};
      const statusUpdate = {
        isRunning: Boolean(responseData.isRunning),
        currentStep: Number(responseData.currentStep) || 0,
        totalSteps: Number(responseData.totalSteps) || 0,
        currentTime: Number(responseData.currentTime) || 0,
        speed: Number(responseData.speed) || 1.0,
        mode: lightControlMode, // Use the selected light control mode
        scenario: simulationStatus.scenario, // Keep the selected scenario
        startTime: responseData.startTime,
        endTime: responseData.endTime
      };
      setSimulationStatus((prev) => ({ ...prev, ...statusUpdate }));
      
      // Reset accumulative metrics when starting simulation
      if (action === "start") {
        console.log('Starting simulation - resetting metrics');
        setRealTimeData({
          vehicleCount: 0,
          averageSpeed: 0,
          simulationTime: 0,
          totalVehicles: 0,
          runningVehicles: 0,
          waitingVehicles: 0,
          teleportingVehicles: 0,
          collisions: 0,
          emergencyStops: 0,
          fuelConsumption: 0,
          emissions: {
            CO2: 0,
            CO: 0,
            HC: 0,
            NOx: 0,
            PMx: 0,
          },
        });
      }
      
      addLog(`Simulation ${action} command executed successfully (${lightControlMode.toUpperCase()} control)`, "success");
    } catch (error) {
      console.error(`Error ${action}ing simulation:`, error);
      
      let errorMessage = error.message;
      if (error.response) {
        // Server responded with error status
        errorMessage = error.response.data?.message || `Server error (${error.response.status}): ${error.response.statusText}`;
      } else if (error.request) {
        // Request was made but no response received
        errorMessage = "No response from server. Please check if the backend is running.";
      }
      
      addLog(`Failed to ${action} simulation: ${errorMessage}`, "error");
    } finally {
      setIsLoading(false);
    }
  };


  const handleConfigChange = (key, value) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
  };
  
  const loadScenarioConfig = async (scenarioId) => {
    try {
      // First try to load saved configuration from backend
      const response = await axios.get(`${API_BASE_URL}/api/sumo/scenario-config/${scenarioId}`, {
        headers: getAuthHeaders(),
        withCredentials: true
      });
      
      let scenarioConfig;
      if (response.data.status === 'success' && response.data.data) {
        // Use saved configuration from backend
        scenarioConfig = response.data.data;
        addLog(`Loaded saved configuration for ${scenarioId} scenario`, "info");
      } else {
        // Fall back to default configuration
        scenarioConfig = scenarioConfigs[scenarioId] || scenarioConfigs.default;
        addLog(`Loaded default configuration for ${scenarioId} scenario`, "info");
      }
      
      const newConfig = { ...config, ...scenarioConfig };
      setConfig(newConfig);
      setOriginalConfig(newConfig);
      setHasUnsavedChanges(false);
      
    } catch (error) {
      // Fall back to default configuration on error
      console.error('Error loading scenario config:', error);
      const scenarioConfig = scenarioConfigs[scenarioId] || scenarioConfigs.default;
      const newConfig = { ...config, ...scenarioConfig };
      setConfig(newConfig);
      setOriginalConfig(newConfig);
      setHasUnsavedChanges(false);
      addLog(`Loaded default configuration for ${scenarioId} scenario (backend error)`, "warning");
    }
  };
  
  const handleSaveConfiguration = () => {
    if (!hasUnsavedChanges) {
      addLog("No changes to save", "info");
      return;
    }
    setShowConfirmDialog(true);
  };
  
  const confirmSaveConfiguration = async () => {
    try {
      const currentScenario = simulationStatus.scenario || "default";
      
      // Send configuration to backend
      const response = await axios.put(`${API_BASE_URL}/api/sumo/scenario-config`, {
        scenario: currentScenario,
        config: config
      }, { 
        headers: getAuthHeaders(),
        withCredentials: true 
      });
      
      if (response.data.status === 'success') {
        setOriginalConfig({ ...config });
        setHasUnsavedChanges(false);
        setShowConfirmDialog(false);
        addLog(`Configuration saved successfully for ${currentScenario} scenario`, "success");
      } else {
        throw new Error(response.data.message || 'Save failed');
      }
    } catch (error) {
      addLog(`Failed to save configuration: ${error.response?.data?.message || error.message}`, "error");
      setShowConfirmDialog(false);
    }
  };
  
  const handleResetToDefaults = () => {
    const currentScenario = simulationStatus.scenario || "default";
    loadScenarioConfig(currentScenario);
    addLog(`Configuration reset to ${currentScenario} defaults`, "info");
  };

  const handleScenarioChange = async (scenarioId) => {
    const scenario = scenarios.find((s) => s.id === scenarioId);
    if (scenario) {
      console.log(`Scenario changed from ${simulationStatus.scenario} to ${scenarioId}`);
      setSimulationStatus((prev) => ({ ...prev, scenario: scenarioId }));
      await loadScenarioConfig(scenarioId); // Load scenario-specific configuration
      addLog(`Scenario changed to: ${scenario.name}`, "info");
    }
  };

  // Debug connection function
  const testConnection = async () => {
    addLog("🔍 Starting connection diagnostics...", "info");
    connectionTest.logConnectionInfo();
    
    const results = await connectionTest.runAllTests();
    
    // Log results to both console and UI logs
    Object.entries(results).forEach(([test, result]) => {
      const status = result.success ? "success" : "error";
      addLog(`${test.toUpperCase()} Test: ${result.message}`, status);
    });
    
    addLog("🔍 Connection diagnostics completed. Check browser console for details.", "info");
  };

  const addLog = (message, type = "info") => {
    setLogs((prev) => [
      ...prev.slice(-99),
      {
        id: Date.now(),
        message,
        type,
        timestamp: new Date(),
      },
    ]);
  };

  const formatTime = (seconds) => {
    console.log('Formatting time for seconds:', seconds);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const formatted = `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    console.log('Formatted time:', formatted);
    return formatted;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "running":
        return "#4CAF50"; // Green
      case "starting":
        return "#2196F3"; // Blue
      case "paused":
        return "#FF9800"; // Orange
      case "stopping":
        return "#FF9800"; // Orange
      case "stopped":
        return "#F44336"; // Red
      case "completed":
        return "#4CAF50"; // Green
      case "error":
        return "#E91E63"; // Pink/Red
      default:
        return "#9E9E9E"; // Grey
    }
  };

  const getLogIcon = (type) => {
    switch (type) {
      case "success":
        return "✅";
      case "error":
        return "❌";
      case "warning":
        return "⚠️";
      case "info":
        return "ℹ️";
      default:
        return "📝";
    }
  };

  return (
    <PageLayout
      title="SUMO Simulation Control"
      subtitle="Advanced traffic simulation management and monitoring"
    >
      <div className="sumo-integration">
        {/* Tab Navigation */}
        <div className="tab-navigation">
          <button
            className={`tab-button ${activeTab === "control" ? "active" : ""}`}
            onClick={() => setActiveTab("control")}
          >
            🎮 Control Panel
          </button>
          <button
            className={`tab-button ${activeTab === "monitor" ? "active" : ""}`}
            onClick={() => setActiveTab("monitor")}
          >
            📊 Real-time Monitor
          </button>
          <button
            className={`tab-button ${activeTab === "config" ? "active" : ""}`}
            onClick={() => setActiveTab("config")}
          >
            ⚙️ Configuration
          </button>
          <button
            className={`tab-button ${activeTab === "logs" ? "active" : ""}`}
            onClick={() => setActiveTab("logs")}
          >
            📋 Logs
          </button>
        </div>

        {/* Control Panel Tab */}
        {activeTab === "control" && (
          <div className="tab-content">
            <div className="control-panel">
              {/* Simulation Status */}
              <div className="status-card">
                <h3>Simulation Status</h3>
                <div className="status-grid">
                  <div className="status-item">
                    <span className="status-label">Status:</span>
                    <span
                      className="status-value"
                      style={{
                        color: getStatusColor((() => {
                          const status = simulationStatus.status || (simulationStatus.isRunning ? "running" : "stopped");
                          // Map statuses for consistent colors
                          if (status === 'starting' || status === 'running') return 'running';
                          if (status === 'completed' || status === 'stopped') return 'stopped';
                          return status;
                        })()),
                      }}
                    >
                      {(() => {
                        const status = simulationStatus.status || (simulationStatus.isRunning ? "running" : "stopped");
                        // Simplify status display
                        if (status === 'starting' || status === 'running') return 'Running';
                        if (status === 'completed' || status === 'stopped') return 'Stopped';
                        return status.charAt(0).toUpperCase() + status.slice(1);
                      })()}
                    </span>
                  </div>
                  <div className="status-item">
                    <span className="status-label">Mode:</span>
                    <span className="status-value">
                      {typeof simulationStatus.mode === 'object' ? 'fixed' : (simulationStatus.mode || 'fixed')}
                    </span>
                  </div>
                  <div className="status-item">
                    <span className="status-label">Scenario:</span>
                    <span className="status-value">
                      {typeof simulationStatus.scenario === 'object' ? 'default' : (simulationStatus.scenario || 'default')}
                    </span>
                  </div>
                  <div className="status-item">
                    <span className="status-label">Current Time:</span>
                    <span className="status-value">
                      {formatTime(simulationStatus.currentTime)}
                    </span>
                  </div>
                  <div className="status-item">
                    <span className="status-label">Step:</span>
                    <span className="status-value">
                      {simulationStatus.currentStep} / {simulationStatus.totalSteps}
                    </span>
                  </div>
                  <div className="status-item">
                    <span className="status-label">Speed:</span>
                    <span className="status-value">
                      {simulationStatus.speed}x
                    </span>
                  </div>
                </div>
              </div>

              {/* Light Control Mode */}
              <div className="config-section" style={{ marginBottom: 16 }}>
                <h4>Light Control</h4>
                <div className="config-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <label className="config-item" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="radio"
                      name="lightControlMode"
                      value="fixed"
                      checked={lightControlMode === "fixed"}
                      onChange={() => setLightControlMode("fixed")}
                    />
                    <span>Fixed time (from AddisAbaba.net.xml)</span>
                  </label>
                  <label className="config-item" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="radio"
                      name="lightControlMode"
                      value="rl"
                      checked={lightControlMode === "rl"}
                      onChange={() => setLightControlMode("rl")}
                    />
                    <span>RL (BestModel)</span>
                  </label>
                </div>
              </div>

              {/* Control Buttons */}
              <div className="control-buttons">
                <button
                  className={`control-btn start ${
                    simulationStatus.isRunning ? "disabled" : ""
                  }`}
                  onClick={() => handleSimulationControl("start")}
                  disabled={simulationStatus.isRunning || isLoading}
                  title={simulationStatus.isRunning ? "Simulation is already running" : "Start simulation"}
                >
                  {isLoading && !simulationStatus.isRunning ? "⏳ Starting..." : "▶️ Start"}
                </button>
                <button
                  className={`control-btn stop ${
                    !simulationStatus.isRunning ? "disabled" : ""
                  }`}
                  onClick={() => handleSimulationControl("stop")}
                  disabled={!simulationStatus.isRunning || isLoading}
                  title={!simulationStatus.isRunning ? "No simulation is running" : "Stop simulation"}
                >
                  {isLoading && simulationStatus.isRunning ? "⏳ Stopping..." : "⏹️ Stop"}
                </button>
              </div>

              {/* Scenario Selection */}
              <div className="scenario-selection">
                <h3>Scenario Selection</h3>
                <div className="scenario-grid">
                  {scenarios.map((scenario) => (
                    <button
                      key={scenario.id}
                      className={`scenario-card ${
                        simulationStatus.scenario === scenario.id
                          ? "selected"
                          : ""
                      }`}
                      onClick={() => handleScenarioChange(scenario.id)}
                    >
                      <h4>{scenario.name}</h4>
                      <p>{scenario.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Real-time Monitor Tab */}
        {activeTab === "monitor" && (
          <div className="tab-content">
            <div className="monitor-panel">
              <div className="metrics-grid">
                <div className="metric-card">
                  <h3>Vehicle Statistics</h3>
                  <div className="metric-item">
                    <span>Total Vehicles:</span>
                    <span className="metric-value">
                      {realTimeData.totalVehicles}
                    </span>
                  </div>
                  <div className="metric-item">
                    <span>Running:</span>
                    <span className="metric-value">
                      {realTimeData.runningVehicles}
                    </span>
                  </div>
                  <div className="metric-item">
                    <span>Waiting:</span>
                    <span className="metric-value">
                      {realTimeData.waitingVehicles}
                    </span>
                  </div>
                  <div className="metric-item">
                    <span>Teleporting:</span>
                    <span className="metric-value">
                      {realTimeData.teleportingVehicles}
                    </span>
                  </div>
                </div>

                <div className="metric-card">
                  <h3>Performance Metrics</h3>
                  <div className="metric-item">
                    <span>Average Speed:</span>
                    <span className="metric-value">
                      {realTimeData.averageSpeed.toFixed(2)} km/h
                    </span>
                  </div>
                  <div className="metric-item">
                    <span>Collisions:</span>
                    <span className="metric-value error">
                      {realTimeData.collisions}
                    </span>
                  </div>
                  <div className="metric-item">
                    <span>Emergency Stops:</span>
                    <span className="metric-value warning">
                      {realTimeData.emergencyStops}
                    </span>
                  </div>
                  <div className="metric-item">
                    <span>Fuel Consumption:</span>
                    <span className="metric-value">
                      {realTimeData.fuelConsumption.toFixed(2)} L
                    </span>
                  </div>
                </div>

                <div className="metric-card">
                  <h3>Emissions</h3>
                  <div className="metric-item">
                    <span>CO₂:</span>
                    <span className="metric-value">
                      {realTimeData.emissions.CO2.toFixed(2)} g
                    </span>
                  </div>
                  <div className="metric-item">
                    <span>CO:</span>
                    <span className="metric-value">
                      {realTimeData.emissions.CO.toFixed(2)} g
                    </span>
                  </div>
                  <div className="metric-item">
                    <span>NOx:</span>
                    <span className="metric-value">
                      {realTimeData.emissions.NOx.toFixed(2)} g
                    </span>
                  </div>
                  <div className="metric-item">
                    <span>PMx:</span>
                    <span className="metric-value">
                      {realTimeData.emissions.PMx.toFixed(2)} g
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Configuration Tab */}
        {activeTab === "config" && (
          <div className="tab-content">
            <div className="config-panel">
              <div className="config-header">
                <h3>Simulation Configuration</h3>
                <div className="config-status">
                  <span className="scenario-info">
                    Current Scenario: <strong>{typeof simulationStatus.scenario === 'object' ? 'default' : simulationStatus.scenario || "default"}</strong>
                    {hasUnsavedChanges && <span className="unsaved-indicator">● Unsaved Changes</span>}
                  </span>
                </div>
              </div>
              <div className="config-sections">
                <div className="config-section">
                  <h4>Basic Parameters</h4>
                  <div className="config-grid">
                    <div className="config-item">
                      <label>Step Length (s):</label>
                      <input
                        type="number"
                        value={config.stepLength}
                        onChange={(e) =>
                          handleConfigChange(
                            "stepLength",
                            parseFloat(e.target.value)
                          )
                        }
                        step="0.1"
                        min="0.1"
                        max="10"
                      />
                    </div>
                    <div className="config-item">
                      <label>Max Speed (m/s):</label>
                      <input
                        type="number"
                        value={config.maxSpeed}
                        onChange={(e) =>
                          handleConfigChange(
                            "maxSpeed",
                            parseFloat(e.target.value)
                          )
                        }
                        step="0.1"
                        min="1"
                        max="50"
                      />
                    </div>
                    <div className="config-item">
                      <label>Min Gap (m):</label>
                      <input
                        type="number"
                        value={config.minGap}
                        onChange={(e) =>
                          handleConfigChange(
                            "minGap",
                            parseFloat(e.target.value)
                          )
                        }
                        step="0.1"
                        min="0"
                        max="10"
                      />
                    </div>
                    <div className="config-item">
                      <label>Acceleration (m/s²):</label>
                      <input
                        type="number"
                        value={config.accel}
                        onChange={(e) =>
                          handleConfigChange(
                            "accel",
                            parseFloat(e.target.value)
                          )
                        }
                        step="0.1"
                        min="0"
                        max="10"
                      />
                    </div>
                    <div className="config-item">
                      <label>Deceleration (m/s²):</label>
                      <input
                        type="number"
                        value={config.decel}
                        onChange={(e) =>
                          handleConfigChange(
                            "decel",
                            parseFloat(e.target.value)
                          )
                        }
                        step="0.1"
                        min="0"
                        max="10"
                      />
                    </div>
                    <div className="config-item">
                      <label>Sigma (randomness):</label>
                      <input
                        type="number"
                        value={config.sigma}
                        onChange={(e) =>
                          handleConfigChange(
                            "sigma",
                            parseFloat(e.target.value)
                          )
                        }
                        step="0.1"
                        min="0"
                        max="1"
                      />
                    </div>
                  </div>
                </div>

                <div className="config-section">
                  <h4>Lane Change Parameters</h4>
                  <div className="config-grid">
                    <div className="config-item">
                      <label>Strategic Factor:</label>
                      <input
                        type="number"
                        value={config.lcStrategic}
                        onChange={(e) =>
                          handleConfigChange(
                            "lcStrategic",
                            parseFloat(e.target.value)
                          )
                        }
                        step="0.1"
                        min="0"
                        max="10"
                      />
                    </div>
                    <div className="config-item">
                      <label>Cooperative Factor:</label>
                      <input
                        type="number"
                        value={config.lcCooperative}
                        onChange={(e) =>
                          handleConfigChange(
                            "lcCooperative",
                            parseFloat(e.target.value)
                          )
                        }
                        step="0.1"
                        min="0"
                        max="10"
                      />
                    </div>
                    <div className="config-item">
                      <label>Speed Gain Factor:</label>
                      <input
                        type="number"
                        value={config.lcSpeedGain}
                        onChange={(e) =>
                          handleConfigChange(
                            "lcSpeedGain",
                            parseFloat(e.target.value)
                          )
                        }
                        step="0.1"
                        min="0"
                        max="10"
                      />
                    </div>
                    <div className="config-item">
                      <label>Keep Right Factor:</label>
                      <input
                        type="number"
                        value={config.lcKeepRight}
                        onChange={(e) =>
                          handleConfigChange(
                            "lcKeepRight",
                            parseFloat(e.target.value)
                          )
                        }
                        step="0.1"
                        min="0"
                        max="10"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="config-actions">
                <button 
                  className={`btn-primary ${hasUnsavedChanges ? '' : 'disabled'}`}
                  onClick={handleSaveConfiguration}
                  disabled={!hasUnsavedChanges}
                >
                  Save Configuration
                </button>
                <button 
                  className="btn-secondary"
                  onClick={handleResetToDefaults}
                >
                  Reset to {typeof simulationStatus.scenario === 'object' ? 'default' : simulationStatus.scenario || "default"} Defaults
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === "logs" && (
          <div className="tab-content">
            <div className="logs-panel">
              <div className="logs-header">
                <h3>Simulation Logs</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn-secondary" onClick={testConnection}>
                    🔍 Test Connection
                  </button>
                  <button className="btn-secondary" onClick={() => setLogs([])}>
                    Clear Logs
                  </button>
                </div>
              </div>
              <div className="logs-container">
                {logs.length === 0 ? (
                  <div className="no-logs">No logs available</div>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className={`log-entry ${log.type}`}>
                      <span className="log-icon">{getLogIcon(log.type)}</span>
                      <span className="log-time">
                        {log.timestamp.toLocaleTimeString()}
                      </span>
                      <span className="log-message">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Configuration Save Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h4>Confirm Configuration Save</h4>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to save the current configuration changes for the <strong>{typeof simulationStatus.scenario === 'object' ? 'default' : simulationStatus.scenario || "default"}</strong> scenario?</p>
              <div className="config-changes-summary">
                <p><small>This will update the scenario's default parameters for future simulations.</small></p>
              </div>
            </div>
            <div className="modal-actions">
              <button 
                className="btn-primary"
                onClick={confirmSaveConfiguration}
              >
                Save Changes
              </button>
              <button 
                className="btn-secondary"
                onClick={() => setShowConfirmDialog(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
};

export default EnhancedSUMOIntegration;
