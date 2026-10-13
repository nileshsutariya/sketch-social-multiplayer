# Three-browser acceptance checklist

Use Chrome, Edge and Firefox, or three separate profiles. Names: Ada, Ben, Cy. A copied tab may clone session storage, so isolated sessions are preferable.

1. Ada creates a room; Ben and Cy follow the invite. All see nicknames. Ben cannot change settings/start. Ada sets one round, 20 seconds, and `castle, rocket, butterfly`. Start. Only the drawer sees three choices. On a later turn let selection expire to verify automatic choice.
2. Choose a word. Check countdown and progressive hints. Inspect guesser network traffic: no secret or three-choice array. Attempt client-supplied score fields: scores remain server-controlled.
3. Pen, colors, brush size, eraser, fill, undo a long multi-batch gesture, clear; compare all canvases and resize a browser. Watchers cannot draw. Use dev tools to send stale turn IDs and duplicate stroke IDs; stale actions fail and duplicates do not add history.
4. Send `castl` for `castle`: only that player sees Close! Correct guesses show a success system message without the word. Repeat a correct guess: no score increment. Attempt chat afterward: muted. Compare early versus late guess points over different turns.
5. Both eligible guessers guess: turn ends early. On another turn let timer expire. Check results, auto transition, one drawer turn per round, total configured rounds and final rankings.
6. Refresh a watcher within 30 seconds: rejoin with token, score and canvas. Toggle network offline for <30 seconds then restore. Repeat >30 seconds: identity expires. Disconnect drawer mid-turn: transition continues. Disconnect host: connected player gains host role. With only one connected player next turn returns to lobby.
7. Add a fourth mid-turn browser: canvas restores, next-turn eligibility is enforced. Test unknown room, empty nickname, 12-player cap, invalid settings, excessive message length via dev tools and drawing/chat flood limits.
8. At end select each completed drawing, play/pause and scrub. Check original event order and timing including undo/fill/clear. Play again resets score/replays. Restart server: rooms are intentionally lost; create a fresh one.

`npm test` exercises three actual Socket.IO connections against an ephemeral server, independently of these visible-browser tests. `npm run build` checks compilation. Manual checks must not be inferred from automated test success.

## Two-minute screen recording

- 0:00-0:20: three visible browser sessions; create and join through invite, show host settings.
- 0:20-0:45: choose one of three private words; draw and show colors, size, eraser, fill, undo, clear.
- 0:45-1:05: near miss, correct guess and duplicate; show private hint and scoreboard.
- 1:05-1:25: refresh watcher; retained score/canvas. Disconnect drawer and show recovery.
- 1:25-1:45: complete short turns; hints, timer, automatic flow and final ranking.
- 1:45-2:00: replay and pause; briefly show run command and architecture diagrams.

Prepare short settings before recording. This file supplies a checklist, not a completed recording.
