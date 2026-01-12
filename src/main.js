// main.js - メインアプリケーションコード

import { isPrimeMillerRabin } from "./algorithms/miller-rabin.js";          // ミラーラビン素数判定法
import { trialDivision, loadPrimes } from './algorithms/trial-division.js'; // 試し割り法
import { pollardsRhoFactorization } from './algorithms/pollards-rho.js';    // Pollard’s rho 法
import { ecmFactorization } from './algorithms/ecm.js';                     // ECM 法

// グローバル変数
let primes = [];
let startTime = null;
let isCalculating = false;

// 経過時間を取得するヘルパー関数
function getElapsedTime() {
    if (!startTime) return "0.000";
    return ((performance.now() - startTime) / 1000).toFixed(3);
}

// 利用可能なワーカー数を取得
function getWorkerCount() {
    const cpuCores = navigator.hardwareConcurrency || 4;
    if (cpuCores <= 8) return Math.max(1, cpuCores - 2);
    return Math.max(1, Math.floor(cpuCores * 0.6));
}

// HTML要素のキャッシュ
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

// 計算開始処理
async function startFactorization() {
    try {
        if (isCalculating) return;

        isCalculating = true;
        if (elements.calculateButton) elements.calculateButton.disabled = true;
        if (elements.numberInput) elements.numberInput.disabled = true;

        hideErrorAndPrepare();

        const rawInput = elements.numberInput ? elements.numberInput.value : "";
        const inputValue = String(rawInput).trim().replace(/[^0-9]/g, '');
        if (!inputValue || BigInt(inputValue) < 2n) {
            showError("2以上の整数を入力してください");
            return;
        }

        const num = BigInt(inputValue);
        console.log(`素因数分解を開始: ${num}`);

        startTime = performance.now();
        updateProgress();

        if (isPrimeMillerRabin(num)) {
            const elapsedTime = getElapsedTime();
            showFinalResult([num], elapsedTime);
            console.log(`入力は素数: ${num}, 計算時間: ${elapsedTime} 秒`);
            return;
        }

        if (!Array.isArray(primes) || primes.length === 0) {primes = await loadPrimes();}
        if (!Array.isArray(primes) || primes.length === 0) {
            throw new Error("素数リストが空のため計算を続行できません");
        }

        console.log("試し割り法を実行します");
        let { factors, remainder } = trialDivision(num, primes, {
            progressCallback: msg => {
                if (elements.result) elements.result.textContent = msg;
            }
        });

        console.log(`試し割り法完了。残りの数: ${remainder}`);

        if (remainder > 1n) {
            if (isPrimeMillerRabin(remainder)) {
                console.log(`残りの数: ${remainder} は素数と判定されました`);
                factors.push(remainder);
            } else {
                console.log(`残りの数: ${remainder} は合成数と判定されました`);
                const digitCount = remainder.toString().length;
                let extraFactors;
                const workerCount = getWorkerCount();
                console.log(`並列計算用のワーカー数: ${workerCount}`);
                
                if (digitCount <= 20) { 
                    // 20桁以下なら Pollard's rho 法
                    console.log(`Pollard's rho を開始（残り ${digitCount} 桁）`);
                    extraFactors = await pollardsRhoFactorization(remainder, workerCount);

                    // Pollard's Rho が失敗した場合は ECM にフォールバック
                    if (extraFactors === null) {
                        console.warn(`Pollard's rho で因数を特定できませんでした。ECM に移行します`);
                        extraFactors = await ecmFactorization(remainder, workerCount);
                    }
                } else {
                    // 21桁以上なら ECM 法
                    console.log(`ECM を開始（残り ${digitCount} 桁）`);
                    extraFactors = await ecmFactorization(remainder, workerCount);
                }

                if (!Array.isArray(extraFactors)) {
                    const elapsedTime = getElapsedTime();
                    console.error(`内部エラー: アルゴリズムからの戻り値が不正です (経過時間: ${elapsedTime}s)`, extraFactors);
                    showError("計算に失敗しました");
                    return;
                }

                if (extraFactors.includes("")) {
                    const elapsedTime = getElapsedTime();
                    console.error(`計算中断: アルゴリズムが因数を特定できず終了しました (経過時間: ${elapsedTime}s)`);
                    showError("素因数を特定できませんでした");
                    return;
                }

                factors = factors.concat(extraFactors);
            }
        }

        const elapsedTime = getElapsedTime();
        showFinalResult(factors, elapsedTime);
        console.log(`素因数分解完了: ${factors.join(" × ")}, 計算時間: ${elapsedTime} 秒`);
    } catch (error) {
        const elapsedTime = getElapsedTime();
        console.error(`${error} (経過時間: ${elapsedTime}s)`);
        showError("エラーが発生しました");
    } finally {
        isCalculating = false;
        if (elements.spinner) elements.spinner.style.display = "none";
        if (elements.loading) elements.loading.style.display = "none";
        if (elements.calculateButton) elements.calculateButton.disabled = false;
        if (elements.numberInput) elements.numberInput.disabled = false;
        startTime = null;
    }
}

// 進行状況更新ループ
function updateProgress() {
    if (!isCalculating || !startTime) return;
    const elapsedTime = ((performance.now() - startTime) / 1000).toFixed(1);
    if (elements.elapsedTime) elements.elapsedTime.textContent = `${elapsedTime}`;
    requestAnimationFrame(updateProgress);
}

// エラー表示を隠し、計算準備
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

// エラーメッセージ表示
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

// HTMLエスケープ
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// 最終結果表示
function showFinalResult(factors, elapsedTime) {
  const strs = (Array.isArray(factors) ? factors : []).map(f => (typeof f === "bigint" ? f.toString() : String(f)));
  const numericStrs = strs.filter(s => /^[0-9]+$/.test(s));
  const counts = new Map();
  for (const s of numericStrs) counts.set(s, (counts.get(s) || 0) + 1);

  const sortedKeys = Array.from(counts.keys()).sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1));

  const parts = sortedKeys.map(k => {
    const c = counts.get(k);
    const base = escapeHtml(k);
    return c > 1 ? `${base}<sup>${escapeHtml(String(c))}</sup>` : `${base}`;
  });

  const nonNumeric = strs.filter(s => !/^[0-9]+$/.test(s)).map(s => escapeHtml(s));
  const allParts = parts.concat(nonNumeric);

  if (elements.time) {
    elements.time.innerHTML = `<div class="time-label">計算時間</div><div class="time-value">${escapeHtml(elapsedTime)} 秒</div>`;
  }

  const resultHtml = `
    <div class="result-label">素因数</div>
    <div class="factors-content">
      <p id="resultContent" class="break-all" style="font-family:monospace; font-size:1rem;">
        ${allParts.join(' <span aria-hidden="true">×</span> ')}
      </p>
    </div>`;

  if (elements.result) elements.result.innerHTML = resultHtml;
  if (elements.outputBox) elements.outputBox.style.display = "block";
  if (elements.time) elements.time.style.display = "block";
  if (elements.result) elements.result.style.display = "block";
}

// 計算開始ボタンのクリックイベント
if (elements.calculateButton) {
  elements.calculateButton.addEventListener("click", startFactorization);
}

// 入力欄のEnterキー処理
if (elements.numberInput) {
  elements.numberInput.addEventListener("keydown", function(event) {
    if (event.isComposing || event.keyCode === 229) {
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      startFactorization();
    }
  });
}

// 入力欄の入力イベント処理
if (elements.numberInput) {
  elements.numberInput.addEventListener("input", () => {
    const input = elements.numberInput;
    input.value = input.value.replace(/[^0-9]/g, '');

    // 最大30桁に制限
    if (input.value.length > 30) {
      input.value = input.value.slice(0, 30);
    }

    const len = input.value.length;
    if (elements.charCounter) elements.charCounter.textContent = `${len}`;
    
    try {
      if (elements.calculateButton) {
        elements.calculateButton.disabled = len === 0 || (len > 0 && BigInt(input.value) < 2n);
      }
    } catch (e) {
      if (elements.calculateButton) elements.calculateButton.disabled = true;
    }

    if (elements.errorMessage) elements.errorMessage.style.display = "none";
    if (elements.outputBox) elements.outputBox.style.display = "none";
  });
}

if (elements.calculateButton) elements.calculateButton.disabled = true;

// 初期化時に素数リストを読み込む
(async () => {
  try {
    primes = await loadPrimes();
  } catch (e) {
    console.warn("素数リストの読み込みに失敗:", e);
  }
})();
