import { app, WebContents } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

export interface UpdateCheckResult {
  hasUpdate: boolean;
  canAutoInstall: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseUrl?: string;
  downloadUrl?: string;
  fileName?: string;
  fileSize?: number;
  releaseNotes?: string;
  error?: string;
}

export interface UpdateDownloadProgress {
  percent: number;
  transferred: number;
  total: number;
}

function parseSemver(v: string): [number, number, number] {
  const clean = v.replace(/^v/i, '').trim();
  const parts = clean.split('.').map((p) => parseInt(p, 10) || 0);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

function isNewerVersion(current: string, latest: string): boolean {
  const [cMaj, cMin, cPat] = parseSemver(current);
  const [lMaj, lMin, lPat] = parseSemver(latest);

  if (lMaj > cMaj) return true;
  if (lMaj < cMaj) return false;
  if (lMin > cMin) return true;
  if (lMin < cMin) return false;
  return lPat > cPat;
}

class UpdateService {
  private activeDownloadController: AbortController | null = null;
  private cachedCheckResult: UpdateCheckResult | null = null;

  public async checkForUpdates(): Promise<UpdateCheckResult> {
    const currentVersion = app.getVersion() || '1.0.4';
    const repo = 'prfctcondition/otofy';
    const apiUrl = `https://api.github.com/repos/${repo}/releases/latest`;

    try {
      const res = await fetch(apiUrl, {
        headers: {
          'User-Agent': `Otofy-App-v${currentVersion}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!res.ok) {
        if (res.status === 404) {
          // No releases published yet
          return {
            hasUpdate: false,
            canAutoInstall: false,
            currentVersion,
            latestVersion: currentVersion,
            releaseNotes: 'No new releases found on GitHub.',
          };
        }
        throw new Error(`GitHub API returned status ${res.status} ${res.statusText}`);
      }

      const data: any = await res.json();
      const tagName = data.tag_name || data.name || '';
      const cleanLatest = tagName.replace(/^v/i, '');
      const hasUpdate = isNewerVersion(currentVersion, cleanLatest);

      // Strict .exe asset filtering (rejects source code archives, .zip, .tar.gz)
      const rawAssets: any[] = data.assets || [];
      const exeAssets = rawAssets.filter(
        (a) => a.name && typeof a.name === 'string' && a.name.toLowerCase().endsWith('.exe')
      );

      // Prioritize installer / setup executable
      const bestExeAsset =
        exeAssets.find(
          (a) =>
            a.name.toLowerCase().includes('windows-installer') ||
            a.name.toLowerCase().includes('installer') ||
            a.name.toLowerCase().includes('setup')
        ) || exeAssets[0];

      const checkResult: UpdateCheckResult = {
        hasUpdate,
        canAutoInstall: Boolean(hasUpdate && bestExeAsset && bestExeAsset.browser_download_url),
        currentVersion,
        latestVersion: tagName || currentVersion,
        releaseUrl: data.html_url || `https://github.com/${repo}/releases`,
        downloadUrl: bestExeAsset?.browser_download_url,
        fileName: bestExeAsset?.name,
        fileSize: bestExeAsset?.size,
        releaseNotes: data.body || 'No release notes provided.',
      };

      this.cachedCheckResult = checkResult;
      return checkResult;
    } catch (err: any) {
      console.warn('[UpdateService] Check for updates failed:', err);
      return {
        hasUpdate: false,
        canAutoInstall: false,
        currentVersion,
        latestVersion: currentVersion,
        error: err?.message || 'Failed to check for updates.',
      };
    }
  }

  public async downloadAndInstall(
    sender?: WebContents
  ): Promise<{ success: boolean; error?: string }> {
    let check = this.cachedCheckResult;
    if (!check || !check.downloadUrl) {
      check = await this.checkForUpdates();
    }

    if (!check.downloadUrl) {
      return {
        success: false,
        error: check.canAutoInstall === false
          ? 'No standalone Windows .exe installer attached to this release.'
          : 'Could not resolve download URL for the update.',
      };
    }

    const tempDir = os.tmpdir();
    const installerName = check.fileName || 'Otofy-Update.exe';
    const destinationPath = path.join(tempDir, installerName);

    this.activeDownloadController = new AbortController();

    try {
      const response = await fetch(check.downloadUrl, {
        signal: this.activeDownloadController.signal,
        headers: {
          'User-Agent': `Otofy-App-v${app.getVersion()}`,
        },
      });

      if (!response.ok || !response.body) {
        throw new Error(`Failed to download installer: ${response.status} ${response.statusText}`);
      }

      const totalBytes = Number(response.headers.get('content-length')) || check.fileSize || 0;
      let transferredBytes = 0;

      const fileStream = fs.createWriteStream(destinationPath);
      const reader = response.body.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (value) {
          transferredBytes += value.length;
          fileStream.write(Buffer.from(value));

          const percent = totalBytes > 0 ? Math.round((transferredBytes / totalBytes) * 100) : 0;
          if (sender) {
            try {
              sender.send('updater:download-progress', {
                percent,
                transferred: transferredBytes,
                total: totalBytes,
              } as UpdateDownloadProgress);
            } catch {}
          }
        }
      }

      await new Promise<void>((resolve, reject) => {
        fileStream.end(() => resolve());
        fileStream.on('error', reject);
      });

      console.log(`[UpdateService] Update downloaded successfully to: ${destinationPath}`);

      // Launch the NSIS installer in detached mode and close Otofy
      setTimeout(() => {
        try {
          const child = spawn(destinationPath, [], {
            detached: true,
            stdio: 'ignore',
          });
          child.unref();
          app.quit();
        } catch (spawnErr) {
          console.error('[UpdateService] Failed to launch installer:', spawnErr);
        }
      }, 500);

      return { success: true };
    } catch (err: any) {
      console.error('[UpdateService] Download error:', err);
      try {
        if (fs.existsSync(destinationPath)) {
          fs.unlinkSync(destinationPath);
        }
      } catch {}
      return { success: false, error: err?.message || 'Download failed' };
    } finally {
      this.activeDownloadController = null;
    }
  }

  public cancelDownload(): void {
    if (this.activeDownloadController) {
      this.activeDownloadController.abort();
      this.activeDownloadController = null;
    }
  }
}

export const updateService = new UpdateService();
export default updateService;
