# How to Use Dynatrace NOC Dashboard Rotator (Step-by-Step Guide)

> **Subject:** Step-by-Step Guide: How to Use the Dynatrace NOC Dashboard Rotator (24/7 Continuous Operation)

---

Hi Team,

Here is a simple, step-by-step guide on how to set up and run the **Dynatrace NOC Dashboard Rotator** on your monitors or wallboard displays for continuous 24/7 operation.

---

### Step 1: Open the App in Dynatrace
1. Log into your **Dynatrace** environment.
2. Open the **Apps** launcher from the left-hand navigation sidebar.
3. Click on **RotaDash** (NOC Dashboard Rotator).

---

### Step 2: Choose Your Playlist Scope
Choose where your rotation playlist is stored:
- Click **👤 My Personal Playlist** if you want a private list saved only to your user account.
- Click **👥 Shared NOC Playlist** if you are setting up a shared list for a team wallboard so everyone sees the same rotation.

---

### Step 3: Add Dashboards and Set Display Times
1. *(Optional)* Type into the **Filter Dashboards Dropdown** box to quickly find dashboards (e.g., type *Production*, *Host*, or *K8s*).
2. Click the dropdown menu and select the dashboard you want to show.
3. In the **sec** box, enter how many seconds you want that dashboard to stay on screen (e.g., `30` or `60`).
4. Click **+ Add Dashboard** to add the next dashboard in your playlist.
5. Repeat until all desired dashboards are in your playlist.

---

### Step 4: Save Your Configuration
Click the **Save Configuration** button at the bottom.
- A confirmation message (`Saved to your personal Dynatrace profile` or `Saved to shared team AppState`) will appear.
- Your playlist is now safely saved and will be remembered every time you open the app.

---

### Step 5: Start the Rotation in Fullscreen Mode
1. Under **Presentation Mode**, keep **Dedicated Window (Wallboard / Multi-Monitor)** selected.
2. Click **Start NOC Rotation**. A clean presentation window will open.
3. Drag the presentation window onto your NOC wallboard, TV, or second monitor.
4. Click once inside that window and press **`F11`** on your keyboard (or click `...` > **Full screen** in Dynatrace).
5. **Done!** The window is now in 100% full screen and will continuously cycle through your dashboards.
   > **Tip:** You only need to press `F11` once. The browser automatically keeps the window in full screen across all dashboard transitions.

---

### Step 6: Continuous 24/7 Run Mode & Live Controller
While the rotation is running on your wallboard, your main controller tab stays open and active:
- **Continuous 24/7 Operation:** The rotator is engineered to run indefinitely ("for eternity"). It will never stop automatically; it only stops when an operator explicitly clicks the **Stop Rotation** button.
- **View Timer:** See a real-time countdown showing seconds left until the next dashboard switch.
- **Pause / Resume:** Click **Pause** to freeze rotation on a dashboard during an active incident, and click **Resume** when done.
- **Skip or Go Back:** Use **Previous** and **Next** to switch dashboards manually.
- **Focus Window:** Bring the wallboard window back to the front if it ever gets hidden.
- **Stop:** Click **Stop Rotation** whenever you want to end the session.

---

### 24/7 Reliability Features (Why it never stops or logs out):
1. **Unthrottled Background Web Worker:** Browsers normally throttle background tabs after a few minutes. RotaDash uses an independent background Web Worker thread that ticks every 1000ms uninterrupted 24/7.
2. **Active 30-Second SSO Keep-Alive:** An automated heartbeat communicates with the Dynatrace API Gateway every 30 seconds. This refreshes your Dynatrace login credentials continuously so sessions never expire.
3. **Browser Tab Sleep Immunity:** Background anti-sleep guards prevent Chrome and Edge Memory Saver from sleeping or discarding the controller tab.
4. **Automatic Reconnection:** If someone accidentally minimizes or closes the presentation window, the rotator automatically detects it and re-opens the window on the next dashboard switch.

---

### Tips for Best Wallboard Results:
- **Keep the Controller Tab Open:** Leave the RotaDash controller tab open in the background on the primary screen. The presentation window runs on your wallboard monitor.
- **Allow Popups:** If the presentation window does not open initially, click the address bar icon, select **Always allow popups from this site**, and click the banner link in RotaDash.

---

Please reach out if you have any questions or need assistance!
