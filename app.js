/**
 * ==============================================================================
 * VARSITY JERSEY CLAIM - PRODUCTION SCRIPT
 * ==============================================================================
 * 
 * STEP 2: Paste your deployed Google Apps Script Web App URL below!
 * Example: const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx.../exec";
 */
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxvpVyZ9JeYdeIsVUiAsT796s-9MCgNyrqbRWSwgWxFH3-IizOit0U_P100pRWBTnF_Cg/exec";

// Application State
let takenNumbers = new Set();
let isDeanMode = false;
let currentFilter = "all";
let isSubmitting = false;
let pollIntervalId = null;

// DOM Elements
const form = document.getElementById("jersey-form");
const nameInput = document.getElementById("student-name");
const numberInput = document.getElementById("jersey-number");
const sizeSelect = document.getElementById("jersey-size");
const numberStatus = document.getElementById("number-status");
const submitBtn = document.getElementById("btn-submit");
const btnText = document.getElementById("btn-text");
const btnSpinner = document.getElementById("btn-spinner");
const errorBox = document.getElementById("error-box");
const errorMessage = document.getElementById("error-message");
const numberGrid = document.getElementById("number-grid");
const countAvailable = document.getElementById("count-available");
const countTaken = document.getElementById("count-taken");
const connectionBanner = document.getElementById("connection-banner");
const connectionMessage = document.getElementById("connection-message");
const btnReconnect = document.getElementById("btn-reconnect");

// Dean Access Elements
const toggleDeanBtn = document.getElementById("toggle-dean-mode");
const deanBox = document.getElementById("dean-box");
const deanPasscodeInput = document.getElementById("dean-passcode");

// Jersey Preview Elements
const previewName = document.getElementById("jersey-preview-name");
const previewNumber = document.getElementById("jersey-preview-number");
const previewSize = document.getElementById("jersey-preview-size");

// Modal Elements
const successModal = document.getElementById("success-modal");
const receiptName = document.getElementById("receipt-name");
const receiptNumber = document.getElementById("receipt-number");
const receiptSize = document.getElementById("receipt-size");
const btnCloseModal = document.getElementById("btn-close-modal");
const confettiCanvas = document.getElementById("confetti-canvas");

// ==============================================================================
// INITIALIZATION & REAL-TIME AUTO-SYNC
// ==============================================================================

document.addEventListener("DOMContentLoaded", () => {
  initGrid();
  setupEventListeners();
  
  // Verify SCRIPT_URL configuration
  if (!isConfigured()) {
    showConnectionError("Cannot connect to server. Please set your Apps Script URL in app.js and refresh.");
    submitBtn.disabled = true;
    setNumberStatus("neutral", "Server not connected.");
    return;
  }

  // Initial load
  loadTakenNumbers(true);

  // Auto-refresh every 4 seconds for live sync across all devices
  pollIntervalId = setInterval(() => {
    loadTakenNumbers(false);
  }, 4000);

  // Refresh immediately when tab becomes visible or receives focus
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && isConfigured()) {
      loadTakenNumbers(false);
    }
  });

  window.addEventListener("focus", () => {
    if (isConfigured()) {
      loadTakenNumbers(false);
    }
  });
});

function isConfigured() {
  return SCRIPT_URL && 
         SCRIPT_URL !== "PASTE_YOUR_WEB_APP_URL_HERE" && 
         SCRIPT_URL.startsWith("https://script.google.com");
}

/**
 * Fetch taken numbers directly from Google Sheets
 * @param {boolean} isInitialLoad - true on first load to show status indicator
 */
async function loadTakenNumbers(isInitialLoad = false) {
  if (!isConfigured()) return;

  if (isInitialLoad) {
    setNumberStatus("loading", "Connecting to Google Sheet...");
  }

  try {
    const response = await fetch(`${SCRIPT_URL}?action=getTaken&_t=${Date.now()}`, {
      method: "GET",
      cache: "no-cache"
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.success && Array.isArray(data.takenNumbers)) {
      const freshTakenNumbers = new Set(data.takenNumbers.map(n => parseInt(n, 10)));
      
      // Check if user's currently typed number was taken by someone else in the background!
      const currentVal = parseInt(numberInput.value, 10);
      if (!isDeanMode && !isNaN(currentVal) && !takenNumbers.has(currentVal) && freshTakenNumbers.has(currentVal)) {
        showError(`Sorry, jersey number ${currentVal} was just taken by someone else. Please pick another number.`);
        numberInput.value = "";
        previewNumber.textContent = "--";
        setNumberStatus("taken", `✕ Jersey #${currentVal} was just claimed! Pick another.`);
      }

      takenNumbers = freshTakenNumbers;
      hideConnectionError();
      if (!isSubmitting) submitBtn.disabled = false;

      renderGrid();
      updateGridStats();

      if (isInitialLoad && !numberInput.value) {
        setNumberStatus("neutral", "Enter or pick a number to check availability");
      }
    } else {
      throw new Error(data.error || "Invalid response format from Google Apps Script");
    }
  } catch (err) {
    console.error("Auto-sync error:", err);
    if (isInitialLoad) {
      showConnectionError("Cannot connect to the server. Please refresh and try again.");
      submitBtn.disabled = true;
      setNumberStatus("neutral", "Cannot connect to server.");
    }
  }
}

// ==============================================================================
// 0-99 INTERACTIVE NUMBER GRID
// ==============================================================================

/**
 * Build 100 number buttons (0 to 99) in the grid
 */
function initGrid() {
  numberGrid.innerHTML = "";
  
  for (let i = 0; i <= 99; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "num-cell";
    btn.id = `num-cell-${i}`;
    btn.dataset.num = i;
    btn.textContent = i < 10 ? `0${i}` : `${i}`;
    btn.setAttribute("aria-label", `Jersey number ${i}`);

    btn.addEventListener("click", () => {
      if (isDeanMode) {
        exitDeanMode();
      }

      if (takenNumbers.has(i)) return; // Ignore if taken
      
      numberInput.value = i;
      numberInput.dispatchEvent(new Event("input", { bubbles: true }));
      
      // Smooth scroll to form on mobile devices
      if (window.innerWidth < 960) {
        form.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });

    numberGrid.appendChild(btn);
  }

  updateGridStats();
}

/**
 * Updates CSS classes for all 0-99 grid cells based on taken status and current selection
 */
function renderGrid() {
  const currentVal = parseInt(numberInput.value, 10);

  for (let i = 0; i <= 99; i++) {
    const cell = document.getElementById(`num-cell-${i}`);
    if (!cell) continue;

    const isTaken = takenNumbers.has(i);
    const isSelected = !isDeanMode && !isNaN(currentVal) && currentVal === i;

    // Reset classes
    cell.classList.remove("taken", "selected");

    if (isTaken) {
      cell.classList.add("taken");
      cell.setAttribute("aria-disabled", "true");
      cell.title = `Number ${i} is already claimed`;
    } else {
      cell.removeAttribute("aria-disabled");
      cell.title = `Click to select number ${i}`;
      if (isSelected) {
        cell.classList.add("selected");
      }
    }

    applyFilterToCell(cell, i, isTaken);
  }
}

function applyFilterToCell(cell, num, isTaken) {
  let visible = true;

  if (currentFilter === "free-only") {
    visible = !isTaken;
  } else if (currentFilter !== "all") {
    const [min, max] = currentFilter.split("-").map(Number);
    visible = num >= min && num <= max;
  }

  cell.style.display = visible ? "flex" : "none";
}

function updateGridStats() {
  // Count only 0-99 numbers for the student counter
  let takenInStudentRange = 0;
  for (let i = 0; i <= 99; i++) {
    if (takenNumbers.has(i)) takenInStudentRange++;
  }

  const freeCount = Math.max(0, 100 - takenInStudentRange);
  countAvailable.textContent = freeCount;
  countTaken.textContent = takenInStudentRange;
}

// ==============================================================================
// FORM INTERACTIONS & DEAN ACCESS
// ==============================================================================

function setupEventListeners() {
  // 1. Student Name Input
  nameInput.addEventListener("input", () => {
    const val = nameInput.value.trim();
    previewName.textContent = val ? val.toUpperCase() : "YOUR NAME";
    hideError();
  });

  // 2. Jersey Number Input
  numberInput.addEventListener("input", () => {
    validateCurrentNumberInput();
    hideError();
  });

  // 3. Size Dropdown
  sizeSelect.addEventListener("change", () => {
    const val = sizeSelect.value;
    previewSize.textContent = val ? `SIZE: ${val}` : "SIZE: --";
    hideError();
  });

  // 4. Dean Mode Toggle
  toggleDeanBtn.addEventListener("click", () => {
    if (isDeanMode) {
      exitDeanMode();
    } else {
      enterDeanMode();
    }
  });

  // 5. Grid Filter Buttons
  const filterBtns = document.querySelectorAll(".filter-btn");
  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      filterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.range;
      renderGrid();
    });
  });

  // 6. Form Submission
  form.addEventListener("submit", handleSubmit);

  // 7. Retry Reconnect Button
  if (btnReconnect) {
    btnReconnect.addEventListener("click", () => {
      loadTakenNumbers(true);
    });
  }

  // 8. Close Modal
  btnCloseModal.addEventListener("click", () => {
    successModal.style.display = "none";
    stopConfetti();
    form.reset();
    if (isDeanMode) exitDeanMode();
    previewName.textContent = "YOUR NAME";
    previewNumber.textContent = "--";
    previewSize.textContent = "SIZE: --";
    setNumberStatus("neutral", "Enter or pick a number to check availability");
    renderGrid();
    nameInput.focus();
  });
}

function enterDeanMode() {
  isDeanMode = true;
  deanBox.style.display = "block";
  toggleDeanBtn.innerHTML = "<span>✕ Cancel Dean Access</span>";
  numberInput.value = "333";
  numberInput.disabled = true;
  previewNumber.textContent = "333";
  previewNumber.classList.add("dean-number");
  
  if (takenNumbers.has(333)) {
    setNumberStatus("taken", "✕ Dean's #333 is ALREADY CLAIMED.");
  } else {
    setNumberStatus("available", "👑 Dean's reserved #333 selected. Enter passcode below.");
  }
  
  deanPasscodeInput.focus();
  renderGrid();
}

function exitDeanMode() {
  isDeanMode = false;
  deanBox.style.display = "none";
  toggleDeanBtn.innerHTML = "<span>🔒 Dean Access</span>";
  numberInput.disabled = false;
  numberInput.value = "";
  deanPasscodeInput.value = "";
  previewNumber.textContent = "--";
  previewNumber.classList.remove("dean-number");
  setNumberStatus("neutral", "Enter or pick a number to check availability");
  renderGrid();
}

/**
 * Real-time availability check for the entered number
 */
function validateCurrentNumberInput() {
  if (isDeanMode) return;

  const raw = numberInput.value.trim();

  if (raw === "") {
    previewNumber.textContent = "--";
    setNumberStatus("neutral", "Enter or pick a number to check availability");
    renderGrid();
    return;
  }

  const num = Number(raw);

  // Range and integer check
  if (!Number.isInteger(num) || num < 0 || num > 99) {
    previewNumber.textContent = "??";
    setNumberStatus("taken", "⚠ Number must be a whole number between 0 and 99");
    renderGrid();
    return;
  }

  // Update preview number badge
  previewNumber.textContent = num < 10 ? `0${num}` : `${num}`;

  // Check if taken
  if (takenNumbers.has(num)) {
    setNumberStatus("taken", `✕ Jersey #${num} is ALREADY TAKEN. Pick another.`);
  } else {
    setNumberStatus("available", `✓ Jersey #${num} is AVAILABLE!`);
  }

  renderGrid();
}

function setNumberStatus(state, message) {
  numberStatus.className = `number-status-badge status-${state}`;
  numberStatus.innerHTML = `<span>${escapeHtml(message)}</span>`;
}

// ==============================================================================
// FORM SUBMISSION (WITH SERVER-SIDE LOCKSERVICE VERIFICATION)
// ==============================================================================

async function handleSubmit(e) {
  e.preventDefault();
  hideError();

  if (!isConfigured()) {
    showError("Cannot connect to server. Please set your Apps Script URL in app.js and refresh.");
    return;
  }

  const name = nameInput.value.trim();
  const rawNumber = numberInput.value.trim();
  const size = sizeSelect.value;
  const deanPasscode = isDeanMode ? deanPasscodeInput.value.trim() : "";

  // 1. Client-Side Validations
  if (!name || name.length < 2) {
    showError("Please enter your full name (at least 2 letters).");
    nameInput.focus();
    return;
  }

  if (rawNumber === "") {
    showError("Please select or enter a jersey number (0–99).");
    numberInput.focus();
    return;
  }

  const number = Number(rawNumber);

  if (isDeanMode) {
    if (number !== 333) {
      showError("Dean access only applies to jersey number 333.");
      return;
    }
    if (!deanPasscode) {
      showError("Please enter the Dean Passcode.");
      deanPasscodeInput.focus();
      return;
    }
  } else {
    if (!Number.isInteger(number) || number < 0 || number > 99) {
      showError("Jersey number must be a whole number between 0 and 99.");
      numberInput.focus();
      return;
    }
    // Quick check against known taken list
    if (takenNumbers.has(number)) {
      showError(`Sorry, jersey number ${number} was just taken by someone else. Please pick another number.`);
      numberInput.focus();
      return;
    }
  }

  if (!size) {
    showError("Please select a jersey size (S, M, L, XL, XXL).");
    sizeSelect.focus();
    return;
  }

  // 2. Lock Submit Button to Prevent Duplicate Requests
  setSubmitting(true, `Securing Jersey #${number}...`);

  const payload = {
    name: name,
    number: number,
    size: size,
    deanPasscode: deanPasscode
  };

  try {
    /**
     * POST with text/plain payload avoids CORS preflight OPTIONS rejection
     * from Google Apps Script while safely passing the JSON string.
     */
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload),
      redirect: "follow"
    });

    const data = await response.json();

    if (data.success) {
      // Success! Update local state and show confirmation modal
      takenNumbers.add(number);
      renderGrid();
      updateGridStats();
      showSuccessModal(name, number, size);
    } else {
      // Server rejected (number taken or invalid dean code)
      const err = data.error || `Sorry, jersey number ${number} was just taken by someone else. Please pick another number.`;
      showError(err);
      
      // Immediately refresh taken list so the grid updates
      await loadTakenNumbers(false);
    }
  } catch (err) {
    console.error("Submission error:", err);
    
    // Fallback via GET if strict browser environment blocked POST redirect
    try {
      const fallbackUrl = `${SCRIPT_URL}?action=register&name=${encodeURIComponent(name)}&number=${encodeURIComponent(number)}&size=${encodeURIComponent(size)}&deanPasscode=${encodeURIComponent(deanPasscode)}&_t=${Date.now()}`;
      const fallbackRes = await fetch(fallbackUrl, { method: "GET", cache: "no-cache" });
      const fallbackData = await fallbackRes.json();
      
      if (fallbackData.success) {
        takenNumbers.add(number);
        renderGrid();
        updateGridStats();
        showSuccessModal(name, number, size);
        return;
      } else {
        showError(fallbackData.error || `Sorry, jersey number ${number} was just taken by someone else. Please pick another number.`);
        await loadTakenNumbers(false);
        return;
      }
    } catch (fallbackErr) {
      showError("Connection error while submitting. Please check your internet connection and try again.");
    }
  } finally {
    setSubmitting(false);
  }
}

function setSubmitting(loading, loadingText = "Submitting...") {
  isSubmitting = loading;
  submitBtn.disabled = loading;
  if (loading) {
    btnText.textContent = loadingText;
    btnSpinner.style.display = "inline-block";
  } else {
    btnText.textContent = "Confirm & Claim Jersey";
    btnSpinner.style.display = "none";
  }
}

function showError(msg) {
  errorMessage.textContent = msg;
  errorBox.style.display = "flex";
  errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
}

function hideError() {
  errorBox.style.display = "none";
}

function showConnectionError(msg) {
  connectionMessage.textContent = msg;
  connectionBanner.style.display = "flex";
}

function hideConnectionError() {
  connectionBanner.style.display = "none";
}

function showSuccessModal(name, number, size) {
  receiptName.textContent = name;
  receiptNumber.textContent = `#${number < 10 ? "0" + number : number}`;
  receiptSize.textContent = size;
  successModal.style.display = "flex";
  startConfetti();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ==============================================================================
// CONFETTI CELEBRATION (Lightweight, pure vanilla JS)
// ==============================================================================

let confettiAnimationId = null;
let confettiParticles = [];

function startConfetti() {
  const ctx = confettiCanvas.getContext("2d");
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;

  confettiParticles = [];
  const colors = ["#F59E0B", "#3B82F6", "#10B981", "#EF4444", "#FBBF24", "#60A5FA"];

  for (let i = 0; i < 90; i++) {
    confettiParticles.push({
      x: Math.random() * confettiCanvas.width,
      y: Math.random() * confettiCanvas.height - confettiCanvas.height,
      r: Math.random() * 6 + 4,
      d: Math.random() * 40 + 10,
      color: colors[Math.floor(Math.random() * colors.length)],
      tilt: Math.floor(Math.random() * 10) - 10,
      tiltAngleIncremental: (Math.random() * 0.07) + 0.05,
      tiltAngle: 0
    });
  }

  function draw() {
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

    for (let i = 0; i < confettiParticles.length; i++) {
      const p = confettiParticles[i];
      p.tiltAngle += p.tiltAngleIncremental;
      p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2;
      p.x += Math.sin(p.d);
      p.tilt = Math.sin(p.tiltAngle - (i / 3)) * 15;

      ctx.beginPath();
      ctx.lineWidth = p.r;
      ctx.strokeStyle = p.color;
      ctx.moveTo(p.x + p.tilt + (p.r / 2), p.y);
      ctx.lineTo(p.x + p.tilt, p.y + p.tilt + (p.r / 2));
      ctx.stroke();

      if (p.y > confettiCanvas.height) {
        confettiParticles[i].x = Math.random() * confettiCanvas.width;
        confettiParticles[i].y = -10;
      }
    }

    confettiAnimationId = requestAnimationFrame(draw);
  }

  draw();
  setTimeout(stopConfetti, 5000);
}

function stopConfetti() {
  if (confettiAnimationId) {
    cancelAnimationFrame(confettiAnimationId);
    confettiAnimationId = null;
  }
  const ctx = confettiCanvas.getContext("2d");
  if (ctx) ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
}

window.addEventListener("resize", () => {
  if (confettiCanvas) {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
  }
});
