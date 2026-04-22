/*
 * Tiny Web Audio sound module for /games/.
 * Zero assets — every sound is synthesised from oscillators.
 * Global mute state persists in localStorage under "games-muted".
 *
 * Usage:
 *   <script src="/games/sfx.js"></script>
 *   SFX.jump();  SFX.eat();  SFX.crash();  etc.
 *   SFX.mountToggle(document.getElementById('mute-slot'));
 */
(function (global) {
  'use strict';

  var ctx = null;
  var muted = (function () {
    try { return localStorage.getItem('games-muted') === '1'; } catch (e) { return false; }
  })();

  function ensureCtx() {
    if (muted) return null;
    if (!ctx) {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
    }
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
    return ctx;
  }

  // Core primitive: a short tone with an attack/decay envelope.
  function tone(opts) {
    var c = ensureCtx(); if (!c) return;
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = opts.type || 'square';
    o.frequency.setValueAtTime(opts.freq, c.currentTime);
    if (opts.slideTo) {
      o.frequency.exponentialRampToValueAtTime(opts.slideTo, c.currentTime + (opts.dur || 0.12));
    }
    var vol = (opts.vol != null ? opts.vol : 0.15);
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(vol, c.currentTime + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + (opts.dur || 0.12));
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + (opts.dur || 0.12) + 0.02);
  }

  // Short noise burst (for crash/thud).
  function noise(opts) {
    var c = ensureCtx(); if (!c) return;
    var dur = opts.dur || 0.2;
    var buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    var src = c.createBufferSource();
    src.buffer = buf;
    var g = c.createGain();
    g.gain.setValueAtTime((opts.vol != null ? opts.vol : 0.12), c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    var bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = opts.freq || 400;
    bp.Q.value = 1.2;
    src.connect(bp).connect(g).connect(c.destination);
    src.start();
    src.stop(c.currentTime + dur);
  }

  var SFX = {
    jump:  function () { tone({ type: 'square',   freq: 620, slideTo: 880, dur: 0.13, vol: 0.12 }); },
    land:  function () { tone({ type: 'triangle', freq: 220, dur: 0.06, vol: 0.08 }); },
    eat:   function () { tone({ type: 'square',   freq: 520, slideTo: 880, dur: 0.09, vol: 0.14 }); },
    point: function () { tone({ type: 'square',   freq: 880, dur: 0.05, vol: 0.08 }); },
    merge: function () { tone({ type: 'triangle', freq: 440, slideTo: 660, dur: 0.12, vol: 0.12 }); },
    brick: function (pitch) {
      tone({ type: 'square', freq: 300 + ((pitch || 0) * 40), dur: 0.06, vol: 0.1 });
    },
    paddle:function () { tone({ type: 'square',   freq: 180, dur: 0.04, vol: 0.1 }); },
    wall:  function () { tone({ type: 'square',   freq: 120, dur: 0.04, vol: 0.08 }); },
    crash: function () { noise({ freq: 380, dur: 0.28, vol: 0.18 }); },
    lose:  function () {
      tone({ type: 'sawtooth', freq: 380, slideTo: 90, dur: 0.45, vol: 0.16 });
    },
    win:   function () {
      var c = ensureCtx(); if (!c) return;
      var notes = [523, 659, 784, 1046];
      notes.forEach(function (f, i) {
        setTimeout(function () { tone({ type: 'triangle', freq: f, dur: 0.14, vol: 0.15 }); }, i * 110);
      });
    },
    correct: function () { tone({ type: 'triangle', freq: 660, slideTo: 990, dur: 0.18, vol: 0.15 }); },
    wrong:   function () { tone({ type: 'sawtooth', freq: 220, slideTo: 110, dur: 0.25, vol: 0.14 }); },

    isMuted: function () { return muted; },
    setMuted: function (m) {
      muted = !!m;
      try { localStorage.setItem('games-muted', muted ? '1' : '0'); } catch (e) {}
      updateButtons();
    },
    toggle: function () { SFX.setMuted(!muted); }
  };

  // Render a small toggle button into a target element.
  var buttons = [];
  function makeBtn() {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'sfx-toggle';
    b.setAttribute('aria-label', 'Toggle sound');
    b.addEventListener('click', function () { SFX.toggle(); });
    buttons.push(b);
    paint(b);
    return b;
  }
  function paint(b) {
    b.textContent = muted ? '🔇 sound off' : '🔊 sound on';
    b.setAttribute('aria-pressed', muted ? 'true' : 'false');
  }
  function updateButtons() { buttons.forEach(paint); }
  SFX.mountToggle = function (target) {
    if (!target) return;
    target.appendChild(makeBtn());
  };

  global.SFX = SFX;
})(window);
