# Privacy Policy

**Last updated:** September 2026

Your privacy is a fundamental principle in the design of **Otofy**. This Privacy Policy explains how the Otofy desktop application handles information and data when you use the Software.

---

### 1. No Personal Data Collection
- **No Account Required:** Otofy does not require user registration, email addresses, passwords, or personal credentials.
- **No Remote Telemetry:** Otofy does not maintain remote tracking servers, analytics endpoints, or advertising SDKs. We do not track your IP address, browsing behavior, or hardware identifiers.

---

### 2. Local Storage Architecture
All your personalized settings and playback records stay exclusively on your local machine:
- **Playlists & Favorites:** Stored locally in your client database (IndexedDB).
- **Listening History:** Stored in a local database on your device (up to 50 recent records) and can be cleared by you at any time.
- **Application Preferences:** Theme choices, volume levels, and interface layouts are preserved strictly in local client storage.

---

### 3. Third-Party Interactions
When fetching media streams, search results, or metadata, your client communicates directly with third-party providers:
- **YouTube Music & SoundCloud:** Search queries and audio stream requests are sent directly from your machine to these services. These requests are subject to the privacy policies of [Google/YouTube](https://policies.google.com/privacy) and [SoundCloud](https://soundcloud.com/pages/privacy).
- **Discord Rich Presence:** When enabled, track details (title, artist, elapsed time) are sent locally to your desktop Discord client via the native IPC pipe (`\\.\pipe\discord-ipc-0`). No private Discord data is retrieved or stored.

---

### 4. Data Security
Because all application state and playback preferences reside locally on your computer, your data security depends on the security of your local operating system.

---

### 5. Policy Updates
Any adjustments to this policy will be committed directly to this file in the official repository.

---

### 6. Contact & Inquiries
If you have questions or concerns about this Privacy Policy, please open an issue in the official project repository:  
https://github.com/prfctcondition/otofy