import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import { useTrafficData } from "../hooks/useRealTimeData";
import RealTimeStatus from "./RealTimeStatus";
import PageLayout from "./PageLayout";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

const RealTimeTrafficMap = () => {
  const { connected, connecting, trafficData, lastUpdate } = useTrafficData();

  // Addis Ababa center coordinates
  const [mapCenter] = useState([9.03, 38.74]);
  const [mapZoom] = useState(12);

  // Sample traffic data - in real app this would come from real-time data
  const [trafficPoints, setTrafficPoints] = useState([
    {
      id: 1,
      name: "Meskel Square",
      position: [9.0125, 38.7636],
      vehicleCount: 45,
      averageSpeed: 25,
      status: "normal",
      congestionLevel: "low",
    },
    {
      id: 2,
      name: "Mexico Square",
      position: [9.0458, 38.7575],
      vehicleCount: 78,
      averageSpeed: 15,
      status: "congested",
      congestionLevel: "high",
    },
    {
      id: 3,
      name: "Piazza",
      position: [9.0348, 38.7578],
      vehicleCount: 32,
      averageSpeed: 30,
      status: "normal",
      congestionLevel: "low",
    },
    {
      id: 4,
      name: "Arat Kilo",
      position: [9.0404, 38.7619],
      vehicleCount: 55,
      averageSpeed: 20,
      status: "moderate",
      congestionLevel: "medium",
    },
    {
      id: 5,
      name: "Bole",
      position: [8.9806, 38.8014],
      vehicleCount: 67,
      averageSpeed: 18,
      status: "congested",
      congestionLevel: "high",
    },
  ]);

  // Update traffic points with real-time data
  useEffect(() => {
    if (trafficData?.stats) {
      // Update traffic points with real-time data
      // This is where you'd integrate actual traffic data from your backend
      console.log("Real-time traffic data received:", trafficData);

      // Example: Update traffic points with new data
      // setTrafficPoints(prevPoints =>
      //   prevPoints.map(point => ({
      //     ...point,
      //     vehicleCount: Math.random() * 100,
      //     averageSpeed: 10 + Math.random() * 30,
      //     // ... other real-time updates
      //   }))
      // );
    }
  }, [trafficData]);

  // Simulate some real-time updates if connected
  useEffect(() => {
    if (!connected) return;

    const interval = setInterval(() => {
      setTrafficPoints((prevPoints) =>
        prevPoints.map((point) => ({
          ...point,
          vehicleCount: Math.max(
            5,
            point.vehicleCount + (Math.random() - 0.5) * 10
          ),
          averageSpeed: Math.max(
            5,
            Math.min(50, point.averageSpeed + (Math.random() - 0.5) * 5)
          ),
        }))
      );
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [connected]);

  const getCircleColor = (congestionLevel) => {
    switch (congestionLevel) {
      case "low":
        return "green";
      case "medium":
        return "orange";
      case "high":
        return "red";
      default:
        return "blue";
    }
  };

  const getCircleOpacity = (status) => {
    return connected ? 0.8 : 0.5;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "normal":
        return "✅";
      case "moderate":
        return "⚠️";
      case "congested":
        return "🚨";
      default:
        return "ℹ️";
    }
  };

  return (
    <PageLayout
      title="Real-Time Traffic Map"
      subtitle="Live traffic monitoring across Addis Ababa"
    >
      <div className="space-y-4">
        {/* Status Bar */}
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-semibold">Traffic Overview</h3>
              <RealTimeStatus showDetails={true} />
            </div>

            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>Normal Flow</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                <span>Moderate Congestion</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span>Heavy Congestion</span>
              </div>
            </div>
          </div>

          {lastUpdate && (
            <div className="mt-2 text-sm text-gray-500">
              Last updated: {new Date(lastUpdate).toLocaleString()}
            </div>
          )}
        </div>

        {/* Map Container */}
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="h-96 w-full rounded-lg overflow-hidden">
            <MapContainer
              center={mapCenter}
              zoom={mapZoom}
              className="h-full w-full"
              zoomControl={true}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {trafficPoints.map((point) => (
                <React.Fragment key={point.id}>
                  {/* Traffic Circle Indicator */}
                  <Circle
                    center={point.position}
                    radius={point.vehicleCount * 10}
                    pathOptions={{
                      color: getCircleColor(point.congestionLevel),
                      fillColor: getCircleColor(point.congestionLevel),
                      fillOpacity: getCircleOpacity(point.status),
                      weight: connected ? 3 : 2,
                    }}
                  />

                  {/* Marker */}
                  <Marker position={point.position}>
                    <Popup>
                      <div className="p-2">
                        <h4 className="font-semibold flex items-center gap-2">
                          {getStatusIcon(point.status)} {point.name}
                        </h4>
                        <div className="mt-2 space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span>Vehicles:</span>
                            <span className="font-medium">
                              {Math.round(point.vehicleCount)}
                              {connected && (
                                <span className="ml-1 w-2 h-2 bg-green-500 rounded-full inline-block animate-pulse"></span>
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Avg Speed:</span>
                            <span className="font-medium">
                              {Math.round(point.averageSpeed)} km/h
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Status:</span>
                            <span
                              className={`font-medium capitalize ${
                                point.status === "normal"
                                  ? "text-green-600"
                                  : point.status === "moderate"
                                    ? "text-orange-600"
                                    : "text-red-600"
                              }`}
                            >
                              {point.status}
                            </span>
                          </div>
                          {connected && (
                            <div className="mt-2 text-xs text-green-600 flex items-center gap-1">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                              Live data
                            </div>
                          )}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                </React.Fragment>
              ))}
            </MapContainer>
          </div>
        </div>

        {/* Traffic Statistics */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-500">
                  Total Vehicles
                </h4>
                <p className="text-2xl font-bold">
                  {trafficPoints
                    .reduce((sum, point) => sum + point.vehicleCount, 0)
                    .toFixed(0)}
                </p>
              </div>
              <div className="text-3xl">🚗</div>
            </div>
            {connected && (
              <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                Real-time count
              </div>
            )}
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-500">
                  Average Speed
                </h4>
                <p className="text-2xl font-bold">
                  {(
                    trafficPoints.reduce(
                      (sum, point) => sum + point.averageSpeed,
                      0
                    ) / trafficPoints.length
                  ).toFixed(1)}{" "}
                  km/h
                </p>
              </div>
              <div className="text-3xl">⚡</div>
            </div>
            {connected && (
              <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                Live monitoring
              </div>
            )}
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-500">
                  Active Locations
                </h4>
                <p className="text-2xl font-bold">{trafficPoints.length}</p>
              </div>
              <div className="text-3xl">📍</div>
            </div>
            {connected && (
              <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                All monitored
              </div>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default RealTimeTrafficMap;
