/**
 * OFAC Compliance Search Chrome Extension
 * Main Popup JavaScript
 */

import { searchSDN, calculateNameSimilarity } from "./utils/fuzzy-search.js";
import {
  initDB,
  getAllSDNEntries,
  saveSearchHistory,
  getSearchHistory,
  clearSearchHistory,
  getSetting,
  getSDNCount,
} from "./utils/storage.js";

// DOM Elements
const elements = {
  // Form elements
  searchForm: document.getElementById("searchForm"),
  firstName: document.getElementById("firstName"),
  middleName: document.getElementById("middleName"),
  lastName: document.getElementById("lastName"),
  dob: document.getElementById("dob"),
  idNumber: document.getElementById("idNumber"),
  address: document.getElementById("address"),
  city: document.getElementById("city"),
  state: document.getElementById("state"),
  country: document.getElementById("country"),
  searchType: document.getElementById("searchType"),
  searchBtn: document.getElementById("searchBtn"),

  // Toggle
  toggleAdvanced: document.getElementById("toggleAdvanced"),
  advancedFields: document.getElementById("advancedFields"),

  // Status
  dataStatus: document.getElementById("dataStatus"),
  statusIndicator: document.getElementById("statusIndicator"),
  statusText: document.getElementById("statusText"),

  // Results
  resultsSection: document.getElementById("resultsSection"),
  resultsContent: document.getElementById("resultsContent"),
  clearResults: document.getElementById("clearResults"),

  // Loading
  loadingOverlay: document.getElementById("loadingOverlay"),

  // History
  historySection: document.getElementById("historySection"),
  historyList: document.getElementById("historyList"),
  clearHistory: document.getElementById("clearHistory"),

  // Footer
  updateDataBtn: document.getElementById("updateDataBtn"),
  entryCount: document.getElementById("entryCount"),
  lastUpdate: document.getElementById("lastUpdate"),

  // Print template elements
  certStatus: document.getElementById("certStatus"),
  certName: document.getElementById("certName"),
  certDOB: document.getElementById("certDOB"),
  certAddress: document.getElementById("certAddress"),
  certID: document.getElementById("certID"),
  certTimestamp: document.getElementById("certTimestamp"),
  certListDate: document.getElementById("certListDate"),
  certEntryCount: document.getElementById("certEntryCount"),
  certRefId: document.getElementById("certRefId"),

  // Clear form button
  clearFormBtn: document.getElementById("clearFormBtn"),
};

// Constants
const FORM_CACHE_KEY = "ofac_form_data";
const FORM_CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

// State
let sdnEntries = [];
let currentSearchResult = null;

/**
 * Initialize the popup
 */
async function init() {
  try {
    await initDB();
    await loadDataStatus();
    await loadHistory();
    loadCachedFormData(); // Restore form data if cached
    setupEventListeners();
  } catch (error) {
    console.error("Failed to initialize:", error);
    showStatus("error", "Failed to load");
  }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Form submission
  elements.searchForm.addEventListener("submit", handleSearch);

  // Advanced fields toggle
  elements.toggleAdvanced.addEventListener("click", toggleAdvancedFields);

  // Clear buttons
  elements.clearResults.addEventListener("click", clearResults);
  elements.clearHistory.addEventListener("click", handleClearHistory);
  elements.clearFormBtn.addEventListener("click", handleClearForm);

  // Update data button
  elements.updateDataBtn.addEventListener("click", handleUpdateData);

  // Auto-save form data on input
  const formInputs = elements.searchForm.querySelectorAll("input, select");
  formInputs.forEach((input) => {
    input.addEventListener("input", saveFormDataToCache);
    input.addEventListener("change", saveFormDataToCache);
  });

  // Event delegation for dynamically created print button
  elements.resultsContent.addEventListener("click", (e) => {
    if (e.target.closest("#printCertBtn")) {
      printCertificate();
    }
  });
}

/**
 * Toggle advanced search fields
 */
function toggleAdvancedFields() {
  elements.advancedFields.classList.toggle("show");
  elements.toggleAdvanced.classList.toggle("active");
}

/**
 * Load and display data status
 */
async function loadDataStatus() {
  try {
    // Try to get status from background script
    const response = await chrome.runtime.sendMessage({
      action: "getDataStatus",
    });

    if (response && response.success) {
      updateStatusDisplay(response);

      // Load SDN entries if available
      if (response.entryCount > 0) {
        await loadSDNEntries();
      } else if (response.needsUpdate) {
        showStatus("updating", "Downloading data...");
        await handleUpdateData();
      }
    } else {
      showStatus("error", "Data unavailable");
    }
  } catch (error) {
    console.error("Failed to load data status:", error);
    showStatus("error", "Connection error");
  }
}

/**
 * Load SDN entries from storage
 */
async function loadSDNEntries() {
  try {
    sdnEntries = await getAllSDNEntries();
    console.log(`Loaded ${sdnEntries.length} SDN entries`);

    if (sdnEntries.length > 0) {
      showStatus("ready", `${sdnEntries.length.toLocaleString()} entries`);
    }
  } catch (error) {
    console.error("Failed to load SDN entries:", error);
  }
}

/**
 * Update status display
 */
function updateStatusDisplay(status) {
  elements.entryCount.textContent = (status.entryCount || 0).toLocaleString();

  if (status.lastUpdate) {
    const date = new Date(status.lastUpdate);
    elements.lastUpdate.textContent = formatDate(date);
  } else {
    elements.lastUpdate.textContent = "Never";
  }

  if (status.updateStatus === "complete" && status.entryCount > 0) {
    showStatus("ready", `${status.entryCount.toLocaleString()} entries`);
  } else if (status.updateStatus === "downloading") {
    showStatus("updating", "Updating...");
  } else if (status.updateStatus === "error") {
    showStatus("error", "Update failed");
  }
}

/**
 * Show status indicator
 */
function showStatus(type, text) {
  elements.statusIndicator.className = "status-indicator " + type;
  elements.statusText.textContent = text;
}

/**
 * Format date for display
 */
function formatDate(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Handle search form submission
 */
async function handleSearch(e) {
  e.preventDefault();

  // Get form values - Simple First/Middle/Last format
  const firstName = elements.firstName.value.trim();
  const middleName = elements.middleName.value.trim();
  const lastName = elements.lastName.value.trim();

  const searchParams = {
    firstName: firstName,
    middleName: middleName,
    lastName: lastName,
    dob: elements.dob.value,
    idNumber: elements.idNumber.value.trim(),
    address: elements.address.value.trim(),
    city: elements.city.value.trim(),
    state: elements.state.value.trim(),
    country: elements.country.value.trim(),
    type: elements.searchType.value,
  };

  // Validate - Need at least first or last name
  if (!firstName && !lastName) {
    alert("Please enter at least a first name or last name to search.");
    return;
  }

  // Show loading
  showLoading(true);
  elements.searchBtn.disabled = true;

  try {
    // Ensure entries are loaded
    if (sdnEntries.length === 0) {
      await loadSDNEntries();
    }

    if (sdnEntries.length === 0) {
      throw new Error("No SDN data available. Please update data first.");
    }

    // Filter by type if specified
    let entriesToSearch = sdnEntries;
    if (searchParams.type && searchParams.type !== "all") {
      entriesToSearch = sdnEntries.filter((e) => e.type === searchParams.type);
    }

    // Perform search
    const matches = searchSDN(searchParams, entriesToSearch, 85);

    // Display results
    displayResults(searchParams, matches);

    // Save to history
    await saveSearchHistory({
      searchParams,
      result: matches.length > 0 ? "POTENTIAL_MATCH" : "PASSED",
      matchCount: matches.length,
    });

    // Refresh history display
    await loadHistory();
  } catch (error) {
    console.error("Search error:", error);
    alert("Search failed: " + error.message);
  } finally {
    showLoading(false);
    elements.searchBtn.disabled = false;
  }
}

/**
 * Display search results
 */
function displayResults(searchParams, matches) {
  elements.resultsSection.classList.add("show");

  const fullName = [
    searchParams.firstName,
    searchParams.middleName,
    searchParams.lastName,
  ]
    .filter(Boolean)
    .join(" ");

  const fullAddress = [
    searchParams.address,
    searchParams.city,
    searchParams.state,
    searchParams.country,
  ]
    .filter(Boolean)
    .join(", ");

  // Store for printing
  currentSearchResult = {
    searchParams,
    matches,
    fullName,
    fullAddress,
    timestamp: new Date(),
  };

  if (matches.length === 0) {
    // PASSED - No matches found
    elements.resultsContent.innerHTML = `
      <div class="result-card passed fade-in">
        <div class="result-status passed">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <span class="result-status-text">NO MATCH FOUND - CLEARED</span>
        </div>
        <div class="result-details">
          <p><strong>Name Searched:</strong> ${escapeHtml(fullName)}</p>
          ${
            searchParams.dob
              ? `<p><strong>DOB:</strong> ${searchParams.dob}</p>`
              : ""
          }
          ${
            fullAddress
              ? `<p><strong>Address:</strong> ${escapeHtml(fullAddress)}</p>`
              : ""
          }
          ${
            searchParams.idNumber
              ? `<p><strong>ID:</strong> ${escapeHtml(
                  searchParams.idNumber
                )}</p>`
              : ""
          }
          <p><strong>Entries Searched:</strong> ${sdnEntries.length.toLocaleString()}</p>
          <p><strong>Search Time:</strong> ${formatDateTime(new Date())}</p>
        </div>
        <div class="result-actions">
          <button type="button" class="print-btn" id="printCertBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 6 2 18 2 18 9"/>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            Print Certificate
          </button>
        </div>
      </div>
    `;
  } else {
    // POTENTIAL MATCHES found
    const matchHtml = matches
      .map(
        (match) => `
      <div class="match-entry">
        <div class="match-entry-header">
          <span class="match-entry-name">${escapeHtml(
            match.entry.fullName || "Unknown"
          )}</span>
          <span class="match-score">${match.score}% Match</span>
        </div>
        <div class="match-entry-details">
          <span><strong>Type:</strong> ${match.entry.type || "N/A"}</span>
          <span><strong>DOB:</strong> ${match.entry.dob || "N/A"}</span>
          <span><strong>Programs:</strong> ${
            match.entry.programs?.join(", ") || "N/A"
          }</span>
          <span><strong>Country:</strong> ${match.entry.country || "N/A"}</span>
        </div>
        ${
          match.details.length > 0
            ? `
          <div class="match-entry-details" style="margin-top: 8px;">
            <span><strong>Match Details:</strong> ${match.details.join(
              "; "
            )}</span>
          </div>
        `
            : ""
        }
      </div>
    `
      )
      .join("");

    elements.resultsContent.innerHTML = `
      <div class="result-card match fade-in">
        <div class="result-status match">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span class="result-status-text">POTENTIAL MATCH FOUND (${
            matches.length
          })</span>
        </div>
        <div class="result-details">
          <p><strong>Name Searched:</strong> ${escapeHtml(fullName)}</p>
          <p style="color: var(--warning); margin-top: 8px;">
            ⚠️ Review required. Contact OFAC hotline if match is confirmed: <strong>1-800-540-6322</strong>
          </p>
        </div>
        ${matchHtml}
      </div>
    `;
  }
}

/**
 * Clear results
 */
function clearResults() {
  elements.resultsSection.classList.remove("show");
  elements.resultsContent.innerHTML = "";
  currentSearchResult = null;
}

/**
 * Load search history
 */
async function loadHistory() {
  try {
    const history = await getSearchHistory(5);

    if (history.length === 0) {
      elements.historyList.innerHTML = `
        <div class="history-empty">No recent searches</div>
      `;
      return;
    }

    elements.historyList.innerHTML = history
      .map((item) => {
        const name =
          [item.searchParams.firstName, item.searchParams.lastName]
            .filter(Boolean)
            .join(" ") || "Unknown";

        const date = new Date(item.timestamp);
        const isPassed = item.result === "PASSED";

        return `
        <div class="history-item" data-search='${escapeAttr(
          JSON.stringify(item.searchParams)
        )}'>
          <div class="history-item-info">
            <span class="history-item-name">${escapeHtml(name)}</span>
            <span class="history-item-date">${formatDateTime(date)}</span>
          </div>
          <div class="history-item-status ${isPassed ? "passed" : "match"}">
            ${
              isPassed
                ? `
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              Passed
            `
                : `
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Match
            `
            }
          </div>
        </div>
      `;
      })
      .join("");

    // Add click handlers to history items
    elements.historyList.querySelectorAll(".history-item").forEach((item) => {
      item.addEventListener("click", () => {
        const searchParams = JSON.parse(item.dataset.search);
        fillFormFromHistory(searchParams);
      });
    });
  } catch (error) {
    console.error("Failed to load history:", error);
  }
}

/**
 * Fill form from history item
 */
function fillFormFromHistory(searchParams) {
  elements.firstName.value = searchParams.firstName || "";
  elements.middleName.value = searchParams.middleName || "";
  elements.lastName.value = searchParams.lastName || "";
  elements.dob.value = searchParams.dob || "";
  elements.idNumber.value = searchParams.idNumber || "";
  elements.address.value = searchParams.address || "";
  elements.city.value = searchParams.city || "";
  elements.state.value = searchParams.state || "";
  elements.country.value = searchParams.country || "";
  elements.searchType.value = searchParams.type || "all";

  // Show advanced fields if any are filled
  if (
    searchParams.dob ||
    searchParams.idNumber ||
    searchParams.address ||
    searchParams.city ||
    searchParams.state ||
    searchParams.country
  ) {
    elements.advancedFields.classList.add("show");
    elements.toggleAdvanced.classList.add("active");
  }
}

/**
 * Handle clear history
 */
async function handleClearHistory() {
  if (confirm("Clear all search history?")) {
    await clearSearchHistory();
    await loadHistory();
  }
}

/**
 * Handle update data
 */
async function handleUpdateData() {
  showStatus("updating", "Updating...");
  elements.updateDataBtn.disabled = true;

  try {
    const response = await chrome.runtime.sendMessage({
      action: "forceUpdate",
    });

    if (response && response.success) {
      await loadSDNEntries();
      showStatus("ready", `${sdnEntries.length.toLocaleString()} entries`);
      elements.lastUpdate.textContent = "Just now";
      elements.entryCount.textContent = sdnEntries.length.toLocaleString();
    } else {
      throw new Error(response?.error || "Update failed");
    }
  } catch (error) {
    console.error("Update failed:", error);
    showStatus("error", "Update failed");
    alert("Failed to update data: " + error.message);
  } finally {
    elements.updateDataBtn.disabled = false;
  }
}

/**
 * Show/hide loading overlay
 */
function showLoading(show) {
  if (show) {
    elements.loadingOverlay.classList.add("show");
  } else {
    elements.loadingOverlay.classList.remove("show");
  }
}

/**
 * Print certificate - opens in new window for proper printing
 */
function printCertificate() {
  if (!currentSearchResult) {
    alert("No search result to print.");
    return;
  }

  const { searchParams, fullName, fullAddress, timestamp } =
    currentSearchResult;

  const refId = generateRefId();
  const searchTime = formatDateTime(timestamp);
  const listDate =
    elements.lastUpdate?.textContent || new Date().toLocaleDateString();
  const entryCount = sdnEntries.length.toLocaleString();

  // Create certificate HTML
  const certificateHTML = `
<!DOCTYPE html>
<html>
<head>
  <title>OFAC Compliance Certificate - ${refId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: Georgia, serif; 
      background: #f5f5f5; 
      padding: 20px;
    }
    .certificate {
      max-width: 700px;
      margin: 0 auto;
      padding: 40px;
      background: white;
      border: 3px solid #1a1a1a;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    }
    .cert-header {
      text-align: center;
      padding-bottom: 20px;
      margin-bottom: 25px;
      border-bottom: 3px solid #1a1a1a;
    }
    .cert-header h1 {
      font-size: 22px;
      letter-spacing: 3px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .cert-header p {
      color: #666;
      font-size: 14px;
    }
    .cert-status {
      text-align: center;
      padding: 20px;
      margin: 20px 0;
      background: #d4edda;
      border: 2px solid #28a745;
      border-radius: 8px;
    }
    .cert-status span {
      font-size: 20px;
      font-weight: 700;
      color: #155724;
    }
    .cert-section {
      margin: 25px 0;
    }
    .cert-section h2 {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 1px solid #ddd;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    td {
      padding: 10px 0;
      border-bottom: 1px solid #eee;
      font-size: 14px;
    }
    td.label {
      font-weight: 600;
      width: 40%;
      color: #333;
    }
    td.value {
      color: #1a1a1a;
    }
    .cert-footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 2px solid #1a1a1a;
      text-align: center;
      font-size: 11px;
      color: #666;
    }
    .ref-id {
      font-family: monospace;
      font-size: 12px;
      background: #f0f0f0;
      padding: 5px 10px;
      display: inline-block;
      margin-top: 10px;
    }
    @media print {
      body { background: white; padding: 0; }
      .certificate { border: none; box-shadow: none; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="cert-header">
      <h1>OFAC COMPLIANCE CERTIFICATE</h1>
      <p>Specially Designated Nationals (SDN) Screening Report</p>
    </div>
    
    <div class="cert-status">
      <span>✓ NO MATCH FOUND - CLEARED</span>
    </div>
    
    <div class="cert-section">
      <h2>Customer Information Searched</h2>
      <table>
        <tr><td class="label">Full Name:</td><td class="value">${
          fullName || "N/A"
        }</td></tr>
        <tr><td class="label">Date of Birth:</td><td class="value">${
          searchParams.dob || "Not provided"
        }</td></tr>
        <tr><td class="label">Address:</td><td class="value">${
          fullAddress || "Not provided"
        }</td></tr>
        <tr><td class="label">ID Number:</td><td class="value">${
          searchParams.idNumber || "Not provided"
        }</td></tr>
      </table>
    </div>
    
    <div class="cert-section">
      <h2>Search Details</h2>
      <table>
        <tr><td class="label">Search Date/Time:</td><td class="value">${searchTime}</td></tr>
        <tr><td class="label">SDN List Date:</td><td class="value">${listDate}</td></tr>
        <tr><td class="label">Entries Searched:</td><td class="value">${entryCount}</td></tr>
        <tr><td class="label">Reference ID:</td><td class="value">${refId}</td></tr>
      </table>
    </div>
    
    <div class="cert-footer">
      <p>This certificate confirms that the individual named above was screened against the U.S. Department of the Treasury's</p>
      <p>Office of Foreign Assets Control (OFAC) Specially Designated Nationals (SDN) List and no matches were found.</p>
      <p style="margin-top: 15px;">Generated by OFAC Compliance Search Extension</p>
      <div class="ref-id">${refId}</div>
    </div>
  </div>
  
  <div class="no-print" style="text-align: center; margin-top: 20px;">
    <button id="printBtn" style="padding: 12px 30px; font-size: 16px; cursor: pointer; background: #28a745; color: white; border: none; border-radius: 6px;">
      🖨️ Print Certificate
    </button>
    <p style="margin-top: 10px; color: #666; font-size: 12px;">Or press Ctrl+P / Cmd+P to print</p>
  </div>
  
  <script>
    document.getElementById('printBtn').addEventListener('click', function() {
      window.print();
    });
    // Auto-print after page loads
    window.onload = function() {
      setTimeout(function() { window.print(); }, 500);
    };
  </script>
</body>
</html>`;

  // Open in new window
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(certificateHTML);
    printWindow.document.close();
  } else {
    alert("Please allow popups to print the certificate.");
  }
}

/**
 * Generate reference ID
 */
function generateRefId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `OFAC-${timestamp}-${random}`;
}

/**
 * Format date and time
 */
function formatDateTime(date) {
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Escape attribute value
 */
function escapeAttr(text) {
  return text.replace(/'/g, "&#39;").replace(/"/g, "&quot;");
}

/**
 * Save form data to cache (localStorage with timestamp)
 */
function saveFormDataToCache() {
  const formData = {
    firstName: elements.firstName.value,
    middleName: elements.middleName.value,
    lastName: elements.lastName.value,
    dob: elements.dob.value,
    idNumber: elements.idNumber.value,
    address: elements.address.value,
    city: elements.city.value,
    state: elements.state.value,
    country: elements.country.value,
    searchType: elements.searchType.value,
    timestamp: Date.now(),
  };

  localStorage.setItem(FORM_CACHE_KEY, JSON.stringify(formData));
}

/**
 * Load cached form data (if not expired)
 */
function loadCachedFormData() {
  try {
    const cached = localStorage.getItem(FORM_CACHE_KEY);
    if (!cached) return;

    const formData = JSON.parse(cached);

    // Check if cache is expired (older than 10 minutes)
    if (Date.now() - formData.timestamp > FORM_CACHE_DURATION_MS) {
      localStorage.removeItem(FORM_CACHE_KEY);
      return;
    }

    // Restore form data
    elements.firstName.value = formData.firstName || "";
    elements.middleName.value = formData.middleName || "";
    elements.lastName.value = formData.lastName || "";
    elements.dob.value = formData.dob || "";
    elements.idNumber.value = formData.idNumber || "";
    elements.address.value = formData.address || "";
    elements.city.value = formData.city || "";
    elements.state.value = formData.state || "";
    elements.country.value = formData.country || "";
    elements.searchType.value = formData.searchType || "all";

    // Show advanced fields if any were filled
    if (
      formData.dob ||
      formData.idNumber ||
      formData.address ||
      formData.city ||
      formData.state ||
      formData.country
    ) {
      elements.advancedFields.classList.add("show");
      elements.toggleAdvanced.classList.add("active");
    }

    console.log("Restored cached form data");
  } catch (error) {
    console.warn("Failed to load cached form data:", error);
  }
}

/**
 * Clear form and remove cache
 */
function handleClearForm() {
  // Clear all form inputs
  elements.firstName.value = "";
  elements.middleName.value = "";
  elements.lastName.value = "";
  elements.dob.value = "";
  elements.idNumber.value = "";
  elements.address.value = "";
  elements.city.value = "";
  elements.state.value = "";
  elements.country.value = "";
  elements.searchType.value = "all";

  // Hide advanced fields
  elements.advancedFields.classList.remove("show");
  elements.toggleAdvanced.classList.remove("active");

  // Remove cache
  localStorage.removeItem(FORM_CACHE_KEY);

  // Focus first field
  elements.firstName.focus();
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", init);
