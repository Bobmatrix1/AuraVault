# 🌌 AuraVault — Secure Team Cloud & Credential Bank

AuraVault is a state-of-the-art, dark glassmorphic digital headquarters designed for teams to securely save company credentials, manage social media profiles, and store PDF documents or images directly in Google Drive. 

Built with **React 19**, **TypeScript**, **Vite**, and **HTML5 IndexedDB**, it features a fully integrated **Web Audio API program-synthesized sound bank** and is optimized to run client-side with maximum efficiency.

---

## ✨ Features

### 🔒 1. Vault Dial Passcode Gate
* **Mechanical Lock Screen**: Protects sensitive assets on initial entry. Features a circular steel dial that physically rotates $35^\circ$ on keypad clicks.
* **Horizontal Sliding Doors**: Validating the passcode spins the dial $720^\circ$ and splits the steel doors, sliding them left and right to reveal the workspace.
* **Immediate Locking on Refresh**: Auth state is kept strictly in-memory; refreshing the browser or closing the tab instantly re-locks the vault.
* **Safe Configuration**: The passcode is stored in a local `.env` configuration file, which is automatically registered in `.gitignore` to prevent secret leaks to public repositories.

### 🎵 2. High-Fidelity Synthesized Audio (UX Sound)
AuraVault generates high-quality sound effects in real time using the browser's native **Web Audio API** (zero downloaded audio files, zero latency, and $0\text{ MB}$ asset footprint):
* **Key Click**: Short high-frequency sine oscillator with white-noise filter contact clicks.
* **Clear Button**: Spring-like linear pitch drop sweep.
* **Access Denied**: Double detuned sawtooth oscillators at low frequencies simulating a security buzzer.
* **Access Granted**: Upward C-Major arpeggio chime ($C_5 \rightarrow E_5 \rightarrow G_5 \rightarrow C_6$).
* **Door Release Swoosh**: Low-frequency rumble combined with bandpass-filtered noise sweeps to simulate pneumatic air escaping from the vault door.
* **Clipboard Copy Indicator**: Short soft $880\text{Hz}$ sine beep.
* **Save/Upload Complete**: Bubble-like pop frequency sweep.

### ☁️ 3. Direct Google Drive Sync (Multi-Drive)
Instead of bloat-saving heavy Base64 files in the browser database, AuraVault connects directly to your cloud storage:
* **Metadata-Only DB**: Your local IndexedDB only stores file sizes, creation dates, Google File IDs, and the owner's email.
* **Direct Streaming**: Uploads bypass local databases, sending binaries straight to Google Drive. Previews and downloads stream the binary on-demand as a temporary Object URL.
* **Multi-Drive Scaling**: Link multiple Google accounts. Set one as your **Active Target** for uploads. If one drive gets full, simply link another drive and set it active. Files owned by the previous account remain downloadable as the app tracks which drive holds which file.
* **Quota Meters**: Dedicated storage gauges show what space is left on each connected drive.
* **Sync Deletions**: Deleting a file in AuraVault automatically calls the Google Drive REST API to delete it on the cloud, saving storage space.

### 🔑 4. Secure Credential Bank & Social Handles
* **Structured Vaults**: Organize databases, server SSH keys, social handle credentials, and financial systems.
* **Security Audits**: Real-time password strength meters and an integrated random password generator.
* **Team Assignments**: Assign specific roles (Admin Owner, Ad Campaign Manager, Content Editor, Team Viewer) to social accounts so everyone knows the DRI (Direct Responsible Individual) for each profile.

---

## 🛠️ Tech Stack
* **Framework**: React 19, TypeScript
* **Build Tool**: Vite 8
* **Styling**: Vanilla CSS (Custom Glassmorphism, Responsive CSS Grid, custom keyframes)
* **Local Database**: IndexedDB (via wrapper)
* **API Client**: Native fetch with Google Drive REST v3 Endpoints
* **Audio Synthesis**: Web Audio API (Oscillators, BiquadFilters, GainNode)
* **Icons**: Lucide React

---

## 🚀 Getting Started

### 1. Installation
Clone the repository, go into the directory, and install dependencies:
```bash
git clone https://github.com/Bobmatrix1/AuraVault.git
cd AuraVault
npm install
```

### 2. Configure Passcode
Create a `.env` file in the root directory (this is already ignored in `.gitignore`):
```env
VITE_VAULT_PASSWORD=2025
```
*(If `.env` is omitted, the app will default to passcode `2025` for local verification).*

### 3. Run Locally
Start the development server:
```bash
npm run dev
```
Open [http://localhost:5173/](http://localhost:5173/) in your web browser.

### 4. Build for Production
To compile and bundle assets for hosting:
```bash
npm run build
```
This generates optimized static assets inside the `/dist` directory.

---

## 🌐 Connecting Real Google Drives
To connect actual team Google Drives, configure a Google Cloud Platform (GCP) project:
1. Go to the [Google Cloud Console](https://console.cloud.google.com).
2. Create a project and search for **Google Drive API**, then click **Enable**.
3. Under **OAuth Consent Screen**, configure User Type and add the scope:
   `https://www.googleapis.com/auth/drive.appdata` *(Allows AuraVault to save files inside a private app folder, hidden from standard Drive views so they aren't accidentally deleted).*
4. Under **Credentials**, create an **API Key** and an **OAuth Client ID (Web Application)**. Add `http://localhost:5173` as an **Authorized JavaScript Origin**.
5. Save these keys in the **Google Drive Sync** config panel inside AuraVault and click **Link Google OAuth**!
