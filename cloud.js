/**
 * cloud.js
 * Простое "облако" для сохранения результатов через jsonbin.io.
 * Если BIN_ID/API_KEY не заданы — работает локальный кэш.
 */
(function () {
  "use strict";

  const CONFIG = {
    // Получите бесплатно на https://jsonbin.io
    BIN_ID: "",      // например "64f1a2b3c4d5e6f7a8b9c0d1"
    API_KEY: "",     // ваш X-Master-Key
    BASE: "https://api.jsonbin.io/v3/b"
  };

  const LOCAL_KEY = "tests_cloud_cache_v1";

  function hasCloud() {
    return !!(CONFIG.BIN_ID && CONFIG.API_KEY);
  }

  function readLocal() {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}"); }
    catch (e) { return {}; }
  }

  function writeLocal(data) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(data)); } catch (e) {}
  }

  /**
   * Загрузить все результаты.
   * @returns {Promise<Object>}
   */
  async function load() {
    if (!hasCloud()) return readLocal();
    try {
      const res = await fetch(CONFIG.BASE + "/" + CONFIG.BIN_ID + "/latest", {
        headers: { "X-Master-Key": CONFIG.API_KEY }
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      const data = json.record || {};
      writeLocal(data);
      return data;
    } catch (e) {
      console.warn("Cloud load failed, using local:", e);
      return readLocal();
    }
  }

  /**
   * Сохранить все результаты.
   * @param {Object} data
   * @returns {Promise<boolean>}
   */
  async function save(data) {
    writeLocal(data);
    if (!hasCloud()) return true;
    try {
      const res = await fetch(CONFIG.BASE + "/" + CONFIG.BIN_ID, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Master-Key": CONFIG.API_KEY
        },
        body: JSON.stringify(data)
      });
      return res.ok;
    } catch (e) {
      console.warn("Cloud save failed:", e);
      return false;
    }
  }

  /**
   * Добавить результат пользователя.
   * @param {string} username
   * @param {string} subjectId
   * @param {number} grade
   * @param {{correct:number,total:number,percent:number}} stats
   * @returns {Promise<boolean>}
   */
  async function pushResult(username, subjectId, grade, stats) {
    if (!username) return false;
    const data = await load();
    if (!data[username]) data[username] = {};
    const cur = data[username][subjectId] || { best: 0, history: [] };
    cur.best = Math.max(cur.best || 0, grade);
    cur.history = cur.history || [];
    cur.history.push({
      grade: grade,
      correct: stats.correct,
      total: stats.total,
      percent: stats.percent,
      date: Date.now()
    });
    if (cur.history.length > 20) cur.history = cur.history.slice(-20);
    data[username][subjectId] = cur;
    return await save(data);
  }

  /**
   * Получить данные пользователя.
   * @param {string} username
   * @returns {Promise<Object>}
   */
  async function getUser(username) {
    if (!username) return {};
    const data = await load();
    return data[username] || {};
  }

  function isCloudEnabled() {
    return hasCloud();
  }

  window.Cloud = {
    load: load,
    save: save,
    pushResult: pushResult,
    getUser: getUser,
    isCloudEnabled: isCloudEnabled
  };
})();