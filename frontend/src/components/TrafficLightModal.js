import React, { useState, useEffect } from 'react';
import TrafficLightPhaseViz, { TrafficLightPhasePreview } from './TrafficLightPhaseViz';
import { loadTlsConfigurations, getAvailablePhases, isValidPhaseIndex } from '../utils/tlsConfigParser';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import './TrafficLightModal.css';

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
  program = {} 
}) => {
  const { user } = useAuth();
  const [tlsConfigs, setTlsConfigs] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState(null);
  const [availablePhases, setAvailablePhases] = useState([]);
  const [error, setError] = useState(null);
  
  const canOverride = user && ['super_admin', 'operator'].includes(user.role);
  
  // Format time in MM:SS format
  const formatTime = (seconds) => {
    if (typeof seconds !== 'number' || seconds < 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Load TLS configurations when modal opens
  useEffect(() => {
    if (isOpen && tlsId) {
      loadTlsConfigurations()
        .then(configs => {
          setTlsConfigs(configs);
          const phases = getAvailablePhases(tlsId, configs);
          setAvailablePhases(phases);
        })
        .catch(err => {
          console.error('Failed to load TLS configurations:', err);
          setError('Failed to load traffic light configurations');
        });
    }
  }, [isOpen, tlsId]);
  
  // Update selected phase when current phase changes
  useEffect(() => {
    if (typeof currentPhase?.currentIndex === 'number') {
      setSelectedPhase(currentPhase.currentIndex);
    }
  }, [currentPhase]);
  
  // Handle phase change
  const handlePhaseChange = async (phaseIndex) => {
    if (!canOverride || !isValidPhaseIndex(tlsId, phaseIndex, tlsConfigs)) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      await api.tlsSetPhase(tlsId, phaseIndex);
      setSelectedPhase(phaseIndex);
      
      // Show success notification
      window.dispatchEvent(new CustomEvent('notify', {
        detail: { 
          type: 'success', 
          message: `Traffic light ${tlsId} phase changed to ${phaseIndex + 1}` 
        }
      }));
    } catch (err) {
      setError(err.message || 'Failed to change phase');
      window.dispatchEvent(new CustomEvent('notify', {
        detail: { 
          type: 'error', 
          message: err.message || 'Failed to change phase' 
        }
      }));
    } finally {
      setLoading(false);
    }
  };
  
  // Handle next/previous phase
  const handleNextPhase = async () => {
    if (!canOverride) return;
    
    setLoading(true);
    setError(null);
    
    try {
      await api.tlsNextPhase(tlsId);
      window.dispatchEvent(new CustomEvent('notify', {
        detail: { 
          type: 'success', 
          message: `Traffic light ${tlsId} moved to next phase` 
        }
      }));
    } catch (err) {
      setError(err.message || 'Failed to move to next phase');
    } finally {
      setLoading(false);
    }
  };
  
  const handlePrevPhase = async () => {
    if (!canOverride) return;
    
    setLoading(true);
    setError(null);
    
    try {
      await api.tlsPrevPhase(tlsId);
      window.dispatchEvent(new CustomEvent('notify', {
        detail: { 
          type: 'success', 
          message: `Traffic light ${tlsId} moved to previous phase` 
        }
      }));
    } catch (err) {
      setError(err.message || 'Failed to move to previous phase');
    } finally {
      setLoading(false);
    }
  };
  
  if (!isOpen) return null;
  
  const currentPhaseIndex = timing?.currentIndex;
  const nextPhaseIndex = timing?.nextIndex;
  const remainingTime = timing?.remaining;
  const currentPhaseData = availablePhases.find(p => p.index === currentPhaseIndex);
  const nextPhaseData = availablePhases.find(p => p.index === nextPhaseIndex);
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="traffic-light-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2>Traffic Light Status</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        {/* Content */}
        <div className="modal-content">
          {/* Traffic Light Info */}
          <div className="tls-info">
            <h3>TLS ID: {tlsId}</h3>
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
          </div>
          
          {/* Current Status */}
          <div className="status-section">
            <h4>Current Status</h4>
            <div className="status-grid">
              <div className="status-item">
                <label>Current Phase:</label>
                <span className="phase-info">
                  {typeof currentPhaseIndex === 'number' 
                    ? `Phase ${currentPhaseIndex + 1}` 
                    : 'Unknown'
                  }
                  {currentPhaseData && (
                    <span className="phase-duration">
                      ({currentPhaseData.duration}s)
                    </span>
                  )}
                </span>
              </div>
              
              <div className="status-item">
                <label>Time Remaining:</label>
                <span className="time-remaining">{formatTime(remainingTime)}</span>
              </div>
              
              <div className="status-item">
                <label>Next Phase:</label>
                <span className="phase-info">
                  {typeof nextPhaseIndex === 'number' 
                    ? `Phase ${nextPhaseIndex + 1}` 
                    : 'Unknown'
                  }
                </span>
              </div>
              
              <div className="status-item">
                <label>Total Phases:</label>
                <span>{availablePhases.length}</span>
              </div>
            </div>
          </div>
          
          {/* Phase Visualization */}
          {currentPhaseData && (
            <div className="visualization-section">
              <h4>Current Phase Visualization</h4>
              <div className="phase-viz-container">
                <TrafficLightPhaseViz 
                  phaseState={currentPhaseData.state} 
                  size={280}
                  showLabels={true}
                />
              </div>
            </div>
          )}
          
          {/* Manual Control Section */}
          {canOverride && availablePhases.length > 0 && (
            <div className="control-section">
              <h4>Manual Override</h4>
              
              {/* Quick Controls */}
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
              
              {/* Phase Selection Grid */}
              <div className="phase-selection">
                <h5>Select Phase:</h5>
                <div className="phase-grid">
                  {availablePhases.map((phase) => (
                    <div
                      key={phase.index}
                      className={`phase-card ${
                        currentPhaseIndex === phase.index ? 'active' : ''
                      } ${selectedPhase === phase.index ? 'selected' : ''}`}
                      onClick={() => handlePhaseChange(phase.index)}
                    >
                      <div className="phase-header">
                        <span className="phase-number">Phase {phase.index + 1}</span>
                        <span className="phase-duration">{phase.duration}s</span>
                      </div>
                      
                      <div className="phase-preview">
                        <TrafficLightPhasePreview 
                          phaseState={phase.state} 
                          width={80} 
                          height={16} 
                        />
                      </div>
                      
                      <div className="phase-state">
                        {phase.state}
                      </div>
                      
                      {phase.description && (
                        <div className="phase-description">
                          {phase.description}
                        </div>
                      )}
                      
                      {currentPhaseIndex === phase.index && (
                        <div className="current-indicator">Current</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Warning Message */}
              <div className="warning-message">
                <strong>⚠ Warning:</strong> Manual override will interrupt the normal 
                traffic light cycle. Use with caution and only when necessary.
              </div>
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
                {typeof program.offset === 'number' && (
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
        </div>
      </div>
    </div>
  );
};

export default TrafficLightModal;