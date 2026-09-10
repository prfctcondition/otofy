<img src="./readme-assets/preview.png" alt="Otofy Main Interface" width="100%" />
<div align="center">

  <h1>音 · Otofy</h1>
  <p><strong>Pure Sound. Zero Tracking. No Subscriptions.</strong></p>

  <p>
    <em>Oto (音 - Sound) meets effortless streaming.</em><br>
    A lightweight, privacy-focused desktop alternative to Spotify, engineered with clean Japanese minimalism.
  </p>

  <p>
    <img src="https://img.shields.io/badge/Electron-4B32C3?style=flat-square&logo=electron&logoColor=white" alt="Electron" />
    <img src="https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB" alt="React" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white" alt="Tailwind" />
    <img src="https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="License" />
  </p>

  <br />
</div>

---

### ⛩️ Why Otofy?

Streaming platforms have become heavy, bloated with podcasts and algorithmic clutter, restricted by paywalls, and aggressive with telemetries. 

**Otofy** is built as a breath of fresh air — a fast, modern alternative inspired by Spotify's fluid experience, but stripped of everything unnecessary. It streams high-quality music directly from **YouTube Music** and **SoundCloud** with zero audio ads, zero forced registrations, and complete privacy.

* **No Accounts Required** — Launch the app and immediately start listening. No emails, no passwords, no behavioral profiling.
* **100% Local Storage** — Your library, custom playlists, downloads, and listening history live directly on your machine. You truly own your music data.
* **Clean & Distraction-Free** — A pure liquid-glass aesthetic with high contrast, calm typography, and zero visual noise.

---

### ✨ Features

#### 🎵 Boundless Streaming & Dual Engine
- **Dual-Engine Catalog**: Combines official studio releases from **YouTube Music** with indie gems, remixes, and live sets from **SoundCloud**.
- **Global Search & Playlist Discovery**: Instant search for tracks, albums, and ready-made playlists with real-time source filtering (`MIXED`, `YT`, `SC`) and a dedicated `[ Tracks ]` / `[ Playlists ]` switch.
- **Dual-Deck Audio Engine with Crossfade**: Studio-grade Web Audio A/B deck architecture with smooth, customizable crossfading (0–12s) for seamless transitions between tracks.
- **Infinite Autoplay (Radio Mode)**: Spotify-style continuous listening. When your queue reaches the end, Otofy automatically fetches and appends similar tracks to keep the music flowing.
- **Parametric 10-Band Equalizer**: Fine-tune your frequency curve or pick instant audio presets (Bass Boost, Vocal, Acoustic, Electronic, Rock).

#### ⚡ Offline & Download Engine
- **Direct Track & Playlist Downloads**: Background downloader powered by bundled FFmpeg saving pristine audio locally with fully embedded ID3 metadata (title, artist, album, high-resolution cover art).
- **Concurrency-Controlled Download Queue**: Capped simultaneous transcoding (up to 3 parallel streams) to keep your PC responsive, with a floating live progress banner, per-track pause/resume/cancel, and global batch controls.
- **Local Audio Discovery & Scanner**: Automatically scans your downloads directory for dropped or existing audio files (`.mp3`, `.flac`, `.opus`, `.m4a`), extracts ID3 tags, and registers them into your library for instant offline playback via `atom://local`.
- **Offline-First Resilience**: Seamless playback with zero internet connection and one-click "Show in folder" explorer integration.

#### 📜 Interactive Synchronized Lyrics
- **Sidebar & Fullscreen Modes**: Keep lyrics docked in a subtle sidebar while browsing, or launch the cinema fullscreen mode with ambient gradient lighting.
- **Click-to-Seek Karaoke**: Lyrics are fully synced with sub-second timestamps. **Click on any line or phrase**, and playback instantly jumps to that exact moment.

#### 📁 Playlist Freedom & Customization
- **Create & Curate**: Organize tracks into customized local collections with personalized color themes and custom cover art uploads (PNG, JPG, WEBP with automatic 1:1 square crop).
- **Procedural Radios & Daily Mixes**: Curated mixes across electronic, hip-hop, indie, lo-fi, metal, and rock, automatically regenerated every 24 hours.
- **Share & Backup**: Export playlists to JSON and share them with friends or restore them on any computer in one click.

---

<div align="center">
  <img src="./readme-assets/lyrics.png" alt="Otofy Synchronized Lyrics Mode" width="100%" />
  <p><em>Real-time synchronized lyrics with dynamic ambient glow and instant click-to-seek playback.</em></p>
</div>

---

### 🗺️ Roadmap

- [x] **Direct Track & Batch Playlist Downloads**: Native background audio downloader with queue concurrency, pause/resume, and embedded tags.
- [x] **Local Files Scanner & Offline Mode**: Automatic discovery and playback of local audio files (`.mp3`, `.flac`, `.opus`, `.m4a`).
- [x] **Dual-Deck Crossfading & Smart Autoplay**: Gapless transitions and continuous radio recommendations.
- [ ] **Spotify Playlist Converter**: Smart import utility that parses Spotify playlist links or metadata and automatically searches, matches, and reconstructs the playlist locally using YouTube Music & SoundCloud sources.
- [ ] **Direct URL Playlist Import**: One-click import for YouTube and SoundCloud playlist URLs into your local library *(Note: you can currently discover and play ready-made playlists directly via the global search `Playlists` tab)*.
- [ ] **Account Authorization (YouTube Music & SoundCloud)**: Optional sign-in to sync your existing cloud libraries, private likes, and user subscriptions *(currently disabled while under active redesign)*.
- [ ] **Discord Rich Presence**: Display current track, artist, album art, and playback progress directly in your Discord status.

---

### 🚀 Getting Started

#### Prerequisites
* [Node.js](https://nodejs.org/) (v18 or newer)
* npm, pnpm, or yarn

#### Setup & Commands

```bash
# 1. Clone the repository
git clone https://github.com/prfctcondition/otofy.git
cd otofy

# 2. Install dependencies
npm install

# 3. Development
npm run dev              # Start web dev server
npm run electron:dev     # Launch Electron desktop window

# 4. Production Build (Windows / macOS / Linux)
npm run build
npm run electron:build
```

---

### 📄 License

This project is licensed under the [MIT License](LICENSE).
