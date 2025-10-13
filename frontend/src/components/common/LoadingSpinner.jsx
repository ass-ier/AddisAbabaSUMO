import React from "react";
import "./LoadingSpinner.css";

const LoadingSpinner = ({ size = "md", message = "Loading..." }) => {
  return (
    <div className="loading-spinner-container" data-size={size}>
      <div className="loading-spinner">
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
      </div>
      {message && <p className="loading-message">{message}</p>}
    </div>
  );
};

export default LoadingSpinner;
