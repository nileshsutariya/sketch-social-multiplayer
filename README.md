# Sketch Social

A full-stack multiplayer drawing and guessing game. React, Vite, Tailwind CSS, HTML5 Canvas, Express, Socket.IO; authoritative in-memory server. Question 2 is an architecture design, not a music application.

## Complete project structure

```text
package.json / package-lock.json / .gitignore
client/
  package.json / index.html / .env.example
  vite.config.js / postcss.config.js
  src/main.jsx          # screens, sockets, drawing input and replay
  src/canvas.js         # stroke reducer, undo, clear and flood fill
  src/style.css         # responsive theme and Tailwind
server/
  package.json / .env.example
  src/index.js          # Express and Socket.IO initialization
  src/connections.js    # actions, chat, identity and reconnection
  src/rooms.js          # rooms and privacy projections
  src/players.js        # identity creation and restoration
  src/reconnection.js   # disconnect grace period and host transfer
  src/replay.js         # completed-turn history
  src/game.js           # timers, turns, rounds, words and replay capture
  src/words.js          # sample words and guess validation
  src/scoring.js        # time-based scores
  src/drawing.js        # payload validation
  src/rate-limit.js     # action limits
  test/game.test.js     # real three-client integration tests
  test/canvas.test.js   # undo/clear and replay reducer tests
scripts/load.mjs        # reproducible room/stroke load harness
scripts/build-architecture.py # regenerate self-contained print edition
docs/
  technical-notes.md / testing.md / requirement-review.md
  music-architecture.md / music-architecture.html
```

## Installation and one-command startup

Requires Node.js 22+ and npm. Install once: `npm install`.

Start both frontend and backend with one command:

```sh
npm run dev
```

Open http://localhost:5173. On PowerShell with script execution disabled use `npm.cmd` in place of `npm`. Create a room and open the invite in two separate browsers/profiles.

For devices on the same Wi-Fi, use this computer's LAN address instead of localhost (currently http://192.168.1.94:5173). Both services bind to 0.0.0.0. Keep VITE_SERVER_URL unset so the frontend's same-origin proxy works from every device. The server's CLIENT_ORIGIN accepts comma-separated frontend origins. Use the invite copied from the LAN URL to join the same room. DHCP may change this IP later.

Defaults work without configuration. To override, copy `server/.env.example` to `server/.env`. PORT defaults to 3001; CLIENT_ORIGIN defaults to http://localhost:5173. If changing the port, also update the Vite proxy target. Optional `client/.env.example` specifies a direct backend URL. Never put secrets in Vite variables.

For one-process hosting run `npm run build`, then `npm start` and open http://localhost:3001. Use TLS and a WebSocket-capable reverse proxy for public deployment. The in-memory implementation requires one Node process. Restart loses all rooms, identities, scores and replays; a Socket.IO adapter alone cannot make independent workers share game state.

## Gameplay

Rooms support 12 players. Host settings: 1-8 rounds, 20-180 seconds, 3-200 distinct custom words. Players draw once each in a shuffled order per round; late joiners watch the current turn and become eligible next turn. Selection times out after 15 seconds. Drawers and correct guessers are muted during drawing to prevent word disclosure. Fast correct guesses award 100-500 points, plus 50 to the drawer. Scores cannot be submitted by clients.

Disconnects reserve identity for 30 seconds; network recovery restores it. Refresh retains the tab's token. A disconnected drawer immediately ends its turn. Host authority transfers to a connected player. With fewer than two connected players the next turn returns to lobby; a new start resets scores. Expired players leave rankings.

At the end select a completed drawing to replay, pause or scrub, including original stroke, fill, undo and clear timing. New games replace replay history.

## Validation and deliverables

Run `npm test` and `npm run build`. See [testing](docs/testing.md) for a complete three-browser checklist and two-minute recording script. See [technical notes](docs/technical-notes.md) for synchronization, security limits, restart behavior and reproducible capacity measurement. [Requirement review](docs/requirement-review.md) records actual validation and limitations.

The music architecture is supplied as Markdown with two Mermaid diagrams and a six-page print-ready HTML document. Open `docs/music-architecture.html` and print at A4, 100% scale with browser headers/footers disabled. The architecture estimates are explicitly distinguished from measured results.

The actual screen recording, GitHub publication and emailing the assignment are separate submission tasks; this generator does not send or publish them.

Tailwind v4 uses its official [PostCSS integration](https://tailwindcss.com/docs/installation/using-postcss). Run `npm run format` to format the source. The architecture HTML can be regenerated with `python scripts/build-architecture.py` using Python 3 without dependencies.
