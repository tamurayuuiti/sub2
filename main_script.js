// ミラー・ラビン素数判定法
import { isPrimeMillerRabin } from './Scripts/millerRabin.js';

// 試し割り法
import { trialDivision } from './Scripts/trialDivision.js';

// Pollard’s rho 法
import { pollardsRhoFactorization } from './Scripts/pollardsRho.js';

let startTime = null;
let isCalculating = false;
let progressInterval = null;
let primes = [];

document.getElementById("calculateButton").addEventListener("click", startFactorization);
document.getElementById("numberInput").addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        startFactorization();
    }
});

// 入力の桁数制限（30桁まで）
const inputField = document.getElementById("numberInput");
const charCounter = document.getElementById("charCounter");
const errorMessage = document.getElementById("errorMessage");

// 入力制御 & カウンター更新
function updateCounter() {
    charCounter.textContent = `現在の桁数: ${inputField.value.length} (最大30桁)`;

    if (inputField.value.length >= 30) {
        charCounter.classList.add("limit-reached");
        errorMessage.style.display = "block";
    } else {
        charCounter.classList.remove("limit-reached");
        errorMessage.style.display = "none";
    }
}

inputField.addEventListener("input", function() {
    const sanitized = this.value.replace(/[^0-9]/g, '').slice(0, 30);
    if (this.value !== sanitized) {
        console.log(`無効な文字を削除: ${this.value} → ${sanitized}`);
        this.value = sanitized;
    }
    updateCounter();
});

// 入力制限（記号・30桁超え防止）
inputField.addEventListener("keydown", function(event) {
    if (["e", "E", "+", "-", "."].includes(event.key) || 
        (this.value.length >= 30 && event.key >= "0" && event.key <= "9")) {
        event.preventDefault();
    }
});

// 外部の素数リスト読み込み
async function loadPrimes() {
    try {
        console.log("素数リストの読み込みを開始します");
        const response = await fetch("https://tamurayuuiti.github.io/sub2/data/primes.txt");
        if (!response.ok) {
            throw new Error(`素数リストの読み込みに失敗しました (HTTP ${response.status})`);
        }
        const text = await response.text();
        primes = text.split(/\s+/).filter(n => n).map(n => BigInt(n));
        if (primes.length === 0) {
            throw new Error("素数リストが空です");
        }
        console.log(`素数リストの読み込みが完了しました。${primes.length} 個の素数を取得しました。`);
    } catch (error) {
        console.error("素数リストの取得エラー:", error);
        alert("素数リストの読み込みに失敗しました。ページを更新して再試行してください。");
    }
}

function updateProgress() {
    let elapsedTime = ((performance.now() - startTime) / 1000).toFixed(1);
    document.getElementById("time").textContent = `経過時間: ${elapsedTime} 秒`;
}

async function startFactorization() {
    try {
        if (isCalculating) return;
        let inputValue = document.getElementById("numberInput").value.trim();
        if (!inputValue) return;

        let num = BigInt(inputValue);
        console.clear();
        console.log(`素因数分解を開始: ${num}`);

        if (num < 2n) {
            document.getElementById("result").textContent = "有効な整数を入力してください";
            return;
        }

        document.getElementById("result").textContent = "";
        document.getElementById("time").textContent = "";
        document.getElementById("progress").textContent = ""; // ← reset
        document.getElementById("spinner").style.display = "block";
        document.getElementById("loading").style.display = "flex";
        await new Promise(resolve => setTimeout(resolve, 10));

        isCalculating = true;
        startTime = performance.now();

        progressInterval = setInterval(updateProgress, 100);

        if (primes.length === 0) {
            await loadPrimes();
            if (primes.length === 0) {
                throw new Error("素数リストが空のため、計算できません");
            }
        }

        console.log("試し割り法を実行します");
        let { factors, remainder } = await trialDivision(num, primes, msg => {
            document.getElementById("result").textContent = msg;
        });
        console.log(`試し割り法完了。残りの数: ${remainder}`);

        if (remainder > 1n) {
            console.log(`Pollard's rho を開始。利用可能なスレッド数: ${navigator.hardwareConcurrency}, n = ${remainder}`);
            let extraFactors = await pollardsRhoFactorization(remainder);

            if (extraFactors.includes("FAIL")) {
                console.error(`Pollard's Rho では因数を発見できませんでした。素因数分解を中断します。`);
                document.getElementById("result").textContent = "素因数分解失敗";
                return;
            }

            factors = factors.concat(extraFactors);
        }

        let elapsedTime = ((performance.now() - startTime) / 1000).toFixed(3);
        document.getElementById("result").textContent = `素因数:\n${factors.sort((a, b) => (a < b ? -1 : 1)).join(" × ")}`;
        document.getElementById("time").textContent = `計算時間: ${elapsedTime} 秒`;
        console.log(`素因数分解完了: ${factors.join(" × ")}, 計算時間: ${elapsedTime} 秒`);
    } catch (error) {
        console.error("計算エラー:", error);
        document.getElementById("result").textContent = "計算中にエラーが発生しました";
    } finally {
        isCalculating = false;
        clearInterval(progressInterval);
        document.getElementById("progress").textContent = ""; // ← これを追加
        document.getElementById("spinner").style.display = "none";
        document.getElementById("loading").style.display = "none";
    }
}

loadPrimes();
