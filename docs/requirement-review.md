# Assignment requirement and verification review

## Implemented Question 1

| Requirement | Location / behavior | Validation |
| --- | --- | --- |
| Create/join/share URL, nicknames, host, connected roster | rooms.js, players.js, connections.js; client landing/lobby | Three real Socket.IO clients tested; visible-browser flow pending |
| Host rounds/duration/custom words and start | configure/start server actions; lobby settings | Host-only rejection, accepted settings, malformed request tested |
| Pen/colors/size/eraser/fill/undo/clear | client canvas.js and toolbar; drawing.js validation | Payload/server authority and undo/clear/replay reducer tested; browser pixel/tool verification pending |
| Low-latency drawing and active-drawer authority | 35 ms batches; Socket.IO events; sequenced history | Unauthorized/stale/duplicate events tested; 10-room acknowledgement smoke benchmark |
| Random drawer, exactly 3 choices, countdown and hints | game.js shuffled rotation; rooms.js private projections | Choices, privacy and timed transitions tested; hint appearance/manual countdown pending |
| Backend guesses, fast scoring and no double score | words.js / scoring.js / chat handler | Real client scoring, duplicate rejection and stale guess tested |
| Early completion, timeout, rounds and final ranking | game.js, client results | Early finish and complete one-round lifecycle tested; multi-round browser demonstration pending |
| Chat, private Close!, system events and secret protection | bounded chat; drawers/winners muted | Private near miss, correct word suppression and mute tested |
| Server authority for secrets, timers, scores and transitions | private per-recipient state; no score mutation API | Tested via public projection and unauthorized actions |
| Thirty-second reconnect, late canvas restore, drawer recovery | reconnection.js / players.js / tab token | Immediate reconnect/score, late-join snapshot and drawer disconnect tested; actual 30-second boundary/manual refresh pending |
| Rate/payload limits, stale clients and event dedupe | rate-limit.js / drawing.js / transport cap | Chat flood/length, invalid point and stale/duplicate event rejection tested; distributed abuse not implemented |
| Every drawing replay with original timing | replay.js / client replay controls | History capture tested; visual play/pause/scrub pending |
| Responsive premium interface and screens | client main.jsx / style.css | Production build passed; no connected browser for visual verification |
| Repo structure, env examples, README, one start command | README / npm workspaces / env examples | Install and build executed; npm start serves built assets |
| Three-browser demo and two-minute recording | testing.md | Checklist delivered; actual recording is not produced |
| Canvas/latency/restart/capacity notes | technical-notes.md | Protocol documented; short load harness executed; no production capacity claim |

## Question 2

`music-architecture.md` contains the complete architecture and two Mermaid diagrams. `music-architecture.html` is a self-contained print edition with six explicitly separated sections and equivalent static SVG diagrams. It covers all four scale inputs; audio delivery/ABR/CDN/startup; metadata/publishing/search; authoritative room timestamps, clock offset, drift and ordering; queue/votes/pause/seek/late joins; database decisions; horizontal scaling/partitioning; regional failover and rolling deploys; eight failure scenarios; QoE and availability metrics; alternatives; first release for three developers and postponed work. Estimates/SLOs are proposals rather than measurements. Browser print pagination and diagram visual appearance have not been verified because no browser surface is connected.

## Actual execution evidence

- Node.js v22.16.0; Windows development host.
- Dependency installation completed. Tailwind upgraded to v4 PostCSS integration; npm audit reported **zero vulnerabilities** at installation time.
- `npm run build` succeeded with Vite. `npm test`: **4 tests passed, 0 failed** in the final suite (real Socket.IO integration, validation and canvas action reduction).
- `npm start` launched the backend on port 3001.
- `npm run load`: ten rooms / thirty real clients; 2,110 acknowledgement samples; p50 **3.48 ms**, p95 **79.17 ms**. Both client and server ran on this machine. The harness sent strokes at 20 Hz for up to 200 events per turn and sampled setup/drawing acknowledgements. These are observed smoke-test results, not rendering latency or a capacity ceiling.
- No connected browser surfaces were available. Three visible-browser end-to-end tests, mobile/touch layout, actual fill/undo raster behavior, audible music synchronization (architecture-only), soak/stress capacity and printed layout remain unverified.

## Deliberate scope limits

Game state is single-process/in-memory, as requested; restarts erase rooms. Rooms cap at twelve players. Long drawings incur full-history snapshot/rerender costs. Reconnect tokens are tab-local; expired identities are removed from scores. No account system, distributed ingress limiter, persistent replay storage or multi-worker game coordination is included. Slow-network zero-lag behavior is not guaranteed. Host sees the configured word pool, but only drawer gets the selected secret; already-correct players are muted during drawing. The actual GitHub repository publication, email submission and two-minute video are not generated or sent.
