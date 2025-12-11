// 試し割り法
import { trialDivision, loadPrimes } from './algorithms/trialDivision.js';

// Pollard’s rho 法
import { pollardsRhoFactorization } from './algorithms/pollardsRho.js';

let primes = [];
let startTime = null;
let isCalculating = false;
const coreCount = navigator.hardwareConcurrency || 4;

const elements = {
    numberInput: document.getElementById("numberInput"),
    charCounter: document.getElementById("charCounter"),
    calculateButton: document.getElementById("calculateButton"),
    errorMessage: document.getElementById("errorMessage"),
    result: document.getElementById("result"),
    time: document.getElementById("time"),
    spinner: document.getElementById("spinner"),
    elapsedTime: document.getElementById("elapsed-time"),
    loading: document.getElementById("loading"),
    outputBox: document.getElementById("outputBox")
};

async function startFactorization() {
    try {
        if (isCalculating) return;

        // 開始処理
        isCalculating = true;
        if (elements.calculateButton) elements.calculateButton.disabled = true;
        if (elements.numberInput) elements.numberInput.disabled = true;

        hideErrorAndPrepare();

        // 入力取得
        const rawInput = elements.numberInput ? elements.numberInput.value : "";
        const inputValue = String(rawInput).trim().replace(/[^0-9]/g, '');
        if (!inputValue || BigInt(inputValue) < 2n) {
            showError("有効な整数を入力してください");
            return;
        }

        const num = BigInt(inputValue);
        console.log(`素因数分解を開始: ${num}`);

        startTime = performance.now();

        updateProgress();

        // 素因数分解開始
        if (!primes || primes.length === 0) {
            try {
                primes = await loadPrimes();
            } catch (e) {
                console.warn("素数リストの読み込みに失敗:", e);
                primes = [];
            }
            if (!primes || primes.length === 0) throw new Error("素数リストが空のため、計算できません");
        }

        console.log("試し割り法を実行します");
        let { factors, remainder } = trialDivision(num, primes, {
            progressCallback: msg => { if (elements.result) elements.result.textContent = msg; }
        });

        console.log(`試し割り法完了。残りの数: ${remainder}`);

        if (remainder > 1n) {
            console.log(`Pollard's rho を開始 (コア数: ${coreCount})`);
            const extraFactors = await pollardsRhoFactorization(remainder);

            // エラーチェック: 想定外の戻り値
            if (!Array.isArray(extraFactors)) {
                const elapsedTime = startTime ? ((performance.now() - startTime) / 1000).toFixed(3) : "0.000";
                console.error("Pollard returned unexpected result:", extraFactors, `Elapsed: ${elapsedTime} s`);
                showError("素因数分解失敗");
                return;
            }

            // Pollard の失敗シグナル
            if (extraFactors.includes("FAIL")) {
                const elapsedTime = startTime ? ((performance.now() - startTime) / 1000).toFixed(3) : "0.000";
                console.error("素因数分解を中断します", `Elapsed: ${elapsedTime} s`);
                showError("素因数分解失敗");
                return;
            }

            factors = factors.concat(extraFactors);
        }

        let elapsedTime = ((performance.now() - startTime) / 1000).toFixed(3);
        showFinalResult(factors, elapsedTime);
        console.log(`素因数分解完了: ${factors.join(" × ")}, 計算時間: ${elapsedTime} 秒`);
    } catch (error) {
        const elapsedTime = startTime ? ((performance.now() - startTime) / 1000).toFixed(3) : "0.000";
        console.error("計算エラー:", error, `Elapsed: ${elapsedTime} s`);
        showError("計算中にエラーが発生しました");
    } finally {
        // 終了処理
        isCalculating = false;
        if (elements.spinner) elements.spinner.style.display = "none";
        if (elements.loading) elements.loading.style.display = "none";
        if (elements.calculateButton) elements.calculateButton.disabled = false;
        if (elements.numberInput) elements.numberInput.disabled = false;
        startTime = null;
    }
}

function updateProgress() {
    if (!isCalculating || !startTime) return;
    const elapsedTime = ((performance.now() - startTime) / 1000).toFixed(1);
    if (elements.elapsedTime) elements.elapsedTime.textContent = `${elapsedTime}`;
    requestAnimationFrame(updateProgress);
}

function hideErrorAndPrepare() {
    if (elements.time) elements.time.innerHTML = "";
    if (elements.result) elements.result.innerHTML = "";
    if (elements.time) elements.time.style.display = "none";
    if (elements.result) elements.result.style.display = "none";
    if (elements.outputBox) elements.outputBox.style.display = "none";
    if (elements.errorMessage) elements.errorMessage.style.display = "none";
    if (elements.spinner) elements.spinner.style.display = "block";
    if (elements.loading) elements.loading.style.display = "flex";
}

// エラーメッセージ表示（UI には時間は表示しない）
function showError(message) {
    if (elements.errorMessage) {
        elements.errorMessage.textContent = message;
        elements.errorMessage.style.display = "block";
    }

    if (elements.result) elements.result.innerHTML = "";
    if (elements.outputBox) elements.outputBox.style.display = "none";

    if (elements.time) {
        elements.time.innerHTML = "";
        elements.time.style.display = "none";
    }

    if (elements.spinner) elements.spinner.style.display = "none";
    if (elements.loading) elements.loading.style.display = "none";
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function showFinalResult(factors, elapsedTime) {
    // 因数を文字列化して個数を数える
    const strs = (Array.isArray(factors) ? factors : []).map(f => (typeof f === "bigint" ? f.toString() : String(f)));
    const numericStrs = strs.filter(s => /^[0-9]+$/.test(s));
    const counts = new Map();
    for (const s of numericStrs) counts.set(s, (counts.get(s) || 0) + 1);

    const sortedKeys = Array.from(counts.keys()).sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1));

    // 整形して表示用に組み立て
    const parts = sortedKeys.map(k => {
        const c = counts.get(k);
        const base = escapeHtml(k);
        return c > 1 ? `${base}<sup>${escapeHtml(String(c))}</sup>` : `${base}`;
    });

    const nonNumeric = strs.filter(s => !/^[0-9]+$/.test(s)).map(s => escapeHtml(s));
    const allParts = parts.concat(nonNumeric);

    // 表示更新
    if (elements.time) elements.time.innerHTML = `<div class="time-label">計算時間</div><div class="time-value">${escapeHtml(elapsedTime)} 秒</div>`;
    const resultHtml = `<div class="result-label">素因数</div>
        <div class="factors-content">
          <p id="resultContent" class="break-all" style="font-family:monospace; font-size:1rem;">${allParts.join(' <span aria-hidden="true">×</span> ')}</p>
        </div>`;

    if (elements.result) elements.result.innerHTML = resultHtml;
    if (elements.outputBox) elements.outputBox.style.display = "block";
    if (elements.time) elements.time.style.display = "block";
    if (elements.result) elements.result.style.display = "block";
}

if (elements.calculateButton) elements.calculateButton.addEventListener("click", startFactorization);
if (elements.numberInput) {
    elements.numberInput.addEventListener("keypress", function(event) {
        if (event.key === "Enter") {
            startFactorization();
        }
    });
}

// 入力欄の入力イベント処理
if (elements.numberInput) {
    elements.numberInput.addEventListener("input", () => {
        const input = elements.numberInput;
        // 画面上から非数字文字を取り除く
        input.value = input.value.replace(/[^0-9]/g, '');

        // 最大30桁に制限
        if (input.value.length > 30) {
            input.value = input.value.slice(0, 30);
        }

        // 桁数表示とボタン有効化/無効化
        const len = input.value.length;
        if (elements.charCounter) elements.charCounter.textContent = `${len}`;
        try {
            if (elements.calculateButton) elements.calculateButton.disabled = len === 0 || (len > 0 && BigInt(input.value) < 2n);
        } catch (e) {
            if (elements.calculateButton) elements.calculateButton.disabled = true;
        }
        if (elements.errorMessage) elements.errorMessage.style.display = "none";
        if (elements.outputBox) elements.outputBox.style.display = "none";
    });
}

if (elements.calculateButton) elements.calculateButton.disabled = true;

// ページロード時に素数リストを先読み込み
(async () => {
    try {
        primes = await loadPrimes();
    } catch (e) {
        console.warn("素数リストの読み込みに失敗:", e);
    }
})();
