/// <reference lib="webworker" />
declare const self: SharedWorkerGlobalScope;

// Relay SharedWorker — a simple broadcast relay for V86VM master/client IPC.
// All same-origin iframes that embed the same project connect here.
// Messages from any port are forwarded to all OTHER ports instantly.
// No V86 logic — just fast MessagePort relay (~0.1ms vs localStorage ~5-20ms).

const ports = new Set<MessagePort>();

self.addEventListener('connect', (e: MessageEvent) => {
  const port = e.ports[0];
  ports.add(port);
  port.start();

  port.addEventListener('message', (msg: MessageEvent) => {
    for (const p of ports) {
      if (p !== port) {
        p.postMessage(msg.data);
      }
    }
  });

  // Clean up on disconnect
  port.addEventListener('close', () => {
    ports.delete(port);
  });
});
