<div align="center">

  <img src="./readme-assets/preview.png" alt="Otofy Main Interface" width="100%" />

  <br />
  <br />

  <h1>音 · Otofy</h1>
  <p><strong>Pure Sound. Zero Tracking. No Subscriptions.</strong></p>

  <p>
    <em>The ultimate privacy-first desktop music streaming and offline player.</em><br>
    Engineered with Japanese aesthetic minimalism, a studio-grade dual audio engine, and zero compromises.
  </p>

  <p>
    <a href="https://github.com/prfctcondition/otofy/releases/latest"><img src="https://img.shields.io/github/v/release/prfctcondition/otofy?color=emerald&label=Release&style=flat-square" alt="Release" /></a>
    <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-blue?style=flat-square" alt="Platform" />
    <img src="https://img.shields.io/badge/Electron-34-4B32C3?style=flat-square&logo=electron&logoColor=white" alt="Electron" />
    <img src="https://img.shields.io/badge/React-19-20232A?style=flat-square&logo=react&logoColor=61DAFB" alt="React" />
    <img src="https://img.shields.io/badge/TypeScript-5.8-007ACC?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white" alt="Tailwind" />
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg?style=flat-square" alt="License" /></a>
  </p>

  <br />

  <p>
    <a href="https://github.com/prfctcondition/otofy/releases/latest">
      <img src="https://img.shields.io/badge/⬇%EF%B8%8F_Download_Otofy_for_Windows-238636?style=for-the-badge&logo=windows&logoColor=white" alt="Download Windows Installer" height="38" />
    </a>
  </p>

  <br />
</div>

---

## ⛩️ Why Otofy?

Modern music streaming has lost its way. Mainstream platforms are bloated with podcasts, forced algorithmic feeds, intrusive audio commercials, paywalled basic controls, and relentless tracking of your listening habits.

**Otofy was built as a pure, uncompromising rebellion against the bloat.**

It delivers the fluidity and elegance of a flagship music service while placing **complete ownership and privacy back into your hands**. Stream millions of tracks directly from YouTube Music and SoundCloud without ever creating an account, batch-download entire libraries for offline listening with embedded metadata, and migrate your playlists from any platform in seconds.

---

## 🔥 Killer Features

### 🔓 1. Zero Accounts, Zero Tracking, Zero Ads
* **No Sign-Up Required**: Launch Otofy and play music immediately. No emails, no passwords, no phone numbers, and no behavioral profiling.
* **100% Local & Private**: Your liked songs, playlists, cached albums, and listening history live strictly on your machine in IndexedDB.
* **Ad-Free Streaming**: Clean, uninterrupted audio playback out of the box.

### 📥 2. High-Speed Batch Playlist Downloader
* **One-Click Playlist Downloads**: Save entire albums or 200+ track playlists directly to your hard drive with a single click.
* **Integrated FFmpeg Transcoding Engine**: Bundled high-performance audio engine converts streams into pristine audio files with zero external software needed.
* **Full ID3 Tag & Cover Art Embedding**: Downloaded tracks automatically include embedded high-resolution (500x500) artwork, artist, title, album, and track indices.
* **Smart Concurrency Queue**: Background download manager throttles parallel workers (up to 3 simultaneous streams) with live progress tracking, per-track pause/resume/cancel, and batch controls to keep your PC smooth.
* **True Offline Mode**: Switch to your downloads library and enjoy full playback without any internet connection.

### 🔄 3. Universal Multi-Platform Playlist Importer
* **Spotify Importer**: Paste any Spotify public playlist URL. Otofy extracts the tracklist and metadata, searches across high-fidelity sources, and reconstructs the playlist locally.
* **YouTube Music & SoundCloud Support**: Import playlists from YouTube Music or SoundCloud directly via URL.
* **Otofy Share Codes**: Export your curated playlists to compact JSON share codes and send them to friends.
* **Smart Matching Engine**: Employs fuzzy string matching, multi-artist parsing (`feat.`, `ft.`, `&`), and duration verification to find the exact studio version of every track.
* **Interactive Conflict Resolver**: If a track has multiple versions or rare remixes, an interactive candidate modal lets you audition, replace, or skip tracks with one click.

### 🌐 4. Boundless Dual-Engine Catalog
* **YouTube Music Engine**: Stream official studio albums, singles, remastered classics, and live sessions.
* **SoundCloud Engine**: Tap into millions of underground remixes, DJ sets, lo-fi beats, bootlegs, and indie tracks.
* **Unified Discovery**: Seamlessly search both platforms simultaneously or filter results with instant `[ YT ]` and `[ SC ]` toggles.

### 🎛️ 5. Studio-Grade 10-Band Graphic Equalizer
* **Precision Parametric EQ**: Tailor your sound across 10 discrete frequency bands (32Hz to 16kHz) using Web Audio API hardware-accelerated biquad filters.
* **One-Click Presets**: Switch instantly between *Bass Boost*, *Vocal Clarity*, *Electronic*, *Rock*, *Acoustic*, and *Flat*.
* **Real-Time Soundstage**: Hear changes in real-time with zero latency or playback distortion.

### ⚡ 6. Dual-Deck Audio Engine & Infinite Autoplay
* **Seamless Crossfading (0–12s)**: Powered by an A/B dual-deck audio pipeline, smoothly blending tracks together like a live radio DJ.
* **Infinite Radio Mode**: When your queue ends, Otofy automatically analyzes the acoustic profile of your last track and generates an endless queue of matching songs.

### 🎤 7. Interactive Synchronized Lyrics (Karaoke & Cinema View)
* **Real-Time Timestamps**: Sub-second synchronized lyrics fetched on the fly.
* **Click-to-Seek Karaoke**: Click on any lyric line or phrase to instantly jump to that exact millisecond in the song.
* **Ambient Cinema Fullscreen**: Immersive visualizer with dynamic lighting that extracts dominant color gradients from current album artwork.

### 📁 8. Power Library & Local Audio Discovery
* **Local Audio Scanner**: Point Otofy to any folder on your computer. It scans and indexes `.mp3`, `.flac`, `.opus`, and `.m4a` files with full metadata extraction.
* **Multi-Select Workflow**: Select multiple tracks at once (`Ctrl/Cmd + Click`, `Shift + Click`) to bulk-add to playlists, queue next, or download in batch.
* **Intelligent Library Sorting**: Sort by Title (A–Z / Z–A), Artist, Date Added, and Duration with instant responsiveness.
* **Offline Album Snapshots**: Saved albums are securely snapshotted in local storage so you never lose your music or hit broken streaming tokens.

---

<div align="center">
  <img src="./readme-assets/lyrics.png" alt="Otofy Synchronized Lyrics Mode" width="100%" />
  <p><em>Real-time synchronized lyrics with dynamic ambient glow and click-to-seek playback.</em></p>
</div>

---

## 🖥️ Platform Comparison

| Feature | Otofy | Spotify Free | YouTube Music | Typical Offline Players |
| :--- | :---: | :---: | :---: | :---: |
| **Price** | **100% Free** | Free (Ad-Supported) | Free (Ad-Supported) | Free / Paid |
| **Account Required** | **❌ None** | ✔️ Required | ✔️ Required | ❌ None |
| **Audio Ads** | **❌ Zero** | ⚠️ Every 15 mins | ⚠️ Every 2 tracks | ❌ Zero |
| **Batch Playlist Download** | **✔️ Unlimited** | ❌ Premium Only | ❌ Premium Only | ❌ Manual files only |
| **Offline Playback with Artwork** | **✔️ Yes (Embedded ID3)** | ✔️ DRM Locked | ✔️ DRM Locked | ⚠️ If tagged manually |
| **Spotify Playlist Import** | **✔️ One-click** | N/A | ❌ Third-party tool | ❌ N/A |
| **SoundCloud Catalog** | **✔️ Built-in** | ❌ No | ❌ No | ❌ No |
| **10-Band Precision EQ** | **✔️ Built-in** | ⚠️ Basic (Mobile only)| ❌ No | ⚠️ Varies |
| **Synchronized Lyrics** | **✔️ Click-to-Seek** | ⚠️ Non-interactive | ⚠️ Static only | ❌ Rare |
| **Telemetry & Tracking** | **❌ Zero** | ⚠️ Extensive | ⚠️ Extensive | ❌ None |

---

## 🚀 Installation

### Windows Installer (Recommended)
1. Download the latest installer from the [Releases page](https://github.com/prfctcondition/otofy/releases/latest):
   - **`Otofy-Windows-installer.exe`**
2. Run the installer and launch Otofy from your Desktop or Start Menu.

---

## 🛠️ Building From Source

### Prerequisites
* [Node.js](https://nodejs.org/) (v18 or newer)
* npm, pnpm, or yarn
* Git

### Setup & Run
```bash
# 1. Clone the repository
git clone https://github.com/prfctcondition/otofy.git
cd otofy

# 2. Install dependencies
npm install

# 3. Launch Desktop Development Environment
npm run electron:dev
```

### Packaging Production Binary
```bash
# Build production desktop installer
npm run dist
```
The output installer will be generated in `release/Otofy-Windows-installer.exe`.

---

## 🗺️ Roadmap & What's Next

- [x] **Universal Playlist Importer**: Spotify, YouTube Music, SoundCloud, and JSON codes with conflict resolution.
- [x] **Batch Playlist Downloader**: Concurrent FFmpeg engine with ID3 & 500x500 artwork embedding.
- [x] **10-Band Graphic Equalizer**: Web Audio hardware filter bank with audio presets.
- [x] **Multi-Select & Advanced Sorting**: Bulk library operations and tracklist organization.
- [x] **Local Files Discovery**: Scan and play local `.mp3`, `.flac`, `.opus`, `.m4a`.
- [ ] **Discord Rich Presence**: Broadcast currently playing track, artist, album art, and progress to Discord.
- [ ] **Native Global Media Keys & Windows SMTC**: Enhanced hardware keyboard controls when minimized to tray.
- [ ] **Cross-Device P2P Library Sync**: Sync custom playlists and history between desktop and mobile across local Wi-Fi without cloud servers.

---

## 📄 License

Distributed under the [MIT License](LICENSE). Built for music lovers who cherish privacy, sound fidelity, and freedom.
