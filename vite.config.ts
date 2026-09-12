import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { defineConfig, Plugin } from 'vite';

function aistudioMediaPlugin(): Plugin {
  return {
    name: 'vite-plugin-aistudio-media',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/assets/aistudio/')) {
          const rawPath = req.url.split('?')[0].split('#')[0];
          try {
            const decodedPath = decodeURIComponent(rawPath);
            const relativePath = decodedPath.replace(/^\//, '');
            const aistudioDir = path.resolve(__dirname, 'public', 'assets', 'aistudio');
            const filePath = path.resolve(__dirname, 'public', relativePath);
            if (
              filePath.startsWith(aistudioDir + path.sep) &&
              fs.existsSync(filePath) &&
              fs.statSync(filePath).isFile()
            ) {
              const ext = path.extname(filePath).toLowerCase();
              const mimeMap: Record<string, string> = {
                '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
                '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
                '.bmp': 'image/bmp', '.ico': 'image/x-icon', '.mp4': 'video/mp4',
                '.webm': 'video/webm', '.ogv': 'video/ogg', '.mp3': 'audio/mpeg',
                '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.pdf': 'application/pdf',
              };
              res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
              res.setHeader('Cache-Control', 'no-cache');
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          } catch { /* fall through */ }
        }
        next();
      });
    },
  };
}

function musicApiPlugin(): Plugin {
  return {
    name: 'vite-plugin-music-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/music/search')) {
          const urlObj = new URL(req.url, 'http://localhost');
          const q = urlObj.searchParams.get('q') || '';
          const source = (urlObj.searchParams.get('source') as 'YT' | 'SC' | 'ALL') || 'ALL';
          try {
            const searchModule = await import('./dist-electron/services/searchService.js');
            const searchResp = await (searchModule.default as any).searchAll(q, source);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(searchResp));
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
        }

        if (req.url && req.url.startsWith('/api/music/proxy-stream')) {
          if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');
            res.setHeader('Access-Control-Max-Age', '86400');
            res.end();
            return;
          }

          const urlObj = new URL(req.url, 'http://localhost');
          const targetUrl = urlObj.searchParams.get('url');
          if (!targetUrl) {
            res.statusCode = 400;
            res.end('Missing stream url parameter');
            return;
          }

          try {
            const upstreamHeaders: Record<string, string> = {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
              'Accept': '*/*',
            };
            if (req.headers.range) {
              upstreamHeaders['Range'] = req.headers.range as string;
            }

            const abortController = new AbortController();
            req.on('close', () => {
              abortController.abort();
            });

            const upstreamRes = await fetch(targetUrl, {
              method: req.method === 'HEAD' ? 'HEAD' : 'GET',
              headers: upstreamHeaders,
              signal: abortController.signal,
            });

            res.statusCode = upstreamRes.status;
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');
            res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
            res.setHeader('Accept-Ranges', 'bytes');

            const contentType = upstreamRes.headers.get('content-type') || 'audio/mp4';
            const contentLength = upstreamRes.headers.get('content-length');
            const contentRange = upstreamRes.headers.get('content-range');

            res.setHeader('Content-Type', contentType);
            if (contentLength) res.setHeader('Content-Length', contentLength);
            if (contentRange) res.setHeader('Content-Range', contentRange);

            if (req.method === 'HEAD' || !upstreamRes.body) {
              res.end();
              return;
            }

            const nodeStream = Readable.fromWeb(upstreamRes.body as any);
            nodeStream.on('error', (err: any) => {
              if (err.name !== 'AbortError') {
                console.warn('[ProxyStream] Stream read error:', err?.message || err);
              }
            });
            nodeStream.pipe(res);
            return;
          } catch (err: any) {
            if (err.name === 'AbortError') return;
            console.error('[ProxyStream] Failed to proxy stream:', err);
            if (!res.headersSent) {
              res.statusCode = 502;
              res.end(`Proxy stream failed: ${err.message}`);
            }
            return;
          }
        }

        if (req.url && req.url.startsWith('/api/music/resolve')) {
          const urlObj = new URL(req.url, 'http://localhost');
          const id = urlObj.searchParams.get('id') || '';
          const source = urlObj.searchParams.get('source') || 'SC';
          const title = urlObj.searchParams.get('title') || '';
          const artist = urlObj.searchParams.get('artist') || '';

          try {
            let result: any;
            if (source === 'SC' || source.toLowerCase() === 'soundcloud') {
              const scModule = await import('./dist-electron/services/scResolver.js');
              result = await scModule.default.resolve(id);
            } else {
              const ytModule = await import('./dist-electron/services/ytResolver.js');
              result = await ytModule.default.resolve(id, title, artist);
            }

            if (result && result.url) {
              // Wrap stream URL with proxy-stream to ensure full CORS, range requests, and Web Audio API support
              result.directUrl = result.url;
              result.url = `/api/music/proxy-stream?url=${encodeURIComponent(result.url)}`;
            }

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result));
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
        }

        if (req.url && req.url.startsWith('/api/music/artist-details')) {
          const urlObj = new URL(req.url, 'http://localhost');
          const artistName = urlObj.searchParams.get('artistName') || '';
          const source = urlObj.searchParams.get('source') || 'YT';
          try {
            let details;
            if (source === 'SC') {
              const scModule = await import('./dist-electron/services/scResolver.js');
              details = await scModule.default.getArtistDetails(artistName);
            } else {
              const itModule = await import('./dist-electron/services/innertubeService.js');
              details = await itModule.default.getArtist(artistName);
              if (!details || (!details.topTracks?.length && !details.albums?.length)) {
                const scModule = await import('./dist-electron/services/scResolver.js');
                details = await scModule.default.getArtistDetails(artistName);
              } else if (!details.avatarUrl || !details.albums?.length) {
                try {
                  const scModule = await import('./dist-electron/services/scResolver.js');
                  const scDetails = await scModule.default.getArtistDetails(artistName);
                  if (scDetails) {
                    if (!details.avatarUrl && scDetails.avatarUrl) {
                      details.avatarUrl = scDetails.avatarUrl;
                    }
                    if ((!details.albums || details.albums.length === 0) && scDetails.albums?.length) {
                      details.albums = scDetails.albums;
                    }
                  }
                } catch {}
              }
              if (!details.avatarUrl && details.topTracks?.length > 0) {
                details.avatarUrl = details.topTracks[0].artworkUrl;
              }
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(details));
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
        }

        if (req.url && req.url.startsWith('/api/music/artist-full-tracks')) {
          const urlObj = new URL(req.url, 'http://localhost');
          const channelId = urlObj.searchParams.get('channelId') || '';
          const artistName = urlObj.searchParams.get('artistName') || '';
          try {
            const itModule = await import('./dist-electron/services/innertubeService.js');
            const getTracksFn = itModule.getArtistFullTracks || itModule.default?.getArtistFullTracks;
            const fullTracks = await getTracksFn(channelId, artistName);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(fullTracks || []));
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
        }

        if (req.url && req.url.startsWith('/api/music/album')) {
          const urlObj = new URL(req.url, 'http://localhost');
          const browseId = urlObj.searchParams.get('browseId') || '';
          const source = urlObj.searchParams.get('source') || 'YT';
          try {
            let album;
            if (source === 'SC' || /^\d+$/.test(browseId)) {
              const scModule = await import('./dist-electron/services/scResolver.js');
              album = await scModule.default.getAlbum(browseId);
            } else {
              const itModule = await import('./dist-electron/services/innertubeService.js');
              album = await itModule.default.getAlbum(browseId);
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(album));
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
        }

        if (req.url && req.url.startsWith('/api/music/genre-tracks')) {
          const urlObj = new URL(req.url, 'http://localhost');
          const query = urlObj.searchParams.get('query') || '';
          try {
            const itModule = await import('./dist-electron/services/innertubeService.js');
            const ytTracks = await itModule.default.getGenreTracks(query);
            if (ytTracks.length < 40) {
              const scModule = await import('./dist-electron/services/scResolver.js');
              const scTracks = await scModule.default.getGenreTracks(query);
              for (const st of scTracks) {
                if (st.durationSec > 45 && !ytTracks.some((t: any) => t.title.toLowerCase() === st.title.toLowerCase())) {
                  ytTracks.push(st as any);
                }
              }
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(ytTracks));
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
        }

        if (req.url && req.url.startsWith('/api/music/related-tracks')) {
          const urlObj = new URL(req.url, 'http://localhost');
          const trackId = urlObj.searchParams.get('id') || '';
          const source = (urlObj.searchParams.get('source') as 'YT' | 'SC') || 'YT';
          const artist = urlObj.searchParams.get('artist') || '';
          const title = urlObj.searchParams.get('title') || '';
          try {
            let results: any[] = [];
            if (source === 'SC') {
              const scModule = await import('./dist-electron/services/scResolver.js');
              results = await scModule.default.getRelatedTracks(trackId);
              if (results.length === 0 && (artist || title)) {
                results = await scModule.default.getGenreTracks(artist || title);
              }
            } else {
              const itModule = await import('./dist-electron/services/innertubeService.js');
              results = await itModule.default.getRelatedTracks(trackId);
              if (results.length === 0 && (artist || title)) {
                results = await itModule.default.getGenreTracks(`${artist || title} radio`);
              }
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(results));
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
        }

        if (req.url && req.url.startsWith('/api/music/lyrics')) {
          const urlObj = new URL(req.url, 'http://localhost');
          const videoId = urlObj.searchParams.get('videoId') || '';
          try {
            const itModule = await import('./dist-electron/services/innertubeService.js');
            const lyrics = await itModule.default.getLyrics(videoId);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ lyrics }));
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
        }

        next();
      });
    },
  };
}

function htmlEntryPlugin(): Plugin {
  return {
    name: 'vite-plugin-html-entry',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url === '/' || req.url === '/index.html') {
          req.url = '/src/index.html';
        }
        next();
      });
    },
    closeBundle() {
      const nestedHtml = path.resolve(__dirname, 'dist', 'src', 'index.html');
      const targetHtml = path.resolve(__dirname, 'dist', 'index.html');
      if (fs.existsSync(nestedHtml)) {
        let content = fs.readFileSync(nestedHtml, 'utf8');
        content = content.replace(/\.\.\/assets\//g, './assets/').replace(/\.\.\/icon\.png/g, './icon.png');
        fs.writeFileSync(targetHtml, content, 'utf8');
        try {
          fs.unlinkSync(nestedHtml);
          fs.rmdirSync(path.resolve(__dirname, 'dist', 'src'));
        } catch {}
      }
    },
  };
}

export default defineConfig(() => {
  const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'));
  return {
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version),
    },
    plugins: [react(), tailwindcss(), htmlEntryPlugin(), aistudioMediaPlugin(), musicApiPlugin()],
    base: './',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : { usePolling: true, interval: 300 },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: path.resolve(__dirname, 'src', 'index.html'),
      },
    },
  };
});
