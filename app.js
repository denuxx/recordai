/* Record AI landing — interactions. Plain JS, no dependencies. */
(() => {
  "use strict";

  // Where the "Download" buttons point. One place to change it.
  const DOWNLOAD_URL = "https://github.com/denuxx/recordai/releases/latest/download/Record-AI.dmg";
  const VERSION = "1.0";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sleepRaw = (ms) => new Promise((r) => setTimeout(r, ms));

  $$(".js-download").forEach((a) => { a.href = DOWNLOAD_URL; a.setAttribute("download", ""); });
  $("#version").textContent = "Версия " + VERSION;

  /* ---------------- Nav, reveal, glow ---------------- */
  const nav = $("#nav");
  const onScroll = () => nav.classList.toggle("scrolled", scrollY > 10);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  $$(".reveal").forEach((el, i) => {
    el.style.transitionDelay = (el.closest(".hero") ? i * 70 : 0) + "ms";
    io.observe(el);
  });

  $$(".tile").forEach((tile) => {
    tile.addEventListener("pointermove", (e) => {
      const r = tile.getBoundingClientRect();
      tile.style.setProperty("--mx", e.clientX - r.left + "px");
      tile.style.setProperty("--my", e.clientY - r.top + "px");
    });
  });

  // The demo window tilts gently toward the pointer.
  const win = $("#window");
  const hero = $(".hero");
  if (!reduceMotion && matchMedia("(pointer: fine)").matches) {
    hero.addEventListener("pointermove", (e) => {
      const r = win.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) / innerWidth;
      const y = (e.clientY - (r.top + r.height / 2)) / innerHeight;
      win.style.setProperty("--ry", (x * 8).toFixed(2) + "deg");
      win.style.setProperty("--rx", (3 - y * 6).toFixed(2) + "deg");
    });
    hero.addEventListener("pointerleave", () => {
      win.style.setProperty("--ry", "0deg");
      win.style.setProperty("--rx", "6deg");
    });
  }

  /* ---------------- Filler cleanup (same rules as the app's Fillers.swift) ---------------- */
  const Fillers = (() => {
    const hes = "(?:э{2,}|э-э[-э]*|эм+|м{2,}|хм+|а-а[-а]*|u+m+|u+h+|uhm|erm|hmm+)";
    const mid = ["ну", "короче", "короче говоря", "типа", "как бы", "в общем", "в общем-то", "так сказать",
      "это самое", "значит", "вот", "like", "you know", "i mean", "basically"];
    const start = ["ну", "короче", "короче говоря", "типа", "как бы", "в общем", "в общем-то", "так сказать",
      "это самое", "so", "like", "basically", "well", "you know", "i mean"];
    const conj = "что|чтобы|но|а|если|когда|потому|поэтому|хотя|который|которая|которые|где|как|that|but|which|because|if|when";
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
    const alt = (w) => "(?:" + [...w].sort((a, b) => b.length - a.length).map(esc).join("|") + ")";
    const L = "\\p{L}";
    const re = (p) => new RegExp(p, "giu");

    const startAlt = "(?:" + alt(start) + "|" + hes + ")";
    const startRe = re("(^|[.!?…]\\s+)(?:" + startAlt + "(?![" + L + "-])\\s*,\\s*)+");
    const midAlt = "(?:" + alt(mid) + "|" + hes + ")(?![" + L + "-])";

    const capStart = (s) => s.replace(startRe, (m, keep, offset, str) => keep + "\u0000");
    const fixCaps = (s) => s.replace(/\u0000(.)?/gu, (m, c) => (c ? c.toLocaleUpperCase("ru") : ""));

    return function clean(text) {
      let s = fixCaps(capStart(text));
      s = s.replace(re(",\\s*" + midAlt + "\\s*,\\s*(?=(?:" + conj + ")(?!" + "\\p{L}))"), ", ");
      s = s.replace(re(",\\s*" + midAlt + "\\s*,\\s*"), " ");
      s = s.replace(re(",\\s*" + midAlt + "\\s*(?=[.!?…;:]|$)"), "");
      s = s.replace(re("(^|[.!?…])(?:\\s*" + hes + "(?![" + L + "-])[,.!?…]*)+"), "$1");
      s = s.replace(re("(?<![" + L + "-])" + hes + "(?![" + L + "-])[,…]*"), "");
      s = fixCaps(capStart(s));
      s = s.replace(re("(?<!" + L + ")(" + L + "{1,3})(?:\\s+\\1)+(?!" + L + ")"), "$1");
      s = s.replace(/\s+([,.!?…;:])/g, "$1")
        .replace(/,(\s*,)+/g, ",")
        .replace(/,\s*([.!?…])/g, "$1")
        .replace(/^[\s,;:]+/, "")
        .replace(/\s{2,}/g, " ")
        .trim();
      const f = s.charAt(0);
      if (f && f !== f.toLocaleUpperCase("ru") && f !== text.charAt(0)) s = f.toLocaleUpperCase("ru") + s.slice(1);
      return s;
    };
  })();

  /* ---------------- Sound: the app's water-drop chimes, synthesized ---------------- */
  let ctx = null;
  let soundOn = false;
  const buffers = {};
  const audio = () => {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      buffers.start = render([[0, 964, 1, .0055], [.068, 964, .5, .0055], [.136, 964, .4, .0055], [.216, 964, .98, .0055]]);
      buffers.stop = render([[0, 722, 1, .008], [.094, 722, .52, .008], [.187, 722, .5, .008]]);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  };
  function render(drops) {
    const sr = ctx.sampleRate, n = Math.floor(0.32 * sr);
    const buf = ctx.createBuffer(1, n, sr), out = buf.getChannelData(0);
    for (const [time, f, g, decay] of drops) {
      const off = Math.floor(time * sr);
      for (let i = 0; i < n - off; i++) {
        const t = i / sr, w = 2 * Math.PI * t;
        const env = Math.min(1, t / 0.0015) * (Math.exp(-t / decay) + 0.02 * Math.exp(-t / 0.025));
        const tone = Math.sin(w * f) + 0.063 * Math.sin(w * (f + 150)) + 0.063 * Math.sin(w * (f - 152)) + 0.02 * Math.sin(w * (f - 305));
        out[off + i] += tone * env * g;
      }
    }
    let peak = 0; for (const v of out) peak = Math.max(peak, Math.abs(v));
    for (let i = 0; i < n; i++) out[i] = out[i] / peak * 0.85;
    return buf;
  }
  function chime(kind, force = false) {
    if (!soundOn && !force) return;
    const c = audio();
    const src = c.createBufferSource(), gain = c.createGain();
    src.buffer = buffers[kind]; gain.gain.value = 0.35;
    src.connect(gain).connect(c.destination); src.start();
  }
  const soundBtn = $("#soundBtn");
  soundBtn.addEventListener("click", () => {
    soundOn = !soundOn;
    soundBtn.setAttribute("aria-pressed", soundOn);
    if (soundOn) chime("start");
  });
  const drop = $("#dropBtn");
  drop.addEventListener("click", () => {
    chime("start", true);
    drop.classList.remove("play"); void drop.offsetWidth; drop.classList.add("play");
  });

  /* ---------------- Waveform bars (shared by the hero pill and the mini pill) ---------------- */
  function makeBars(el, count) {
    el.innerHTML = "";
    const bars = Array.from({ length: count }, () => el.appendChild(document.createElement("i")));
    const shape = bars.map((_, i) => 0.35 + 0.65 * Math.sin(Math.PI * (i + 0.5) / count));
    return { bars, shape, level: 0, target: 0 };
  }
  function drawBars(w, maxH, t) {
    // Fast attack, slow release, exactly like the app. At zero level every bar is flat.
    w.level += (w.target - w.level) * (w.target > w.level ? 0.6 : 0.15);
    w.bars.forEach((b, i) => {
      const wobble = 0.6 + 0.4 * Math.sin(t / 90 + i * 1.7) * Math.sin(t / 130 + i * 0.9);
      b.style.height = Math.max(2, w.level * w.shape[i] * maxH * wobble) + "px";
    });
  }

  const pill = $("#pill");
  const heroBars = makeBars($("#bars"), 13);
  const miniBars = makeBars($("#miniBars"), 11);
  const pillScale = () => parseFloat(getComputedStyle(pill).getPropertyValue("--s")) || 1.6;

  /* ---------------- Microphone visualizer (local only, nothing is recorded) ---------------- */
  let mic = null; // { analyser, data, stream }
  const micBtn = $("#micBtn");
  function micLevel() {
    if (!mic) return 0;
    mic.analyser.getFloatTimeDomainData(mic.data);
    let sum = 0; for (const v of mic.data) sum += v * v;
    const db = 20 * Math.log10(Math.sqrt(sum / mic.data.length) + 1e-9);
    const gate = -50;
    return Math.max(0, Math.min(1, (db - gate) / (-12 - gate)));
  }
  micBtn.addEventListener("click", async () => {
    if (mic) { stopMic(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const c = audio();
      const analyser = c.createAnalyser(); analyser.fftSize = 1024;
      c.createMediaStreamSource(stream).connect(analyser);
      mic = { analyser, data: new Float32Array(analyser.fftSize), stream };
      micBtn.setAttribute("aria-pressed", "true");
      demo.interrupt("mic");
    } catch {
      $("#demoText").textContent = "Нет доступа к микрофону — ничего страшного, демо работает и так.";
    }
  });
  function stopMic() {
    mic?.stream.getTracks().forEach((t) => t.stop());
    mic = null;
    micBtn.setAttribute("aria-pressed", "false");
    demo.interrupt("auto");
  }

  /* ---------------- Hero demo ---------------- */
  const caption = $("#caption");
  const noteText = $("#noteText");
  const keyHint = $("#keyHint");
  const demoText = $("#demoText");

  const examples = [
    "[Ну,] [короче,] завтра созвон в десять. [Эээ,] надо обсудить релиз и деплой.",
    "Слушай, вылезла ошибка: Cannot find type User in scope. Посмотришь, когда будет минутка?",
    "Это, [типа,] работает, но, [как бы,] не всегда. Push в main уже сделал.",
  ];

  const demo = {
    mode: "auto",     // "auto" | "mic"
    phase: "idle",    // "idle" | "recording" | "processing"
    skip: false,      // ends the current skippable wait early
    wake: null,
    run: 0,
    interrupt(mode) {
      if (mode) this.mode = mode;
      this.run++;
      this.skip = true;
      this.wake?.();
    },
  };

  // A wait that a key press can cut short.
  function wait(ms, skippable = true) {
    if (reduceMotion) ms = Math.min(ms, 300);
    return new Promise((resolve) => {
      if (skippable && demo.skip) { demo.skip = false; return resolve(); }
      const t = setTimeout(done, ms);
      function done() { clearTimeout(t); if (demo.wake === done) demo.wake = null; resolve(); }
      if (skippable) demo.wake = done;
    });
  }

  function pressKey() {
    keyHint.classList.add("pressed");
    setTimeout(() => keyHint.classList.remove("pressed"), 180);
  }

  function setPill(state) { pill.dataset.state = state; demo.phase = state === "hidden" ? "idle" : state; }

  function parse(example) {
    return example.split(" ").map((tok) => {
      const filler = tok.startsWith("[") && tok.endsWith("]");
      return { text: filler ? tok.slice(1, -1) : tok, filler };
    });
  }

  let exampleIndex = 0;
  async function autoCycle(run) {
    const tokens = parse(examples[exampleIndex % examples.length]);
    exampleIndex++;
    const spoken = tokens.map((t) => t.text).join(" ");
    const result = Fillers(spoken);

    // Start
    demo.skip = false;
    pressKey(); chime("start");
    setPill("recording");
    caption.className = "caption";
    caption.innerHTML = '<span class="caption-label">Вы говорите</span>' +
      tokens.map((t) => `<span class="cw${t.filler ? " filler" : ""}">${t.text} </span>`).join("");
    const words = $$(".cw", caption);
    await wait(450, false);
    if (run !== demo.run) return;

    // Speak word by word
    for (let i = 0; i < words.length; i++) {
      if (demo.skip) { words.slice(i).forEach((w) => w.classList.add("on")); break; }
      words[i].classList.add("on");
      heroBars.target = 0.55 + Math.random() * 0.45;
      const pause = /[.?!:]$/.test(tokens[i].text) ? 520 : 0;
      await wait(210 + tokens[i].text.length * 22 + pause);
      heroBars.target = pause ? 0 : heroBars.target * 0.4;
      if (run !== demo.run) return;
    }
    demo.skip = false;
    heroBars.target = 0;
    await wait(500);
    if (run !== demo.run) return;

    // Stop → processing
    pressKey(); chime("stop");
    setPill("processing");
    $$(".cw.filler", caption).forEach((w) => w.classList.add("cut"));
    await wait(750, false);
    if (run !== demo.run) return;

    // Paste
    caption.classList.add("fade");
    setPill("hidden");
    insertIntoNote(result);
    await wait(2600);
  }

  function insertIntoNote(text) {
    if (noteText.textContent.length > 150) noteText.innerHTML = "";
    const prefix = noteText.textContent ? " " : "";
    const span = document.createElement("span");
    span.className = "fresh";
    (prefix + text).split(/(\s+)/).forEach((part, i) => {
      if (!part) return;
      const w = document.createElement("span");
      w.className = "w";
      w.textContent = part;
      w.style.animationDelay = i * 18 + "ms";
      span.appendChild(w);
    });
    noteText.appendChild(span);
    setTimeout(() => span.classList.add("settled"), 1400);
  }

  async function micCycle(run) {
    setPill("recording");
    caption.className = "caption";
    caption.innerHTML = '<span class="caption-label">Микрофон включён</span>Скажите что-нибудь — волна слушает вас. Сам текст распознаётся уже в приложении, на вашем Mac.';
    $$(".cw", caption).forEach((w) => w.classList.add("on"));
    demoText.innerHTML = "Звук не записывается и никуда не отправляется";
    while (run === demo.run && demo.mode === "mic") await wait(250);
    caption.className = "caption fade";
    setPill("hidden");
    demoText.innerHTML = "Нажмите <b>⌥ Space</b> прямо сейчас — или просто смотрите";
  }

  async function loop() {
    for (;;) {
      const run = demo.run;
      try {
        if (demo.mode === "mic") await micCycle(run);
        else await autoCycle(run);
      } catch (e) { console.error(e); await sleepRaw(1000); }
      if (run !== demo.run) { setPill("hidden"); heroBars.target = 0; caption.className = "caption fade"; await sleepRaw(250); }
    }
  }

  // Frame loop for both waveforms.
  function frame(t) {
    if (demo.mode === "mic" && mic) heroBars.target = micLevel();
    drawBars(heroBars, 18 * pillScale(), t);
    drawBars(miniBars, 20, t);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ⌥ Space on the page drives the demo, like in the app: start, or finish early.
  function trigger() {
    if (demo.mode === "mic") { stopMic(); return; }
    demo.skip = true;
    demo.wake?.();
  }
  addEventListener("keydown", (e) => {
    if (e.altKey && e.code === "Space") { e.preventDefault(); if (!e.repeat) trigger(); }
  });
  keyHint.addEventListener("click", () => { audio(); trigger(); });

  // Start the demo when it scrolls into view.
  const demoIO = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { demoIO.disconnect(); setTimeout(loop, 900); }
  });
  demoIO.observe($("#demo"));

  /* ---------------- Streaming timeline ---------------- */
  (() => {
    const track = $("#tlWave").parentElement;
    const wave = $("#tlWave"), head = $("#tlHead"), chunksEl = $("#tlChunks");
    const status = $("#tlStatus"), time = $("#tlTime");
    const D = 9000; // ms of animation for the whole "recording"
    const cuts = [0, 0.27, 0.55, 0.8, 1];
    const labels = ["Привет всем!", "Итоги:", "релиз готов", "тесты ок."];
    let started = 0, done = [], running = false;

    function reset() {
      const width = track.clientWidth;
      wave.innerHTML = ""; chunksEl.innerHTML = ""; done = [];
      const n = Math.floor((width - 8) / 4);
      for (let i = 0; i < n; i++) {
        const x = i / n;
        const nearCut = cuts.some((c) => Math.abs(c - x) < 0.018);
        const h = nearCut ? 2 : 4 + Math.abs(Math.sin(i * 0.9) * Math.sin(i * 0.23)) * 24 + Math.random() * 4;
        const bar = document.createElement("i"); bar.style.height = h + "px";
        wave.appendChild(bar);
      }
      status.textContent = "Говорите…"; status.classList.remove("done");
      started = performance.now();
    }
    function chunk(i, cls, text) {
      const el = document.createElement("div");
      el.className = "tl-chunk " + cls;
      el.style.left = cuts[i] * 100 + "%";
      el.style.width = `calc(${(cuts[i + 1] - cuts[i]) * 100}% - 4px)`;
      el.textContent = text;
      chunksEl.appendChild(el);
      return el;
    }
    function tick(now) {
      if (!running) return;
      const p = Math.min(1, (now - started) / D);
      const width = track.clientWidth;
      wave.style.width = p * width + "px";
      head.style.left = p * (width - 2) + "px";
      head.style.opacity = p < 1 ? 1 : 0;
      const secs = Math.round(p * 300);
      time.textContent = Math.floor(secs / 60) + ":" + String(secs % 60).padStart(2, "0");
      // Each phrase is transcribed as soon as its pause arrives, while recording continues.
      for (let i = 0; i < 3; i++) {
        if (p >= cuts[i + 1] && !done[i]) {
          done[i] = true;
          const el = chunk(i, "busy", "");
          setTimeout(() => { el.className = "tl-chunk"; el.textContent = labels[i]; }, 900);
        }
      }
      if (p >= 1 && !done[3]) {
        done[3] = true;
        status.textContent = "Стоп. Дописываю последние слова…";
        const el = chunk(3, "busy", "");
        setTimeout(() => {
          el.className = "tl-chunk tail"; el.textContent = labels[3];
          status.textContent = "Текст готов через 0,6 с после стопа"; status.classList.add("done");
        }, 600);
        setTimeout(() => { reset(); }, 4200);
      }
      requestAnimationFrame(tick);
    }
    const tio = new IntersectionObserver((entries) => {
      const visible = entries.some((e) => e.isIntersecting);
      if (visible && !running) { running = true; reset(); requestAnimationFrame(tick); }
      if (!visible) running = false;
    });
    tio.observe($("#timeline"));
  })();

  /* ---------------- Mixed languages ---------------- */
  (() => {
    const el = $("#mixed");
    const lines = [
      [["Короче, вылезла ошибка "], ["Cannot find type User in scope", 1], [", посмотри."]],
      [["Запушил фикс в "], ["main", 1], [", завтра сделаем "], ["code review", 1], ["."]],
      [["Build failed with exit code 1", 1], [" — опять что-то с зависимостями."]],
    ];
    let i = 0;
    async function show() {
      const line = lines[i++ % lines.length];
      // An English run is one highlighted span, so the highlight doesn't break between words.
      el.innerHTML = "<span>" + line.map(([t, en]) => {
        const words = t.split(/(\s+)/).filter(Boolean).map((w) => `<span class="w">${w}</span>`).join("");
        return en ? `<span class="en">${words}</span>` : words;
      }).join("") + "</span>";
      const words = $$(".w", el);
      for (const w of words) { w.classList.add("on"); await sleepRaw(reduceMotion ? 0 : 90); }
      await sleepRaw(2800);
      words.forEach((w) => w.classList.remove("on"));
      await sleepRaw(400);
      show();
    }
    show();
  })();

  /* ---------------- Fillers playground ---------------- */
  (() => {
    const input = $("#fillerIn"), out = $("#fillerOut");
    const update = () => {
      out.textContent = Fillers(input.value) || "—";
      out.classList.remove("flash"); void out.offsetWidth; out.classList.add("flash");
    };
    input.addEventListener("input", update);
    $$("[data-sample]").forEach((b) => b.addEventListener("click", () => { input.value = b.dataset.sample; update(); }));
    update();
  })();

  /* ---------------- Hold to talk ---------------- */
  (() => {
    const key = $("#holdKey"), mini = $("#miniPill"), out = $("#holdOut");
    const phrases = ["Встреча переносится на четверг.", "Купить молоко и кофе.", "Отправь мне, пожалуйста, отчёт.", "Looks good to me, мержим."];
    let downAt = 0, timer = null, n = 0;
    function down(e) {
      e.preventDefault();
      if (downAt) return;
      downAt = performance.now();
      key.classList.add("down"); mini.classList.add("on");
      out.textContent = "Говорите…"; out.classList.remove("done");
      chime("start", true);
      timer = setInterval(() => { miniBars.target = Math.random() < 0.25 ? 0.05 : 0.5 + Math.random() * 0.5; }, 140);
    }
    function up() {
      if (!downAt) return;
      const held = performance.now() - downAt;
      downAt = 0;
      clearInterval(timer); miniBars.target = 0;
      key.classList.remove("down"); mini.classList.remove("on");
      chime("stop", true);
      if (held < 350) { out.textContent = "Держите клавишу, пока говорите"; return; }
      out.textContent = "«" + phrases[n++ % phrases.length] + "»"; out.classList.add("done");
    }
    key.addEventListener("pointerdown", down);
    addEventListener("pointerup", up);
    key.addEventListener("pointercancel", up);
    key.addEventListener("keydown", (e) => { if ((e.code === "Space" || e.code === "Enter") && !e.repeat) down(e); });
    key.addEventListener("keyup", (e) => { if (e.code === "Space" || e.code === "Enter") up(); });
  })();

  /* ---------------- Recent at caret ---------------- */
  (() => {
    const field = $("#recentText"), popup = $("#popup");
    let count = 0;
    $$(".p-row", popup).forEach((row) => row.addEventListener("click", () => {
      if (count++ % 3 === 0) field.textContent = "Привет! ";
      field.textContent += row.dataset.text + " ";
      popup.classList.add("closed");
      setTimeout(() => popup.classList.remove("closed"), 1500);
    }));
  })();
})();
