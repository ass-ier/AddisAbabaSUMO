import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import PageLayout from './PageLayout';
import './TLSTestPanel.css';

/**
 * TLS Test Panel for traffic light controls
 * Uses real TLS IDs from the SUMO network with friendly name mapping
 */
const TLSTestPanel = () => {
  const { user } = useAuth();
  const [selectedTls, setSelectedTls] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [tlsData, setTlsData] = useState(null);
  const [loadingTlsData, setLoadingTlsData] = useState(true);
  const [customPhase, setCustomPhase] = useState('GrGr');

  // Load available TLS IDs on component mount
  useEffect(() => {
    const loadTlsData = async () => {
      try {
        const data = await api.getTlsAvailable();
        setTlsData(data);
        // Set first friendly name as default selection
        if (data.friendlyNames && data.friendlyNames.length > 0) {
          setSelectedTls(data.friendlyNames[0]);
        }
        console.log('TLS data loaded:', data);
      } catch (error) {
        console.error('Failed to load TLS data:', error);
        setLastResult({ 
          type: 'error', 
          message: `Failed to load TLS data: ${error.message}` 
        });
      } finally {
        setLoadingTlsData(false);
      }
    };

    if (user) {
      loadTlsData();
    } else {
      setLoadingTlsData(false);
    }
  }, [user]);

  const canControl = user && ['super_admin', 'operator'].includes(user.role);

  const executeDirectStateCommand = async (phase) => {
    if (!canControl) {
      setLastResult({ type: 'error', message: 'No permission to control traffic lights' });
      return;
    }

    if (!selectedTls) {
      setLastResult({ type: 'error', message: 'No TLS selected' });
      return;
    }

    setLoading(true);
    setLastResult(null);

    try {
      const result = await api.tlsSetState(selectedTls, phase);
      setLastResult({ 
        type: 'success', 
        message: `Successfully set TLS "${selectedTls}" to state "${phase}"`,
        data: result 
      });
      
      console.log(`TLS state command result:`, result);
      
      // Show success notification
      window.dispatchEvent(new CustomEvent('notify', {
        detail: { 
          type: 'success', 
          message: `TLS ${selectedTls}: state set to "${phase}" successfully` 
        }
      }));
      
    } catch (error) {
      console.error(`TLS state command failed:`, error);
      setLastResult({ 
        type: 'error', 
        message: `Failed to set TLS "${selectedTls}" state to "${phase}": ${error.message}`,
        error: error.message 
      });
      
      window.dispatchEvent(new CustomEvent('notify', {
        detail: { 
          type: 'error', 
          message: `TLS state control failed: ${error.message}` 
        }
      }));
    } finally {
      setLoading(false);
    }
  };

  const executeCommand = async (command, params = {}) => {
    if (!canControl) {
      setLastResult({ type: 'error', message: 'No permission to control traffic lights' });
      return;
    }

    setLoading(true);
    setLastResult(null);

    try {
      let result;
      switch (command) {
        case 'next':
          result = await api.tlsNextPhase(selectedTls);
          setLastResult({ 
            type: 'success', 
            message: `Successfully moved TLS "${selectedTls}" to next phase`,
            data: result 
          });
          break;
        case 'prev':
          result = await api.tlsPrevPhase(selectedTls);
          setLastResult({ 
            type: 'success', 
            message: `Successfully moved TLS "${selectedTls}" to previous phase`,
            data: result 
          });
          break;
        case 'set':
          result = await api.tlsSetPhase(selectedTls, params.phaseIndex);
          setLastResult({ 
            type: 'success', 
            message: `Successfully set TLS "${selectedTls}" to phase ${params.phaseIndex}`,
            data: result 
          });
          break;
        default:
          throw new Error('Unknown command');
      }
      
      console.log(`TLS ${command} command result:`, result);
      
      // Show success notification
      window.dispatchEvent(new CustomEvent('notify', {
        detail: { 
          type: 'success', 
          message: `TLS ${selectedTls}: ${command} command executed successfully` 
        }
      }));
      
    } catch (error) {
      console.error(`TLS ${command} command failed:`, error);
      setLastResult({ 
        type: 'error', 
        message: `Failed to ${command} TLS "${selectedTls}": ${error.message}`,
        error: error.message 
      });
      
      window.dispatchEvent(new CustomEvent('notify', {
        detail: { 
          type: 'error', 
          message: `TLS control failed: ${error.message}` 
        }
      }));
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <PageLayout title="TLS Test Panel" subtitle="Traffic Light Control Testing">
        <div className="tls-test-panel">
          <div className="no-auth">
            <h3>🚫 Authentication Required</h3>
            <p>Please log in to test traffic light controls.</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="TLS Test Panel" subtitle="Traffic Light Control Testing">
      <div className="tls-test-panel">
        <div className="panel-header">
          <h3>🚦 Traffic Light Control Test</h3>
          <p>Test controls with confirmed working TLS IDs</p>
        </div>

      {/* TLS Selection */}
      <div className="tls-selector">
        <label htmlFor="tls-select">Select Traffic Light:</label>
        {loadingTlsData ? (
          <div className="loading-tls">Loading TLS data...</div>
        ) : (
          <select 
            id="tls-select"
            value={selectedTls} 
            onChange={(e) => setSelectedTls(e.target.value)}
            className="tls-select"
            disabled={!tlsData || !tlsData.friendlyNames || tlsData.friendlyNames.length === 0}
          >
            {tlsData && tlsData.friendlyNames ? (
              tlsData.friendlyNames.map(friendlyName => {
                const actualId = tlsData.mappings[friendlyName] || friendlyName;
                return (
                  <option key={friendlyName} value={friendlyName}>
                    {friendlyName} ({actualId.length > 30 ? actualId.substring(0, 30) + '...' : actualId})
                  </option>
                );
              })
            ) : (
              <option value="" disabled>No TLS IDs available</option>
            )}
          </select>
        )}
      </div>

      {/* TLS Info Display */}
      {tlsData && !loadingTlsData && (
        <div className="tls-info">
          <p>📊 <strong>Available Traffic Lights:</strong> {tlsData.friendlyCount} friendly names mapped to {tlsData.totalCount} total TLS IDs</p>
          {selectedTls && tlsData.mappings[selectedTls] && (
            <p>🎯 <strong>Selected:</strong> "{selectedTls}" → "{tlsData.mappings[selectedTls]}"</p>
          )}
        </div>
      )}

      {/* Control Buttons */}
      <div className="control-buttons">
        <button
          className="control-btn next-btn"
          onClick={() => executeCommand('next')}
          disabled={loading || !canControl || !selectedTls || loadingTlsData}
          title={!canControl ? 'No permission' : !selectedTls ? 'No TLS selected' : 'Move to next phase'}
        >
          {loading ? '⏳' : '➡'} Next Phase
        </button>

        <button
          className="control-btn prev-btn"
          onClick={() => executeCommand('prev')}
          disabled={loading || !canControl || !selectedTls || loadingTlsData}
          title={!canControl ? 'No permission' : !selectedTls ? 'No TLS selected' : 'Move to previous phase'}
        >
          {loading ? '⏳' : '⬅'} Previous Phase
        </button>

        <button
          className="control-btn set-btn"
          onClick={() => executeCommand('set', { phaseIndex: 0 })}
          disabled={loading || !canControl || !selectedTls || loadingTlsData}
          title={!canControl ? 'No permission' : !selectedTls ? 'No TLS selected' : 'Set to phase 0'}
        >
          {loading ? '⏳' : '0'} Phase 0
        </button>

        <button
          className="control-btn set-btn"
          onClick={() => executeCommand('set', { phaseIndex: 1 })}
          disabled={loading || !canControl || !selectedTls || loadingTlsData}
          title={!canControl ? 'No permission' : !selectedTls ? 'No TLS selected' : 'Set to phase 1'}
        >
          {loading ? '⏳' : '1'} Phase 1
        </button>

        <button
          className="control-btn set-btn"
          onClick={() => executeCommand('set', { phaseIndex: 2 })}
          disabled={loading || !canControl || !selectedTls || loadingTlsData}
          title={!canControl ? 'No permission' : !selectedTls ? 'No TLS selected' : 'Set to phase 2'}
        >
          {loading ? '⏳' : '2'} Phase 2
        </button>
      </div>

      {/* Direct State Control */}
      <div className="state-control-section">
        <h4>🎯 Direct State Control</h4>
        <p>Set exact traffic light state using SUMO phase notation (e.g., "GrGr", "rGrG")</p>
        
        <div className="state-input-group">
          <label htmlFor="custom-phase">Phase State:</label>
          <input
            id="custom-phase"
            type="text"
            value={customPhase}
            onChange={(e) => setCustomPhase(e.target.value.trim())}
            placeholder="e.g., GrGr, rGrG, rrrr"
            className="phase-input"
            disabled={loading || loadingTlsData}
          />
          <button
            className="control-btn state-btn"
            onClick={() => executeDirectStateCommand(customPhase)}
            disabled={loading || !canControl || !selectedTls || !customPhase || loadingTlsData}
            title={!canControl ? 'No permission' : !selectedTls ? 'No TLS selected' : !customPhase ? 'Enter phase state' : `Set state to "${customPhase}"`}
          >
            {loading ? '⏳' : '🎯'} Set State
          </button>
        </div>
        
        <div className="preset-buttons">
          <button
            className="control-btn preset-btn"
            onClick={() => executeDirectStateCommand('GrGr')}
            disabled={loading || !canControl || !selectedTls || loadingTlsData}
            title="Green-red Green-red"
          >
            GrGr
          </button>
          <button
            className="control-btn preset-btn"
            onClick={() => executeDirectStateCommand('rGrG')}
            disabled={loading || !canControl || !selectedTls || loadingTlsData}
            title="red-Green red-Green"
          >
            rGrG
          </button>
          <button
            className="control-btn preset-btn"
            onClick={() => executeDirectStateCommand('rrGG')}
            disabled={loading || !canControl || !selectedTls || loadingTlsData}
            title="red-red Green-Green"
          >
            rrGG
          </button>
          <button
            className="control-btn preset-btn"
            onClick={() => executeDirectStateCommand('rrrr')}
            disabled={loading || !canControl || !selectedTls || loadingTlsData}
            title="All red (emergency stop)"
          >
            All Red
          </button>
        </div>
      </div>

      {/* Permission Info */}
      {!canControl && (
        <div className="permission-info">
          <p>🔒 Your role ({user.role}) does not allow traffic light control.</p>
          <p>Required roles: super_admin or operator</p>
        </div>
      )}

      {/* Result Display */}
      {lastResult && (
        <div className={`result-panel ${lastResult.type}`}>
          <div className="result-header">
            {lastResult.type === 'success' ? '✅' : '❌'} 
            {lastResult.type === 'success' ? 'SUCCESS' : 'ERROR'}
          </div>
          <div className="result-message">{lastResult.message}</div>
          {lastResult.data && (
            <details className="result-details">
              <summary>Response Data</summary>
              <pre>{JSON.stringify(lastResult.data, null, 2)}</pre>
            </details>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="instructions">
        <h4>📝 Instructions:</h4>
        <ul>
          <li>Select a traffic light from the dropdown (friendly names mapped to real SUMO IDs)</li>
          <li>Ensure the SUMO simulation is running via the "Start Simulation" API call</li>
          <li><strong>Phase Control:</strong> Use Next/Previous/Set buttons to cycle through predefined phases</li>
          <li><strong>Direct State Control:</strong> Set exact traffic light states using SUMO notation:
            <ul>
              <li><code>G</code> = Green, <code>r</code> = Red, <code>y</code> = Yellow</li>
              <li><code>GrGr</code> = North/South Green, East/West Red</li>
              <li><code>rGrG</code> = North Red, South Green, East Red, West Green</li>
            </ul>
          </li>
          <li>Watch your SUMO simulation window for immediate visual changes</li>
          <li>Check browser console and backend logs for detailed operation logs</li>
        </ul>
        <p><strong>Note:</strong> {tlsData ? `${tlsData.friendlyCount} friendly TLS names are mapped to real SUMO traffic light IDs from your network.` : 'TLS mapping is loading...'}</p>
        {tlsData && tlsData.totalCount > tlsData.friendlyCount && (
          <p><strong>Info:</strong> Your network has {tlsData.totalCount} total traffic lights, {tlsData.friendlyCount} have friendly names.</p>
        )}
      </div>
    </div>
    </PageLayout>
  );
};

export default TLSTestPanel;