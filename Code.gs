/**
 * PRODUCTION JERSEY REGISTRATION BACKEND (Google Apps Script)
 * 
 * Connected to Google Sheet:
 * https://docs.google.com/spreadsheets/d/1mZ-UqbEYoPnHcnhZjjFxC0i1QM8PYg72PILNAvykaRA/edit
 * Sheet ID: 1mZ-UqbEYoPnHcnhZjjFxC0i1QM8PYg72PILNAvykaRA
 * Tab Name: "Jerseys"
 * Columns: Timestamp | Student Name | Jersey Number | Size
 *
 * RULES ENFORCED ON THE SERVER:
 * 1. Each jersey number can be claimed only ONCE.
 * 2. Students can only select numbers 0 to 99.
 * 3. Number 333 is strictly reserved for the Dean, requiring a secret passcode
 *    stored in Apps Script Project Settings > Script Properties (key: DEAN_CODE).
 * 4. Uses LockService to process submissions one-at-a-time, eliminating race conditions.
 * 5. Returns only taken numbers to the public—NEVER exposes student names or sizes.
 *    Only the Sheet Owner can see who applied and what size they chose.
 */

// Target Google Sheet configuration
const SPREADSHEET_ID = "1mZ-UqbEYoPnHcnhZjjFxC0i1QM8PYg72PILNAvykaRA";
const SHEET_NAME = "Jerseys";
const HEADERS = ["Timestamp", "Student Name", "Jersey Number", "Size"];
const ALLOWED_SIZES = ["S", "M", "L", "XL", "XXL"];
const MIN_STUDENT_NUMBER = 0;
const MAX_STUDENT_NUMBER = 99;
const DEAN_RESERVED_NUMBER = 333;
const DEAN_PROPERTY_KEY = "DEAN_CODE";

/**
 * Access the target spreadsheet directly by its unique ID,
 * with fallback to the active spreadsheet if opened from Extensions menu.
 */
function getSpreadsheet() {
  if (SPREADSHEET_ID && SPREADSHEET_ID.trim() !== "") {
    try {
      return SpreadsheetApp.openById(SPREADSHEET_ID.trim());
    } catch (err) {
      // Fallback if openById fails in certain container permissions
    }
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Access or initialize the "Jerseys" sheet tab with required headers.
 */
function getOrCreateSheet() {
  const ss = getSpreadsheet();
  if (!ss) {
    throw new Error("Could not find the target Google Sheet. Please check spreadsheet permissions or SPREADSHEET_ID.");
  }
  
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  
  return sheet;
}

/**
 * Retrieve all currently registered jersey numbers.
 * PRIVACY: Only numbers are returned. No student names or sizes are ever exposed.
 */
function getTakenNumbersList(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return [];
  }
  
  // Column 3 is "Jersey Number" (1-indexed)
  const values = sheet.getRange(2, 3, lastRow - 1, 1).getValues();
  const taken = [];
  
  for (let i = 0; i < values.length; i++) {
    const val = values[i][0];
    if (val !== "" && val !== null && !isNaN(val)) {
      taken.push(parseInt(val, 10));
    }
  }
  
  return [...new Set(taken)].sort((a, b) => a - b);
}

/**
 * Helper to build JSON responses.
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * GET Handler:
 * Publicly returns array of taken numbers for real-time live synchronization.
 */
function doGet(e) {
  try {
    const sheet = getOrCreateSheet();
    const action = e && e.parameter && e.parameter.action ? e.parameter.action : "getTaken";
    
    if (action === "register") {
      return handleRegistration({
        name: e.parameter.name,
        number: e.parameter.number,
        size: e.parameter.size,
        deanPasscode: e.parameter.deanPasscode
      });
    }
    
    const takenNumbers = getTakenNumbersList(sheet);
    return createJsonResponse({
      success: true,
      takenNumbers: takenNumbers
    });
  } catch (error) {
    return createJsonResponse({
      success: false,
      error: "Failed to read taken numbers: " + error.toString()
    });
  }
}

/**
 * POST Handler:
 * Receives JSON payload with name, number, size, and optional deanPasscode.
 */
function doPost(e) {
  try {
    let payload = {};
    
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (err) {
        payload = e.parameter || {};
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }
    
    return handleRegistration(payload);
  } catch (error) {
    return createJsonResponse({
      success: false,
      error: "Unexpected server error: " + error.toString()
    });
  }
}

/**
 * Process a registration with server-side validation and LockService.
 */
function handleRegistration(payload) {
  const rawName = payload.name ? String(payload.name).trim() : "";
  const rawNumber = payload.number !== undefined && payload.number !== null ? String(payload.number).trim() : "";
  const rawSize = payload.size ? String(payload.size).trim().toUpperCase() : "";
  const deanPasscode = payload.deanPasscode ? String(payload.deanPasscode).trim() : "";
  
  // 1. Validate Student Name
  if (!rawName) {
    return createJsonResponse({
      success: false,
      error: "Please enter your full name."
    });
  }
  
  if (rawName.length < 2) {
    return createJsonResponse({
      success: false,
      error: "Name must be at least 2 characters long."
    });
  }
  
  // 2. Validate Jersey Number
  if (rawNumber === "" || isNaN(rawNumber)) {
    return createJsonResponse({
      success: false,
      error: "Jersey number is required."
    });
  }
  
  const jerseyNumber = parseInt(rawNumber, 10);
  
  // 3. Special Rule: Dean's Reserved Number 333
  if (jerseyNumber === DEAN_RESERVED_NUMBER) {
    const scriptProperties = PropertiesService.getScriptProperties();
    const configuredDeanCode = scriptProperties.getProperty(DEAN_PROPERTY_KEY);
    
    if (!configuredDeanCode) {
      return createJsonResponse({
        success: false,
        error: "Dean passcode has not been configured in Apps Script Project Settings yet."
      });
    }
    
    if (!deanPasscode || deanPasscode !== configuredDeanCode.trim()) {
      return createJsonResponse({
        success: false,
        error: "Invalid Dean Passcode. Jersey number 333 is strictly reserved for the Dean."
      });
    }
  } else {
    // Normal students must be between 0 and 99
    if (jerseyNumber < MIN_STUDENT_NUMBER || jerseyNumber > MAX_STUDENT_NUMBER) {
      return createJsonResponse({
        success: false,
        error: "Students can choose jersey numbers between 0 and 99 only."
      });
    }
  }
  
  // 4. Validate Size
  if (!ALLOWED_SIZES.includes(rawSize)) {
    return createJsonResponse({
      success: false,
      error: "Please select a valid size (" + ALLOWED_SIZES.join(", ") + ")."
    });
  }
  
  // 5. Concurrency Control with LockService (First Come, First Served)
  const lock = LockService.getScriptLock();
  const acquired = lock.tryLock(30000); // Wait up to 30 seconds
  
  if (!acquired) {
    return createJsonResponse({
      success: false,
      error: "The server is currently busy processing another request. Please try again in a moment."
    });
  }
  
  try {
    const sheet = getOrCreateSheet();
    const takenNumbers = getTakenNumbersList(sheet);
    
    // Check if number was already claimed
    if (takenNumbers.includes(jerseyNumber)) {
      return createJsonResponse({
        success: false,
        error: "Sorry, jersey number " + jerseyNumber + " was just taken by someone else. Please pick another number."
      });
    }
    
    // Append row
    const timestamp = new Date();
    sheet.appendRow([timestamp, rawName, jerseyNumber, rawSize]);
    
    // Commit write immediately
    SpreadsheetApp.flush();
    
    return createJsonResponse({
      success: true,
      message: "Jersey number " + jerseyNumber + " claimed successfully!",
      data: {
        name: rawName,
        number: jerseyNumber,
        size: rawSize,
        timestamp: timestamp.toISOString()
      }
    });
  } catch (err) {
    return createJsonResponse({
      success: false,
      error: "Could not complete registration: " + err.toString()
    });
  } finally {
    // Always release lock
    lock.releaseLock();
  }
}
