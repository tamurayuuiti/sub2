// ミラー・ラビン素数判定法
import { isPrimeMillerRabin } from './millerRabin.js';

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
document.getElementById("numberInput").addEventListener("keydown", function(event) {
    if (this.value.length >= 30 && /^[0-9]$/.test(event.key)) {
        event.preventDefault();
    }
});

// 外部の素数リスト読み込み
async function loadPrimes() {
    try {
        console.log("素数リストの読み込みを開始します...");
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
    let elapsedTime = ((performance.now() - startTime) / 1000).toFixed(3);
    document.getElementById("progress").textContent = `経過時間: ${elapsedTime} 秒`;
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
        document.getElementById("spinner").style.display = "block";
        document.getElementById("loading").style.display = "flex";
        await new Promise(resolve => setTimeout(resolve, 10));

        isCalculating = true;
        startTime = performance.now();

        if (primes.length === 0) {
            await loadPrimes();
            if (primes.length === 0) {
                throw new Error("素数リストが空のため、計算できません");
            }
        }

        console.log("試し割り法を実行します...");
        let { factors, remainder } = await trialDivisionFromFile(num);
        console.log(`試し割り法完了。残りの数: ${remainder}`);

        if (remainder > 1n) {
            console.log(`Pollard's rhoを開始: n = ${remainder}`);

            let extraFactors;
            extraFactors = await pollardsRhoFactorization(remainder);

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
        document.getElementById("spinner").style.display = "none";
        document.getElementById("loading").style.display = "none";
    }
}

// 外部ファイルを使った試し割り法
async function trialDivisionFromFile(number) {
    let factors = [];
    let lastLoggedPrime = 0n;
    let limit;
    
    if (number >= 10n ** 10n) {
        // nが10桁以上なら、10万以下の素数のみ
        limit = 0;
        for (let i = 0; i < primes.length; i++) {
            if (BigInt(primes[i]) > 100000n) break;
            limit = i + 1;
        }
    } else {
        // nが10桁未満なら、最大499979まで試す
        limit = Math.min(primes.length, 499979);
    }
    
    try {
        for (let i = 0; i < limit; i++) {
            if (primes[i] === undefined) break; // 万が一 undefined があれば停止
            let prime = BigInt(primes[i]);
            if (prime * prime > number) break;
            while (number % prime === 0n) {
                factors.push(prime);
                number /= prime;
            }
            
            if (i % 500 === 0) await new Promise(resolve => setTimeout(resolve, 0)); // 100はとりあえず固定
        }
        
    } catch (error) {
        console.error("試し割りエラー:", error);
        document.getElementById("result").textContent = "試し割り中にエラーが発生しました";
    }
    return { factors, remainder: number };
}

// 改良版 Pollard’s rho 法
async function pollardsRhoFactorization(number) {
    if (typeof number !== "bigint") {
        throw new TypeError(`エラー: pollardsRhoFactorization() に渡された number (${number}) が BigInt ではありません。`);
    }

    let factors = [];
    while (number > 1n) {
        if (isPrimeMillerRabin(number)) {
            console.log(`素因数を発見: ${number}`);
            factors.push(number);
            break;
        }

        let factor = null;
        while (!factor || factor === number) {
            console.log(`Pollard's rho を試行: ${number}`);
            factor = await pollardsRho(number);

            if (factor === null) {
                console.error(`Pollard's Rho では因数を見つけられませんでした。新しい処理に移行`);
                return await alternativeFactorization(number);  // **新しい処理（仮）へ移行**
            }
        }

        console.log(`見つかった因数: ${factor}`);

        if (isPrimeMillerRabin(factor)) {
            factors.push(factor);
        } else {
            console.log(`合成数を発見: ${factor} → さらに分解`);
            let subFactors = await pollardsRhoFactorization(factor);
            factors = factors.concat(subFactors);
        }

        number /= factor;
    }
    return factors;
}

async function pollardsRho(n) {
    let attempt = 0;

    while (true) {
        let { k, fxFunction, fxFunctionString, digitCount, MAX_TRIALS } = getDigitBasedParams(n, attempt);
        let trialCount = 0n;
        let x = 2n, y = 2n, d = 1n;
        let m = 128n, q = 1n;
        let c = getRandomC(n, attempt);

        console.log(`試行 ${attempt + 1} 回目: 使用中の f(x) = ${fxFunctionString}, MAX_TRIALS = ${MAX_TRIALS}`);

        if (digitCount >= 21 && attempt >= 2) {
            console.log(`試行 ${attempt + 1} 回目: Pollard’s Rho では因数を発見できず。新しい処理に移行`);
            return alternativeFactorization(n);
        }

        x = fxFunction(x, c, n);
        y = fxFunction(fxFunction(y, c, n), c, n);

        while (d === 1n && trialCount < BigInt(MAX_TRIALS)) {
            let ys = y;
            for (let i = 0n; i < m && trialCount < BigInt(MAX_TRIALS); i++) {
                y = fxFunction(fxFunction(y, c, n), c, n);
                q *= abs(x - y);
                if (q >= n) q %= n;
                trialCount++;

                if (q === 0n) {
                    console.log(`エラー: q が 0 になりました。`);
                    q = 1n;
                }

                if (i % (k + (m / 16n)) === 0n) {
                    d = gcd(q, n);
                    if (d > 1n) break;
                }

                if (i % 1000000n === 0n) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }

            x = ys;
            if (d === 1n) {
                m = (m * 3n) >> 1n;
                if (m > 10n ** 7n) {
                    console.log("エラー: m が異常に大きくなっています。計算を中断します。");
                    return null;
                }
            }
        }

        if (d > 1n && d !== n) {
            console.log(`因数を発見: ${d} (試行回数: ${trialCount})`);
            return d;
        }

        console.log(`試行回数 ${MAX_TRIALS} 回を超過。c を変更して再試行 (${attempt + 1}回目)`);
        attempt++;
    }
}

function getDigitBasedParams(n, attempt = 0) {
    let digitCount = Math.floor(Math.log10(Number(n))) + 1;

    // `k` の値（GCD 計算頻度）
    let k = digitCount <= 10 ? 5n 
          : digitCount <= 20 ? 10n 
          : digitCount <= 30 ? 15n 
          : 25n;

    // `maxC` の範囲（`c` の最大値）
    let maxC = digitCount <= 10 ? 10
             : digitCount <= 20 ? 30
             : 50;

    // `MAX_TRIALS` の設定（各関数ごとに異なる試行回数を設定）
    let MAX_TRIALS;
    let fxFunction;
    let fxFunctionString;

    if (digitCount <= 10) {
        fxFunction = (x, c, n) => (x * x + c) % n;
        fxFunctionString = "(x² + c) % n";
        MAX_TRIALS = 1000000;
    } else if (digitCount <= 20) {
        fxFunction = (x, c, n) => ((x + c) * (x + c) + c) % n;
        fxFunctionString = "((x + c)² + c) % n";
        MAX_TRIALS = 1000000;
    } else {
        if (attempt === 0) {
            fxFunction = (x, c, n) => ((x * x * x + c) % n);
            fxFunctionString = "(x³ + c) % n";
            MAX_TRIALS = 500000;
        } else if (attempt === 1) {
            fxFunction = (x, c, n) => ((x * x + c * x) % n);
            fxFunctionString = "(x² + c x) % n";
            MAX_TRIALS = 3000000;
        } else {
            fxFunction = null;
            fxFunctionString = "別の因数分解関数に移行";
            MAX_TRIALS = 0;
        }
    }

    return { digitCount, k, maxC, fxFunction, fxFunctionString, MAX_TRIALS };
}

function getRandomC(n, attempt = 0) {
    let { maxC, fxFunctionString } = getDigitBasedParams(n, attempt);
    let c = BigInt((Math.floor(Math.random() * maxC) * 2) + 1);

    console.log(`試行 ${attempt + 1} 回目: 使用中の c = ${c} (範囲: 1 ～ ${maxC * 2 - 1})`);

    return c;
}

function f(x, n, c) {
    let { fxFunction } = getDigitBasedParams(n);
    return fxFunction(x, c, n);
}

function gcd(a, b) {
    if (a === 0n) return b;
    if (b === 0n) return a;

    let shift = 0n;
    while (((a | b) & 1n) === 0n) {  
        a >>= 1n;
        b >>= 1n;
        shift++;
    }

    while ((a & 1n) === 0n) a >>= 1n;  
    while (b !== 0n) {
        while ((b & 1n) === 0n) b >>= 1n;
        if (a > b) [a, b] = [b, a];  
        b -= a;
        if (b === 0n) break;
    }

    return a << shift;  
}

function abs(n) {
    return n < 0n ? -n : n;
}

loadPrimes();
