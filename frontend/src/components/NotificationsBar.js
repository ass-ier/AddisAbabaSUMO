import React, { useEffect, useState } from "react";
import "./NotificationsBar.css";

const MAX_ITEMS = 4;

const NotificationsBar = () => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const handler = (e) => {
      const { message, type = "info" } = e.detail || {};
      const id = Date.now() + Math.random();
      setItems((prev) => [{ id, message, type }, ...prev].slice(0, MAX_ITEMS));
      setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== id));
      }, 4000);
    };
    window.addEventListener("notify", handler);
    return () => window.removeEventListener("notify", handler);
  }, []);

  const variant = (type) => {
    switch (type) {
      case "error":
        return "notif-error";
      case "success":
        return "notif-success";
      case "warning":
        return "notif-warning";
      default:
        return "notif-info";
    }
  };

  return (
    <div className="notifications-bar">
      {items.map((n) => (
        <div key={n.id} className={`notification ${variant(n.type)}`}>
          {n.message}
        </div>
      ))}
    </div>
  );
};

export default NotificationsBar;
