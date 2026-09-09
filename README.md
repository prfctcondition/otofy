# Zen Music 🎵

A modern, fluid desktop and mobile music player powered by Electron, React, Tailwind CSS, and TypeScript. Ad-free audio streaming, high-resolution discographies, synchronized karaoke lyrics, and a parametric equalizer.

## ✨ Features

- **Ad-Free Music Streaming**: Seamless audio streaming powered by Innertube (YouTube Music) and SoundCloud.
- **Full-Screen Spotify-Style Lyrics**: Fullscreen karaoke lyrics with real-time synchronized auto-scroll, click-to-seek, and adaptive ambient gradient lighting.
- **Search Sources Filter**: Switch effortlessly between `MIXED` (Both), `YT` (YouTube Music official tracks), and `SC` (SoundCloud).
- **Rich Artist Discographies**: Full artist profiles with avatars, official tracks, albums, singles, and related artists without pagination limits.
- **10-Band Parametric Equalizer**: Real-time audio EQ with presets (Bass Boost, Vocal, Rock, Pop, Electronic, etc.).
- **Dynamic Daily Mixes & Radio Stations**: Curated playlists generated and refreshed every 24 hours.
- **Playlist Management**: Create, rename, save collections from stations, and import/share playlists.
- **Liquid-Glass Design**: Sleek translucent UI with high-contrast readable typography and zero GPU overhead.

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or newer)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/prfctcondition/zen-music.git
   cd zen-music
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run in Development Mode:
   - Web Dev Server:
     ```bash
     npm run dev
     ```
   - Desktop Electron App:
     ```bash
     npm run electron:dev
     ```

4. Build for Production:
   ```bash
   npm run build
   npm run electron:build
   ```

## 📄 License

MIT License.
