import React from 'react';
import { useRealTimeData } from '../hooks/useRealTimeData';

const RealTimeStatus = ({ className = '', showDetails = false }) => {
  const { 
    connected, 
    connecting, 
    error, 
    lastUpdate,
    getConnectionInfo,
    connect
  } = useRealTimeData([], { autoConnect: false });

  const connectionInfo = getConnectionInfo();

  if (!showDetails && !connected && !connecting) {
    return null; // Hide when not connected and details not requested
  }

  const getStatusColor = () => {
    if (connected) return 'text-green-600';
    if (connecting) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusIcon = () => {
    if (connected) return '🟢';
    if (connecting) return '🟡';
    return '🔴';
  };

  const getStatusText = () => {
    if (connected) return 'Real-time';
    if (connecting) return 'Connecting...';
    return 'Offline';
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center gap-1">
        <span className="text-sm">{getStatusIcon()}</span>
        <span className={`text-sm font-medium ${getStatusColor()}`}>
          {getStatusText()}
        </span>
      </div>

      {showDetails && (
        <>
          {connected && lastUpdate && (
            <span className="text-xs text-gray-500">
              • Updated {new Date(lastUpdate).toLocaleTimeString()}
            </span>
          )}
          
          {error && !connecting && (
            <button
              onClick={connect}
              className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
              title="Retry connection"
            >
              Retry
            </button>
          )}

          {showDetails && connectionInfo.socketId && (
            <span className="text-xs text-gray-400" title="Socket ID">
              ID: {connectionInfo.socketId.slice(-6)}
            </span>
          )}
        </>
      )}

      {connected && (
        <div 
          className="w-2 h-2 bg-green-500 rounded-full animate-pulse" 
          title="Live data updates active"
        />
      )}
    </div>
  );
};

export default RealTimeStatus;