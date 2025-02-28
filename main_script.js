// ミラー・ラビン素数判定法
import { isPrimeMillerRabin } from './millerRabin.js';

let currentInput = null;
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
document.getElementById("numberInput").addEventListener("input", function(event) {
    if (event.target.value.length > 30) {
        event.target.value = event.target.value.slice(0, 30);
    }
});

// 外部の素数リストを読み込む
async function loadPrimes() {
    try {
        console.log("素数リストの読み込みを開始します...");
        const response = await fetch("https://tamurayuuiti.github.io/sub2/data/primes.txt");
        if (!response.ok) {
            throw new Error(`素数リストの読み込みに失敗しました (HTTP ${response.status})`);
        }
        const text = await response.text();
        primes = text.split(/\s+/).filter(n => n).map(n => BigInt(n)); // 空白・改行対応
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
        console.log(`因数分解を開始: ${num}`);

        if (num < 2n) {
            document.getElementById("result").textContent = "有効な整数を入力してください";
            return;
        }

        document.getElementById("result").textContent = "";
        document.getElementById("time").textContent = "";
        document.getElementById("progress").textContent = "経過時間: 0.000 秒";
        document.getElementById("spinner").style.display = "block";
        document.getElementById("loading").style.display = "flex";
        document.getElementById("progress").style.display = "block";
        await new Promise(resolve => setTimeout(resolve, 10));

        isCalculating = true;
        startTime = performance.now();
        progressInterval = setInterval(updateProgress, 1);

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
        console.log(`因数分解完了: ${factors.join(" × ")}, 時間: ${elapsedTime} 秒`);
    } catch (error) {
        console.error("計算エラー:", error);
        document.getElementById("result").textContent = "計算中にエラーが発生しました";
    } finally {
        isCalculating = false;
        clearInterval(progressInterval);
        document.getElementById("spinner").style.display = "none";
        document.getElementById("loading").style.display = "none";
        document.getElementById("progress").style.display = "none";
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
            
            if (i % 100 === 0) await new Promise(resolve => setTimeout(resolve, 0)); // 処理を分割
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
            console.log(`素数を発見: ${number}`);
            factors.push(number);
            break;
        }

        let factor = null;
        while (!factor || factor === number) {
            console.log(`Pollard's rho を再試行: ${number}`);
            factor = await pollardsRho(number);

            if (factor === null || factor === 1n) {
                console.error(`エラー: 因数を見つけられませんでした: ${number}`);
                return factors;
            }
        }

        console.log(`見つかった因数: ${factor}`);

        let subFactors = [];
        if (!isPrimeMillerRabin(factor)) {
            console.log(`合成数を発見: ${factor} → さらに分解`);
            subFactors = await pollardsRhoFactorization(factor);
        } else {
            subFactors = [factor];
        }

        let count = 0n;
        while (number % factor === 0n) {
            count++;
            number /= factor;
        }
        
        // ✅ `factor` そのものを追加せず、分解された `subFactors` のみを加える
        factors.push(...subFactors.flatMap(f => Array(Number(count)).fill(f)));

        // ✅ まとめて `number` から除算
        number /= factor ** count;

        await new Promise(resolve => setTimeout(resolve, 0)); // 過負荷防止
    }
    return factors;
}

async function pollardsRho(n) {
    if (n % 2n === 0n) return 2n;

    let x = 2n, y = 2n, d = 1n
    let c = generateC(n);
    let m = 128n, q = 1n;

    function f(x) { 
        return (x * x * x + 2n * x + c) % n;
    }

    x = f(x);
    y = f(f(y));

    let digitCount = n.toString().length;
    let k = digitCount <= 10 ? 5n 
            : digitCount <= 20 ? 10n 
            : digitCount <= 30 ? 15n 
            : digitCount <= 40 ? 20n 
            : 25n;

    let gcdSkipCounter = 0n;
    const gcdSkipLimit = 5n;

    while (d === 1n) {
        let ys = y;
        for (let i = 0n; i < m; i++) {
            y = f(y);
            q = (q * abs(x - y)) % n;

            if ((q & 0b1111n) === 0n || gcdSkipCounter >= gcdSkipLimit) {
                d = fastGCD(q, n);
                gcdSkipCounter = 0n;
                if (d > 1n) break;
            } else {
                gcdSkipCounter++;
            }

            if (i % 1000n === 0n) {
                await new Promise(resolve => setTimeout(resolve, 0));  
            }
        }

        x = ys;
        if (d === 1n) {
            m = (m * 3n) >> 1n;
            if (m > 10n ** 6n) {
                throw new Error("エラー: m が異常に大きくなっています。計算を停止します。");
            }
        }
    }
    return d === n ? null : d;
}

function generateC(n) {
    let digitCount = n.toString().length;
    let base = BigInt(10 ** Math.min(digitCount, 8));  // ✅ 8桁までの範囲で制限
    return base + BigInt(Math.floor(Math.random() * 1000));
}

function fastGCD(a, b) {
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
        b %= a;
    }
    return a << shift;  
}

function abs(n) {
    return n < 0n ? -n : n;
}

// 初回ロード時に素数データをプリロード
loadPrimes();
