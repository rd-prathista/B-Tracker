/**
 * Global Shared Formatting Helpers for B Tracker
 * Designed to reduce code duplication and keep screen rendering clean and maintainable.
 */

/**
 * Format a number/amount into a localized string with exactly two decimal places.
 * Example: 1250.5 -> "1,250.50"
 * @param {number|string} value - The input value to format
 * @returns {string} - Localized decimal string
 */
export const fmt = (value) => {
  return parseFloat(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * Format an ISO date string into a clean user-friendly list date representation.
 * Example: "2026-05-17T..." -> "17 May 26"
 * @param {string} str - ISO date string
 * @returns {string} - Formatted clean string
 */
export const fmtDate = (str) => {
  if (!str) return '---';
  const d = new Date(str);
  if (isNaN(d.getTime())) return '---';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
};

/**
 * Format a Date object or ISO string into a full readable date for modal fields.
 * Example: Date object -> "17 May 2026"
 * @param {Date|string} d - Date target
 * @returns {string} - Formatted modal date
 */
export const formatModalDate = (d) => {
  if (!d) return '---';
  const date = new Date(d);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

/**
 * Extract the localized Month and Year text from a date representation.
 * Example: "2026-05-17" -> "May 2026"
 * @param {string|Date} d - Date representation
 * @returns {string} - Month and Year label
 */
export const getMonthLabel = (d) => {
  if (!d) return '---';
  return new Date(d).toLocaleString('default', { month: 'long', year: 'numeric' });
};
