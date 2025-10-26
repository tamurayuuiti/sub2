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
    outputBox: document.getElementById("outputBox") // 追加
};

async function startFactorization() {
    try {
        if (isCalculating) return;

        hideErrorAndPrepare();

        const inputValue = elements.numberInput.value.trim();
        if (!inputValue || BigInt(inputValue) < 2n) {
            showError("有効な整数を入力してください");
            return;
        }

        const num = BigInt(inputValue);
        console.log(`素因数分解を開始: ${num}`);

        isCalculating = true;
        startTime = performance.now();

        setTimeout(() => {
            elements.elapsedTime.style.display = "block";
            updateProgress();
        }, 1000);

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
        showFinalResult(factors, elapsedTime);
        console.log(`素因数分解完了: ${factors.join(" × ")}, 計算時間: ${elapsedTime} 秒`);
    } catch (error) {
        console.error("計算エラー:", error);
        elements.result.textContent = "計算中にエラーが発生しました";
    } finally {
        isCalculating = false;
        elements.spinner.style.display = "none";
        elements.elapsedTime.style.display = "none";
        elements.loading.style.display = "none";
    }
}

function updateProgress() {
    if (!startTime) return;
    let elapsedTime = ((performance.now() - startTime) / 1000).toFixed(1);
    elements.elapsedTime.textContent = `（経過時間: ${elapsedTime} 秒）`;
    requestAnimationFrame(updateProgress);
}

function hideErrorAndPrepare() {
    elements.time.innerHTML = "";
    elements.result.innerHTML = "";
    elements.time.style.display = "none";
    elements.result.style.display = "none";
    elements.outputBox.style.display = "none"; // 出力ボックス非表示
    elements.elapsedTime.style.display = "none";
    elements.errorMessage.style.display = "none";
    elements.spinner.style.display = "block";
    elements.loading.style.display = "flex";
    console.clear();
}

function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.style.display = "block";
    elements.time.innerHTML = "";
    elements.result.innerHTML = "";
    elements.outputBox.style.display = "none"; // エラー時は出力を隠す
    elements.time.style.display = "none";
    elements.result.style.display = "none";
}

function showFinalResult(factors, elapsedTime) {
    // HTML に差し込むための簡易エスケープ
    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    // factorsArray を base^exp 形式の HTML（単一文字列）に整形して返す
    function formatFactorsAsHtml(factorsArray) {
        const strs = factorsArray.map(f => (typeof f === "bigint" ? f.toString() : String(f)));
        const numericStrs = strs.filter(s => /^[0-9]+$/.test(s));
        const counts = new Map();
        for (const s of numericStrs) counts.set(s, (counts.get(s) || 0) + 1);

        const sortedKeys = Array.from(counts.keys()).sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1));

        // 変更: 単一文字列で "base^exp" を作る（指数が1のときは ^1 を付けない）
        const parts = sortedKeys.map(k => {
            const c = counts.get(k);
            const base = escapeHtml(k);
            return c > 1 ? `<span class="factor">${base}^${escapeHtml(c)}</span>` : `<span class="factor">${base}</span>`;
        });

        const nonNumeric = strs
            .filter(s => !/^[0-9]+$/.test(s))
            .map(s => `<span class="factor">${escapeHtml(s)}</span>`);
        return parts.concat(nonNumeric).join(' <span class="times" aria-hidden="true">×</span> ');
    }

    // 時間ボックスと結果ボックスをそれぞれ整形して表示
    elements.time.innerHTML = `<div class="time-label">計算時間</div><div class="time-value">${escapeHtml(elapsedTime)} 秒</div>`;
    elements.result.innerHTML = `<div class="result-label">素因数</div><div class="factors-content">${formatFactorsAsHtml(factors)}</div>`;

    // ボックスを表示（CSS で見た目を整える）
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

elements.numberInput.addEventListener("beforeinput", (e) => {
    const { value, selectionStart, selectionEnd } = elements.numberInput;
    const nextLength = value.length - (selectionEnd - selectionStart) + (e.data?.length || 0);
    if (nextLength > 30) e.preventDefault();
  });

elements.numberInput.addEventListener("input", () => {
    const input = elements.numberInput;
    if (input.value.length > 30) input.value = input.value.slice(0, 30);
  
    const len = input.value.length;
    elements.charCounter.textContent = `現在の桁数: ${len}（最大30桁）`;
    elements.charCounter.classList.toggle("limit-reached", len >= 30);
    elements.charCounter.style.color = len === 30 ? "red" : "";
});

(async () => {
    primes = await loadPrimes();
})();
