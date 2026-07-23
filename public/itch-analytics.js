/**
 * Itch Analytics SDK — drop into any itch.io web game.
 * Usage:
 *   ItchAnalytics.init({ gameId, writeKey, apiUrl })
 *   ItchAnalytics.progress('forest', { name: 'Лес', index: 2 })
 *   ItchAnalytics.event('buy_hint', 1)
 */
(function (global) {
  "use strict";

  var STORAGE_PLAYER = "ia_player_id";
  var STORAGE_SESSION = "ia_session_id";
  var HEARTBEAT_MS = 15000;
  var FLUSH_MS = 5000;
  var queue = [];
  var cfg = null;
  var sessionId = null;
  var sessionStartedAt = null;
  var heartbeatTimer = null;
  var flushTimer = null;
  var playerId = null;

  function uuid() {
    if (global.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "p_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function detectPlatform() {
    var ua = (navigator.userAgent || "").toLowerCase();
    if (ua.indexOf("windows") >= 0) return "windows";
    if (ua.indexOf("mac os") >= 0 || ua.indexOf("macintosh") >= 0) return "mac";
    if (ua.indexOf("linux") >= 0) return "linux";
    if (ua.indexOf("android") >= 0) return "android";
    if (ua.indexOf("iphone") >= 0 || ua.indexOf("ipad") >= 0) return "ios";
    return "web";
  }

  function getPlayerId() {
    try {
      var id = localStorage.getItem(STORAGE_PLAYER);
      if (!id) {
        id = "pl_" + uuid().replace(/-/g, "").slice(0, 16);
        localStorage.setItem(STORAGE_PLAYER, id);
      }
      return id;
    } catch (e) {
      return "pl_anon_" + uuid().slice(0, 8);
    }
  }

  function enqueue(ev) {
    if (!cfg) return;
    ev.playerId = playerId;
    ev.platform = detectPlatform();
    ev.ts = Date.now();
    if (sessionId) ev.sessionId = sessionId;
    queue.push(ev);
  }

  function flush(sync) {
    if (!cfg || !queue.length) return;
    var batch = queue.splice(0, queue.length);
    var url = cfg.apiUrl.replace(/\/$/, "") + "/api/ingest";
    var body = JSON.stringify({ events: batch });
    var headers = { "Content-Type": "application/json", "X-Write-Key": cfg.writeKey };

    if (sync && navigator.sendBeacon) {
      try {
        var blob = new Blob([body], { type: "application/json" });
        // sendBeacon cannot set custom headers — fall back to fetch keepalive
      } catch (e) {}
    }

    try {
      fetch(url, {
        method: "POST",
        headers: headers,
        body: body,
        keepalive: !!sync,
        mode: "cors",
      }).catch(function () {
        queue = batch.concat(queue);
      });
    } catch (e) {
      queue = batch.concat(queue);
    }
  }

  function startSession() {
    sessionId = "s_" + uuid().replace(/-/g, "").slice(0, 16);
    sessionStartedAt = Date.now();
    try {
      sessionStorage.setItem(STORAGE_SESSION, sessionId);
    } catch (e) {}
    enqueue({ type: "session_start", sessionId: sessionId });
    flush(false);
  }

  function endSession(sync) {
    if (!sessionId || !sessionStartedAt) return;
    var durationMs = Math.max(0, Date.now() - sessionStartedAt);
    enqueue({
      type: "session_end",
      sessionId: sessionId,
      durationMs: durationMs,
    });
    flush(sync);
  }

  function heartbeat() {
    if (!sessionId || !sessionStartedAt) return;
    enqueue({
      type: "heartbeat",
      sessionId: sessionId,
      durationMs: Math.max(0, Date.now() - sessionStartedAt),
    });
    flush(false);
  }

  var api = {
    init: function (options) {
      if (!options || !options.writeKey) {
        console.warn("[ItchAnalytics] writeKey required");
        return api;
      }
      cfg = {
        gameId: options.gameId || "",
        writeKey: options.writeKey,
        apiUrl: options.apiUrl || "",
      };
      if (!cfg.apiUrl) {
        console.warn("[ItchAnalytics] apiUrl required");
        return api;
      }
      playerId = getPlayerId();
      startSession();

      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = setInterval(heartbeat, HEARTBEAT_MS);
      if (flushTimer) clearInterval(flushTimer);
      flushTimer = setInterval(function () {
        flush(false);
      }, FLUSH_MS);

      global.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "hidden") endSession(true);
        else if (document.visibilityState === "visible" && !sessionId) startSession();
      });
      global.addEventListener("pagehide", function () {
        endSession(true);
      });
      return api;
    },

    progress: function (levelId, opts) {
      opts = opts || {};
      enqueue({
        type: "progress",
        levelId: String(levelId),
        levelName: opts.name || opts.levelName || String(levelId),
        levelIndex: opts.index != null ? opts.index : opts.levelIndex != null ? opts.levelIndex : 0,
      });
      return api;
    },

    event: function (name, value) {
      enqueue({
        type: "event",
        name: String(name),
        value: value != null ? Number(value) : null,
      });
      return api;
    },

    flush: function () {
      flush(false);
      return api;
    },

    getPlayerId: function () {
      return playerId;
    },
  };

  global.ItchAnalytics = api;
})(typeof window !== "undefined" ? window : globalThis);
