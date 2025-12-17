/**
 * Fuzzy Search Utilities for OFAC Name Matching
 * Implements Jaro-Winkler similarity algorithm for name comparison
 */

/**
 * Calculate Jaro similarity between two strings
 * @param {string} s1 - First string
 * @param {string} s2 - Second string
 * @returns {number} - Similarity score between 0 and 1
 */
function jaroSimilarity(s1, s2) {
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;

  const str1 = s1.toLowerCase();
  const str2 = s2.toLowerCase();

  const len1 = str1.length;
  const len2 = str2.length;

  // Maximum distance for matching characters
  const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;

  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Find matching characters
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, len2);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || str1[i] !== str2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  // Count transpositions
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (str1[i] !== str2[k]) transpositions++;
    k++;
  }

  return (
    (matches / len1 +
      matches / len2 +
      (matches - transpositions / 2) / matches) /
    3
  );
}

/**
 * Calculate Jaro-Winkler similarity between two strings
 * Gives higher scores to strings that match from the beginning
 * @param {string} s1 - First string
 * @param {string} s2 - Second string
 * @param {number} p - Scaling factor (default 0.1, max 0.25)
 * @returns {number} - Similarity score between 0 and 1
 */
export function jaroWinkler(s1, s2, p = 0.1) {
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;

  const jaroScore = jaroSimilarity(s1, s2);

  // Calculate common prefix (up to 4 characters)
  const str1 = s1.toLowerCase();
  const str2 = s2.toLowerCase();
  let prefix = 0;
  const maxPrefix = Math.min(4, Math.min(str1.length, str2.length));

  for (let i = 0; i < maxPrefix; i++) {
    if (str1[i] === str2[i]) {
      prefix++;
    } else {
      break;
    }
  }

  return jaroScore + prefix * p * (1 - jaroScore);
}

/**
 * Normalize a name for comparison
 * Removes special characters, extra spaces, and converts to lowercase
 * @param {string} name - Name to normalize
 * @returns {string} - Normalized name
 */
export function normalizeName(name) {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Calculate similarity between two full names
 * Handles first/middle/last name variations
 * @param {Object} searchName - Object with firstName, middleName, lastName
 * @param {Object} sdnName - Object with firstName, middleName, lastName
 * @returns {number} - Combined similarity score (0-100)
 */
export function calculateNameSimilarity(searchName, sdnName) {
  const normalizedSearch = {
    first: normalizeName(searchName.firstName),
    middle: normalizeName(searchName.middleName),
    last: normalizeName(searchName.lastName),
  };

  const normalizedSDN = {
    first: normalizeName(sdnName.firstName),
    middle: normalizeName(sdnName.middleName),
    last: normalizeName(sdnName.lastName),
  };

  // Calculate individual name part scores
  let lastScore = 0;
  let firstScore = 0;
  let middleScore = 0;

  // Last name is most important
  if (normalizedSearch.last && normalizedSDN.last) {
    lastScore = jaroWinkler(normalizedSearch.last, normalizedSDN.last);
  }

  // First name
  if (normalizedSearch.first && normalizedSDN.first) {
    firstScore = jaroWinkler(normalizedSearch.first, normalizedSDN.first);
  }

  // Middle name (if provided)
  if (normalizedSearch.middle && normalizedSDN.middle) {
    middleScore = jaroWinkler(normalizedSearch.middle, normalizedSDN.middle);
  } else if (!normalizedSearch.middle || !normalizedSDN.middle) {
    // If either doesn't have middle name, don't penalize
    middleScore = null;
  }

  // Calculate weighted average
  // Last name: 50%, First name: 35%, Middle name: 15%
  let totalWeight = 0;
  let weightedScore = 0;

  if (normalizedSearch.last) {
    weightedScore += lastScore * 0.5;
    totalWeight += 0.5;
  }

  if (normalizedSearch.first) {
    weightedScore += firstScore * 0.35;
    totalWeight += 0.35;
  }

  if (middleScore !== null) {
    weightedScore += middleScore * 0.15;
    totalWeight += 0.15;
  }

  // Normalize the score
  const finalScore = totalWeight > 0 ? (weightedScore / totalWeight) * 100 : 0;
  return Math.round(finalScore);
}

/**
 * Check if a date of birth matches
 * @param {string} searchDOB - Search DOB (format: YYYY-MM-DD or similar)
 * @param {string} sdnDOB - SDN entry DOB
 * @returns {boolean} - True if dates match
 */
export function matchDOB(searchDOB, sdnDOB) {
  if (!searchDOB || !sdnDOB) return false;

  // Extract just the numbers for comparison
  const searchNums = searchDOB.replace(/\D/g, "");
  const sdnNums = sdnDOB.replace(/\D/g, "");

  // Try direct match
  if (searchNums === sdnNums) return true;

  // Parse dates for comparison
  try {
    const search = new Date(searchDOB);
    const sdn = new Date(sdnDOB);

    if (isNaN(search.getTime()) || isNaN(sdn.getTime())) return false;

    return (
      search.getFullYear() === sdn.getFullYear() &&
      search.getMonth() === sdn.getMonth() &&
      search.getDate() === sdn.getDate()
    );
  } catch {
    return false;
  }
}

/**
 * Calculate address similarity
 * @param {Object} searchAddr - Search address object
 * @param {Object} sdnAddr - SDN entry address object
 * @returns {number} - Similarity score (0-100)
 */
export function calculateAddressSimilarity(searchAddr, sdnAddr) {
  if (!searchAddr || !sdnAddr) return 0;

  let totalScore = 0;
  let fields = 0;

  // Country match (most important)
  if (searchAddr.country && sdnAddr.country) {
    const countryScore = jaroWinkler(
      normalizeName(searchAddr.country),
      normalizeName(sdnAddr.country)
    );
    totalScore += countryScore * 40;
    fields++;
  }

  // State match
  if (searchAddr.state && sdnAddr.state) {
    const stateScore = jaroWinkler(
      normalizeName(searchAddr.state),
      normalizeName(sdnAddr.state)
    );
    totalScore += stateScore * 20;
    fields++;
  }

  // City match
  if (searchAddr.city && sdnAddr.city) {
    const cityScore = jaroWinkler(
      normalizeName(searchAddr.city),
      normalizeName(sdnAddr.city)
    );
    totalScore += cityScore * 25;
    fields++;
  }

  // Street address match
  if (searchAddr.address && sdnAddr.address) {
    const streetScore = jaroWinkler(
      normalizeName(searchAddr.address),
      normalizeName(sdnAddr.address)
    );
    totalScore += streetScore * 15;
    fields++;
  }

  return fields > 0 ? Math.round(totalScore) : 0;
}

/**
 * Calculate overall match score between search and SDN entry
 * @param {Object} searchParams - All search parameters
 * @param {Object} sdnEntry - SDN entry to compare against
 * @returns {Object} - Match result with score and details
 */
export function calculateMatchScore(searchParams, sdnEntry) {
  const result = {
    score: 0,
    nameScore: 0,
    dobMatch: false,
    addressScore: 0,
    idMatch: false,
    details: [],
  };

  // Name similarity (primary factor)
  result.nameScore = calculateNameSimilarity(
    {
      firstName: searchParams.firstName,
      middleName: searchParams.middleName,
      lastName: searchParams.lastName,
    },
    {
      firstName: sdnEntry.firstName,
      middleName: sdnEntry.middleName,
      lastName: sdnEntry.lastName,
    }
  );

  // DOB match (strong indicator)
  if (searchParams.dob) {
    result.dobMatch = matchDOB(searchParams.dob, sdnEntry.dob);
    if (result.dobMatch) {
      result.details.push("Date of birth matches");
    }
  }

  // Address similarity
  if (searchParams.country || searchParams.city || searchParams.state) {
    result.addressScore = calculateAddressSimilarity(
      {
        address: searchParams.address,
        city: searchParams.city,
        state: searchParams.state,
        country: searchParams.country,
      },
      {
        address: sdnEntry.address,
        city: sdnEntry.city,
        state: sdnEntry.state,
        country: sdnEntry.country,
      }
    );
  }

  // ID number match
  if (searchParams.idNumber && sdnEntry.ids) {
    const normalizedSearchId = searchParams.idNumber.replace(/\D/g, "");
    for (const id of sdnEntry.ids) {
      const normalizedSdnId = id.number?.replace(/\D/g, "") || "";
      if (normalizedSearchId === normalizedSdnId) {
        result.idMatch = true;
        result.details.push(`ID number matches (${id.type})`);
        break;
      }
    }
  }

  // Calculate overall score
  // Name: 60%, DOB: 20%, Address: 15%, ID: 5%
  let overallScore = result.nameScore * 0.6;

  if (result.dobMatch) {
    overallScore += 20;
  }

  overallScore += result.addressScore * 0.15;

  if (result.idMatch) {
    overallScore += 5;
  }

  result.score = Math.min(100, Math.round(overallScore));

  return result;
}

/**
 * Search SDN entries for matches
 * @param {Object} searchParams - Search parameters
 * @param {Array} sdnEntries - SDN entries to search
 * @param {number} threshold - Minimum score threshold (default 85)
 * @returns {Array} - Matching entries with scores
 */
export function searchSDN(searchParams, sdnEntries, threshold = 85) {
  const matches = [];

  for (const entry of sdnEntries) {
    const matchResult = calculateMatchScore(searchParams, entry);

    if (matchResult.score >= threshold) {
      matches.push({
        entry,
        ...matchResult,
      });
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);

  return matches;
}
