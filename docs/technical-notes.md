# Technical notes

## Canvas and ordering

The canvas is 1000 x 650 logical pixels and scales responsively. Each accepted event has a unique ID, type, normalized points [0,1], six-digit color and brush size. Strokes include a gesture ID for undo grouping. The server appends sequence numbers and milliseconds since drawing start. Pointer data batches every 35 ms, with at most 64 points including the previous batch boundary. Eraser paints white. Fill uses an iterative flood fill on the deterministic rendered canvas. Undo removes the most recent gesture; clear resets visible history. Replay retains the commands, so their effects occur at original times.

The reducer retains cleared actions internally so undo can restore a cleared canvas. Undo also removes a fill operation. A pure reducer test verifies full gesture grouping, clear restoration and replay prefixes; actual browser raster differences still need visual verification.

Only the current drawer can mutate. Turn IDs reject stale events; duplicate event IDs are idempotent. Socket.IO preserves connection ordering. Clients detect sequence gaps and request a fresh state snapshot. The complete active history restores mid-turn joiners and reconnecting clients. Full snapshots are also sent on once-per-second timer updates. This prioritizes simple correctness but costs bandwidth and rerender time for dense canvases. Before scaling, split timer deltas from snapshots and add checkpoints. Drawing waits for server acceptance, adding a network round trip; zero visible lag is not guaranteed on slow connections.

Limits: 100 drawing events/second/socket, 12,000 events/turn, 64 points/event, brush size 1-40, 20 KB transport messages; chat max 200 characters and five messages/five seconds. This is basic abuse protection. A public service also needs ingress/IP connection limits and account authentication. Reconnect tokens are cryptographically random, tab-local and omitted from public state. CORS is not authentication. React escapes chat text. There is no API to assign client scores.

## State and restart behavior

The server owns secret choice, timestamps, drawer, scores, eligibility and transitions. Choices are sent only to the drawer. The lobby exposes the configured word pool; the selected word stays private until results. Drawer and correct guessers cannot send chat during drawing. One-edit near misses generate a private notice. Correct messages become system messages without echoing the secret.

Drawer disconnection ends the turn. Other disconnected players cease to block early completion; they retain score and identity for 30 seconds. The host transfers to a connected participant. Under two players, next turn returns to lobby. Expired identities are removed. Rooms disappear after all identities expire. Restart destroys in-memory rooms, scores, tokens and replays. Clients then need to create a new room. For horizontal scaling, implement room ownership with a durable event log and snapshots; a pub/sub adapter is insufficient.

## Reproducible capacity measurement

No measured room-capacity guarantee is claimed. A planning hypothesis is tens of small rooms per modest server, but full history snapshots and long replay retention can dominate memory/network. At 30 events/second and 180 seconds a turn holds 5,400 events; long games retain many turns. Hardware, word duration, event density and uplink change capacity substantially.

1. Build and start the server on a documented host. Record CPU/RAM/OS/Node and deployment limits.
2. On another host set SERVER_URL and ROOMS, then run `npm run load`. PowerShell example: `$env:ROOMS='10'`; `$env:SERVER_URL='http://HOST:3001'`. Run 10, 25, 50, 100 rooms separately.
3. The harness makes three actual clients/room, selects real words, draws at 20 Hz and keeps clients syncing. It runs for 25 seconds and prints measured acknowledgement p50/p95. These samples include setup and drawing; they are not receipt-to-render times or production capacity.
4. Record server CPU/RSS, event-loop lag and outbound bandwidth using monitoring/profiling. Keep a real browser room active and measure receipt-to-render with performance marks. Inspect errors; callback races on turn selection are tolerated by the harness.
5. Agree acceptance criteria before testing (e.g. p95 regional drawing receipt <150 ms, CPU <70%, bounded RSS, no accepted event loss). Use a ten-minute dedicated soak before claiming capacity. The included short harness is a smoke load test.

Only report results from an actual run, with host and settings. Current verification status appears in the requirement review.
