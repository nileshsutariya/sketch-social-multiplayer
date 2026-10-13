import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";
import { render, W, H } from "./canvas.js";
import { eventId } from "./event-id.js";
import "./style.css";
const socket = io(import.meta.env.VITE_SERVER_URL || undefined, {
  autoConnect: false,
});
const emit = (event, data) =>
  new Promise((resolve) =>
    socket
      .timeout(5000)
      .emit(event, data, (err, result) =>
        resolve(
          err ? { error: "Server did not respond. Please reconnect." } : result,
        ),
      ),
  );
function App() {
  const [state, setState] = useState(null),
    [identity, setIdentity] = useState(null),
    [name, setName] = useState(""),
    [roomId, setRoomId] = useState(
      new URLSearchParams(location.search).get("room") || "",
    ),
    [notice, setNotice] = useState(""),
    [connected, setConnected] = useState(false),
    [joining, setJoining] = useState(false);
  const [text, setText] = useState(""),
    [settings, setSettings] = useState(null),
    [tool, setTool] = useState("pen"),
    [color, setColor] = useState("#4338ca"),
    [size, setSize] = useState(6),
    [replay, setReplay] = useState(null),
    [replayTime, setReplayTime] = useState(0),
    [playing, setPlaying] = useState(false);
  const canvas = useRef(null),
    live = useRef(null),
    session = useRef(null),
    pending = useRef([]),
    drag = useRef(null),
    chatEnd = useRef(null);
  const drawer =
    state?.drawer === identity?.player && state?.phase === "drawing";
  useEffect(() => {
    const restore = async () => {
      setConnected(true);
      const saved = session.current;
      if (saved) {
        const result = await emit("join", saved);
        if (result.error) setNotice(result.error);
        else setIdentity(result);
      }
    };
    const receive = (s) => {
      live.current = s;
      setState(s);
      if (s.phase === "lobby") setSettings((old) => old || s.settings);
    };
    const drawing = ({ turnId, event }) => {
      const s = live.current;
      if (!s || s.turnId !== turnId) return;
      if (event.seq <= s.seq) return;
      if (event.seq !== s.seq + 1) {
        socket.emit("sync");
        return;
      }
      const next = { ...s, seq: event.seq, events: [...s.events, event] };
      live.current = next;
      setState(next);
    };
    socket.on("connect", restore);
    socket.on("disconnect", () => {
      setConnected(false);
      drag.current = null;
      pending.current = [];
    });
    socket.on("state", receive);
    socket.on("drawing", drawing);
    socket.on("notice", setNotice);
    socket.on("connect_error", () =>
      setNotice("Cannot connect to the server."),
    );
    try {
      const saved = JSON.parse(
        sessionStorage.getItem(
          "session:" + new URLSearchParams(location.search).get("room"),
        ) || "null",
      );
      if (saved) {
        session.current = saved;
        setName(saved.name);
        socket.connect();
      }
    } catch {
      setNotice("Enter your nickname to rejoin.");
    }
    return () => {
      socket.off("connect", restore);
      socket.off("state", receive);
      socket.off("drawing", drawing);
      socket.removeAllListeners("disconnect");
      socket.removeAllListeners("notice");
      socket.removeAllListeners("connect_error");
    };
  }, []);
  useEffect(() => {
    if (canvas.current)
      render(
        canvas.current,
        replay
          ? replay.events.filter((e) => e.at <= replayTime)
          : state?.events || [],
      );
  }, [state?.events, replay, replayTime]);
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: "nearest" });
  }, [state?.chat]);
  useEffect(() => {
    if (!playing || !replay) return;
    let previous = performance.now();
    const timer = setInterval(() => {
      const now = performance.now(),
        delta = now - previous;
      previous = now;
      setReplayTime((t) => {
        if (t + delta >= replay.duration) {
          setPlaying(false);
          return replay.duration;
        }
        return t + delta;
      });
    }, 30);
    return () => clearInterval(timer);
  }, [playing, replay]);
  useEffect(() => {
    const timer = setInterval(() => flush(), 35);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    drag.current = null;
    pending.current = [];
    setTool("pen");
  }, [state?.turnId]);
  async function action(event, data) {
    const result = await emit(event, data);
    if (result?.error) setNotice(result.error);
    return result;
  }
  async function join(create) {
    if (joining) return;
    setJoining(true);
    setNotice("");
    if (!socket.connected) {
      socket.connect();
      await new Promise((resolve) => {
        if (socket.connected) resolve();
        else {
          socket.once("connect", resolve);
          setTimeout(resolve, 5000);
        }
      });
    }
    const token = sessionStorage.getItem("token:" + roomId);
    const result = await action("join", { create, room: roomId, name, token });
    if (result?.room) {
      setIdentity(result);
      session.current = { room: result.room, name, token: result.token };
      sessionStorage.setItem("token:" + result.room, result.token);
      sessionStorage.setItem(
        "session:" + result.room,
        JSON.stringify(session.current),
      );
      history.replaceState(null, "", "?room=" + result.room);
      setRoomId(result.room);
    }
    setJoining(false);
  }
  function point(e) {
    const rect = canvas.current.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    ];
  }
  function sendEvent(event) {
    const s = live.current;
    if (!s || !socket.connected) return;
    socket
      .timeout(5000)
      .emit("draw", { turnId: s.turnId, event }, (err, res) => {
        if (err || res?.error) {
          setNotice(res?.error || "Drawing connection interrupted.");
          socket.emit("sync");
        }
      });
  }
  function flush() {
    if (!pending.current.length || !drag.current) return;
    const points = pending.current.splice(0, 63);
    const d = drag.current;
    if (d.last) points.unshift(d.last);
    sendEvent({
      id: eventId(),
      type: "stroke",
      gesture: d.gesture,
      color: d.color,
      size: d.size,
      points,
    });
    d.last = points.at(-1);
  }
  function down(e) {
    if (!drawer || replay) return;
    e.preventDefault();
    canvas.current.setPointerCapture(e.pointerId);
    const p = point(e);
    if (tool === "fill") {
      sendEvent({
        id: eventId(),
        type: "fill",
        color,
        size,
        points: [p],
      });
      return;
    }
    drag.current = {
      gesture: eventId(),
      color: tool === "eraser" ? "#ffffff" : color,
      size,
    };
    pending.current = [p];
  }
  function move(e) {
    if (!drag.current) return;
    pending.current.push(point(e));
    if (pending.current.length >= 64) flush();
  }
  function up(e) {
    if (!drag.current) return;
    pending.current.push(point(e));
    while (pending.current.length) flush();
    pending.current = [];
    drag.current = null;
  }
  const seconds = state
    ? Math.max(0, Math.ceil((state.deadline - state.serverTime) / 1000))
    : 0;
  const host = state?.host === identity?.player;
  return (
    <div className="shell">
      <header>
        <a className="brand" href="/">
          ✳{" "}
          <span>
            sketch<span className="accent">social</span>
          </span>
        </a>
        <span className="badge">
          {state
            ? connected
              ? "● Connected"
              : "○ Reconnecting…"
            : "DRAW · GUESS · CONNECT"}
        </span>
      </header>
      {!state ? (
        <main className="landing">
          <div>
            <span className="eyebrow">A LITTLE ART. A LOT OF LAUGHS.</span>
            <h1>
              Great guesses.
              <br />
              <span className="accent">Questionable art.</span>
            </h1>
            <p>
              Bring your friends, grab a brush, and turn your imagination into a
              multiplayer guessing game.
            </p>
            <div className="art">
              ✎ <span>your next masterpiece starts here</span> ✦
            </div>
          </div>
          <form
            className="panel join"
            onSubmit={(e) => {
              e.preventDefault();
              join(false);
            }}
          >
            <h2>Make room for fun.</h2>
            <label>
              Your nickname
              <input
                required
                maxLength="24"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Picasso-ish"
              />
            </label>
            <button
              type="button"
              disabled={!name.trim() || joining}
              onClick={() => join(true)}
            >
              Create a room →
            </button>
            <div className="divider">or join your friends</div>
            <label>
              Room code
              <input
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.trim())}
                placeholder="Paste the room code"
                required
              />
            </label>
            <button
              className="secondary"
              disabled={joining || !name.trim() || !roomId}
            >
              Join room
            </button>
          </form>
        </main>
      ) : (
        <main>
          <div className="room-heading">
            <div>
              <span className="eyebrow">YOUR CREATIVE CORNER</span>
              <h2>Room {state.id}</h2>
            </div>
            <button
              className="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(location.href);
                  setNotice("Invite link copied.");
                } catch {
                  setNotice(location.href);
                }
              }}
            >
              Copy invite link ↗
            </button>
          </div>
          <div className="game-grid">
            <aside className="panel players">
              <h3>
                {state.phase === "finished" ? "Final rankings" : "The crew"}{" "}
                <span>{state.players.length}/12</span>
              </h3>
              {[...state.players]
                .sort((a, b) => b.score - a.score)
                .map((p, i) => (
                  <div
                    key={p.id}
                    className={
                      "player " + (p.id === state.drawer ? "active" : "")
                    }
                  >
                    <span className="avatar">{i + 1}</span>
                    <div>
                      <strong>
                        {p.name}
                        {p.id === identity?.player ? " (you)" : ""}
                      </strong>
                      <small>
                        {!p.connected
                          ? "Reconnecting…"
                          : p.id === state.drawer
                            ? "✎ Drawing"
                            : state.guessed.includes(p.id)
                              ? "✓ Guessed"
                              : p.id === state.host
                                ? "Room host"
                                : "Ready to play"}
                      </small>
                    </div>
                    <b>{p.score}</b>
                  </div>
                ))}
            </aside>
            <section className="panel board">
              <div className="board-top">
                <span>
                  {replay
                    ? "TURN REPLAY"
                    : state.phase === "lobby"
                      ? "WAITING LOBBY"
                      : `ROUND ${state.round} / ${state.settings.rounds}`}
                </span>
                <strong className="word">
                  {replay
                    ? replay.word
                    : state.word || state.hint || "Ready, set, sketch."}
                </strong>
                <span className="timer">
                  {state.deadline && !replay ? seconds + "s" : "✦"}
                </span>
              </div>
              {state.phase === "lobby" ? (
                <div className="lobby">
                  <h2>Good company. Blank canvas.</h2>
                  <p>
                    Invite at least one friend to start. Each player takes a
                    turn drawing.
                  </p>
                  {host && settings ? (
                    <div className="settings">
                      <label>
                        Rounds
                        <input
                          type="number"
                          min="1"
                          max="8"
                          value={settings.rounds}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              rounds: Number(e.target.value),
                            })
                          }
                        />
                      </label>
                      <label>
                        Seconds per drawing
                        <input
                          type="number"
                          min="20"
                          max="180"
                          value={settings.duration}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              duration: Number(e.target.value),
                            })
                          }
                        />
                      </label>
                      <label className="wide">
                        Word list (comma separated)
                        <textarea
                          value={settings.words.join(", ")}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              words: e.target.value
                                .split(",")
                                .map((w) => w.trim()),
                            })
                          }
                        />
                      </label>
                      <button
                        onClick={async () => {
                          const r = await action("configure", settings);
                          if (r?.ok) await action("start", {});
                        }}
                      >
                        Save & start game →
                      </button>
                    </div>
                  ) : (
                    <p>The host is setting up your game.</p>
                  )}
                </div>
              ) : (
                <>
                  <canvas
                    ref={canvas}
                    width={W}
                    height={H}
                    onPointerDown={down}
                    onPointerMove={move}
                    onPointerUp={up}
                    onPointerCancel={up}
                    style={{ cursor: drawer ? "crosshair" : "default" }}
                    aria-label="Shared drawing canvas"
                  />
                  {drawer && !replay && (
                    <div className="toolbar">
                      {["pen", "eraser", "fill"].map((t) => (
                        <button
                          key={t}
                          className={tool === t ? "selected" : "secondary"}
                          onClick={() => setTool(t)}
                        >
                          {t}
                        </button>
                      ))}
                      <input
                        aria-label="Drawing colour"
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                      />
                      <label>
                        Brush{" "}
                        <input
                          aria-label="Brush size"
                          type="range"
                          min="1"
                          max="40"
                          value={size}
                          onChange={(e) => setSize(Number(e.target.value))}
                        />
                        {size}
                      </label>
                      {["undo", "clear"].map((type) => (
                        <button
                          key={type}
                          className="secondary"
                          onClick={() => sendEvent({ id: eventId(), type })}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  )}
                  {state.phase === "choosing" && (
                    <div
                      className={
                        identity?.player === state.drawer
                          ? "status word-modal"
                          : "status"
                      }
                      role={
                        identity?.player === state.drawer ? "dialog" : undefined
                      }
                      aria-label="Secret word selection"
                    >
                      <h3>
                        {identity?.player === state.drawer
                          ? "Choose your secret word"
                          : "The artist is choosing a word…"}
                      </h3>
                      {state.choices.map((word) => (
                        <button
                          key={word}
                          onClick={() =>
                            action("choose", { turnId: state.turnId, word })
                          }
                        >
                          {word}
                        </button>
                      ))}
                    </div>
                  )}
                  {state.phase === "results" && (
                    <div className="status">
                      <h3>The word was {state.word || "not selected"}.</h3>
                      <p>
                        Next turn in {seconds}s · {state.guessed.length} correct
                        guesses
                      </p>
                    </div>
                  )}
                  {state.phase === "finished" && (
                    <div className="status">
                      <h2>
                        {
                          state.players
                            .slice()
                            .sort((a, b) => b.score - a.score)[0]?.name
                        }{" "}
                        takes the crown ♛
                      </h2>
                      <div className="replays">
                        <label>
                          Watch a completed turn
                          <select
                            value={replay?.turnId || ""}
                            onChange={(e) => {
                              setReplay(
                                state.replays.find(
                                  (r) => r.turnId === e.target.value,
                                ) || null,
                              );
                              setReplayTime(0);
                              setPlaying(false);
                            }}
                          >
                            <option value="">Choose a drawing</option>
                            {state.replays.map((r, i) => (
                              <option value={r.turnId} key={r.turnId}>
                                Turn {i + 1} · {r.drawer} ·{" "}
                                {r.word || "No word"}
                              </option>
                            ))}
                          </select>
                        </label>
                        {replay && (
                          <>
                            <button
                              onClick={() => {
                                if (replayTime >= replay.duration)
                                  setReplayTime(0);
                                setPlaying(!playing);
                              }}
                            >
                              {playing ? "Pause" : "Play replay"}
                            </button>
                            <input
                              aria-label="Replay position"
                              type="range"
                              min="0"
                              max={replay.duration || 1}
                              value={replayTime}
                              onChange={(e) =>
                                setReplayTime(Number(e.target.value))
                              }
                            />
                          </>
                        )}
                        {host && (
                          <button
                            onClick={() => {
                              setReplay(null);
                              action("start", {});
                            }}
                          >
                            Play again
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
            <aside className="panel chat">
              <h3>
                Room chat <span>✧</span>
              </h3>
              <div className="messages">
                {state.chat.map((m) => (
                  <p key={m.id} className={m.system ? "system" : ""}>
                    {m.name && <strong>{m.name}: </strong>}
                    {m.text}
                  </p>
                ))}
                <div ref={chatEnd} />
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const r = await action("chat", {
                    text,
                    turnId: state.turnId,
                  });
                  if (r?.ok) setText("");
                }}
              >
                <input
                  maxLength="200"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type your guess…"
                  aria-label="Chat message or guess"
                />
                <button
                  disabled={!connected || !text.trim()}
                  aria-label="Send message"
                >
                  ↑
                </button>
              </form>
              <small>Be kind. Guess boldly.</small>
            </aside>
          </div>
        </main>
      )}
      {notice && (
        <div role="status" className="toast" onClick={() => setNotice("")}>
          {notice}
          <button className="secondary" aria-label="Dismiss notification">
            ×
          </button>
        </div>
      )}
      <footer>Made for the moments between the masterpieces.</footer>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
