import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import io from "socket.io-client";
import PageLayout from "./PageLayout";
import "./EnhancedSUMOIntegration.css";

const EnhancedSUMOIntegration = () => {
  // Simulation State
  const [simulationStatus, setSimulationStatus] = useState({
    isRunning: false,
    isPaused: false,
    startTime: null,
    endTime: null,
    currentStep: 0,
    totalSteps: 0,
    currentTime: 0,
    speed: 1.0,
    mode: "fixed", // fixed, rl (UI label only)
    scenario: "default",
  });

  // Light control toggle: 'fixed' (SUMO default programs from net.xml) or 'rl' (PPO BestModel)
  const [lightControlMode, setLightControlMode] = useState("fixed");

  // Configuration State
  const [config, setConfig] = useState({
    stepLength: 1.0,
    startWithGui: false,
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
    {
      id: "accident",
      name: "Accident Scenario",
      description: "Traffic simulation with accident monitoring and enhanced collision detection",
    },
  ]);

  const socketRef = useRef(null);

  // SUMO config setter (no local state needed)
  const setSumoConfig = async (name) => {
    try {
      await axios.put("/api/sumo/config", { name }, { withCredentials: true });
      addLog(`SUMO config set to ${name}`, "success");
    } catch (e) {
      addLog(`Failed to set SUMO config: ${e.message}`, "error");
    }
  };

  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io("http://localhost:5001");

    // Listen for simulation status updates
    socketRef.current.on("simulationStatus", (status) => {
      setSimulationStatus((prev) => ({ ...prev, ...status }));
    });

    // Listen for real-time traffic data
    socketRef.current.on("trafficData", (data) => {
      setRealTimeData((prev) => ({ ...prev, ...data }));
    });

    // Listen for simulation logs
    socketRef.current.on("simulationLog", (log) => {
      setLogs((prev) => [
        ...prev.slice(-99),
        { ...log, timestamp: new Date() },
      ]);
    });

    // Fetch initial status
    fetchSimulationStatus();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const fetchSimulationStatus = async () => {
    try {
      const response = await axios.get("/api/sumo/status");
      setSimulationStatus((prev) => ({ ...prev, ...response.data }));
    } catch (error) {
      console.error("Error fetching simulation status:", error);
    }
  };

  const handleSimulationControl = async (action) => {
    setIsLoading(true);
    try {
      // Align with backend API: expects { command: "start_simulation" | ... }
      const commandMap = {
        start: "start_simulation",
        pause: "pause_simulation",
        resume: "resume_simulation",
        stop: "stop_simulation",
        reset: "stop_simulation",
        step: "step",
      };
      const command = commandMap[action];
      if (!command) throw new Error("Invalid action");

      // If starting, map selected scenario to sumocfg and set it before starting
      if (action === "start") {
        const scenarioMap = {
          default: "AddisAbabaSimple.sumocfg",
          rush_hour: "AddisAbabaSimple_peak.sumocfg",
          night: "AddisAbabaSimple_offpeak.sumocfg",
          accident: "AddisAbabaSimple_accident.sumocfg",
        };
        const sc = simulationStatus.scenario || "default";
        const cfgName = scenarioMap[sc] || scenarioMap.default;
        await setSumoConfig(cfgName);
      }

      const payload = { command, parameters: {} };
      if (action === "start") {
        // Base SUMO parameters; do not include RL switches unless RL is selected
        payload.parameters = {
          stepLength: config.stepLength,
          startWithGui: true,
        };

        if (lightControlMode === "rl") {
          // Use BestModel for RL; relative to project root so backend can resolve
          // You can adjust this path if you prefer a different model
          payload.parameters.useRL = true;
          payload.parameters.rlModelPath = "Sumoconfigs/experiments/targeted_addis_ppo_20251003_031746/models/best_model/best_model.zip";
          payload.parameters.rlDelta = 15; // decision interval (s)
        }
      }
      const response = await axios.post("/api/sumo/control", payload, {
        withCredentials: true,
      });
      setSimulationStatus((prev) => ({ ...prev, ...response.data.data, mode: lightControlMode }));
      addLog(`Simulation ${action} command executed successfully (${lightControlMode.toUpperCase()} control)`, "success");
    } catch (error) {
      console.error(`Error ${action}ing simulation:`, error);
      addLog(`Failed to ${action} simulation: ${error.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const openSumoGui = async () => {
    try {
      await axios.post(
        "/api/sumo/open-gui",
        { withConfig: true },
        { withCredentials: true }
      );
      addLog("Opened SUMO GUI", "success");
    } catch (e) {
      addLog(`Failed to open SUMO GUI: ${e.message}`, "error");
    }
  };

  const handleConfigChange = (key, value) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleScenarioChange = (scenarioId) => {
    const scenario = scenarios.find((s) => s.id === scenarioId);
    if (scenario) {
      setSimulationStatus((prev) => ({ ...prev, scenario: scenarioId }));
      addLog(`Scenario changed to: ${scenario.name}`, "info");
    }
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
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "running":
        return "#4CAF50";
      case "paused":
        return "#FF9800";
      case "stopped":
        return "#F44336";
      default:
        return "#9E9E9E";
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
                        color: getStatusColor(
                          simulationStatus.isRunning ? "running" : "stopped"
                        ),
                      }}
                    >
                      {simulationStatus.isRunning ? "Running" : "Stopped"}
                    </span>
                  </div>
                  <div className="status-item">
                    <span className="status-label">Mode:</span>
                    <span className="status-value">
                      {simulationStatus.mode}
                    </span>
                  </div>
                  <div className="status-item">
                    <span className="status-label">Scenario:</span>
                    <span className="status-value">
                      {simulationStatus.scenario}
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
                      {simulationStatus.currentStep} /{" "}
                      {simulationStatus.totalSteps}
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
                >
                  ▶️ Start
                </button>
                <button
                  className={`control-btn pause ${
                    !simulationStatus.isRunning || simulationStatus.isPaused
                      ? "disabled"
                      : ""
                  }`}
                  onClick={() => handleSimulationControl("pause")}
                  disabled={
                    !simulationStatus.isRunning ||
                    simulationStatus.isPaused ||
                    isLoading
                  }
                >
                  ⏸️ Pause
                </button>
                <button
                  className={`control-btn resume ${
                    !simulationStatus.isPaused ? "disabled" : ""
                  }`}
                  onClick={() => handleSimulationControl("resume")}
                  disabled={!simulationStatus.isPaused || isLoading}
                >
                  ▶️ Resume
                </button>
                <button
                  className="control-btn step"
                  onClick={() => handleSimulationControl("step")}
                  disabled={isLoading}
                >
                  ⏭️ Step
                </button>
                <button
                  className="control-btn stop"
                  onClick={() => handleSimulationControl("stop")}
                  disabled={!simulationStatus.isRunning || isLoading}
                >
                  ⏹️ Stop
                </button>
                <button
                  className="control-btn reset"
                  onClick={() => handleSimulationControl("reset")}
                  disabled={isLoading}
                >
                  🔄 Reset
                </button>
                <button className="control-btn" onClick={openSumoGui}>
                  🖥️ Open SUMO
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
              <h3>Simulation Configuration</h3>
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
                <button className="btn-primary">Save Configuration</button>
                <button className="btn-secondary">Reset to Defaults</button>
                <button className="btn-secondary">Load Preset</button>
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
                <button className="btn-secondary" onClick={() => setLogs([])}>
                  Clear Logs
                </button>
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
    </PageLayout>
  );
};

export default EnhancedSUMOIntegration;
