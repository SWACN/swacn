declare module 'asciinema-player' {
  export interface AsciinemaThemeObject {
    fg: string;
    bg: string;
    palette: string;
  }

  export interface AsciinemaOptions {
    loop?: boolean | number;
    fit?: 'width' | 'height' | 'both' | 'none';
    theme?: string | AsciinemaThemeObject; // <-- The Fix: Allow string OR our custom object
    preload?: boolean;
    autoplay?: boolean;
    speed?: number;
    idleTimeLimit?: number;
    poster?: string;
    terminalFontSize?: string;   // Added these so TS doesn't complain about our other config
    terminalFontFamily?: string; // Added these so TS doesn't complain about our other config
  }

  export interface AsciinemaPlayerInstance {
    play(): void;
    pause(): void;
    dispose(): void;
    addEventListener(event: string, callback: () => void): void;
  }

  export function create(
    src: string,
    element: HTMLElement,
    options?: AsciinemaOptions
  ): AsciinemaPlayerInstance;
}