(() => {
    const samplePath = "data/sample.csv";
    const state = {
        headers: [],
        rows: [],
        currentIndex: 0,
        sequence: [],
        sequenceIndex: 0,
        isPlaying: false,
        order: "sequential",
        runId: 0,
        voices: []
    };
    const els = {};

    document.addEventListener("DOMContentLoaded", init);

    function init() {
        ["csv-file", "data-count", "field-list", "message", "current-card", "play-button", "stop-button", "prev-button", "next-button", "repeat-button", "restart-button", "order-select", "repeat-select", "rate-select", "field-delay-select", "card-delay-select", "between-fields-setting", "field-delay-label", "table-wrap"].forEach(id => {
            els[toCamel(id)] = document.getElementById(id);
        });

        fillNumberSelect(els.repeatSelect, 1, 5, 2, "回");
        fillNumberSelect(els.fieldDelaySelect, 0, 5, 2, "秒");
        fillNumberSelect(els.cardDelaySelect, 0, 5, 2, "秒");

        bindEvents();
        refreshVoices();
        if (window.speechSynthesis) {
            window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
        }
        loadSample();
    }

    function bindEvents() {
        els.csvFile.addEventListener("change", handleFile);
        els.playButton.addEventListener("click", playFromCurrent);
        els.stopButton.addEventListener("click", stopPlayback);
        els.prevButton.addEventListener("click", () => moveBy(-1));
        els.nextButton.addEventListener("click", () => moveBy(1));
        els.repeatButton.addEventListener("click", replayCurrent);
        els.restartButton.addEventListener("click", restartPlayback);
        els.orderSelect.addEventListener("change", () => {
            const oldOrder = state.order;
            state.order = els.orderSelect.value;
            if (oldOrder !== state.order) {
                // 順序が変わったら、現在のカードを起点に順序を作り直す
                initSequence(state.currentIndex);
                updateUi();
            }
        });
    }

    function toCamel(id) {
        return id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    }

    function fillNumberSelect(select, min, max, selected, suffix) {
        for (let i = min; i <= max; i++) {
            select.add(new Option(`${i}${suffix}`, String(i), i === selected, i === selected));
        }
    }

    async function loadSample() {
        try {
            const response = await fetch(samplePath, { cache: "no-store" });
            if (!response.ok) throw new Error("sample");
            applyCsv(await response.text(), "サンプルデータを読み込みました。▶ 再生を押すと読み上げを試せます。", false);
        } catch (_) {
            showMessage("サンプルCSVを読み込めませんでした。ページを再読み込みしてください。", true);
        }
    }

    function handleFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv" || file.type === "application/vnd.ms-excel";
        if (!isCsv) {
            showMessage("CSVファイルを選択してください。", true);
            return;
        }
        const reader = new FileReader();
        reader.onload = () => applyCsv(String(reader.result), "CSVを読み込みました。", true);
        reader.onerror = () => showMessage("CSVを読み込めませんでした。もう一度お試しください。", true);
        reader.readAsText(file, "UTF-8");
    }

    function parseCsv(text) {
        const source = text.replace(/^\uFEFF/, "");
        if (!source.trim()) throw new Error("CSVが空です。データを入力してください。");

        const rows = [];
        let row = [];
        let field = "";
        let quoted = false;

        for (let i = 0; i < source.length; i++) {
            const c = source[i];
            const n = source[i + 1];
            if (quoted) {
                if (c === '"' && n === '"') {
                    field += '"';
                    i++;
                } else if (c === '"') {
                    quoted = false;
                } else {
                    field += c;
                }
            } else if (c === '"') {
                quoted = true;
            } else if (c === ",") {
                row.push(field);
                field = "";
            } else if (c === "\n") {
                row.push(field);
                rows.push(row);
                row = [];
                field = "";
            } else if (c !== "\r") {
                field += c;
            }
        }

        if (quoted) throw new Error("CSVを正しく解析できませんでした。引用符の数を確認してください。");
        row.push(field);
        rows.push(row);

        return rows.filter(r => r.some(cell => cell.trim() !== ""));
    }

    function applyCsv(text, successMessage, fromUpload) {
        try {
            const parsed = parseCsv(text);
            const headers = (parsed[0] || []).map(h => h.trim());
            if (!headers.length || !headers[0]) throw new Error("1行目に項目名を入力してください。");

            const rows = parsed.slice(1)
                .map(r => headers.map((_, i) => (r[i] || "").trim()))
                .filter(r => r.some(cell => cell !== ""));

            if (!rows.length) throw new Error("データが存在しません。読み上げたい内容を入力してください。");

            state.headers = headers;
            state.rows = rows;
            stopPlayback(false);
            initSequence(0);
            updateUi();
            showMessage(successMessage, false);
        } catch (error) {
            showMessage(error.message || "CSVを正しく解析できませんでした。内容を確認してください。", true);
            if (fromUpload) els.csvFile.value = "";
        }
    }

    function hasSecondColumn() {
        return state.headers.length > 2 && state.rows.some(r => r[2]);
    }

    function getSettings() {
        return {
            repeat: Number(els.repeatSelect.value),
            rate: Number(els.rateSelect.value),
            fieldDelay: Number(els.fieldDelaySelect.value) * 1000,
            cardDelay: Number(els.cardDelaySelect.value) * 1000
        };
    }

    async function playFromCurrent() {
        if (!state.rows.length) {
            showMessage("読み上げ対象データがありません。CSVを読み込んでください。", true);
            return;
        }
        startPlayback();
    }

    function startPlayback() {
        stopPlayback(false);
        state.isPlaying = true;
        const runId = ++state.runId;
        updateControls();
        playLoop(runId);
    }

    async function playLoop(runId) {
        try {
            while (isActive(runId)) {
                await readCurrentCard(runId);
                if (!isActive(runId)) break;

                // 次のカードへ進む前に設定を再取得（待ち時間の即時反映）
                const settings = getSettings();
                await wait(settings.cardDelay, runId);
                if (!isActive(runId)) break;

                if (!advanceAuto()) {
                    stopPlayback();
                    break;
                }
                updateUi();
            }
        } finally {
            if (runId === state.runId) {
                state.isPlaying = false;
                updateControls();
                clearSpeaking();
            }
        }
    }

    async function readCurrentCard(runId) {
        const row = state.rows[state.currentIndex] || [];

        // ループ内で設定を再取得することで、繰り返し回数や速度、遅延の変更を即時反映する
        for (let count = 0; ; count++) {
            const settings = getSettings();
            if (count >= settings.repeat || !isActive(runId)) break;

            // 1つ目の読み上げ（2列目があれば優先、なければ1列目）
            const firstText = row[1] || row[0];
            await speak(firstText, settings.rate, 0, runId);
            if (!isActive(runId)) break;

            // 2つ目の読み上げ（3列目があれば、4列目優先で読む）
            if (row[2]) {
                const innerSettings = getSettings();
                await wait(innerSettings.fieldDelay, runId);
                if (!isActive(runId)) break;
                const secondText = row[3] || row[2];
                await speak(secondText, innerSettings.rate, 2, runId);
            }
        }
    }

    function speak(text, rate, fieldIndex, runId) {
        return new Promise(resolve => {
            if (!text || !window.speechSynthesis || !isActive(runId)) {
                resolve();
                return;
            }

            window.speechSynthesis.cancel();
            clearSpeaking();
            markSpeaking(fieldIndex);

            const language = detectLanguage(text);
            if (!language) {
                showMessage("日本語と外国語が混在する文章には対応していません。文章をどちらか一方の言語にしてください。", true);
                stopPlayback();
                resolve();
                return;
            }

            const utterance = new SpeechSynthesisUtterance(text);
            const voice = selectVoice(language);
            utterance.lang = voice?.lang || language;
            utterance.rate = rate;
            if (voice) utterance.voice = voice;

            const finish = () => {
                clearSpeaking();
                resolve();
            };

            utterance.onend = finish;
            utterance.onerror = finish;
            window.speechSynthesis.speak(utterance);
        });
    }

    function wait(ms, runId) {
        return new Promise(resolve => {
            if (ms <= 0) {
                resolve();
                return;
            }
            window.setTimeout(resolve, ms);
        }).then(() => {
            if (!isActive(runId)) return;
        });
    }

    function isActive(runId) {
        return state.isPlaying && runId === state.runId;
    }

    function stopPlayback(update = true) {
        state.isPlaying = false;
        state.runId++;
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        clearSpeaking();
        if (update) updateControls();
    }

    function replayCurrent() {
        if (!state.rows.length) return;
        startPlayback();
    }

    function restartPlayback() {
        if (!state.rows.length) return;
        stopPlayback(false);
        initSequence(0);
        updateUi();
        startPlayback();
    }

    function moveBy(delta) {
        if (!state.rows.length) return;
        const wasPlaying = state.isPlaying;
        stopPlayback(false);

        state.sequenceIndex = (state.sequenceIndex + delta + state.sequence.length) % state.sequence.length;
        state.currentIndex = state.sequence[state.sequenceIndex];

        updateUi();
        if (wasPlaying) startPlayback();
    }

    function advanceAuto() {
        if (state.sequenceIndex >= state.sequence.length - 1) return false;
        state.sequenceIndex++;
        state.currentIndex = state.sequence[state.sequenceIndex];
        return true;
    }

    function initSequence(startIndex = 0) {
        const count = state.rows.length;
        const all = Array.from({ length: count }, (_, i) => i);

        if (state.order === "random") {
            // シャッフルする。ただし startIndex を最初に持ってくるか、startIndex の位置を探す
            // ここではシンプルに「全部シャッフルして、startIndex を見つける」か
            // 「startIndex を除いてシャッフルし、先頭に startIndex を置く」ことにする
            const other = all.filter(i => i !== startIndex);
            state.sequence = [startIndex, ...shuffle(other)];
            state.sequenceIndex = 0;
        } else {
            state.sequence = all;
            state.sequenceIndex = startIndex;
        }
        state.currentIndex = state.sequence[state.sequenceIndex];
    }

    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function refreshVoices() {
        state.voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    }

    function detectLanguage(text) {
        const value = String(text).trim();
        const hasJapanese = /\p{Script=Hiragana}|\p{Script=Katakana}|[\u3400-\u9FFF]/u.test(value);
        const hasLatin = /\p{Script=Latin}/u.test(value);
        if (hasJapanese && hasLatin) return null;
        if (/\p{Script=Hiragana}|\p{Script=Katakana}|[\u3400-\u9FFF]/u.test(value)) return "ja-JP";
        if (/\p{Script=Hangul}/u.test(value)) return "ko-KR";
        if (/\p{Script=Cyrillic}/u.test(value)) return "ru-RU";
        if (/\p{Script=Arabic}/u.test(value)) return "ar-SA";
        if (/\p{Script=Devanagari}/u.test(value)) return "hi-IN";
        if (/\p{Script=Hebrew}/u.test(value)) return "he-IL";
        if (/\p{Script=Thai}/u.test(value)) return "th-TH";
        if (/\p{Script=Greek}/u.test(value)) return "el-GR";
        if (/\p{Script=Georgian}/u.test(value)) return "ka-GE";
        if (/\p{Script=Armenian}/u.test(value)) return "hy-AM";
        if (/\p{Script=Latin}/u.test(value)) return detectLatinLanguage(value);
        return "en-US";
    }

    function detectLatinLanguage(text) {
        const lower = text.toLowerCase();
        if (/[áéíóúüñ¿¡]/.test(lower)) return "es-ES";
        if (/[àâçéèêëîïôûùüÿœ]/.test(lower)) return "fr-FR";
        if (/[äöüß]/.test(lower)) return "de-DE";
        if (/[àèéìíîòóùú]/.test(lower) && /\b(che|chi|gli|sono|una|uno|perché|come)\b/.test(lower)) return "it-IT";
        if (/[ãõ]/.test(lower) || /\b(que|não|uma|você|para)\b/.test(lower)) return "pt-BR";
        return "en-US";
    }

    function selectVoice(language) {
        if (!state.voices.length) return null;
        const base = language.toLowerCase().split("-")[0];
        return state.voices.find(v => v.lang?.toLowerCase() === language.toLowerCase())
            || state.voices.find(v => v.lang?.toLowerCase().startsWith(`${base}-`))
            || null;
    }

    function updateUi() {
        updateCurrent();
        updateTable();
        updateMeta();
        updateControls();
        const hasSecond = hasSecondColumn();
        els.betweenFieldsSetting.style.display = hasSecond ? "grid" : "none";
        if (hasSecond) {
            const h1 = state.headers[0] || "項目1";
            const h2 = state.headers[2] || "項目2";
            els.fieldDelayLabel.textContent = `${h1}から${h2}までの待ち時間`;
        }
    }

    function updateCurrent() {
        const row = state.rows[state.currentIndex] || [];
        els.currentCard.innerHTML = state.headers.map((h, i) => {
            // 2列目(i=1)と4列目(i=3)は表示しない
            if (i === 1 || i === 3) return "";
            return `<div class="current-field" data-field="${i}"><span class="current-label">${escapeHtml(h)}</span><p class="current-value">${escapeHtml(row[i] || "（空欄）")}</p></div>`;
        }).join("");
    }

    function updateTable() {
        els.tableWrap.innerHTML = `<table class="data-table"><thead><tr>${state.headers.map(h => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${state.rows.map((r, ri) => `<tr class="${ri === state.currentIndex ? "is-current" : ""}">${state.headers.map((_, i) => `<td>${r[i] ? escapeHtml(r[i]) : '<span class="empty-cell">空欄</span>'}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    }

    function updateMeta() {
        els.dataCount.textContent = `${state.sequenceIndex + 1} / ${state.rows.length}件`;
        els.fieldList.textContent = `項目名：${state.headers.join(" / ")}`;
    }

    function updateControls() {
        [els.playButton, els.prevButton, els.nextButton, els.repeatButton, els.restartButton].forEach(button => {
            button.disabled = !state.rows.length;
        });
        els.stopButton.disabled = !state.isPlaying;
    }

    function showMessage(text, isError) {
        els.message.textContent = text;
        els.message.className = `message is-visible${isError ? " is-error" : ""}`;
    }

    function markSpeaking(index) {
        const el = els.currentCard.querySelector(`[data-field="${index}"]`);
        if (el) el.classList.add("is-speaking");
    }

    function clearSpeaking() {
        els.currentCard.querySelectorAll(".is-speaking").forEach(el => el.classList.remove("is-speaking"));
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    }
})();
