// src/core/CastParser.ts

export type CastHeader = { version: number; width: number; height: number; timestamp: number };
export type IoEvent = [number, 'o' | 'i', string];
export type FsEvent = [number, 'fs', { action: 'create' | 'modify' | 'delete', path: string, content?: string }];
export type CastEvent = IoEvent | FsEvent;

export class CastParser {
  header: CastHeader | null = null;
  ioEvents: IoEvent[] = [];
  fsEvents: FsEvent[] = [];

  async parse(castUrl: string) {
    const response = await fetch(castUrl);
    const text = await response.text();
    const lines = text.trim().split('\n');

    this.header = JSON.parse(lines[0]);

    for (let i = 1; i < lines.length; i++) {
      const event = JSON.parse(lines[i]) as CastEvent;
      if (event[1] === 'o' || event[1] === 'i') {
        this.ioEvents.push(event as IoEvent);
      } else if (event[1] === 'fs') {
        this.fsEvents.push(event as FsEvent);
      }
    }
  }

  // Returns FS events that occurred between the last timestamp and the current playback time
  getPendingFsEvents(lastTime: number, currentTime: number): FsEvent[] {
    return this.fsEvents.filter(e => e[0] > lastTime && e[0] <= currentTime);
  }
}