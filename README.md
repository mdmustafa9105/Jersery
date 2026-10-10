# 🎽 Official Jersey Claim System

A mobile-friendly, production web application where students can reserve their jersey number (0–99) and size. Connected directly to your Google Sheet with **real-time auto-synchronization** and **server-side concurrency locking** via Google Apps Script's `LockService` to guarantee that **each jersey number can only be claimed once**.

---

## 📁 Project Structure

```
Jersey/
├── Code.gs       # Google Apps Script backend code (paste into Google Sheets)
├── index.html    # Production website with live 0-99 grid and Dean access
├── style.css     # Fast, mobile-first athletic dark-mode design system
├── app.js        # Production frontend logic with 4-second auto-sync
├── package.json  # Vite build & local dev configuration
├── vercel.json   # Vercel deployment configuration
└── README.md     # Setup & deployment guide
```

---

## 🚀 Live Production Setup Guide

### Step 1: Set Up Your Google Sheet

1. Open your sheet:  
   👉 [https://docs.google.com/spreadsheets/d/1mZ-UqbEYoPnHcnhZjjFxC0i1QM8PYg72PILNAvykaRA/edit](https://docs.google.com/spreadsheets/d/1mZ-UqbEYoPnHcnhZjjFxC0i1QM8PYg72PILNAvykaRA/edit)
3. Name the sheet tab at the bottom:
   ```text
   Jerseys
   ```
   *(Case-sensitive; must be `Jerseys`)*.
4. In **Row 1** (the header row), type:
   - **A1:** `Timestamp`
   - **B1:** `Student Name`
   - **C1:** `Jersey Number`
   - **D1:** `Size`

---

### Step 2: Paste the Apps Script Backend

1. In your Google Sheet, click **Extensions** > **Apps Script**.
2. Delete any existing placeholder code in the editor.
3. Open [Code.gs](file:///d:/Jersey/Code.gs), copy everything, and paste it into the Apps Script editor.
4. Click the **Save** icon (floppy disk) or press `Ctrl + S`.

---

### Step 3: Set Your Secret Dean Passcode (for #333)

Number `333` is strictly reserved for the Dean. The secret passcode is stored securely in your Google account (never in the website code):
1. In the Apps Script left sidebar, click the **Gear icon** (⚙️ *Project Settings*).
2. Scroll down to **Script Properties** and click **Add script property**.
3. Under **Property**, enter:
   ```text
   DEAN_CODE
   ```
4. Under **Value**, enter your desired secret passcode (for example: `Dean2026!`).
5. Click **Save script properties**.

---

### Step 4: Deploy (or Update) the Web App

1. In the top-right corner of Apps Script, click the blue **Deploy** button > **New deployment** (or **Manage deployments** > **Edit** > **New version** if already deployed).
2. Click the gear icon (⚙️) next to *Select type* and pick **Web app**.
3. Set the fields:
   - **Description:** `Jersey Claim API`
   - **Execute as:** `Me (your email)`
   - **Who has access:** `Anyone` *(Crucial: Allows the website to verify taken numbers without students needing a Google login)*
4. Click **Deploy**.
5. When prompted, click **Authorize access**, select your account, click **Advanced**, and then click **Go to Untitled project (unsafe)** > **Allow**.
6. Copy the **Web app URL** (ending with `/exec`):
   ```text
   https://script.google.com/macros/s/AKfycbx.../exec
   ```

---

### Step 5: Connect Your Website

1. Open [app.js](file:///d:/Jersey/app.js) in this folder.
2. At line 8, replace the placeholder:
   ```javascript
   const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx.../exec";
   ```
3. Save the file.

---

### Step 6: Test Locally

Run the dev server in PowerShell:
```bash
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

**Real Test:**
1. Register `Vikrant` with jersey number `12` and size `L`.
2. Click **Confirm & Claim Jersey**.
3. Confirmation modal appears, and a new row is added to your Google Sheet!
4. Open the website in an incognito window or on your phone:
   - Within 4 seconds (or on reload), number `12` will automatically show as **crossed out and unclickable** for everyone!
5. If another student tries to submit number `12`, the server rejects it with:
   > *"Sorry, jersey number 12 was just taken by someone else. Please pick another number."*

---

### Step 7: Deploy on Vercel

#### Method A: GitHub to Vercel (Automatic updates on push)
1. Push your `Jersey` folder to your GitHub account:
   ```bash
   git init
   git add .
   git commit -m "Production jersey claim app"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```
2. Go to [vercel.com](https://vercel.com) > **Add New...** > **Project** > Import your repository.
3. Click **Deploy**. Vercel will build and publish your site with a live `.vercel.app` URL.

#### Method B: Vercel CLI (Direct from terminal)
```bash
npx vercel --prod
```
Log in, accept the defaults, and Vercel will deploy immediately!
