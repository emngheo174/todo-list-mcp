# MCP-UI Project (Local)

This repository demonstrates running an MCP server that serves UI resources and a small web client that connects via WebSocket.

## Requirements
- Node.js 18+ and `npm`
- Internet access if you use the CDN-hosted web component

## Install dependencies
From the project root:

```bash
npm install
```

## Run the MCP server (HTTP + WebSocket)
The project includes `server.ts` (TypeScript). The quickest way to run it locally is with `tsx`:

```bash
npx tsx server.ts
```

By default the server listens on port `8000`:
- Web UI (serving `src/index.html`): http://localhost:8000
- WebSocket endpoint for MCP: ws://localhost:8000

If `npx tsx` is not available, install it as a dev dependency:

```bash
npm install -D tsx
npx tsx server.ts
```

## Run the client (Vite)
This repo also contains a Vite configuration (used for development). To run the client with Vite:

```bash
npm run dev
```

Vite typically serves at `http://localhost:5173`. The client connects to the MCP WebSocket at `ws://localhost:8000`, so make sure the MCP server is running first.

## How it works (brief)
- `server.ts` creates an MCP server and registers a tool named `get_project_status`. When invoked it returns a UI resource (HTML) that the client can render.
- `src/index.html` is a simple web client that connects to the MCP server over WebSocket and calls the tool via a JSON-RPC message (`method: "tools/call"`).
- The UI component from `@mcp-ui/client` is loaded from a CDN in `src/index.html`. A small `process` polyfill is included there to avoid "process is not defined" errors in browsers.

## Troubleshooting
- `Uncaught ReferenceError: process is not defined`
  - A tiny polyfill is added at the top of `src/index.html`. Ensure the polyfill script runs before importing the web component.

- `Failed to resolve module specifier "@mcp-ui/client/..."`
  - The client import uses a CDN (jsDelivr or unpkg). If you prefer offline usage, install `@mcp-ui/client` and serve it locally.

- TypeScript/Node type errors (e.g. missing `http`, `fs`, or `@types/node`):
  - Install development types: `npm install -D @types/node typescript`.

## Next steps I can help with
- Add a `start` script to `package.json` so you can run the server with `npm start`.
- Replace the CDN web component with a simple HTML renderer if you want to avoid loading external scripts.
- Debug specific console errors — paste logs or describe what you see and I will help fix them.

---
README updated at `d:\\code\\test\\mcp-ui-project\\README.md`.