import React, { useEffect, useState } from "react";
import { api } from "../utils/api";

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState({ user: "", role: "", date: "" });

  const load = async () => {
    const params = {};
    if (filter.user) params.user = filter.user;
    if (filter.role) params.role = filter.role;
    if (filter.date) params.startDate = filter.date;
    const res = await api.listAuditLogs(params);
    setLogs(res.items || []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportCsv = () => {
    const headers = ["time", "user", "role", "action", "target"];
    const rows = logs.map((l) => [
      l.time ? new Date(l.time).toISOString() : "",
      l.user || "",
      l.role || "",
      l.action || "",
      l.target || "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "audit-logs.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCsvServer = () => {
    const params = new URLSearchParams();
    if (filter.user) params.append("user", filter.user);
    if (filter.role) params.append("role", filter.role);
    if (filter.date) params.append("startDate", filter.date);
    window.open(`/api/audit/export.csv?${params.toString()}`, "_blank");
  };

  const exportPdf = async () => {
    const styles = `
      <style>
        body { font-family: Arial, sans-serif; padding: 16px; }
        h1 { font-size: 18px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; font-size: 12px; }
        th { background: #f5f5f5; text-align: left; }
      </style>
    `;
    const rows = logs
      .map(
        (l) => `
        <tr>
          <td>${l.time ? new Date(l.time).toLocaleString() : "&mdash;"}</td>
          <td>${l.user || ""}</td>
          <td>${l.role || ""}</td>
          <td>${l.action || ""}</td>
          <td>${l.target || ""}</td>
        </tr>`
      )
      .join("");
    const html = `
      <html>
        <head>${styles}</head>
        <body>
          <h1>Audit Logs</h1>
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>User</th>
                <th>Role</th>
                <th>Action</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </body>
      </html>`;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  const items = logs.filter(
    (l) =>
      (!filter.user || (l.user || "").includes(filter.user)) &&
      (!filter.role || (l.role || "") === filter.role)
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
        <p className="text-gray-600">Track system activities and changes</p>
      </div>
      <div className="bg-white p-4 rounded shadow shadow-card grid md:grid-cols-4 gap-3">
        <input
          className="border p-2"
          placeholder="User"
          value={filter.user}
          onChange={(e) => setFilter({ ...filter, user: e.target.value })}
        />
        <input
          className="border p-2"
          placeholder="Role"
          value={filter.role}
          onChange={(e) => setFilter({ ...filter, role: e.target.value })}
        />
        <input
          className="border p-2"
          type="date"
          value={filter.date}
          onChange={(e) => setFilter({ ...filter, date: e.target.value })}
        />
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={load}>
            Apply
          </button>
          <button className="btn-secondary" onClick={exportCsv}>
            Export CSV (client)
          </button>
          <button className="btn-secondary" onClick={exportCsvServer}>
            Export CSV (server)
          </button>
          <button className="btn-secondary" onClick={exportPdf}>
            Export PDF
          </button>
        </div>
      </div>
      <div className="bg-white p-4 rounded shadow shadow-card overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 text-left">Time</th>
              <th className="p-2 text-left">User</th>
              <th className="p-2 text-left">Role</th>
              <th className="p-2 text-left">Action</th>
              <th className="p-2 text-left">Target</th>
            </tr>
          </thead>
          <tbody>
            {items.map((l, i) => (
              <tr key={i} className="border-b">
                <td className="p-2">
                  {l.time ? new Date(l.time).toLocaleString() : "—"}
                </td>
                <td className="p-2">{l.user}</td>
                <td className="p-2">{l.role}</td>
                <td className="p-2">{l.action}</td>
                <td className="p-2">{l.target}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
