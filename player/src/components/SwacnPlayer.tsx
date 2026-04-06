import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { CastParser } from '../core/CastParser';
import { WebVMBridge } from '../core/WebVMBridge';

interface PlayerProps {
  castUrl: string;
  baselineUrl: string;
}

export const SwacnPlayer: React.FC<PlayerProps> = ({ castUrl, baselineUrl }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isInteractive, setIsInteractive] = useState(false);
  const [vmLoaded, setVmLoaded] = useState(false);

  const term = useRef<Terminal | null>(null);
  const parser = useRef(new CastParser());
  const vm = useRef(new WebVMBridge());
  
  const playbackState = useRef({
    startTime: 0,
    lastEventIndex: 0,
    lastFsTime: 0
  });

  // 1. Initialize Terminal and Data
  useEffect(() => {
    if (!terminalRef.current) return;

    term.current = new Terminal({
      cursorBlink: true,
      theme: { background: '#1e1e1e' }
    });
    const fitAddon = new FitAddon();
    term.current.loadAddon(fitAddon);
    term.current.open(terminalRef.current);
    fitAddon.fit();

    const init = async () => {
      // Fetch cast data in parallel with booting the VM
      await Promise.all([
        parser.current.parse(castUrl),
        vm.current.initialize(baselineUrl).then(() => setVmLoaded(true))
      ]);
      
      // Render initial frame
      if (parser.current.ioEvents.length > 0) {
         term.current?.write(parser.current.ioEvents[0][2]);
      }
    };

    init();

    return () => term.current?.dispose();
  }, [castUrl, baselineUrl]);

  // 2. Playback Loop
  useEffect(() => {
    let animationFrameId: number;

    const playLoop = () => {
      if (!isPlaying || isInteractive) return;

      const elapsed = (Date.now() - playbackState.current.startTime) / 1000;
      const { ioEvents } = parser.current;

      // Render stdout up to current time
      while (
        playbackState.current.lastEventIndex < ioEvents.length &&
        ioEvents[playbackState.current.lastEventIndex][0] <= elapsed
      ) {
        const event = ioEvents[playbackState.current.lastEventIndex];
        if (event[1] === 'o') term.current?.write(event[2]);
        playbackState.current.lastEventIndex++;
      }

      // Hydrate WebVM FS silently in the background
      const pendingFs = parser.current.getPendingFsEvents(playbackState.current.lastFsTime, elapsed);
      pendingFs.forEach(fsEvent => {
        vm.current.applyFsEvent(fsEvent[2]);
      });
      playbackState.current.lastFsTime = elapsed;

      animationFrameId = requestAnimationFrame(playLoop);
    };

    if (isPlaying && !isInteractive) {
      playbackState.current.startTime = Date.now() - (playbackState.current.lastFsTime * 1000);
      animationFrameId = requestAnimationFrame(playLoop);
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, isInteractive]);

  // 3. Transition to Interactive Mode
  const handleTakeControl = async () => {
    if (!vmLoaded) return alert("WebVM is still booting. Please wait.");
    
    setIsPlaying(false);
    setIsInteractive(true);
    
    // Clear terminal and spawn a real shell connected to the WebVM
    term.current?.clear();
    term.current?.write('\r\n\x1b[32m[SWACN] Control handed over. VM environment is hydrated.\x1b[0m\r\n');
    
    await vm.current.spawnInteractiveShell(term.current);
  };

  return (
    <div className="swacn-embed" style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #333' }}>
      {/* Control Bar */}
      <div style={{ background: '#2d2d2d', padding: '8px', display: 'flex', justifyContent: 'space-between', color: '#fff' }}>
        <div>
          {!isInteractive && (
            <button onClick={() => setIsPlaying(!isPlaying)}>
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
          )}
        </div>
        <div>
          <span style={{ fontSize: '12px', marginRight: '15px' }}>
            {vmLoaded ? '🟢 VM Ready' : '🟡 Booting VM...'}
          </span>
          {!isInteractive && (
             <button disabled={!vmLoaded} onClick={handleTakeControl} style={{ cursor: vmLoaded ? 'pointer' : 'wait' }}>
               ⌨️ Take Control
             </button>
          )}
        </div>
      </div>

      {/* Terminal Canvas */}
      <div ref={terminalRef} style={{ height: '400px', width: '100%', background: '#1e1e1e', padding: '10px' }} />
    </div>
  );
};