(function () {
  "use strict";

  const app = document.getElementById("app");
  const THEME_KEY = "tests_theme_v11";
  const USER_KEY = "tests_user_v11";
  const LOCAL_BEST = "tests_best_v11";

  /* ============ Тема ============ */
  const THEMES = ["light", "beige", "dark"];
  const THEME_LABELS = { light: "☀️", beige: "📜", dark: "🌙" };
  const THEME_NAMES = { light: "Светлая", beige: "Бежевая", dark: "Тёмная" };

  function getTheme() {
    try {
      const t = localStorage.getItem(THEME_KEY);
      if (t && THEMES.indexOf(t) !== -1) return t;
    } catch (e) {}
    return (window.matchMedia && window.matchMedia("(prefers-color-scheme:dark)").matches)
      ? "dark" : "light";
  }

  function setTheme(t) {
    if (THEMES.indexOf(t) === -1) t = "light";
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
    document.documentElement.setAttribute("data-theme", t);
  }

  setTheme(getTheme());

  /* ============ Пользователь ============ */
  function getUser() {
    try { return localStorage.getItem(USER_KEY) || ""; } catch (e) { return ""; }
  }
  function setUser(name) {
    try { localStorage.setItem(USER_KEY, name); } catch (e) {}
  }

  /* ============ Локальный best ============ */
  let localBest = {};
  try { localBest = JSON.parse(localStorage.getItem(LOCAL_BEST) || "{}"); }
  catch (e) { localBest = {}; }

  function saveLocalBest() {
    try { localStorage.setItem(LOCAL_BEST, JSON.stringify(localBest)); } catch (e) {}
  }

  /* ============ Облако ============ */
  let cloudCache = {};
  let cloudStatus = "off";

  const CloudSafe = {
    isCloudEnabled: function () {
      return window.Cloud && window.Cloud.isCloudEnabled
        ? window.Cloud.isCloudEnabled() : false;
    },
    getUser: async function (name) {
      if (!window.Cloud) return {};
      try { return await window.Cloud.getUser(name); } catch (e) { return {}; }
    },
    pushResult: async function (name, sid, grade, stats) {
      if (!window.Cloud) return false;
      try { return await window.Cloud.pushResult(name, sid, grade, stats); }
      catch (e) { return false; }
    }
  };

  async function refreshCloud() {
    const user = getUser();
    if (!user) {
      cloudCache = {};
      cloudStatus = "off";
      return;
    }
    cloudStatus = "sync";
    try {
      const data = await CloudSafe.getUser(user);
      cloudCache = data || {};
      cloudStatus = CloudSafe.isCloudEnabled() ? "on" : "off";
    } catch (e) {
      cloudStatus = "off";
    }
  }

  /* ============ Утилиты ============ */
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /**
   * Уникальная выборка без повторов.
   * Если запрошено больше, чем есть — вернёт все.
   */
  function pickUnique(pool, n) {
    const copy = pool.slice();
    const result = [];
    const count = Math.min(n, copy.length);
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * copy.length);
      result.push(copy.splice(idx, 1)[0]);
    }
    return result;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fmtDate(ts) {
    try {
      const d = new Date(ts);
      return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" })
        + " " + d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    } catch (e) { return ""; }
  }

  function allSubjects() {
    return SUBJECTS.concat(HARD_SUBJECTS);
  }

  function totalQuestions() {
    let sum = 0;
    allSubjects().forEach(function (s) { sum += s.q.length; });
    return sum;
  }

  /* ============ Состояние ============ */
  let state = null;

  /* ============ Главная ============ */
  function renderHome() {
    const user = getUser();
    const statusClass = cloudStatus === "on" ? "on"
      : cloudStatus === "sync" ? "sync" : "off";
    const statusText = !user
      ? "Локальный режим. Войдите, чтобы сохранять в облаке."
      : (cloudStatus === "on" ? "Облако подключено · " + escapeHtml(user)
        : cloudStatus === "sync" ? "Синхронизация…"
        : "Локально · " + escapeHtml(user));

    app.innerHTML =
      '<div class="top">' +
        '<h1>🎓 Тесты</h1>' +
        '<div class="tools">' +
          '<button class="iconbtn" id="themeBtn" title="Сменить тему">' + THEME_LABELS[getTheme()] + '</button>' +
          '<button class="iconbtn" id="userBtn" title="Профиль">👤</button>' +
        '</div>' +
      '</div>' +
      '<div class="cloud ' + statusClass + '">' +
        '<span class="dot"></span>' +
        '<span style="flex:1">' + statusText + '</span>' +
        (user
          ? '<button class="link" id="logoutBtn">выйти</button>'
          : '<button class="link" id="loginBtn">войти</button>') +
      '</div>' +
      '<p class="sub">Всего ' + totalQuestions() + ' вопросов. Выберите раздел и предмет.</p>' +

      '<div class="section-title">Обычные тесты <span class="tag">' + SUBJECTS.length + ' предметов</span></div>' +
      '<div class="grid">' +
        SUBJECTS.map(renderSubjectCard).join("") +
      '</div>' +

      '<div class="section-title">Сложные тесты <span class="tag hard">' + HARD_SUBJECTS.length + ' предмет</span></div>' +
      '<div class="grid">' +
        HARD_SUBJECTS.map(function (s) { return renderSubjectCard(s, true); }).join("") +
      '</div>';

    document.getElementById("themeBtn").addEventListener("click", showThemePicker);
    document.getElementById("userBtn").addEventListener("click", showUserModal);

    const loginBtn = document.getElementById("loginBtn");
    if (loginBtn) loginBtn.addEventListener("click", showUserModal);
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) logoutBtn.addEventListener("click", function () {
      setUser("");
      cloudCache = {};
      cloudStatus = "off";
      renderHome();
    });

    app.querySelectorAll(".subj").forEach(function (btn) {
      btn.addEventListener("click", function () { startTest(btn.dataset.id); });
    });
  }

  function renderSubjectCard(s, hard) {
    const cloud = cloudCache[s.id];
    const grade = cloud && cloud.best ? cloud.best : localBest[s.id];
    // Используем РЕАЛЬНОЕ количество вопросов, а не expected — так исключается баг «51»
    const qCount = s.q.length;
    const expected = typeof s.expected === "number" ? s.expected : qCount;
    const warn = qCount !== expected ? " ⚠️" + qCount : "";
    const cls = "card subj" + (hard ? " hard" : "");
    return '<button class="' + cls + '" data-id="' + s.id + '">' +
      (grade ? '<span class="badge">' + grade + '</span>' : '') +
      '<span class="e">' + s.e + '</span>' +
      '<b>' + escapeHtml(s.n) + '</b>' +
      '<small>' + qCount + ' вопр.' + warn +
        (grade ? ' · лучшая: ' + grade : ' · не пройден') +
      '</small>' +
    '</button>';
  }

  /* ============ Выбор темы ============ */
  function showThemePicker() {
    const cur = getTheme();
    const bg = document.createElement("div");
    bg.className = "modal-bg";
    bg.innerHTML =
      '<div class="modal">' +
        '<h2>Тема оформления</h2>' +
        '<div class="themepick">' +
          THEMES.map(function (t) {
            return '<button data-t="' + t + '" class="' + (t === cur ? "on" : "") + '">' +
              THEME_LABELS[t] + '<br>' + THEME_NAMES[t] +
            '</button>';
          }).join("") +
        '</div>' +
        '<button class="btn" id="closeBtn" style="margin-top:14px">Готово</button>' +
      '</div>';
    document.body.appendChild(bg);

    bg.addEventListener("click", function (e) {
      if (e.target === bg || e.target.id === "closeBtn") bg.remove();
    });

    bg.querySelectorAll(".themepick button").forEach(function (b) {
      b.addEventListener("click", function () {
        setTheme(b.dataset.t);
        const tb = document.getElementById("themeBtn");
        if (tb) tb.textContent = THEME_LABELS[getTheme()];
        bg.querySelectorAll(".themepick button").forEach(function (x) {
          x.classList.toggle("on", x === b);
        });
      });
    });
  }

  /* ============ Профиль ============ */
  function showUserModal() {
    const cur = getUser();
    const bg = document.createElement("div");
    bg.className = "modal-bg";
    bg.innerHTML =
      '<div class="modal">' +
        '<h2>Профиль</h2>' +
        '<p class="sub" style="margin-bottom:10px">Введите имя — результаты будут сохраняться и синхронизироваться.</p>' +
        '<input id="nameInput" placeholder="Ваше имя" value="' + escapeHtml(cur) + '" maxlength="32">' +
        '<div class="row">' +
          '<button class="btn g" id="cancelBtn">Отмена</button>' +
          '<button class="btn" id="saveBtn">Сохранить</button>' +
        '</div>' +
        (cur ? '<button class="btn g" id="histBtn" style="margin-top:8px">📊 Мои результаты</button>' : '') +
      '</div>';
    document.body.appendChild(bg);

    const input = bg.querySelector("#nameInput");
    setTimeout(function () { input.focus(); }, 50);

    bg.addEventListener("click", function (e) {
      if (e.target === bg || e.target.id === "cancelBtn") bg.remove();
    });

    bg.querySelector("#saveBtn").addEventListener("click", async function () {
      const name = input.value.trim();
      if (!name) { input.focus(); return; }
      setUser(name);
      bg.remove();
      await refreshCloud();
      renderHome();
    });

    const histBtn = bg.querySelector("#histBtn");
    if (histBtn) histBtn.addEventListener("click", function () {
      bg.remove();
      showHistory();
    });
  }

  /* ============ История ============ */
  async function showHistory() {
    const user = getUser();
    if (!user) return;
    cloudStatus = "sync";
    await refreshCloud();

    const items = [];
    allSubjects().forEach(function (s) {
      const c = cloudCache[s.id];
      if (!c) return;
      if (c.history && c.history.length) {
        c.history.slice().reverse().forEach(function (h) {
          items.push({ s: s, h: h });
        });
      } else if (c.best) {
        items.push({ s: s, h: { grade: c.best, date: 0, percent: 0, correct: 0, total: 0 } });
      }
    });
    items.sort(function (a, b) { return (b.h.date || 0) - (a.h.date || 0); });

    const bg = document.createElement("div");
    bg.className = "modal-bg";
    bg.innerHTML =
      '<div class="modal">' +
        '<h2>📊 Результаты · ' + escapeHtml(user) + '</h2>' +
        (items.length
          ? '<div class="hist">' +
              items.map(function (it) {
                return '<div class="hitem">' +
                  '<div>' +
                    '<b>' + it.s.e + ' ' + escapeHtml(it.s.n) + '</b>' +
                    '<small>' + (it.h.date ? fmtDate(it.h.date) : "—") +
                      ' · ' + it.h.correct + '/' + it.h.total +
                      ' (' + it.h.percent + '%)</small>' +
                  '</div>' +
                  '<div class="g g' + it.h.grade + '">' + it.h.grade + '</div>' +
                '</div>';
              }).join("") +
            '</div>'
          : '<p class="sub">Пока нет результатов. Пройдите любой тест!</p>') +
        '<button class="btn" id="closeBtn">Закрыть</button>' +
      '</div>';
    document.body.appendChild(bg);

    bg.addEventListener("click", function (e) {
      if (e.target === bg || e.target.id === "closeBtn") bg.remove();
    });
  }

  /* ============ Запуск теста ============ */
  function startTest(id) {
    const subject = allSubjects().find(function (s) { return s.id === id; });
    if (!subject) return;

    // Каждый вопрос используется ровно один раз
    const total = subject.q.length;
    const picked = pickUnique(subject.q, total);

    const questions = picked.map(function (q) {
      const opts = q[1].map(function (text, i) {
        return { text: text, correct: i === q[2] };
      });
      return { text: q[0], options: shuffle(opts) };
    });

    state = {
      subject: subject,
      index: 0,
      selected: null,
      answers: [],
      questions: questions,
      startTime: Date.now()
    };
    renderQuestion();
  }

  function renderQuestion() {
    const subject = state.subject;
    const questions = state.questions;
    const index = state.index;
    const selected = state.selected;
    const q = questions[index];
    const n = questions.length;
    const progress = Math.round((index / n) * 100);

    app.innerHTML =
      '<div class="top">' +
        '<button class="back" id="backBtn">← Назад</button>' +
        '<span>' + subject.e + ' ' + escapeHtml(subject.n) + ' · ' + (index + 1) + '/' + n + '</span>' +
      '</div>' +
      '<div class="bar"><i style="width:' + progress + '%"></i></div>' +
      '<h2>' + escapeHtml(q.text) + '</h2>' +
      '<div id="options">' +
        q.options.map(function (o, i) {
          return '<button class="opt' + (selected === i ? " sel" : "") + '" data-i="' + i + '">' +
            escapeHtml(o.text) +
          '</button>';
        }).join("") +
      '</div>' +
      '<div class="row">' +
        '<button class="btn g" id="skipBtn">Пропустить</button>' +
        '<button class="btn" id="nextBtn"' + (selected === null ? " disabled" : "") + '>' +
          (index === n - 1 ? "Завершить" : "Далее") +
        '</button>' +
      '</div>';

    document.getElementById("backBtn").addEventListener("click", function () {
      if (confirm("Выйти без сохранения результата?")) {
        state = null;
        renderHome();
      }
    });

    document.getElementById("options").addEventListener("click", function (e) {
      const btn = e.target.closest(".opt");
      if (!btn) return;
      state.selected = parseInt(btn.dataset.i, 10);
      document.querySelectorAll(".opt").forEach(function (b, j) {
        b.classList.toggle("sel", j === state.selected);
      });
      document.getElementById("nextBtn").disabled = false;
    });

    document.getElementById("skipBtn").addEventListener("click", function () {
      state.answers.push(null);
      state.selected = null;
      advance();
    });

    document.getElementById("nextBtn").addEventListener("click", function () {
      if (state.selected === null) return;
      state.answers.push(state.selected);
      state.selected = null;
      advance();
    });
  }

  function advance() {
    if (state.index < state.questions.length - 1) {
      state.index++;
      renderQuestion();
    } else {
      renderResult();
    }
  }

  /* ============ Результат ============ */
  async function renderResult() {
    const subject = state.subject;
    const questions = state.questions;
    const answers = state.answers;
    const startTime = state.startTime;
    const n = questions.length;

    let correct = 0;
    questions.forEach(function (q, i) {
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

    if (!localBest[subject.id] || grade > localBest[subject.id]) {
      localBest[subject.id] = grade;
      saveLocalBest();
    }

    const user = getUser();
    if (user) {
      CloudSafe.pushResult(user, subject.id, grade, {
        correct: correct, total: n, percent: percent
      }).then(function (ok) {
        cloudStatus = ok ? "on" : "off";
      }).catch(function () {
        cloudStatus = "off";
      });
    }

    const reviewHtml = questions.map(function (q, i) {
      const ans = answers[i];
      const correctOpt = q.options.find(function (o) { return o.correct; });
      const ok = ans !== null && q.options[ans] && q.options[ans].correct;
      const userText = (ans !== null && q.options[ans])
        ? escapeHtml(q.options[ans].text) : "—";
      return '<div class="rv ' + (ok ? "ok" : "no") + '">' +
        '<b>' + (ok ? "✅" : "❌") + ' ' + escapeHtml(q.text) + '</b>' +
        '<small>Ваш ответ: ' + userText +
          (ok ? "" : "<br>Верно: " + escapeHtml(correctOpt.text)) +
        '</small>' +
      '</div>';
    }).join("");

    app.innerHTML =
      '<div class="card grade">' +
        '<div class="sub" style="margin:0">' + subject.e + ' ' + escapeHtml(subject.n) + '</div>' +
        '<div class="n" style="color:' + colors[grade] + '">' + grade + '</div>' +
        '<b>' + correct + ' из ' + n + ' · ' + percent + '%</b>' +
        '<p class="sub" style="margin:8px 0 0">' + texts[grade] + '</p>' +
        '<p class="sub" style="margin:4px 0 0;font-size:13px">Время: ' + mins + ' мин ' + secs + ' сек</p>' +
      '</div>' +
      '<h2 style="margin-top:22px">Разбор ответов</h2>' +
      reviewHtml +
      '<div class="row">' +
        '<button class="btn" id="againBtn">Ещё раз</button>' +
        '<button class="btn g" id="homeBtn">К предметам</button>' +
      '</div>' +
      '<button class="btn g" id="shareBtn" style="margin-top:8px">Поделиться результатом</button>';

    document.getElementById("againBtn").addEventListener("click", function () {
      startTest(subject.id);
    });
    document.getElementById("homeBtn").addEventListener("click", function () {
      state = null;
      renderHome();
    });
    document.getElementById("shareBtn").addEventListener("click", function () {
      shareResult(subject, grade, correct, n, percent);
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function shareResult(subject, grade, correct, total, percent) {
    const text = 'Я прошёл тест «' + subject.n + '» на оценку ' + grade +
      '! ' + correct + '/' + total + ' (' + percent + '%). Попробуй и ты!';
    if (navigator.share) {
      navigator.share({ title: "Тесты", text: text }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text)
        .then(function () { alert("Результат скопирован!"); })
        .catch(function () {});
    } else {
      alert(text);
    }
  }

  /* ============ Старт ============ */
  (async function init() {
    // Автопроверка количества вопросов
    allSubjects().forEach(function (s) {
      const exp = typeof s.expected === "number" ? s.expected : s.q.length;
      if (s.q.length !== exp) {
        console.warn("⚠️ " + s.n + ": " + s.q.length + " вопросов (ожидается " + exp + ")");
      }
    });
    await refreshCloud();
    renderHome();
  })();
})();