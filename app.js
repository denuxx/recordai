/* Record AI landing — interactions. Plain JS, no dependencies. */
(() => {
  "use strict";

  // Where the "Download" buttons point. One place to change it.
  const DOWNLOAD_URL = "https://github.com/denuxx/recordai/releases/latest/download/Record-AI.dmg";
  const VERSION = "1.1.1";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const motion = matchMedia("(prefers-reduced-motion: reduce)");

  $$(".js-download").forEach((a) => { a.href = DOWNLOAD_URL; a.setAttribute("download", ""); });
  $("#version").textContent = "Версия " + VERSION;

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
  function chime(kind) {
    if (!soundOn) return;
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

  /* The graphic and the scripted transcription both work without microphone access. */
  const instrument = $("#demo");
  const pill = $("#pill");
  const bars = Array.from({ length: 13 }, () => $("#bars").appendChild(document.createElement("i")));
  const idleHeights = [3, 5, 8, 13, 9, 18, 14, 10, 16, 11, 7, 5, 3];
  const caption = $("#caption");
  const noteText = $("#noteText");
  const status = $("#demoText");
  const micBtn = $("#micBtn");
  const examples = [
    "[Ну,] [короче,] покажу прототип завтра на встрече.",
    "После code review отправлю правки.",
    "[Эээ,] сделай текст короче, пожалуйста.",
  ];
  let exampleIndex = 0;
  let phase = "ready";
  let tokens = [];
  let spoken = "";
  let previousNote = noteText.textContent;
  let timer = 0;
  let frameId = 0;
  let autoTimer = 0;
  let mic = null;
  let micRequest = 0;

  function announce(text, visible = false) {
    status.classList.toggle("sr-only", !visible);
    status.textContent = text;
  }
  function preventAutoplay() {
    clearTimeout(autoTimer);
    autoObserver.disconnect();
  }
  function setPhase(next) {
    clearTimeout(timer);
    cancelAnimationFrame(frameId);
    phase = next;
    instrument.dataset.phase = next;
    pill.dataset.state = next;
    const active = next === "recording" || next === "mic";
    $("#cancelDemo").disabled = !active;
    $("#confirmDemo").disabled = !active;
    $("#playIcon").setAttribute("href", active ? "#i-stop" : "#i-play");
    const labels = {ready: "Запустить демо", recording: "Вставить текст", processing: "Распознавание…", done: "Повторить демо", mic: "Выключить микрофон"};
    $("#playLabel").textContent = labels[next];
    $("#keyHint").disabled = next === "processing";
    bars.forEach((bar, i) => { bar.style.height = idleHeights[i] + "px"; });
    if (active && (!motion.matches || mic)) frameId = requestAnimationFrame(draw);
  }
  function draw(now) {
    let level = .55 + .35 * Math.sin(now / 170);
    if (mic) {
      mic.analyser.getFloatTimeDomainData(mic.samples);
      let sum = 0;
      for (const sample of mic.samples) sum += sample * sample;
      const db = 20 * Math.log10(Math.sqrt(sum / mic.samples.length) + 1e-9);
      level = Math.min(1, Math.max(0, (db + 50) / 38));
      if (now - mic.lastDraw >= (motion.matches ? 200 : 45)) {
        mic.envelope.shift();
        mic.envelope.push(Math.round(1 + level * 43));
        mic.trace.setAttribute("d", mic.envelope.map((height, i) => "M" + (i * 2 + 1) + " " + (50 - height) + "v" + height * 2).join(" "));
        mic.lastDraw = now;
      }
    }
    if (!motion.matches) {
      bars.forEach((bar, i) => {
        const wobble = .65 + .35 * Math.sin(now / 100 + i * 1.3);
        bar.style.height = (2 + level * (23 - Math.abs(i - 6) * 2) * wobble) + "px";
      });
    }
    frameId = requestAnimationFrame(draw);
  }

  function prepareExample() {
    const example = examples[exampleIndex++ % examples.length];
    caption.replaceChildren(document.createTextNode("«"));
    tokens = example.split(" ").map((token, i) => {
      const word = document.createElement("span");
      word.className = token.startsWith("[") ? "word filler" : "word";
      word.textContent = token.replace(/^\[|\]$/g, "");
      if (i) caption.append(" ");
      caption.append(word);
      return word;
    });
    caption.append("»");
    spoken = tokens.map(word => word.textContent).join(" ");
  }
  function paste() {
    const result = Fillers(spoken);
    noteText.replaceChildren();
    result.split(" ").forEach((part, i) => {
      const word = document.createElement("span");
      word.className = "fresh";
      word.textContent = (i ? " " : "") + part;
      word.style.animationDelay = (i * 30) + "ms";
      noteText.append(word);
    });
    setPhase("done");
    announce("В заметку вставлен текст: " + result);
  }
  function finish() {
    if (phase === "mic") { stopMic(); return; }
    if (phase !== "recording") return;
    tokens.forEach(word => {
      word.classList.add("spoken");
      if (word.classList.contains("filler")) word.classList.add("cut");
    });
    chime("stop");
    setPhase("processing");
    timer = setTimeout(paste, motion.matches ? 0 : 650);
  }
  function revealWord(index) {
    if (index === tokens.length) { timer = setTimeout(finish, 560); return; }
    tokens[index].classList.add("spoken");
    timer = setTimeout(() => revealWord(index + 1), 220 + tokens[index].textContent.length * 19);
  }
  function startDemo() {
    preventAutoplay();
    previousNote = noteText.textContent;
    noteText.textContent = "";
    prepareExample();
    announce("Демонстрация диктовки.");
    setPhase("recording");
    chime("start");
    if (motion.matches) {
      tokens.forEach(word => word.classList.add("spoken"));
      timer = setTimeout(finish, 1200);
    } else {
      revealWord(0);
    }
  }
  function cancel() {
    if (phase === "mic") { stopMic(); return; }
    if (phase !== "recording" && phase !== "processing") return;
    noteText.textContent = previousNote;
    caption.textContent = "Диктовка отменена";
    setPhase("ready");
    announce("Диктовка отменена.");
  }
  function trigger() {
    if (phase === "recording" || phase === "mic") finish();
    else if (phase !== "processing") startDemo();
  }
  $("#keyHint").addEventListener("click", trigger);
  $("#cancelDemo").addEventListener("click", cancel);
  $("#confirmDemo").addEventListener("click", finish);
  addEventListener("keydown", event => {
    if (event.defaultPrevented || event.isComposing || event.target.closest?.("input,textarea,[contenteditable=true]")) return;
    if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.code === "Space") {
      event.preventDefault();
      if (!event.repeat) trigger();
    } else if (event.key === "Escape" && ["recording", "processing", "mic"].includes(phase)) {
      cancel();
    } else if (event.key === "Enter" && phase === "recording" && !event.target.closest?.("button,a,summary")) {
      finish();
    }
  });

  /* Audio samples go only to a local analyser. Disconnect its graph and tracks on exit. */
  function stopMic() {
    micRequest++;
    micBtn.disabled = false;
    if (!mic) return;
    mic.source.disconnect();
    mic.analyser.disconnect();
    mic.stream.getTracks().forEach(track => track.stop());
    mic.graph.remove();
    mic = null;
    micBtn.setAttribute("aria-pressed", "false");
    caption.textContent = "Микрофон выключен";
    setPhase("ready");
    announce("Микрофон выключен.");
  }
  micBtn.addEventListener("click", async () => {
    preventAutoplay();
    if (mic) { stopMic(); return; }
    const request = ++micRequest;
    micBtn.disabled = true;
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true}});
      if (request !== micRequest || document.hidden) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      const context = audio();
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);
      const ns = "http://www.w3.org/2000/svg";
      const graph = document.createElementNS(ns, "svg");
      graph.setAttribute("viewBox", "0 0 128 100");
      graph.setAttribute("preserveAspectRatio", "none");
      const trace = document.createElementNS(ns, "path");
      graph.append(trace);
      $(".plot").append(graph);
      cancel();
      mic = {stream, source, analyser, graph, trace, samples: new Float32Array(analyser.fftSize), envelope: Array(64).fill(1), lastDraw: 0};
      stream.getAudioTracks()[0].addEventListener("ended", stopMic, {once: true});
      micBtn.setAttribute("aria-pressed", "true");
      caption.textContent = "Волна вашего голоса в реальном времени";
      setPhase("mic");
      announce("Микрофон управляет волной. Аудио не записывается. Распознавание доступно в приложении.", true);
    } catch {
      stream?.getTracks().forEach(track => track.stop());
      if (request === micRequest) {
        cancel();
        announce("Микрофон недоступен. Демонстрацию можно запустить без него.", true);
      }
    } finally {
      if (request === micRequest) micBtn.disabled = false;
    }
  });
  function suspend() {
    stopMic();
    preventAutoplay();
    cancel();
  }
  addEventListener("pagehide", suspend);
  document.addEventListener("visibilitychange", () => { if (document.hidden) suspend(); });
  motion.addEventListener("change", () => { if (motion.matches) suspend(); });

  // One silent preview on entry. The visitor can finish, cancel or replay it.
  const autoObserver = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && !document.hidden && !motion.matches) {
      clearTimeout(autoTimer);
      autoTimer = setTimeout(startDemo, 1700);
    } else {
      clearTimeout(autoTimer);
    }
  }, {threshold: .45});
  autoObserver.observe(instrument);
  setPhase("ready");

  /* Cleanup playground. The input and samples use the exact same Fillers port. */
  const input = $("#fillerIn");
  const samples = $$("[data-sample]");
  function updateResult() {
    $("#fillerOut").textContent = Fillers(input.value) || "—";
    samples.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.sample === input.value)));
  }
  input.addEventListener("input", updateResult);
  samples.forEach(button => button.addEventListener("click", () => {
    input.value = button.dataset.sample;
    updateResult();
  }));
  updateResult();

  const holdKey = $("#holdKey");
  const holdOut = $("#holdOut");
  const phrases = ["Встреча переносится на четверг.", "Купить молоко и кофе.", "После code review отправлю правки."];
  let heldSince = null;
  let phrase = 0;
  function hold() {
    if (heldSince !== null) return;
    heldSince = performance.now();
    holdKey.classList.add("down");
    holdOut.textContent = "Говорите…";
    chime("start");
  }
  function release(event) {
    if (heldSince === null) return;
    const insert = performance.now() - heldSince >= 350 && !["pointercancel", "blur"].includes(event.type);
    heldSince = null;
    holdKey.classList.remove("down");
    holdOut.textContent = insert ? "«" + phrases[phrase++ % phrases.length] + "»" : "Удерживайте, пока говорите";
    chime("stop");
  }
  holdKey.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    holdKey.setPointerCapture(event.pointerId);
    hold();
  });
  holdKey.addEventListener("pointerup", release);
  holdKey.addEventListener("pointercancel", release);
  holdKey.addEventListener("blur", release);
  for (const type of ["keydown", "keyup"]) {
    holdKey.addEventListener(type, event => {
      if (event.altKey || !["Space", "Enter"].includes(event.code)) return;
      event.preventDefault();
      if (type === "keyup") release(event);
      else if (!event.repeat) hold();
    });
  }
  $$(".recent-list button").forEach(button => button.addEventListener("click", () => {
    $("#recentText").textContent = button.textContent;
  }));
})();
