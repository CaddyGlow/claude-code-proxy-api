/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / k ** i).toFixed(dm)} ${sizes[i]}`;
}

/**
 * Debounce function that delays execution until after wait milliseconds
 */
export function debounce<T extends (...args: never[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout !== null) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function that limits execution to once per wait milliseconds
 */
export function throttle<T extends (...args: never[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  let lastFunc: ReturnType<typeof setTimeout> | null = null;
  let lastRan = 0;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      lastRan = Date.now();
      inThrottle = true;
    } else {
      if (lastFunc) {
        clearTimeout(lastFunc);
      }
      lastFunc = setTimeout(
        () => {
          if (Date.now() - lastRan >= wait) {
            func(...args);
            lastRan = Date.now();
          }
        },
        wait - (Date.now() - lastRan)
      );
    }
  };
}

/**
 * Format currency to string with proper decimals
 */
export function formatCurrency(amount: number, currency = "USD", decimals = 2): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/**
 * Format number with proper locale formatting
 */
export function formatNumber(num: number, decimals = 0): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Format percentage with proper decimals
 */
export function formatPercentage(value: number, decimals = 1): string {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);
}

/**
 * Format duration in seconds to human-readable string
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

/**
 * Format relative time (e.g., "2 hours ago", "5 minutes ago")
 */
export function formatRelativeTime(timestamp: string | Date): string {
  const now = new Date();
  const past = new Date(timestamp);
  const diffInMs = now.getTime() - past.getTime();
  const diffInSeconds = Math.floor(diffInMs / 1000);

  if (diffInSeconds < 60) {
    return "just now";
  }
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  }
  const days = Math.floor(diffInSeconds / 86400);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}

/**
 * Format date time to localized string
 */
export function formatDateTime(
  timestamp: string | Date,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = new Date(timestamp);
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  };

  return new Intl.DateTimeFormat("en-US", options || defaultOptions).format(date);
}

/**
 * Calculate percentage change between two values
 */
export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return ((current - previous) / previous) * 100;
}

/**
 * Format percentage change with proper sign and color indication
 */
export function formatPercentageChange(
  current: number,
  previous: number
): {
  text: string;
  color: "green" | "red" | "gray";
} {
  const change = calculatePercentageChange(current, previous);
  const absChange = Math.abs(change);

  if (change > 0) {
    return {
      text: `+${absChange.toFixed(1)}%`,
      color: "green",
    };
  }
  if (change < 0) {
    return {
      text: `-${absChange.toFixed(1)}%`,
      color: "red",
    };
  }
  return {
    text: "0%",
    color: "gray",
  };
}

/**
 * Get chart color based on index
 */
export function getChartColor(index: number): string {
  const colors = [
    "#3B82F6", // blue
    "#10B981", // green
    "#F59E0B", // yellow
    "#EF4444", // red
    "#8B5CF6", // purple
    "#06B6D4", // cyan
    "#EC4899", // pink
    "#84CC16", // lime
    "#F97316", // orange
    "#6366F1", // indigo
  ];
  return colors[index % colors.length];
}

/**
 * Simple hash function for consistent color mapping
 */
export function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}
