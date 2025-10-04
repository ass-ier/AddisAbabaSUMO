import React, { useState } from "react";
import "./Reports.css";
import PageLayout from "./PageLayout";

const Reports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reportFilters, setReportFilters] = useState({
    startDate: "",
    endDate: "",
    intersectionId: "",
    reportType: "traffic_summary",
  });

  const generateReport = async () => {
    setLoading(true);
    try {
      // Simulate report generation
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const mockReport = {
        id: Date.now(),
        type: reportFilters.reportType,
        title: `${reportFilters.reportType
          .replace("_", " ")
          .toUpperCase()} Report`,
        generatedAt: new Date().toISOString(),
        period: `${reportFilters.startDate} to ${reportFilters.endDate}`,
        data: {
          totalVehicles: Math.floor(Math.random() * 1000) + 500,
          averageSpeed: Math.floor(Math.random() * 30) + 25,
          peakHours: ["08:00-09:00", "17:00-18:00"],
          congestionLevel: Math.floor(Math.random() * 3) + 1,
          intersections: Math.floor(Math.random() * 10) + 5,
        },
      };
      setReports((prev) => [mockReport, ...prev]);
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
    const reportData = {
      ...report,
      downloadUrl: `/api/reports/${report.id}/download`,
    };
    const dataStr = JSON.stringify(reportData, null, 2);
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
      subtitle="Generate and download traffic analysis reports"
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
              <label htmlFor="startDate">Start Date:</label>
              <input
                type="date"
                id="startDate"
                name="startDate"
                value={reportFilters.startDate}
                onChange={handleFilterChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="endDate">End Date:</label>
              <input
                type="date"
                id="endDate"
                name="endDate"
                value={reportFilters.endDate}
                onChange={handleFilterChange}
                required
              />
            </div>
          </div>
          <div className="form-actions">
            <button
              onClick={generateReport}
              disabled={
                loading || !reportFilters.startDate || !reportFilters.endDate
              }
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
                    {new Date(report.generatedAt).toLocaleDateString()}
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
                    <span className="value">
                      {report.data.averageSpeed} km/h
                    </span>
                  </div>
                  <div className="data-item">
                    <span className="label">Congestion Level:</span>
                    <span
                      className="value congestion"
                      style={{
                        color: getCongestionLevel(report.data.congestionLevel)
                          .color,
                      }}
                    >
                      {getCongestionLevel(report.data.congestionLevel).text}
                    </span>
                  </div>
                  <div className="data-item">
                    <span className="label">Intersections:</span>
                    <span className="value">{report.data.intersections}</span>
                  </div>
                </div>
                <div className="report-actions">
                  <button
                    onClick={() => downloadReport(report)}
                    className="btn-secondary"
                  >
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
