// ミラー・ラビン素数判定法
import { isPrimeMillerRabin } from './Scripts/millerRabin.js';

// 試し割り法
import { trialDivision, loadPrimes } from './Scripts/trialDivision.js';

// Pollard’s rho 法
import { pollardsRhoFactorization } from './Scripts/pollardsRho.js';

const coreCount = navigator.hardwareConcurrency || 4;
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

const numberInput = document.getElementById("numberInput");
const charCounter = document.getElementById("charCounter");

numberInput.addEventListener("beforeinput", (e) => {
    const len = numberInput.value.length;
    const sel = numberInput.selectionEnd - numberInput.selectionStart;

    // e.data が null（Backspace など）のときは許可
    if (e.data && len - sel + e.data.length > 30) {
        e.preventDefault();
    }
    if (sanitized.length > 30) {
        sanitized = sanitized.slice(0, 30);
    }
});

numberInput.addEventListener("input", () => {
    const len = numberInput.value.length;
    charCounter.textContent = `現在の桁数: ${len}（最大30桁）`;
    charCounter.classList.toggle("limit-reached", len >= 30);
});

function updateProgress() {
    if (!startTime) return;
    let elapsedTime = ((performance.now() - startTime) / 1000).toFixed(1);
    document.getElementById("elapsed-time").textContent = `（経過時間: ${elapsedTime} 秒）`;
    requestAnimationFrame(updateProgress);
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
        document.getElementById("progress").textContent = "";
        document.getElementById("spinner").style.display = "block";
        document.getElementById("elapsed-time").style.display = "none";
        document.getElementById("loading").style.display = "flex";

        isCalculating = true;
        startTime = performance.now();

        // 1秒後に経過時間を表示し、更新開始
        setTimeout(() => {
            document.getElementById("elapsed-time").style.display = "block";
            updateProgress();
        }, 1000);

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
            console.log(`Pollard's rho を開始 (コア数: ${coreCount})`);
            const extraFactors = await pollardsRhoFactorization(remainder);

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
        document.getElementById("progress").textContent = "";
        document.getElementById("spinner").style.display = "none";
        document.getElementById("elapsed-time").style.display = "none";
        document.getElementById("loading").style.display = "none";
    }
}

(async () => {
    primes = await loadPrimes();
})();
