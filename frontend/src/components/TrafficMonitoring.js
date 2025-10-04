import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import io from "socket.io-client";
import "./TrafficMonitoring.css";
import PageLayout from "./PageLayout";

const TrafficMonitoring = () => {
  const [trafficData, setTrafficData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    intersectionId: "",
    startDate: "",
    endDate: "",
  });
  const [live, setLive] = useState(false);
  const socketRef = useRef(null);

  const fetchTrafficData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (filters.intersectionId) {
        params.append("intersectionId", filters.intersectionId);
      }
      if (filters.startDate) {
        params.append("startDate", filters.startDate);
      }
      if (filters.endDate) {
        params.append("endDate", filters.endDate);
      }

      const response = await axios.get(`/api/traffic-data?${params}`);
      setTrafficData(response.data);
    } catch (error) {
      console.error("Error fetching traffic data:", error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchTrafficData();
  }, [filters, fetchTrafficData]);

  useEffect(() => {
    if (!live) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }
    socketRef.current = io("http://localhost:5000");
    socketRef.current.on("trafficData", (data) => {
      setTrafficData((prev) => [data, ...prev].slice(0, 500));
    });
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [live]);

  const handleFilterChange = (e) => {
    setFilters({
      ...filters,
      [e.target.name]: e.target.value,
    });
  };

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    fetchTrafficData();
  };

  const clearFilters = () => {
    setFilters({
      intersectionId: "",
      startDate: "",
      endDate: "",
    });
    fetchTrafficData();
  };

  const exportCsv = () => {
    if (!trafficData?.length) return;
    const headers = [
      "timestamp",
      "intersectionId",
      "trafficFlow",
      "vehicleCount",
      "averageSpeed",
      "signalStatus",
    ];
    const rows = trafficData.map((d) => [
      d.timestamp ? new Date(d.timestamp).toISOString() : "",
      d.intersectionId ?? "",
      d.trafficFlow ?? "",
      d.vehicleCount ?? "",
      d.averageSpeed ?? "",
      d.signalStatus ?? "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "traffic-data.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(trafficData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "traffic-data.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const getSignalStatusColor = (status) => {
    switch ((status || "").toLowerCase()) {
      case "green":
        return "#4CAF50";
      case "yellow":
        return "#FF9800";
      case "red":
        return "#F44336";
      default:
        return "#9E9E9E";
    }
  };

  return (
    <PageLayout
      title="Traffic Monitoring"
      subtitle="Monitor real-time traffic data and intersection status"
    >
      <div className="monitoring-controls">
        <form onSubmit={handleFilterSubmit} className="filter-form">
          <div className="filter-group">
            <label htmlFor="intersectionId">Intersection ID:</label>
            <input
              type="text"
              id="intersectionId"
              name="intersectionId"
              value={filters.intersectionId}
              onChange={handleFilterChange}
              placeholder="Enter intersection ID"
            />
          </div>

          <div className="filter-group">
            <label htmlFor="startDate">Start Date:</label>
            <input
              type="datetime-local"
              id="startDate"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
            />
          </div>

          <div className="filter-group">
            <label htmlFor="endDate">End Date:</label>
            <input
              type="datetime-local"
              id="endDate"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
            />
          </div>

          <div className="filter-actions">
            <button type="submit" className="btn-primary">
              Apply Filters
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="btn-secondary"
            >
              Clear
            </button>
            <label className="live-toggle">
              <input
                type="checkbox"
                checked={live}
                onChange={(e) => setLive(e.target.checked)}
              />
              Live
            </label>
          </div>
        </form>
      </div>

      <div className="traffic-data-section">
        <div className="section-header">
          <h2>Traffic Data</h2>
          <div className="section-actions">
            <button onClick={fetchTrafficData} className="btn-secondary">
              Refresh Data
            </button>
            <button onClick={exportCsv} className="btn-secondary">
              Export CSV
            </button>
            <button onClick={exportJson} className="btn-secondary">
              Export JSON
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading">Loading traffic data...</div>
        ) : (
          <div className="traffic-data-table">
            {trafficData.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Intersection ID</th>
                    <th>Traffic Flow</th>
                    <th>Vehicle Count</th>
                    <th>Average Speed</th>
                    <th>Signal Status</th>
                  </tr>
                </thead>
                <tbody>
                  {trafficData.map((data, index) => (
                    <tr key={index}>
                      <td>
                        {data.timestamp
                          ? new Date(data.timestamp).toLocaleString()
                          : ""}
                      </td>
                      <td>{data.intersectionId}</td>
                      <td>{data.trafficFlow}</td>
                      <td>{data.vehicleCount || 0}</td>
                      <td>{data.averageSpeed || 0} km/h</td>
                      <td>
                        <span
                          className="signal-status"
                          style={{
                            backgroundColor: getSignalStatusColor(
                              data.signalStatus
                            ),
                          }}
                        >
                          {data.signalStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="no-data">
                <p>No traffic data found for the selected filters.</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="traffic-summary">
        <h2>Traffic Summary</h2>
        <div className="summary-cards">
          <div className="summary-card">
            <h3>Total Records</h3>
            <p>{trafficData.length}</p>
          </div>

          <div className="summary-card">
            <h3>Average Vehicle Count</h3>
            <p>
              {trafficData.length > 0
                ? Math.round(
                    trafficData.reduce(
                      (sum, data) => sum + (data.vehicleCount || 0),
                      0
                    ) / trafficData.length
                  )
                : 0}
            </p>
          </div>

          <div className="summary-card">
            <h3>Average Speed</h3>
            <p>
              {trafficData.length > 0
                ? Math.round(
                    trafficData.reduce(
                      (sum, data) => sum + (data.averageSpeed || 0),
                      0
                    ) / trafficData.length
                  )
                : 0}{" "}
              km/h
            </p>
          </div>

          <div className="summary-card">
            <h3>Unique Intersections</h3>
            <p>
              {new Set(trafficData.map((data) => data.intersectionId)).size}
            </p>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default TrafficMonitoring;
