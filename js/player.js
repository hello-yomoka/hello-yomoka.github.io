(() => {
    const samplePath = "data/sample.csv";
    const state = { headers: [], rows: [], currentIndex: 0, isPlaying: false, order: "sequential", randomQueue: [], randomHistory: [] };
    const els = {};
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    document.addEventListener("DOMContentLoaded", init);

    function init() {
        ["csv-file","data-count","field-list","message","current-card","play-button","stop-button","prev-button","next-button","repeat-button","order-select","repeat-select","rate-select","field-delay-select","card-delay-select","between-fields-setting","table-wrap"].forEach(id => els[toCamel(id)] = document.getElementById(id));
        fillNumberSelect(els.repeatSelect, 1, 5, 2, "回");
        fillNumberSelect(els.fieldDelaySelect, 0, 5, 2, "秒");
        fillNumberSelect(els.cardDelaySelect, 0, 5, 2, "秒");
        bindEvents();
        loadSample();
    }

    function bindEvents() {
        els.csvFile.addEventListener("change", handleFile);
        els.playButton.addEventListener("click", playFromCurrent);
        els.stopButton.addEventListener("click", stopPlayback);
        els.prevButton.addEventListener("click", () => moveBy(-1));
        els.nextButton.addEventListener("click", () => moveBy(1));
        els.repeatButton.addEventListener("click", replayCurrent);
        els.orderSelect.addEventListener("change", () => { state.order = els.orderSelect.value; resetRandom(); });
    }

    function toCamel(id) { return id.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); }
    function fillNumberSelect(select, min, max, selected, suffix) { for (let i = min; i <= max; i++) select.add(new Option(`${i}${suffix}`, String(i), i === selected, i === selected)); }

    async function loadSample() {
        try {
            const response = await fetch(samplePath);
            if (!response.ok) throw new Error("sample");
            applyCsv(await response.text(), "サンプルデータを読み込みました。▶ 再生を押すと読み上げを試せます。", false);
        } catch (_) { showMessage("サンプルCSVを読み込めませんでした。ページを再読み込みしてください。", true); }
    }

    function handleFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv" || file.type === "application/vnd.ms-excel";
        if (!isCsv) { showMessage("CSVファイルを選択してください。", true); return; }
        const reader = new FileReader();
        reader.onload = () => applyCsv(String(reader.result), "CSVを読み込みました。", true);
        reader.onerror = () => showMessage("CSVを読み込めませんでした。もう一度お試しください。", true);
        reader.readAsText(file, "UTF-8");
    }

    function parseCsv(text) {
        const source = text.replace(/^\uFEFF/, "");
        if (!source.trim()) throw new Error("CSVが空です。データを入力してください。");
        const rows = []; let row = [], field = "", quoted = false;
        for (let i = 0; i < source.length; i++) {
            const c = source[i], n = source[i + 1];
            if (quoted) { if (c === '"' && n === '"') { field += '"'; i++; } else if (c === '"') quoted = false; else field += c; }
            else if (c === '"') quoted = true;
            else if (c === ",") { row.push(field); field = ""; }
            else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
            else if (c !== "\r") field += c;
        }
        if (quoted) throw new Error("CSVを正しく解析できませんでした。引用符の数を確認してください。");
        row.push(field); rows.push(row);
        return rows.filter(r => r.some(cell => cell.trim() !== ""));
    }

    function applyCsv(text, successMessage, fromUpload) {
        try {
            const parsed = parseCsv(text);
            const headers = (parsed[0] || []).map(h => h.trim());
            if (!headers.length || !headers[0]) throw new Error("1行目に項目名を入力してください。");
            const rows = parsed.slice(1).map(r => headers.map((_, i) => (r[i] || "").trim())).filter(r => r[0]);
            if (!rows.length) throw new Error("1列目のデータが存在しません。読み上げたい内容を入力してください。");
            state.headers = headers; state.rows = rows; state.currentIndex = 0; stopPlayback(false); resetRandom(); updateUi(); showMessage(successMessage, false);
        } catch (error) {
            showMessage(error.message || "CSVを正しく解析できませんでした。内容を確認してください。", true);
            if (fromUpload) els.csvFile.value = "";
        }
    }

    function hasSecondColumn() { return state.headers.length > 1 && state.rows.some(row => row[1]); }
    function getSettings() { return { repeat: Number(els.repeatSelect.value), rate: Number(els.rateSelect.value), fieldDelay: Number(els.fieldDelaySelect.value) * 1000, cardDelay: Number(els.cardDelaySelect.value) * 1000 }; }

    async function playFromCurrent() {
        if (!state.rows.length) { showMessage("読み上げ対象データがありません。CSVを読み込んでください。", true); return; }
        stopPlayback(false); state.isPlaying = true; updateControls();
        try {
            while (state.isPlaying) {
                await readCurrentCard();
                if (!state.isPlaying) break;
                await wait(getSettings().cardDelay);
                if (!state.isPlaying) break;
                goNextAuto(); updateUi();
            }
        } finally { state.isPlaying = false; updateControls(); clearSpeaking(); }
    }

    async function readCurrentCard() {
        const settings = getSettings(), row = state.rows[state.currentIndex];
        for (let count = 0; count < settings.repeat && state.isPlaying; count++) {
            await speak(row[0], settings.rate, 0);
            if (hasSecondColumn() && row[1] && state.isPlaying) { await wait(settings.fieldDelay); await speak(row[1], settings.rate, 1); }
        }
    }

    function speak(text, rate, fieldIndex) {
        return new Promise(resolve => {
            if (!text || !window.speechSynthesis) { resolve(); return; }
            clearSpeaking(); markSpeaking(fieldIndex);
            const utterance = new SpeechSynthesisUtterance(text); utterance.lang = "ja-JP"; utterance.rate = rate;
            utterance.onend = () => { clearSpeaking(); resolve(); }; utterance.onerror = () => { clearSpeaking(); resolve(); };
            window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance);
        });
    }

    function stopPlayback(update = true) { state.isPlaying = false; if (window.speechSynthesis) window.speechSynthesis.cancel(); clearSpeaking(); if (update) updateControls(); }
    function replayCurrent() { stopPlayback(false); playFromCurrent(); }
    function moveBy(delta) { stopPlayback(false); state.currentIndex = (state.currentIndex + delta + state.rows.length) % state.rows.length; updateUi(); }
    function goNextAuto() { state.order === "random" ? nextRandom() : state.currentIndex = (state.currentIndex + 1) % state.rows.length; }
    function resetRandom() { state.randomQueue = shuffle([...state.rows.keys()].filter(i => i !== state.currentIndex)); state.randomHistory = [state.currentIndex]; }
    function nextRandom() { if (!state.randomQueue.length) resetRandom(); const next = state.randomQueue.shift(); state.randomHistory.push(next); state.currentIndex = next; }
    function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

    function updateUi() { updateCurrent(); updateTable(); updateMeta(); updateControls(); els.betweenFieldsSetting.hidden = !hasSecondColumn(); }
    function updateCurrent() {
        const row = state.rows[state.currentIndex] || [];
        els.currentCard.innerHTML = state.headers.map((h, i) => `<div class="current-field" data-field="${i}"><span class="current-label">${escapeHtml(h)}</span><p class="current-value">${escapeHtml(row[i] || "（空欄）")}</p></div>`).join("");
    }
    function updateTable() {
        els.tableWrap.innerHTML = `<table class="data-table"><thead><tr>${state.headers.map(h => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${state.rows.map((r, ri) => `<tr class="${ri === state.currentIndex ? "is-current" : ""}">${state.headers.map((_, i) => `<td>${r[i] ? escapeHtml(r[i]) : '<span class="empty-cell">空欄</span>'}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    }
    function updateMeta() { els.dataCount.textContent = `${state.rows.length}件`; els.fieldList.textContent = `項目名：${state.headers.join(" / ")}`; }
    function updateControls() { [els.playButton, els.prevButton, els.nextButton, els.repeatButton].forEach(b => b.disabled = !state.rows.length); els.stopButton.disabled = !state.isPlaying; }
    function showMessage(text, isError) { els.message.textContent = text; els.message.className = `message is-visible${isError ? " is-error" : ""}`; }
    function markSpeaking(i) { const el = els.currentCard.querySelector(`[data-field="${i}"]`); if (el) el.classList.add("is-speaking"); }
    function clearSpeaking() { els.currentCard.querySelectorAll(".is-speaking").forEach(el => el.classList.remove("is-speaking")); }
    function escapeHtml(value) { return String(value).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
})();
