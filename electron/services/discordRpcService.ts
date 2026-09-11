import net from 'net';
import crypto from 'crypto';

const CLIENT_ID = '1547850981117526046';
const GITHUB_REPO_URL = 'https://github.com/prfctcondition/otofy';
const DEFAULT_ASSET_KEY = 'logo';

// Discord IPC Opcodes
const OPCODE_HANDSHAKE = 0;
const OPCODE_FRAME = 1;
const OPCODE_CLOSE = 2;
const OPCODE_PING = 3;
const OPCODE_PONG = 4;

export interface DiscordActivityPayload {
  title?: string;
  artist?: string;
  source?: 'YT' | 'SC' | string;
  durationSec?: number;
  currentSec?: number;
  isPlaying?: boolean;
  artworkUrl?: string;
}

class DiscordRpcService {
  private socket: net.Socket | null = null;
  private isConnected = false;
  private isConnecting = false;
  private isHandshakeComplete = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private lastActivity: DiscordActivityPayload | null = null;

  constructor() {
    this.connect();
  }

  private getPipePath(index = 0): string {
    if (process.platform === 'win32') {
      return `\\\\.\\pipe\\discord-ipc-${index}`;
    }
    const env = process.env;
    const prefix = env.XDG_RUNTIME_DIR || env.TMPDIR || env.TMP || env.TEMP || '/tmp';
    return `${prefix.replace(/\/$/, '')}/discord-ipc-${index}`;
  }

  private connect(pipeIndex = 0): void {
    if (this.isConnected || this.isConnecting) return;
    if (pipeIndex >= 10) {
      this.scheduleReconnect(3000);
      return;
    }

    this.isConnecting = true;
    const pipePath = this.getPipePath(pipeIndex);

    let socket: net.Socket;
    try {
      socket = net.connect(pipePath);
    } catch {
      this.isConnecting = false;
      if (pipeIndex < 9) {
        this.connect(pipeIndex + 1);
      } else {
        this.scheduleReconnect(3000);
      }
      return;
    }

    this.socket = socket;

    socket.on('connect', () => {
      this.isConnected = true;
      this.isConnecting = false;
      this.sendHandshake();

      // Handshake takes ~200-300ms to be processed by Discord IPC
      setTimeout(() => {
        this.isHandshakeComplete = true;
        if (this.lastActivity && this.lastActivity.isPlaying) {
          this.dispatchActivity();
        }
      }, 300);
    });

    socket.on('data', (data) => {
      try {
        if (data.length >= 8) {
          const op = data.readInt32LE(0);
          if (op === OPCODE_PING) {
            this.sendPacket(OPCODE_PONG, {});
          } else if (op === OPCODE_FRAME) {
            this.isHandshakeComplete = true;
          }
        }
      } catch {}
    });

    socket.on('error', (err: any) => {
      // If we failed initial pipe probing, try next pipe index
      if (!this.isConnected && pipeIndex < 9) {
        try {
          socket.removeAllListeners();
          socket.destroy();
        } catch {}
        this.socket = null;
        this.isConnecting = false;
        this.connect(pipeIndex + 1);
      } else {
        this.handleSocketError(err);
      }
    });

    socket.on('close', () => {
      this.handleSocketError();
    });

    socket.on('end', () => {
      this.handleSocketError();
    });
  }

  private handleSocketError(err?: any): void {
    if (err && err.code !== 'ENOENT' && err.code !== 'ECONNREFUSED') {
      console.warn('[DiscordRPC] Socket disconnected / error:', err?.message || err);
    }

    if (this.socket) {
      try {
        this.socket.removeAllListeners();
        this.socket.destroy();
      } catch {}
      this.socket = null;
    }
    this.isConnected = false;
    this.isConnecting = false;
    this.isHandshakeComplete = false;

    // Plan automatic reconnection (self-healing backoff)
    this.scheduleReconnect(2500);
  }

  private scheduleReconnect(delayMs = 2500): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect(0);
    }, delayMs);
  }

  private sendPacket(opcode: number, payloadObj: any): boolean {
    if (!this.socket || this.socket.destroyed || !this.isConnected) return false;
    try {
      const payloadStr = JSON.stringify(payloadObj);
      const payloadLen = Buffer.byteLength(payloadStr);
      const packet = Buffer.alloc(8 + payloadLen);
      packet.writeInt32LE(opcode, 0);
      packet.writeInt32LE(payloadLen, 4);
      packet.write(payloadStr, 8);

      return this.socket.write(packet, (err) => {
        if (err) {
          console.warn('[DiscordRPC] Write packet failed:', err.message);
          this.handleSocketError(err);
        }
      });
    } catch (err) {
      console.warn('[DiscordRPC] sendPacket failed:', err);
      this.handleSocketError(err);
      return false;
    }
  }

  private sendHandshake(): void {
    this.sendPacket(OPCODE_HANDSHAKE, {
      v: 1,
      client_id: CLIENT_ID,
    });
  }

  /**
   * Debounced presence update to protect against Discord IPC rate limiting
   * when rapidly skipping multiple tracks.
   */
  public updatePresence(data: DiscordActivityPayload): void {
    this.lastActivity = data;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (!data.title || !data.isPlaying) {
      this.clearPresence();
      return;
    }

    if (!this.isConnected || !this.socket || this.socket.destroyed) {
      if (!this.isConnecting) this.connect(0);
      return;
    }

    // Debounce SET_ACTIVITY calls by 400ms
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.dispatchActivity();
    }, 400);
  }

  private dispatchActivity(): void {
    const data = this.lastActivity;
    if (!data || !data.title || !data.isPlaying) {
      return;
    }

    if (!this.isConnected || !this.socket || this.socket.destroyed) {
      if (!this.isConnecting) this.connect(0);
      return;
    }

    const sourceTag = data.source?.toUpperCase() === 'SC' ? '「SC」' : '「YT」';
    const artistName = data.artist || 'Unknown Artist';
    const rawTitle = data.title || 'Unknown Track';

    const cleanTitle = rawTitle.replace(/^Listening to /i, '').trim();
    const detailsText = `Listening to ${cleanTitle}`;

    // State: strictly artist with source tag: ${track.artist} 「${sourceTag}」
    const stateText = `${artistName} ${sourceTag}`;

    // Large image: direct HTTPS URL of album cover, fallback to 'logo'
    const rawArtwork = (data.artworkUrl || '').trim();
    let largeImageUrl = DEFAULT_ASSET_KEY;
    if (rawArtwork && (rawArtwork.startsWith('https://') || rawArtwork.startsWith('http://'))) {
      largeImageUrl = rawArtwork.replace(/^http:\/\//i, 'https://');
    }

    const now = Math.floor(Date.now() / 1000);
    const currentSec = Math.max(0, Math.floor(data.currentSec || 0));
    const startTimestamp = Math.max(0, now - currentSec);
    const durationSec = Math.max(0, Math.floor(data.durationSec || 0));
    const endTimestamp = durationSec > 0 ? startTimestamp + durationSec : startTimestamp + 180;

    const activity: any = {
      type: 2, // ActivityType.Listening
      details: detailsText.length > 128 ? `${detailsText.slice(0, 125)}...` : detailsText,
      state: stateText.length > 128 ? `${stateText.slice(0, 125)}...` : stateText,
      timestamps: {
        start: startTimestamp,
        end: endTimestamp,
      },
      assets: {
        large_image: largeImageUrl,
      },
      buttons: [
        {
          label: 'Listen on Otofy',
          url: GITHUB_REPO_URL,
        },
      ],
    };

    this.sendPacket(OPCODE_FRAME, {
      cmd: 'SET_ACTIVITY',
      args: {
        pid: process.pid,
        activity,
      },
      nonce: crypto.randomUUID(),
    });
  }

  public clearPresence(): void {
    this.lastActivity = null;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (!this.isConnected || !this.socket || this.socket.destroyed) return;

    this.sendPacket(OPCODE_FRAME, {
      cmd: 'SET_ACTIVITY',
      args: {
        pid: process.pid,
        activity: null,
      },
      nonce: crypto.randomUUID(),
    });
  }

  public destroy(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.clearPresence();
    if (this.socket) {
      try {
        this.socket.removeAllListeners();
        this.socket.destroy();
      } catch {}
      this.socket = null;
    }
    this.isConnected = false;
    this.isConnecting = false;
    this.isHandshakeComplete = false;
  }
}

export const discordRpc = new DiscordRpcService();
export default discordRpc;
