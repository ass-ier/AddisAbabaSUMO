import React, { useEffect, useState } from "react";
import { api } from "../utils/api";

export default function SystemSettings() {
  const [settings, setSettings] = useState(null);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    (async () => setSettings(await api.getSettings()))();
  }, []);

  if (!settings)
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
          <p className="text-gray-600">Loading...</p>
        </div>
        <div />
      </div>
    );

  const save = async (e) => {
    e.preventDefault();
    await api.saveSettings(settings);
    setSaved("Settings saved");
    setTimeout(() => setSaved(""), 2000);
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
        <p className="text-gray-600">Configure system-wide options</p>
      </div>
      <form onSubmit={save} className="grid gap-6 md:grid-cols-2">
        <div className="bg-white p-4 rounded shadow shadow-card">
          <h2 className="font-medium mb-3">SUMO</h2>
          <label className="block text-sm">Step length</label>
          <input
            className="border p-2 w-full mb-3"
            type="number"
            step="0.1"
            value={settings.sumo.stepLength}
            onChange={(e) =>
              setSettings({
                ...settings,
                sumo: {
                  ...settings.sumo,
                  stepLength: parseFloat(e.target.value),
                },
              })
            }
          />
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.sumo.startWithGui}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  sumo: { ...settings.sumo, startWithGui: e.target.checked },
                })
              }
            />{" "}
            Start with GUI
          </label>
        </div>
        <div className="bg-white p-4 rounded shadow shadow-card">
          <h2 className="font-medium mb-3">Adaptive Mode</h2>
          <label className="block text-sm">Enabled</label>
          <input
            type="checkbox"
            className="mb-3"
            checked={settings.adaptive.enabled}
            onChange={(e) =>
              setSettings({
                ...settings,
                adaptive: { ...settings.adaptive, enabled: e.target.checked },
              })
            }
          />
          <label className="block text-sm">Min Green (s)</label>
          <input
            className="border p-2 w-full mb-3"
            type="number"
            value={settings.adaptive.minGreen}
            onChange={(e) =>
              setSettings({
                ...settings,
                adaptive: {
                  ...settings.adaptive,
                  minGreen: parseInt(e.target.value),
                },
              })
            }
          />
          <label className="block text-sm">Max Green (s)</label>
          <input
            className="border p-2 w-full"
            type="number"
            value={settings.adaptive.maxGreen}
            onChange={(e) =>
              setSettings({
                ...settings,
                adaptive: {
                  ...settings.adaptive,
                  maxGreen: parseInt(e.target.value),
                },
              })
            }
          />
        </div>
        <div className="bg-white p-4 rounded shadow shadow-card">
          <h2 className="font-medium mb-3">Emergency Rules</h2>
          <label className="block text-sm">Priority</label>
          <select
            className="border p-2 w-full mb-3"
            value={settings.emergency.priorityLevel}
            onChange={(e) =>
              setSettings({
                ...settings,
                emergency: {
                  ...settings.emergency,
                  priorityLevel: e.target.value,
                },
              })
            }
          >
            <option value="low">Low</option>
            <option value="med">Medium</option>
            <option value="high">High</option>
          </select>
          <label className="block text-sm">Default Handling</label>
          <select
            className="border p-2 w-full"
            value={settings.emergency.defaultHandling}
            onChange={(e) =>
              setSettings({
                ...settings,
                emergency: {
                  ...settings.emergency,
                  defaultHandling: e.target.value,
                },
              })
            }
          >
            <option value="forceGreen">Force Green</option>
            <option value="holdYellow">Hold Yellow</option>
          </select>
        </div>
        <div className="bg-white p-4 rounded shadow shadow-card">
          <h2 className="font-medium mb-3">MongoDB</h2>
          <label className="block text-sm">URI</label>
          <input
            className="border p-2 w-full"
            value={settings.mongodb.uri}
            onChange={(e) =>
              setSettings({
                ...settings,
                mongodb: { ...settings.mongodb, uri: e.target.value },
              })
            }
          />
          <button type="button" className="btn-secondary mt-3">
            Backup Now
          </button>
        </div>
        <div className="md:col-span-2">
          <button className="btn-primary">Save</button>
          {saved && <span className="ml-3 text-green-600">{saved}</span>}
        </div>
      </form>
    </div>
  );
}
