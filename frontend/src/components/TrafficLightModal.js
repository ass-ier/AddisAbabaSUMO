import React, { useState, useEffect } from "react";
import { TrafficLightPhasePreview } from "./TrafficLightPhaseViz";
import {
  loadTlsConfigurations,
  getAvailablePhases,
  isValidPhaseIndex,
} from "../utils/tlsConfigParser";
import { api } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import "./TrafficLightModal.css";

/**
 * Traffic Light Status Modal
 * Shows detailed information about a traffic light and allows manual phase control
 */
const TrafficLightModal = ({
  tlsId,
  isOpen,
  onClose,
  currentPhase = null,
  nextPhase = null,
  timing = {},
  program = {},
  currentState = undefined,
  turns = undefined,
}) => {
  const { user } = useAuth();
  const [tlsConfigs, setTlsConfigs] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState(null);
  const [availablePhases, setAvailablePhases] = useState([]);
  const [error, setError] = useState(null);
  const [overrideActive, setOverrideActive] = useState(false);
  // Local countdown that updates every second, independent of role
  const [remainingCountdown, setRemainingCountdown] = useState(null);

  const canOverride = user && ["super_admin", "operator"].includes(user.role);

  // Format time in MM:SS format
  const formatTime = (seconds) => {
    if (typeof seconds !== "number" || seconds === null) return "--:--";
    const total = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Load TLS configurations when modal opens
  useEffect(() => {
    if (isOpen && tlsId) {
      // Reset override flag on open
      setOverrideActive(false);
      (async () => {
        try {
          const loader = loadTlsConfigurations;
          if (typeof loader !== 'function') {
            throw new Error('TLS config loader unavailable');
          }
          const configs = await loader();
          console.log("TLS configs loaded:", configs);
          setTlsConfigs(configs);
          const phases = getAvailablePhases(tlsId, configs);
          console.log("Available phases for", tlsId, ":", phases);
          setAvailablePhases(phases);

          // Clear any previous error if we successfully loaded configs
          if (Object.keys(configs).length > 0) {
            setError(null);
          }
        } catch (err) {
          console.error("Failed to load TLS configurations:", err);
          // Don't treat this as a fatal error - create fallback phases
          setError(
            "Configuration file not available - using basic controls only"
          );
          setTlsConfigs({});

          // Create basic fallback phases for testing
          const fallbackPhases = [
            {
              index: 0,
              state: "GGGrrrr",
              duration: 45,
              description: "Phase 1",
            },
            {
              index: 1,
              state: "yyyrrr",
              duration: 3,
              description: "Transition 1",
            },
            { index: 2, state: "rrrGGG", duration: 30, description: "Phase 2" },
            {
              index: 3,
              state: "rrryyy",
              duration: 3,
              description: "Transition 2",
            },
          ];

          console.log("Using fallback phases:", fallbackPhases);
          setAvailablePhases(fallbackPhases);
        }
      })();
    }
  }, [isOpen, tlsId]);

  // Derive current and next phase indices early for use in effects
  const inferredCurrentIndex =
    (typeof timing?.currentIndex === 'number')
      ? timing.currentIndex
      : ((typeof currentState === 'string' && Array.isArray(availablePhases))
          ? (availablePhases.find((p) => p.state === currentState)?.index)
          : undefined);

  const computedNextIndex =
    (typeof timing?.nextIndex === 'number')
      ? timing.nextIndex
      : ((typeof inferredCurrentIndex === 'number' && availablePhases.length > 0)
          ? (inferredCurrentIndex + 1) % availablePhases.length
          : undefined);

  // Keep selected/highlighted phase in sync with live updates
  useEffect(() => {
    if (typeof timing?.currentIndex === "number") {
      setSelectedPhase(timing.currentIndex);
    } else if (typeof inferredCurrentIndex === 'number') {
      setSelectedPhase(inferredCurrentIndex);
    }
  }, [timing?.currentIndex, inferredCurrentIndex]);

  // Reset remaining countdown when timing.remaining changes or modal opens (only when provided)
  useEffect(() => {
    if (isOpen && typeof timing?.remaining === 'number') {
      const start = Math.max(0, Math.floor(timing.remaining));
      setRemainingCountdown(start);
    } else if (isOpen) {
      setRemainingCountdown(null);
    }
  }, [isOpen, timing?.remaining]);

  // Tick countdown every second while open and we have remaining time
  useEffect(() => {
    if (!isOpen || typeof remainingCountdown !== 'number') return;
    const id = setInterval(() => {
      setRemainingCountdown((r) => (typeof r === 'number' && r > 0 ? r - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [isOpen, remainingCountdown]);

  // Handle phase change
  const handlePhaseChange = async (phaseIndex) => {
    if (!canOverride) {
      console.warn("Phase change blocked: no override permission");
      return;
    }

    // Allow basic validation even without loaded configs
    const hasConfigs = Object.keys(tlsConfigs).length > 0;
    if (hasConfigs && !isValidPhaseIndex(tlsId, phaseIndex, tlsConfigs)) {
      console.warn("Phase change blocked: invalid phase index", {
        tlsId,
        phaseIndex,
        availablePhases,
      });
      return;
    }

    console.log("Setting TLS phase:", { tlsId, phaseIndex });
    setLoading(true);
    setError(null);

    try {
      // Safety: enforce all-yellow for ~3 seconds before switching to the chosen phase
      const inferLen = () => {
        const idx = (typeof inferredCurrentIndex === 'number') ? inferredCurrentIndex : undefined;
        if (Array.isArray(program?.phases) && typeof idx === 'number') {
          const st = program.phases[idx]?.state || '';
          if (st.length > 0) return st.length;
        }
        if (Array.isArray(program?.phases) && program.phases.length > 0) {
          const st = program.phases[0]?.state || '';
          if (st.length > 0) return st.length;
        }
        if (Array.isArray(availablePhases) && availablePhases.length > 0) {
          const st = availablePhases[0]?.state || '';
          if (st.length > 0) return st.length;
        }
        return 1;
      };
      const len = Math.max(1, inferLen());
      const allYellow = 'y'.repeat(len);
      console.log('Override: applying all-yellow before phase set', { tlsId, phaseIndex, allYellowLen: len });
      await api.tlsSetState(tlsId, allYellow);
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const response = await api.tlsSetPhase(tlsId, phaseIndex);
      console.log("TLS phase set successfully:", response);
      setSelectedPhase(phaseIndex);

      // Additionally force the exact R/Y/G state for the selected phase (if we know it)
      // This gives an immediate visible change when overriding
      const programPhases = program?.phases || [];
      const desiredState = programPhases.find((p) => p.index === phaseIndex)?.state
        || availablePhases.find((p) => p.index === phaseIndex)?.state;
      if (desiredState && typeof desiredState === 'string' && desiredState.length > 0) {
        try {
          await api.tlsSetState(tlsId, desiredState);
          console.log("TLS state forced successfully to:", desiredState);
          setOverrideActive(true);
        } catch (forceErr) {
          console.warn("TLS set-state fallback failed:", forceErr?.message || forceErr);
        }
      }


      // Show success notification
      window.dispatchEvent(
        new CustomEvent("notify", {
          detail: {
            type: "success",
            message: `Traffic light ${tlsId} phase changed to ${phaseIndex + 1}`,
          },
        })
      );
    } catch (err) {
      console.error("TLS phase change failed:", err);
      setError(err.message || "Failed to change phase");
      window.dispatchEvent(
        new CustomEvent("notify", {
          detail: {
            type: "error",
            message: err.message || "Failed to change phase",
          },
        })
      );
    } finally {
      setLoading(false);
    }
  };

  // Handle next/previous phase
  const handleNextPhase = async () => {
    if (!canOverride) {
      console.warn("Next phase blocked: no override permission");
      return;
    }

    console.log("Moving to next phase for TLS:", tlsId);
    setLoading(true);
    setError(null);

    try {
      const response = await api.tlsNextPhase(tlsId);
      console.log("Next phase success:", response);
      window.dispatchEvent(
        new CustomEvent("notify", {
          detail: {
            type: "success",
            message: `Traffic light ${tlsId} moved to next phase`,
          },
        })
      );
    } catch (err) {
      console.error("Next phase failed:", err);
      setError(err.message || "Failed to move to next phase");
    } finally {
      setLoading(false);
    }
  };

  const handlePrevPhase = async () => {
    if (!canOverride) {
      console.warn("Prev phase blocked: no override permission");
      return;
    }

    console.log("Moving to previous phase for TLS:", tlsId);
    setLoading(true);
    setError(null);

    try {
      const response = await api.tlsPrevPhase(tlsId);
      console.log("Previous phase success:", response);
      window.dispatchEvent(
        new CustomEvent("notify", {
          detail: {
            type: "success",
            message: `Traffic light ${tlsId} moved to previous phase`,
          },
        })
      );
    } catch (err) {
      console.error("Previous phase failed:", err);
      setError(err.message || "Failed to move to previous phase");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentPhaseData = availablePhases.find(
    (p) => p.index === inferredCurrentIndex
  );
  const nextPhaseData = availablePhases.find((p) => p.index === computedNextIndex);

  return (
    <div className="modal-overlay" onClick={() => { if (!overrideActive) onClose(); }}>
      <div className="traffic-light-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2>Traffic Light Status</h2>
          <button
            className="close-btn"
            onClick={() => { if (!overrideActive) onClose(); }}
            disabled={overrideActive}
            title={overrideActive ? 'Resume normal flow to close' : ''}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="modal-content">
          {/* Traffic Light Info */}
          <div className="tls-info">
            <h3>TLS ID: {tlsId}</h3>
            {error && <div className="error-message">{error}</div>}
          </div>

          {/* Current Status */}
          <div className="status-section">
            <h4>Current Status</h4>
            <div className="status-grid">
              <div className="status-item">
                <label>Current Phase:</label>
                <span className="phase-info">
                  {typeof inferredCurrentIndex === "number"
                    ? `Phase ${inferredCurrentIndex + 1}`
                    : "Unknown"}
                  {currentPhaseData && (
                    <span className="phase-duration">
                      ({currentPhaseData.duration}s)
                    </span>
                  )}
                </span>
              </div>

              <div className="status-item">
                <label>Time Remaining:</label>
                <span className="time-remaining">
                  {formatTime(remainingCountdown)}
                </span>
              </div>

              <div className="status-item">
                <label>Next Phase:</label>
                <span className="phase-info">
                  {typeof computedNextIndex === "number"
                    ? `Phase ${computedNextIndex + 1}`
                    : "Unknown"}
                </span>
              </div>

              <div className="status-item">
                <label>Total Phases:</label>
                <span>{availablePhases.length}</span>
              </div>
            </div>
          </div>


          {/* Phases list (visible to all roles) */}
          {availablePhases.length > 0 && (
            <div className="phase-selection">
              <h4>{canOverride ? 'Manual Override' : 'Available Phases'}</h4>

              {/* Quick Controls (operators/admin only) */}
              {canOverride && (
                <div className="quick-controls">
                  <button
                    className="control-btn prev-btn"
                    onClick={handlePrevPhase}
                    disabled={loading}
                  >
                    ⬅ Previous Phase
                  </button>
                  <button
                    className="control-btn next-btn"
                    onClick={handleNextPhase}
                    disabled={loading}
                  >
                    Next Phase ➡
                  </button>
                </div>
              )}

              {/* Phase Selection Grid */}
              <div className="phase-selection">
                <h5>{canOverride ? 'Select Phase:' : 'Phases:'}</h5>
                <div className="phase-grid">
                  {availablePhases.map((phase) => (
                    <div
                      key={phase.index}
                      className={`phase-card ${
                        inferredCurrentIndex === phase.index ? "active" : ""
                      } ${selectedPhase === phase.index ? "selected" : ""} ${!canOverride ? "disabled" : ""}`}
                      onClick={canOverride ? (() => handlePhaseChange(phase.index)) : undefined}
                      title={canOverride ? '' : 'View only'}
                    >
                      <div className="phase-header">
                        <span className="phase-number">
                          Phase {phase.index + 1}
                        </span>
                        <span className="phase-duration">
                          {phase.duration}s
                        </span>
                      </div>

                      <div className="phase-preview">
                        <TrafficLightPhasePreview
                          phaseState={phase.state}
                          width={80}
                          height={16}
                        />
                      </div>

                      <div className="phase-state">{phase.state}</div>

                      {phase.description && (
                        <div className="phase-description">
                          {phase.description}
                        </div>
                      )}

                      {inferredCurrentIndex === phase.index && (
                        <div className="current-indicator">Current</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Warning Message (operators/admin only) */}
              {canOverride && (
                <div className="warning-message">
                  <strong>⚠ Warning:</strong> Manual override will interrupt the
                  normal traffic light cycle. Use with caution and only when
                  necessary.
                </div>
              )}
            </div>
          )}

          {/* Program Information */}
          {program && Object.keys(program).length > 0 && (
            <div className="program-section">
              <h4>Program Information</h4>
              <div className="program-info">
                {program.type && (
                  <div className="info-item">
                    <label>Type:</label>
                    <span>{program.type}</span>
                  </div>
                )}
                {typeof program.offset === "number" && (
                  <div className="info-item">
                    <label>Offset:</label>
                    <span>{program.offset}s</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Loading Overlay */}
          {loading && (
            <div className="loading-overlay">
              <div className="loading-spinner">⟳</div>
              <span>Updating...</span>
            </div>
          )}

          {/* Override blocker popup - appears only while manual override is active */}
          {overrideActive && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2000,
              }}
            >
              <div
                style={{
                  background: 'white',
                  borderRadius: 8,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                  width: 420,
                  maxWidth: '90%',
                  padding: 16,
                  border: '1px solid #e5e7eb',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>⚠️</span>
                  <h4 style={{ margin: 0 }}>Manual override active</h4>
                </div>
                <div style={{ color: '#374151', fontSize: 14, lineHeight: 1.5 }}>
                  The normal signal program for this traffic light is currently overridden.
                  You must resume the normal phase flow to continue.
                </div>
                <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    className="control-btn"
                    onClick={async () => {
                      try {
                        if (!canOverride) return;
                        setLoading(true);
                        // Determine length of state string to build all-yellow
                        const inferLen = () => {
                          const idx = (typeof inferredCurrentIndex === 'number') ? inferredCurrentIndex : undefined;
                          if (Array.isArray(program?.phases) && typeof idx === 'number') {
                            const st = program.phases[idx]?.state || '';
                            if (st.length > 0) return st.length;
                          }
                          if (Array.isArray(program?.phases) && program.phases.length > 0) {
                            const st = program.phases[0]?.state || '';
                            if (st.length > 0) return st.length;
                          }
                          if (Array.isArray(availablePhases) && availablePhases.length > 0) {
                            const st = availablePhases[0]?.state || '';
                            if (st.length > 0) return st.length;
                          }
                          return 1;
                        };
                        const len = Math.max(1, inferLen());
                        const allYellow = 'y'.repeat(len);
                        console.log('Applying all-yellow then reset:', { tlsId, len, allYellow });
                        // Force all-yellow state first so it’s visible during ongoing simulation steps
                        await api.tlsSetState(tlsId, allYellow);
                        // Wait ~3 seconds wall time
                        await new Promise((resolve) => setTimeout(resolve, 3000));
                        // Now reset to normal schedule
                        await api.tlsReset(tlsId);
                        setOverrideActive(false);
                        window.dispatchEvent(
                          new CustomEvent('notify', {
                            detail: { type: 'success', message: 'Applied all-yellow and reset to normal schedule' },
                          })
                        );
                      } catch (err) {
                        console.error('Reset normal schedule failed:', err);
                        window.dispatchEvent(
                          new CustomEvent('notify', {
                            detail: { type: 'error', message: err?.message || 'Failed to reset schedule' },
                          })
                        );
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                    style={{ padding: '8px 12px', background: '#6B7280', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                  >
                    ⟲ Reset to normal schedule
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrafficLightModal;
