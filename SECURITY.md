# Security Policy

## Security Model

SWACN is designed as an interactive terminal recording and sharing platform. 

* **Client-Side Sandbox:** The interactive environment is executed inside the viewer's browser using a **v86 Virtual Machine (x86 WASM Emulator)** running inside a Web Worker. Because the emulator executes entirely client-side, any commands run or scripts executed inside the sandbox are isolated to the local browser window and do not affect SWACN's servers.
* **Sensitive Information Warning:** Recordings (casts) capture terminal output and input. Users are warned **never** to record or upload sensitive secrets, API keys, passwords, or personal PII.

---

## Supported Versions

Only the latest release or the current state of the main branch is actively supported with security updates.

| Version | Supported |
| :--- | :---: |
| Latest | Release / Main |

---

## Reporting a Vulnerability

If you discover a security vulnerability, please do **not** open a public issue on GitHub. Instead, report it privately so we can address it responsibly.

* **Contact:** Please open a private support ticket or direct message an administrator on our [Discord Server](https://discord.gg/aNxmb3Mr3g).
* **What to include:**
  * A description of the vulnerability.
  * Step-by-step instructions (or a proof-of-concept script/recording) to reproduce the issue.
  * The potential impact of the vulnerability.

We will acknowledge receipt of your report within **48 hours** and work to resolve the issue as quickly as possible. We request that you maintain confidentiality until we have had a reasonable amount of time to release a patch.
