// 試し割り法
import { trialDivision, loadPrimes } from './src/modules/trialDivision.js';

// Pollard’s rho 法
import { pollardsRhoFactorization } from './src/modules/pollardsRho.js';

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

        hideErrorAndPrepare();

        const inputValue = elements.numberInput.value.trim().replace(/[^0-9]/g, '');
        if (!inputValue || BigInt(inputValue) < 2n) {
            showError("有効な整数を入力してください");
            return;
        }

        const num = BigInt(inputValue);
        console.log(`素因数分解を開始: ${num}`);

        isCalculating = true;
        startTime = performance.now();

        // 開始直後から小数点以下1桁で更新を始める
        updateProgress();

        if (primes.length === 0) {
            await loadPrimes();
            if (primes.length === 0) throw new Error("素数リストが空のため、計算できません");
        }

        console.log("試し割り法を実行します");
        let { factors, remainder } = await trialDivision(num, primes, msg => {
            elements.result.textContent = msg;
        });
        console.log(`試し割り法完了。残りの数: ${remainder}`);

        if (remainder > 1n) {
            console.log(`Pollard's rho を開始 (コア数: ${coreCount})`);
            const extraFactors = await pollardsRhoFactorization(remainder);

            if (extraFactors.includes("FAIL")) {
                console.error(`Pollard's Rho では因数を発見できませんでした。素因数分解を中断します。`);
                elements.result.textContent = "素因数分解失敗";
                return;
            }

            factors = factors.concat(extraFactors);
        }

        let elapsedTime = ((performance.now() - startTime) / 1000).toFixed(3);
        showFinalResult(factors, elapsedTime, num.toString());
        console.log(`素因数分解完了: ${factors.join(" × ")}, 計算時間: ${elapsedTime} 秒`);
    } catch (error) {
        console.error("計算エラー:", error);
        elements.result.textContent = "計算中にエラーが発生しました";
    } finally {
        isCalculating = false;
        if (elements.spinner) elements.spinner.style.display = "none";
        elements.loading.style.display = "none";
        elements.calculateButton.disabled = false;
        // ループ停止を確実にするため startTime をクリア
        startTime = null;
    }
}

function updateProgress() {
    // 計算中のみ継続して更新（開始直後から1桁表示）
    if (!isCalculating || !startTime) return;
    const elapsedTime = ((performance.now() - startTime) / 1000).toFixed(1);
    elements.elapsedTime.textContent = `${elapsedTime}`;
    requestAnimationFrame(updateProgress);
}

function hideErrorAndPrepare() {
    elements.time.innerHTML = "";
    elements.result.innerHTML = "";
    elements.time.style.display = "none";
    elements.result.style.display = "none";
    elements.outputBox.style.display = "none";
    elements.errorMessage.style.display = "none";
    if (elements.spinner) elements.spinner.style.display = "block";
    elements.loading.style.display = "flex";
    console.clear();
}

function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.style.display = "block";
    elements.time.innerHTML = "";
    elements.result.innerHTML = "";
    elements.outputBox.style.display = "none";
    elements.time.style.display = "none";
    elements.result.style.display = "none";
}

function showFinalResult(factors, elapsedTime, originalStr) {
    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    // factors (BigInt or string) を文字列化してカウント
    const strs = factors.map(f => (typeof f === "bigint" ? f.toString() : String(f)));
    const numericStrs = strs.filter(s => /^[0-9]+$/.test(s));
    const counts = new Map();
    for (const s of numericStrs) counts.set(s, (counts.get(s) || 0) + 1);

    const sortedKeys = Array.from(counts.keys()).sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1));

    // parts を作成（指数は <sup> で表現）
    const parts = sortedKeys.map(k => {
        const c = counts.get(k);
        const base = escapeHtml(k);
        return c > 1 ? `${base}<sup>${escapeHtml(String(c))}</sup>` : `${base}`;
    });

    // 非数値（万が一）も付ける
    const nonNumeric = strs.filter(s => !/^[0-9]+$/.test(s)).map(s => escapeHtml(s));
    const allParts = parts.concat(nonNumeric);

    // time と result を整形して表示
    elements.time.innerHTML = `<div class="time-label">計算時間</div><div class="time-value">${escapeHtml(elapsedTime)} 秒</div>`;
    // result 内は resultContent のあるレイアウトに合わせ、オリジナル = p^a × ... を表示
    const resultHtml = `<div class="result-label">素因数</div>
        <div class="factors-content">
          <p id="resultContent" class="break-all" style="font-family:monospace; font-size:1rem;">${escapeHtml(originalStr)} = ${allParts.join(' <span aria-hidden="true">×</span> ')}</p>
        </div>`;

    elements.result.innerHTML = resultHtml;

    elements.outputBox.style.display = "block";
    elements.time.style.display = "block";
    elements.result.style.display = "block";
}

elements.calculateButton.addEventListener("click", startFactorization);
elements.numberInput.addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        startFactorization();
    }
});

// 新しい input イベント（非数字を除去して桁数を更新、ボタンの有効/無効制御）
elements.numberInput.addEventListener("input", () => {
    const input = elements.numberInput;
    // 画面上から非数字文字を取り除く（表示上の整合性）
    input.value = input.value.replace(/[^0-9]/g, '');

    const len = input.value.length;
    elements.charCounter.textContent = `${len}`;
    // 2 以上の整数でボタンを有効にする（空や 1 以下は無効）
    try {
        elements.calculateButton.disabled = len === 0 || (len > 0 && BigInt(input.value) < 2n);
    } catch (e) {
        elements.calculateButton.disabled = true;
    }
    // 隠れているエラー/出力をクリア
    elements.errorMessage.style.display = "none";
    elements.outputBox.style.display = "none";
});

// 初期化: ボタンを無効化しておく
elements.calculateButton.disabled = true;

// ページ読み込み時に素数リストをプリロード（既存挙動を維持）
(async () => {
    try {
        primes = await loadPrimes();
    } catch (e) {
        console.warn("素数リストの読み込みに失敗:", e);
    }
})();
