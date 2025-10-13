import React from "react";
import "./Card.css";

/**
 * Reusable Card component for displaying information
 * @param {string} title - Card title
 * @param {string|number} value - Main value to display
 * @param {React.ReactNode} icon - Icon component or element
 * @param {string} variant - Card style variant: 'default', 'stat', 'info'
 * @param {string} color - Color theme: 'primary', 'success', 'warning', 'error'
 * @param {React.ReactNode} children - Additional content
 * @param {Function} onClick - Optional click handler
 * @param {string} className - Additional CSS classes
 */
const Card = ({
  title,
  value,
  icon,
  variant = "default",
  color = "primary",
  children,
  onClick,
  className = "",
  subtitle,
  trend,
  ...props
}) => {
  const cardClasses = `card card-${variant} card-${color} ${
    onClick ? "card-clickable" : ""
  } ${className}`.trim();

  if (variant === "stat") {
    return (
      <div className={cardClasses} onClick={onClick} {...props}>
        <div className="card-stat-content">
          {icon && <div className="card-stat-icon">{icon}</div>}
          <div className="card-stat-info">
            {value && <div className="card-stat-value">{value}</div>}
            {title && <div className="card-stat-title">{title}</div>}
            {subtitle && <div className="card-stat-subtitle">{subtitle}</div>}
            {trend && (
              <div className={`card-stat-trend trend-${trend.direction}`}>
                {trend.direction === "up" ? "↑" : "↓"} {trend.value}
              </div>
            )}
          </div>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className={cardClasses} onClick={onClick} {...props}>
      {(title || icon) && (
        <div className="card-header">
          {icon && <div className="card-icon">{icon}</div>}
          {title && <h3 className="card-title">{title}</h3>}
        </div>
      )}
      {children && <div className="card-body">{children}</div>}
    </div>
  );
};

export default Card;
