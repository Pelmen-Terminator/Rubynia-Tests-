(function () {
  "use strict";

  const app = document.getElementById("app");
  const STORAGE_KEY = "tests_best_v2";
  const THEME_KEY = "tests_theme";

  let best = {};
  try { best = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch (e) { best = {}; }

  function saveBest() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(best)); } catch (e) {}
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function getTheme() {
    try { return localStorage.getItem(THEME_KEY) || "auto"; } catch (e) { return "auto"; }
  }

  function applyTheme() {
    const t = getTheme();
    if (t === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  }

  function toggleTheme() {
    const cur = getTheme();
    const next = cur === "dark" ? "light" : "dark";
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    applyTheme();
    render();
  }

  applyTheme();

  // ---- Состояние ----
  let state = null; // { subject, index, selected, answers, questions, startTime }

  // ---- Экраны ----
  function renderHome() {
    const themeIcon = getTheme() === "dark" ? "☀️" : "🌙";
    app.innerHTML = `
      <div class="top">
        <h1>🎓 Тесты</h1>
        <button class="back" id="themeBtn" title="Сменить тему">${themeIcon}</button>
      </div>
      <p class="sub">Выберите предмет. Оценка по 5-балльной шкале.</p>
      <div class="grid">
        ${SUBJECTS.map(s => `
          <button class="card subj" data-id="${s.id}">
            ${best[s.id] ? `<span class="badge">${best[s.id]}</span>` : ""}
            <span class="e">${s.e}</span>
            <b>${s.n}</b>
            <small>${s.q.length} вопр.${best[s.id] ? " · лучшая: " + best[s.id] : " · не пройден"}</small>
          </button>
        `).join("")}
      </div>
    `;
    document.getElementById("themeBtn").addEventListener("click", toggleTheme);
    app.querySelectorAll(".subj").forEach(btn => {
      btn.addEventListener("click", () => startTest(btn.dataset.id));
    });
  }

  function startTest(id) {
    const subject = SUBJECTS.find(s => s.id === id);
    if (!subject) return;
    const questions = shuffle(subject.q).map(q => {
      const opts = q[1].map((text, i) => ({ text, correct: i === q[2] }));
      return { text: q[0], options: shuffle(opts) };
    });
    state = {
      subject,
      index: 0,
      selected: null,
      answers: [],
      questions,
      startTime: Date.now()
    };
    renderQuestion();
  }

  function renderQuestion() {
    const { subject, questions, index, selected } = state;
    const q = questions[index];
    const n = questions.length;
    const progress = Math.round((index / n) * 100);

    app.innerHTML = `
      <div class="top">
        <button class="back" id="backBtn">← Назад</button>
        <span>${subject.e} ${subject.n} · ${index + 1}/${n}</span>
      </div>
      <div class="bar"><i style="width:${progress}%"></i></div>
      <h2>${escapeHtml(q.text)}</h2>
      <div id="options">
        ${q.options.map((o, i) => `
          <button class="opt${selected === i ? " sel" : ""}" data-i="${i}">
            ${escapeHtml(o.text)}
          </button>
        `).join("")}
      </div>
      <div class="row">
        <button class="btn g" id="skipBtn">Пропустить</button>
        <button class="btn" id="nextBtn" ${selected === null ? "disabled" : ""}>
          ${index === n - 1 ? "Завершить" : "Далее"}
        </button>
      </div>
    `;

    document.getElementById("backBtn").addEventListener("click", () => {
      if (confirm("Выйти без сохранения результата?")) {
        state = null;
        renderHome();
      }
    });

    document.getElementById("options").addEventListener("click", e => {
      const btn = e.target.closest(".opt");
      if (!btn) return;
      state.selected = parseInt(btn.dataset.i, 10);
      document.querySelectorAll(".opt").forEach((b, j) => {
        b.classList.toggle("sel", j === state.selected);
      });
      document.getElementById("nextBtn").disabled = false;
    });

    document.getElementById("skipBtn").addEventListener("click", () => {
      state.answers.push(null);
      state.selected = null;
      if (state.index < n - 1) {
        state.index++;
        renderQuestion();
      } else {
        renderResult();
      }
    });

    document.getElementById("nextBtn").addEventListener("click", () => {
      if (state.selected === null) return;
      state.answers.push(state.selected);
      state.selected = null;
      if (state.index < n - 1) {
        state.index++;
        renderQuestion();
      } else {
        renderResult();
      }
    });
  }

  function renderResult() {
    const { subject, questions, answers, startTime } = state;
    const n = questions.length;
    let correct = 0;
    questions.forEach((q, i) => {
      const ans = answers[i];
      if (ans !== null && q.options[ans] && q.options[ans].correct) correct++;
    });
    const percent = Math.round((correct / n) * 100);
    const grade = percent >= 90 ? 5 : percent >= 70 ? 4 : percent >= 50 ? 3 : 2;
    const texts = {
      5: "Отлично! Блестящий результат.",
      4: "Хорошо! Совсем немного до идеала.",
      3: "Удовлетворительно. Стоит повторить тему.",
      2: "Неудовлетворительно. Попробуйте ещё раз после повторения."
    };
    const colors = { 5: "var(--ok)", 4: "#65a30d", 3: "#d97706", 2: "var(--no)" };
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;

    if (!best[subject.id] || grade > best[subject.id]) {
      best[subject.id] = grade;
      saveBest();
    }

    const reviewHtml = questions.map((q, i) => {
      const ans = answers[i];
      const correctOpt = q.options.find(o => o.correct);
      const ok = ans !== null && q.options[ans] && q.options[ans].correct;
      const userText = ans !== null && q.options[ans] ? escapeHtml(q.options[ans].text) : "—";
      return `
        <div class="rv ${ok ? "ok" : "no"}">
          <b>${ok ? "✅" : "❌"} ${escapeHtml(q.text)}</b>
          <small>
            Ваш ответ: ${userText}
            ${ok ? "" : "<br>Верно: " + escapeHtml(correctOpt.text)}
          </small>
        </div>
      `;
    }).join("");

    app.innerHTML = `
      <div class="card grade">
        <div class="sub" style="margin:0">${subject.e} ${subject.n}</div>
        <div class="n" style="color:${colors[grade]}">${grade}</div>
        <b>${correct} из ${n} · ${percent}%</b>
        <p class="sub" style="margin:8px 0 0">${texts[grade]}</p>
        <p class="sub" style="margin:4px 0 0;font-size:13px">Время: ${mins} мин ${secs} сек</p>
      </div>
      <h2 style="margin-top:22px">Разбор ответов</h2>
      ${reviewHtml}
      <div class="row">
        <button class="btn" id="againBtn">Ещё раз</button>
        <button class="btn g" id="homeBtn">К предметам</button>
      </div>
      <button class="btn g" id="shareBtn" style="margin-top:8px">Поделиться результатом</button>
    `;

    document.getElementById("againBtn").addEventListener("click", () => startTest(subject.id));
    document.getElementById("homeBtn").addEventListener("click", () => {
      state = null;
      renderHome();
    });
    document.getElementById("shareBtn").addEventListener("click", () => shareResult(subject, grade, correct, n, percent));

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function shareResult(subject, grade, correct, total, percent) {
    const text = `Я прошёл тест «${subject.n}» на оценку ${grade}! ${correct}/${total} (${percent}%). Попробуй и ты!`;
    if (navigator.share) {
      navigator.share({ title: "Тесты", text }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => alert("Результат скопирован!")).catch(() => {});
    } else {
      alert(text);
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ---- Старт ----
  renderHome();
})();