import React from "react";
import { useRealTimeData } from "../hooks/useRealTimeData";

const RealTimeStatus = ({ className = "", showDetails = false }) => {
  const {
    connected,
    connecting,
    error,
    lastUpdate,
    getConnectionInfo,
    connect,
  } = useRealTimeData([], { autoConnect: false });

  const connectionInfo = getConnectionInfo();

  if (!showDetails && !connected && !connecting) {
    return null; // Hide when not connected and details not requested
  }

  const getStatusColor = () => {
    if (connected) return "text-green-600";
    if (connecting) return "text-yellow-600";
    return "text-red-600";
  };

  const getStatusIcon = () => {
    if (connected) return "🟢";
    if (connecting) return "🟡";
    return "🔴";
  };

  const getStatusText = () => {
    if (connected) return "Real-time";
    if (connecting) return "Connecting...";
    return "Offline";
  };

  return (
    <div className={`flex items-center justify-between w-full ${className}`}>
      <div className="flex items-center gap-2">
        {/* Status Indicator */}
        <div
          className={`relative flex items-center justify-center w-7 h-7 rounded-full ${
            connected
              ? "bg-green-100 dark:bg-green-900/30"
              : connecting
                ? "bg-yellow-100 dark:bg-yellow-900/30"
                : "bg-red-100 dark:bg-red-900/30"
          }`}
        >
          <span className="text-base leading-none">{getStatusIcon()}</span>
        </div>

        {/* Status Text */}
        {showDetails && (
          <div className="flex flex-col">
            <span
              className={`text-xs font-semibold leading-tight ${
                connected
                  ? "text-green-700 dark:text-green-400"
                  : connecting
                    ? "text-yellow-700 dark:text-yellow-400"
                    : "text-red-700 dark:text-red-400"
              }`}
            >
              {getStatusText()}
            </span>
            {connected && lastUpdate && (
              <span className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                {new Date(lastUpdate).toLocaleTimeString()}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Retry Button (collapsed state) */}
      {!showDetails && error && !connecting && (
        <button
          onClick={connect}
          className="flex items-center justify-center w-7 h-7 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
          title="Retry connection"
          aria-label="Retry connection"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      )}
    </div>
  );
};

export default RealTimeStatus;
