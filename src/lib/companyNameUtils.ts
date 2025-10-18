/**
 * Company Name Normalization & Matching Utilities
 * 
 * These functions handle "smart" company name matching to prevent duplicates
 * Example: "Superdry PLC" = "SUPERDRY" = "Superdry Ltd" = "super-dry limited"
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
    .replace(/\b(ltd|limited|plc|llc|inc|incorporated|corp|corporation|co|group|holdings?|international)\b/gi, '')
    // Remove extra spaces again
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate Levenshtein distance between two strings
 * (number of single-character edits needed to change one word into another)
 * 
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Edit distance (0 = identical)
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[len1][len2];
}

/**
 * Check if two company names are similar enough to be considered the same
 * Uses multiple strategies: exact match, fuzzy match, substring match
 * 
 * @param name1 - First company name
 * @param name2 - Second company name
 * @returns true if companies are likely the same
 * 
 * @example
 * isSimilarCompany("Superdry PLC", "Superdry Limited") // true
 * isSimilarCompany("TESCO", "Tesco Stores") // true
 * isSimilarCompany("ASDA", "Sainsburys") // false
 */
export function isSimilarCompany(name1: string, name2: string): boolean {
  if (!name1 || !name2) return false;
  
  const n1 = normalizeCompanyName(name1);
  const n2 = normalizeCompanyName(name2);
  
  // Exact match after normalization
  if (n1 === n2) return true;
  
  // One is substring of the other (handles "Tesco" vs "Tesco Stores")
  if (n1.includes(n2) || n2.includes(n1)) return true;
  
  // Fuzzy match: allow up to 2 character differences for typos
  // (but only if strings are reasonably long to avoid false positives)
  if (n1.length >= 4 && n2.length >= 4) {
    const distance = levenshteinDistance(n1, n2);
    const maxDistance = Math.max(2, Math.floor(Math.min(n1.length, n2.length) * 0.15)); // 15% tolerance
    if (distance <= maxDistance) return true;
  }
  
  return false;
}

/**
 * Find the best matching company name from a list
 * 
 * @param targetName - Company name to match
 * @param candidateNames - List of potential matches
 * @returns Best matching name or null if no good match
 * 
 * @example
 * findBestMatch("Superdry", ["SUPERDRY PLC", "Supermarket Ltd", "Next PLC"]) 
 * // returns "SUPERDRY PLC"
 */
export function findBestMatch(targetName: string, candidateNames: string[]): string | null {
  const normalized = normalizeCompanyName(targetName);
  
  for (const candidate of candidateNames) {
    if (isSimilarCompany(normalized, candidate)) {
      return candidate;
    }
  }
  
  return null;
}

/**
 * Extract key words from company name for search
 * Removes common words and keeps meaningful terms
 * 
 * @param name - Company name
 * @returns Array of search keywords
 * 
 * @example
 * extractSearchKeywords("Tesco Stores Limited") // ["tesco", "stores"]
 * extractSearchKeywords("M&S Food") // ["m&s", "food"]
 */
export function extractSearchKeywords(name: string): string[] {
  const commonWords = new Set([
    'the', 'and', 'or', 'of', 'in', 'for', 'to', 'a', 'an',
    'ltd', 'limited', 'plc', 'llc', 'inc', 'corp', 'co', 'group'
  ]);
  
  return normalizeCompanyName(name)
    .split(' ')
    .filter(word => word.length > 1 && !commonWords.has(word));
}

/**
 * Calculate similarity score between two company names (0-1)
 * Higher score = more similar
 * 
 * @param name1 - First company name
 * @param name2 - Second company name
 * @returns Similarity score from 0 (completely different) to 1 (identical)
 */
export function calculateNameSimilarity(name1: string, name2: string): number {
  const n1 = normalizeCompanyName(name1);
  const n2 = normalizeCompanyName(name2);
  
  // Exact match
  if (n1 === n2) return 1.0;
  
  // Substring match
  if (n1.includes(n2) || n2.includes(n1)) {
    const shorter = Math.min(n1.length, n2.length);
    const longer = Math.max(n1.length, n2.length);
    return shorter / longer; // e.g., "tesco" in "tesco stores" = 5/12 = 0.83
  }
  
  // Levenshtein-based similarity
  const distance = levenshteinDistance(n1, n2);
  const maxLength = Math.max(n1.length, n2.length);
  return Math.max(0, 1 - (distance / maxLength));
}
