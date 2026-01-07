/**
 * Timezone Utilities for UTC+7 (WIB - Waktu Indonesia Barat)
 * All date operations should use these functions to ensure consistent timezone handling
 */

/**
 * Get current date/time in WIB (UTC+7)
 * @returns {Date} Current date in WIB timezone
 */
export function getNowInWIB() {
  return new Date();
}

/**
 * Convert a date to WIB string format
 * @param {Date} date - The date to format
 * @returns {string} Formatted date string in WIB
 */
export function formatDateInWIB(date) {
  const options = {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  };
  return new Intl.DateTimeFormat("id-ID", options).format(date);
}

/**
 * Get WIB timestamp
 * @returns {number} Current timestamp in milliseconds
 */
export function getWIBTimestamp() {
  return Date.now();
}

/**
 * Get date offset for WIB (UTC+7)
 * @returns {number} Offset in milliseconds (7 hours)
 */
export function getWIBOffset() {
  return 7 * 60 * 60 * 1000; // 7 hours in milliseconds
}
