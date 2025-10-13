import React, { useState } from "react";
import axios from "axios";
import "./Reports.css";
import PageLayout from "./PageLayout";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5001";

const Reports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reportFilters, setReportFilters] = useState({
    startDate: "",
    endDate: "",
    intersectionId: "",
    reportType: "traffic_summary",
  });

  const toIsoOrNull = (val, fallbackMs) => {
    if (val) return new Date(val).toISOString();
    if (fallbackMs != null) return new Date(Date.now() - fallbackMs).toISOString();
    return null;
  };

  const deterministicallySummarize = (rows, type) => {
    const totalVehicles = rows.reduce((acc, r) => acc + (Number(r.vehicleCount) || 0), 0);
    const avgSpeed = rows.length
      ? Number(
          (
            rows.reduce((acc, r) => acc + (Number(r.averageSpeed) || 0), 0) /
            rows.length
          ).toFixed(1)
        )
      : 0;
    const intersections = new Set(rows.map((r) => r.intersectionId || "")).size;
    const avgFlow = rows.length
      ? rows.reduce((a, r) => a + (Number(r.trafficFlow) || 0), 0) / rows.length
      : 0;
    const congestionLevel = avgFlow > 1300 ? 3 : avgFlow > 700 ? 2 : 1;

    // Peak hours by summing vehicleCount per hour
    const byHour = {};
    for (const r of rows) {
      const t = r.timestamp ? new Date(r.timestamp) : null;
      if (!t) continue;
      const hourKey = t.toISOString().slice(0, 13); // YYYY-MM-DDTHH
      byHour[hourKey] = (byHour[hourKey] || 0) + (Number(r.vehicleCount) || 0);
    }
    const sortedHours = Object.entries(byHour)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([k]) => {
        const h = k.slice(11, 13);
        const start = `${h}:00`;
        const end = `${h.padStart(2, "0")}:59`;
        return `${start}-${end}`;
      });

    return {
      totalVehicles,
      averageSpeed: avgSpeed,
      peakHours: sortedHours,
      congestionLevel,
      intersections,
      type,
    };
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      // Default to last 24 hours if not provided
      const startIso = toIsoOrNull(reportFilters.startDate, 24 * 60 * 60 * 1000);
      const endIso = toIsoOrNull(reportFilters.endDate, 0) || new Date().toISOString();

      const params = new URLSearchParams();
      if (reportFilters.intersectionId)
        params.append("intersectionId", reportFilters.intersectionId);
      params.append("startDate", startIso);
      params.append("endDate", endIso);
      params.append("limit", "5000");

      const res = await axios.get(`${API_BASE}/api/traffic-data?${params.toString()}`);
      const rows = Array.isArray(res.data) ? res.data : [];

      const data = deterministicallySummarize(rows, reportFilters.reportType);

      const report = {
        id: Date.now(),
        type: reportFilters.reportType,
        title: `${reportFilters.reportType.replace("_", " ").toUpperCase()} Report`,
        generatedAt: new Date().toISOString(),
        period: `${startIso} to ${endIso}`,
        data,
      };
      setReports((prev) => [report, ...prev]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    setReportFilters({
      ...reportFilters,
      [e.target.name]: e.target.value,
    });
  };

  const downloadReport = (report) => {
    const dataStr = JSON.stringify(report, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${report.title.replace(/\s+/g, "_")}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getCongestionLevel = (level) => {
    const levels = {
      1: { text: "Low", color: "#4CAF50" },
      2: { text: "Medium", color: "#FF9800" },
      3: { text: "High", color: "#F44336" },
    };
    return levels[level] || { text: "Unknown", color: "#9E9E9E" };
  };

  return (
    <PageLayout
      title="Reports"
      subtitle="Generate and download traffic analysis reports (deterministic from persisted data)"
    >
      <div className="report-generator card shadow-card">
        <h2>Generate New Report</h2>
        <div className="report-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="reportType">Report Type:</label>
              <select
                id="reportType"
                name="reportType"
                value={reportFilters.reportType}
                onChange={handleFilterChange}
              >
                <option value="traffic_summary">Traffic Summary</option>
                <option value="congestion_analysis">Congestion Analysis</option>
                <option value="speed_analysis">Speed Analysis</option>
                <option value="intersection_performance">
                  Intersection Performance
                </option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="intersectionId">
                Intersection ID (Optional):
              </label>
              <input
                type="text"
                id="intersectionId"
                name="intersectionId"
                value={reportFilters.intersectionId}
                onChange={handleFilterChange}
                placeholder="Enter intersection ID"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="startDate">Start Date & Time:</label>
              <input
                type="datetime-local"
                id="startDate"
                name="startDate"
                value={reportFilters.startDate}
                onChange={handleFilterChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="endDate">End Date & Time:</label>
              <input
                type="datetime-local"
                id="endDate"
                name="endDate"
                value={reportFilters.endDate}
                onChange={handleFilterChange}
              />
            </div>
          </div>
          <div className="form-actions">
            <button
              onClick={generateReport}
              disabled={loading}
              className="btn-primary"
            >
              {loading ? "Generating..." : "Generate Report"}
            </button>
          </div>
        </div>
      </div>
      <div className="reports-list card shadow-card">
        <h2>Generated Reports</h2>
        {reports.length > 0 ? (
          <div className="reports-grid">
            {reports.map((report) => (
              <div key={report.id} className="report-card">
                <div className="report-header">
                  <h3>{report.title}</h3>
                  <span className="report-date">
                    {new Date(report.generatedAt).toLocaleString()}
                  </span>
                </div>
                <div className="report-info">
                  <p>
                    <strong>Period:</strong> {report.period}
                  </p>
                  <p>
                    <strong>Type:</strong>{" "}
                    {report.type.replace("_", " ").toUpperCase()}
                  </p>
                </div>
                <div className="report-data">
                  <div className="data-item">
                    <span className="label">Total Vehicles:</span>
                    <span className="value">{report.data.totalVehicles}</span>
                  </div>
                  <div className="data-item">
                    <span className="label">Average Speed:</span>
                    <span className="value">{report.data.averageSpeed} km/h</span>
                  </div>
                  <div className="data-item">
                    <span className="label">Congestion Level:</span>
                    <span
                      className="value congestion"
                      style={{ color: getCongestionLevel(report.data.congestionLevel).color }}
                    >
                      {getCongestionLevel(report.data.congestionLevel).text}
                    </span>
                  </div>
                  <div className="data-item">
                    <span className="label">Intersections:</span>
                    <span className="value">{report.data.intersections}</span>
                  </div>
                  {Array.isArray(report.data.peakHours) && report.data.peakHours.length > 0 && (
                    <div className="data-item">
                      <span className="label">Peak Hours:</span>
                      <span className="value">{report.data.peakHours.join(", ")}</span>
                    </div>
                  )}
                </div>
                <div className="report-actions">
                  <button onClick={() => downloadReport(report)} className="btn-secondary">
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-reports">
            <p>No reports generated yet. Create your first report above.</p>
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default Reports;
