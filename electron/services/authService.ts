import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';

function getUserDataPath(): string {
  try {
    if (process.versions?.electron) {
      const req = createRequire(import.meta.url);
      const electron = req('electron');
      const app = electron?.app || electron?.default?.app;
      if (app && typeof app.getPath === 'function') {
        return app.getPath('userData');
      }
    }
  } catch {}

  const base = process.env.APPDATA ||
    (process.platform === 'darwin'
      ? path.join(process.env.HOME || '', 'Library', 'Application Support')
      : path.join(process.env.HOME || '', '.config'));
  return path.join(base, 'otofy');
}

export interface SavedAuthSession {
  youtube?: {
    cookies: string;
    username?: string;
    connectedAt: number;
    visitorData?: string;
  };
  soundcloud?: {
    cookies: string;
    oauthToken?: string;
    username?: string;
    connectedAt: number;
  };
}

class AuthService {
  private filePath: string;
  private sessionData: SavedAuthSession = {};

  constructor() {
    const userData = getUserDataPath();
    if (!fs.existsSync(userData)) {
      try {
        fs.mkdirSync(userData, { recursive: true });
      } catch {}
    }
    this.filePath = path.join(userData, 'auth_session.json');
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        this.sessionData = JSON.parse(raw);
      }
    } catch (err) {
      console.warn('[AuthService] Failed to load auth_session.json:', err);
      this.sessionData = {};
    }
  }

  private save(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.sessionData, null, 2), 'utf8');
    } catch (err) {
      console.warn('[AuthService] Failed to save auth_session.json:', err);
    }
  }

  public getSession(): SavedAuthSession {
    return { ...this.sessionData };
  }

  public getYoutubeCookie(): string | undefined {
    return this.sessionData.youtube?.cookies;
  }

  public getYoutubeVisitorData(): string | undefined {
    return undefined;
  }

  public getSoundcloudToken(): string | undefined {
    return this.sessionData.soundcloud?.oauthToken;
  }

  public getSoundcloudCookie(): string | undefined {
    return this.sessionData.soundcloud?.cookies;
  }

  public setYoutubeAuth(cookies: string, username?: string): void {
    this.sessionData.youtube = {
      cookies,
      username: username || 'Google Account',
      connectedAt: Date.now(),
    };
    this.save();
  }

  public setSoundcloudAuth(cookies: string, oauthToken?: string, username?: string): void {
    this.sessionData.soundcloud = {
      cookies,
      oauthToken,
      username: username || 'SoundCloud User',
      connectedAt: Date.now(),
    };
    this.save();
  }

  public clearAuth(platform: 'youtube' | 'soundcloud'): void {
    if (platform === 'youtube') {
      delete this.sessionData.youtube;
    } else if (platform === 'soundcloud') {
      delete this.sessionData.soundcloud;
    }
    this.save();
  }

  public getAccountStatus(): {
    youtube: { connected: boolean; username?: string };
    soundcloud: { connected: boolean; username?: string };
  } {
    return {
      youtube: {
        connected: Boolean(this.sessionData.youtube?.cookies),
        username: this.sessionData.youtube?.username,
      },
      soundcloud: {
        connected: Boolean(this.sessionData.soundcloud?.oauthToken || this.sessionData.soundcloud?.cookies),
        username: this.sessionData.soundcloud?.username,
      },
    };
  }
}

export const authService = new AuthService();
export default authService;
