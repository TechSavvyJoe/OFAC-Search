/**
 * OFAC Search Chrome Extension - Background Service Worker
 * Handles automatic SDN data updates and extension lifecycle events
 */

import { downloadAndParseSDN, needsUpdate } from "./utils/ofac-data.js";
import {
  initDB,
  storeSDNEntries,
  clearSDNEntries,
  saveSetting,
  getSetting,
  getSDNCount,
} from "./utils/storage.js";

// Constants
const UPDATE_ALARM_NAME = "ofac-sdn-update";
const UPDATE_INTERVAL_HOURS = 24;

/**
 * Initialize the extension on first install
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log("OFAC Search Extension installed/updated:", details.reason);

  if (details.reason === "install") {
    // First time install - download SDN data
    await initializeSDNData();
  } else if (details.reason === "update") {
    // Check if data needs refresh after update
    await checkAndUpdateSDNData();
  }

  // Set up periodic update alarm
  await setupUpdateAlarm();
});

/**
 * Handle extension startup
 */
chrome.runtime.onStartup.addListener(async () => {
  console.log("OFAC Search Extension started");
  await checkAndUpdateSDNData();
  await setupUpdateAlarm();
});

/**
 * Handle alarm events for periodic updates
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === UPDATE_ALARM_NAME) {
    console.log("Running scheduled SDN data update");
    await checkAndUpdateSDNData();
  }
});

/**
 * Handle messages from popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getDataStatus") {
    handleGetDataStatus().then(sendResponse);
    return true; // Keep channel open for async response
  }

  if (message.action === "forceUpdate") {
    handleForceUpdate().then(sendResponse);
    return true;
  }

  if (message.action === "getSDNEntries") {
    handleGetSDNEntries().then(sendResponse);
    return true;
  }
});

/**
 * Set up the periodic update alarm
 */
async function setupUpdateAlarm() {
  // Clear any existing alarm
  await chrome.alarms.clear(UPDATE_ALARM_NAME);

  // Create new alarm for periodic updates (every 24 hours)
  chrome.alarms.create(UPDATE_ALARM_NAME, {
    delayInMinutes: UPDATE_INTERVAL_HOURS * 60,
    periodInMinutes: UPDATE_INTERVAL_HOURS * 60,
  });

  console.log(`Update alarm set for every ${UPDATE_INTERVAL_HOURS} hours`);
}

/**
 * Initialize SDN data on first install
 */
async function initializeSDNData() {
  try {
    await initDB();
    await saveSetting("updateStatus", "downloading");
    await saveSetting("lastError", null);

    console.log("Downloading SDN data from Treasury.gov...");
    const result = await downloadAndParseSDN();

    // Store entries
    await clearSDNEntries();
    await storeSDNEntries(result.entries);

    // Save metadata
    await saveSetting("lastUpdate", result.downloadedAt);
    await saveSetting("publishDate", result.publishDate);
    await saveSetting("entryCount", result.count);
    await saveSetting("updateStatus", "complete");

    console.log(`SDN data initialized: ${result.count} entries`);

    return { success: true, count: result.count };
  } catch (error) {
    console.error("Failed to initialize SDN data:", error);
    await saveSetting("updateStatus", "error");
    await saveSetting("lastError", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Check if data needs updating and perform update if necessary
 */
async function checkAndUpdateSDNData() {
  try {
    await initDB();
    const lastUpdate = await getSetting("lastUpdate");
    const count = await getSDNCount();

    // Check if we need to update
    if (!needsUpdate(lastUpdate) && count > 0) {
      console.log("SDN data is up to date");
      return { success: true, updated: false };
    }

    // Perform update
    return await performSDNUpdate();
  } catch (error) {
    console.error("Error checking SDN data:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Perform the actual SDN data update
 */
async function performSDNUpdate() {
  try {
    await saveSetting("updateStatus", "downloading");
    await saveSetting("lastError", null);

    console.log("Downloading SDN data from Treasury.gov...");
    const result = await downloadAndParseSDN();

    // Clear old entries and store new ones
    await clearSDNEntries();
    await storeSDNEntries(result.entries);

    // Save metadata
    await saveSetting("lastUpdate", result.downloadedAt);
    await saveSetting("publishDate", result.publishDate);
    await saveSetting("entryCount", result.count);
    await saveSetting("updateStatus", "complete");

    console.log(`SDN data updated: ${result.count} entries`);

    return { success: true, updated: true, count: result.count };
  } catch (error) {
    console.error("Failed to update SDN data:", error);
    await saveSetting("updateStatus", "error");
    await saveSetting("lastError", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Handle request for data status from popup
 */
async function handleGetDataStatus() {
  try {
    await initDB();
    const lastUpdate = await getSetting("lastUpdate");
    const publishDate = await getSetting("publishDate");
    const entryCount =
      (await getSetting("entryCount")) || (await getSDNCount());
    const updateStatus = await getSetting("updateStatus");
    const lastError = await getSetting("lastError");

    return {
      success: true,
      lastUpdate,
      publishDate,
      entryCount,
      updateStatus,
      lastError,
      needsUpdate: needsUpdate(lastUpdate) || entryCount === 0,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Handle force update request from popup
 */
async function handleForceUpdate() {
  return await performSDNUpdate();
}

/**
 * Handle request for SDN entries from popup
 */
async function handleGetSDNEntries() {
  try {
    await initDB();
    const { getAllSDNEntries } = await import("./utils/storage.js");
    const entries = await getAllSDNEntries();
    return { success: true, entries };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
