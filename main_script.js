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
    if (event.target.value.length > 50) {
        event.target.value = event.target.value.slice(0, 50);
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
            console.log("因数分解を実行します...");

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
            
            if (i % 5000 === 0 && prime !== lastLoggedPrime) {
                console.clear();
                console.log(`試し割り中... 現在の素数: ${prime}`);
                lastLoggedPrime = prime;
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
    let factors = [];
    while (number > 1n) {
        if (isPrimeMillerRabin(number)) {
            factors.push(number);
            break;
        }

        let factor = null;
        
        while (!factor || factor === number) { // 成功するまで繰り返す
            console.log(`Pollard's rho を再試行: ${number}`);
            factor = pollardsRho(number);
        }

        // **因数が合成数の場合、再帰的に分解する**
        if (isPrimeMillerRabin(factor)) {
            factors.push(factor);
        } else {
            console.log(`合成数を発見: ${factor} → さらに分解`);
            let subFactors = await pollardsRhoFactorization(factor);
            factors = factors.concat(subFactors);
        }

        number /= factor;
        await new Promise(resolve => setTimeout(resolve, 0));
    }
    return factors;
}

function pollardsRho(n) {
    if (n % 2n === 0n) return 2n;

    let x = 2n, y = 2n, d = 1n, c = BigInt(Math.floor(Math.random() * 10) + 1);
    let m = 128n, q = 1n;

    // **nの桁数を取得**
    let digitCount = n.toString().length;
    let useMontgomery = digitCount >= 30; // 30桁以上ならMontgomery乗算を使用

    let R = useMontgomery ? (1n << BigInt(n.toString(2).length + 1)) : 0n;
let nInv = useMontgomery ? modInverse(-n, R) : 0n;

// Montgomery 乗算
function montgomeryMul(a, b, n, R, nInv) {
    let t = a * b;
    let m = ((t % R) * nInv) % R;  // `t % R` を追加してオーバーフロー防止
    let u = (t + m * n) / R;
    
    return u < 0n ? (u + n) % n : (u >= n ? u - n : u); // 負数を防ぐ処理を追加
}

// モジュラー逆数計算
function modInverse(a, m) {
    let m0 = m, y = 0n, x = 1n;
    if (m === 1n) return 0n;

    while (a > 1n) {
        let q = a / m;
        let t = m;

        m = a % m;
        a = t;
        t = y;

        y = x - q * y;
        x = t;
    }

    return x < 0n ? x + m0 : x;
}

// `f(x)` を修正
function f(x) { 
    return (montgomeryMul(x, x, n, R, nInv) + c) % n;
}

    x = f(x);
    y = f(f(y));

    // **kの動的設定**
    let k = digitCount <= 10 ? 5n 
            : digitCount <= 20 ? 10n 
            : digitCount <= 30 ? 15n 
            : digitCount <= 40 ? 20n 
            : 25n;

    while (d === 1n) {
        let ys = y;
        for (let i = 0n; i < m; i++) {
            y = f(y);
            q = useMontgomery 
                ? montgomeryMul(q, abs(x - y), n, R, nInv)
                : (q * abs(x - y)) % n;

            // **k回に1回だけgcdを計算**
            if (i % k === 0n) {
                d = gcd(q, n);
                if (d > 1n) break;  // 因数が見つかったら即終了
            }
        }

        x = ys;
        if (d === 1n) m *= 2n;  // 探索範囲を増やす

        // **q をリセットしてオーバーフローを防ぐ**
        if (q > n) q = 1n;
    }

    return d === n ? null : d;
}

// 最大公約数計算
function gcd(a, b) {
    while (b) {
        let temp = b;
        b = a % b;
        a = temp;
    }
    return a;
}

// 絶対値計算
function abs(n) {
    return n < 0n ? -n : n;
}

// 初回ロード時に素数データをプリロード
loadPrimes();
