/**
 * Company Name Normalization Utilities
 * Shared logic for standardizing company names to prevent duplicates in reports
 *
 * This matches the logic in src/lib/companyNameUtils.ts
 */

/**
 * Normalize a company name for duplicate detection
 * Removes punctuation, whitespace, and common suffixes
 *
 * @param name - Raw company name
 * @returns Normalized lowercase string
 *
 * @example
 * normalizeCompanyName("Superdry PLC") // "superdry"
 * normalizeCompanyName("TESCO Stores Limited") // "tesco stores"
 * normalizeCompanyName("Next P.L.C.") // "next"
 */
export function normalizeCompanyName(name: string): string {
  if (!name) return '';

  return name
    .toLowerCase()
    .trim()
    // Remove all punctuation and special chars
    .replace(/[^\w\s]/g, ' ')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    // Remove common company suffixes (case insensitive)
    .replace(/\b(ltd|limited|plc|llc|inc|incorporated|corp|corporation|co|group|holdings?|international|stores?|supermarkets?|retail|com)\b/gi, '')
    // Remove extra spaces again
    .replace(/\s+/g, ' ')
    .trim();
}
