# RotaDash – Dynatrace NOC Dashboard Rotator

A dedicated **NOC Dashboard Rotator** app built on the **Dynatrace AppEngine** using the **Strato Design System**. Designed specifically for Network Operations Centers (NOC), command centers, and multi-monitor wallboards to cycle continuously 24/7 ("for eternity") through Dynatrace Dashboards with zero manual intervention, automatic recovery, and uninterrupted session persistence.

---

## Key Features

- **24/7 Continuous "Eternal" Rotation**:
  - Once started, rotation runs indefinitely until an operator explicitly clicks **Stop Rotation**.
  - Built with an unthrottled background **Web Worker** timer thread that ticks faithfully every 1000ms, completely immune to Chromium background tab throttling.
  - Wall-clock timestamp scheduling guarantees zero time drift even if the machine sleeps or changes power states.

- **Dual Storage Scopes**:
  - **👤 My Personal Playlist**: Saved to your personal Dynatrace user profile (`UserAppState`). Ideal for individual monitoring setups and private playlists.
  - **👥 Shared NOC Playlist**: Tenant-wide shared state (`AppState`). Any team member or wallboard monitor in the tenant loads the exact same shared rotation playlist.

- **Active Session Keep-Alive Heartbeat (Every 30 Seconds)**:
  - Automated background heartbeat sends authenticated requests to Dynatrace's Document Service every 30 seconds.
  - Keeps OAuth bearer tokens refreshed and prevents Dynatrace SSO idle timeouts (which typically occur at the 4-hour mark).

- **Browser Tab Sleep & Discard Immunity**:
  - Employs a silent Web Audio stream that signals Chromium's process manager that the tab is actively streaming media, preventing Chrome and Edge Memory Saver from suspending or discarding the controller tab.
  - Requests the Screen Wake Lock API to prevent unattended wallboard monitors from going to sleep.

- **Automatic Presentation Recovery**:
  - If the presentation window is accidentally minimized, disconnected, or closed, the rotator automatically reconnects and re-opens the window on the next dashboard switch.

- **Interactive Presentation Controller**:
  - **Live Rotation Banner**: Real-time second-by-second countdown to the next dashboard transition.
  - **On-the-Fly Controls**: Pause (**Resume / Pause**), skip forward (**Next**), go back (**Previous**), bring window to front (**Focus Window**), and **Stop Rotation**.
  - **Popup Blocker Safeguard**: Automatic detection with a direct interactive link if your browser intercepts the presentation window.

- **Instant Dashboard Search & Filter**:
  - Automatically loads and sorts all accessible dashboards from the Dynatrace Document Service.
  - Live search filter input allows instant filtering by name or ID across hundreds of dashboards.

- **Native Dynatrace Theme Support**:
  - Automatically synchronizes with your Dynatrace Light and Dark theme preferences.
  - Built using Strato Design System tokens with high-contrast, WCAG AAA compliant colors for crystal-clear readability on wallboards and monitors.

---

## Display Modes & NOC Wallboard Setup

### Option 1: Dedicated Window (Recommended for Wallboards)
1. Select **Dedicated Window (Wallboard / Multi-Monitor)** in the controller.
2. Click **Start NOC Rotation**.
3. A clean, borderless standalone presentation window opens on your screen (`popup=yes`).
4. Drag the window to your target NOC wallboard or secondary monitor.
5. Click once into the window and press **`F11`** on your keyboard (or click the action menu `...` in the Dynatrace dashboard header and choose **Full screen**).
6. **Result:** 100% edge-to-edge hardware fullscreen.
   > **Note:** Modern browsers (Chrome, Edge) preserve F11 fullscreen across all dashboard transitions automatically. The display will rotate indefinitely without exiting full screen.

### Option 2: Dedicated Tab
1. Select **Dedicated Tab** in the controller.
2. Click **Start NOC Rotation**.
3. Opens and cycles inside a dedicated browser tab.
4. Press **`F11`** or click **Full screen** in the dashboard header for edge-to-edge display.

---

## Required Permissions & Scopes

The application requires the following OAuth scopes declared in `app.config.json`:

| Scope | Purpose |
| :--- | :--- |
| `document:documents:read` | Queries available tenant dashboards and performs keep-alive heartbeats. |
| `state:user-app-states:read` | Reads personal rotation configurations. |
| `state:user-app-states:write` | Saves personal rotation configurations. |
| `state:app-states:read` | Reads tenant-wide shared NOC configurations. |
| `state:app-states:write` | Saves tenant-wide shared NOC configurations. |

---

## Development & Deployment

### Prerequisites
- Node.js (v18+)
- Dynatrace App Toolkit (`dt-app`)

### Install Dependencies
```bash
npm install
```

### Start Local Development Server
Runs the development server with live reload against your target Dynatrace environment:
```bash
npm run start
```

### Build for Production
Compiles and bundles the application into the `dist/` directory:
```bash
npm run build
```

### Deploy to Dynatrace
Builds and deploys the app directly to your configured Dynatrace tenant:
```bash
npm run deploy
```

---

## Project Structure

```
rota-dash/
├── app.config.json           # Dynatrace app configuration, environment URL, and scopes
├── ui/
│   ├── app/
│   │   └── App.tsx           # Main NOC Rotator Controller, state management, and timers
│   ├── index.html            # Application entry HTML template
│   ├── main.tsx              # AppRoot and React DOM mount
│   └── tsconfig.json         # TypeScript configuration
├── package.json              # Scripts and dependencies
├── steps.md                  # Email-ready step-by-step user guide
├── CLIENT_GUIDE.md           # Client documentation
└── README.md                 # Technical project documentation
```

---

## License

Internal Dynatrace AppEngine Application. All rights reserved.
