let currentInput = null;
let startTime = null;
let isCalculating = false;
let progressInterval = null;
let primes = [];

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
        const response = await fetch("https://tamurayuuiti.github.io/sub2/data/primes.txt");
        if (!response.ok) {
            throw new Error(`素数リストの読み込みに失敗しました (HTTP ${response.status})`);
        }
        const text = await response.text();
        primes = text.split(/\s+/).filter(n => n).map(n => BigInt(n)); // 空白・改行対応
        if (primes.length === 0) {
            throw new Error("素数リストが空です");
        }
    } catch (error) {
        console.error("素数リストの取得エラー:", error);
        alert("素数リストの読み込みに失敗しました。ページを更新して再試行してください。");
    }
}

function updateProgress() {
    let elapsedTime = ((performance.now() - startTime) / 1000).toFixed(3);
    document.getElementById("progress").textContent = `経過時間: ${elapsedTime} 秒`;
}

// ECM（楕円曲線法）
function ecmFactorization(n, maxCurves = 5, B = 1000) {
    function gcd(a, b) {
        while (b) {
            let temp = b;
            b = a % b;
            a = temp;
        }
        return a;
    }

    for (let i = 0; i < maxCurves; i++) {
        let a = BigInt(Math.floor(Math.random() * Number(n))); 
        let x = BigInt(Math.floor(Math.random() * Number(n))); 
        let y = (x ** 3n + a * x + 1n) % n;

        let factor = gcd(2n * y, n); 
        if (factor > 1n && factor < n) return factor;

        let k = 2n;
        while (k < B) {
            x = (x * x + a) % n;
            y = (y * y + a) % n;
            k *= 2n;
            factor = gcd(x - y, n);
            if (factor > 1n && factor < n) return factor;
        }
    }
    return null;
}

// ミラー・ラビン素数判定法
function isPrimeMillerRabin(n) {
    if (n < 2n) return false;
    if (n === 2n || n === 3n) return true;
    if (n % 2n === 0n) return false;

    let d = n - 1n;
    while (d % 2n === 0n) d /= 2n;

    function powerMod(base, exp, mod) {
        let result = 1n;
        base %= mod;
        while (exp > 0n) {
            if (exp & 1n) result = (result * base) % mod; // ビット演算で最適化
            exp >>= 1n;
            base = (base * base) % mod;
        }
        return result;
    }

    // 12個の固定基数（n < 2²⁵⁶ なら確定的に判定可能）
    const witnesses = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n];

    for (let a of witnesses) {
        if (a >= n) break; // `n` より大きな `a` は無視
        let x = powerMod(a, d, n);
        if (x === 1n || x === n - 1n) continue;

        let dCopy = d;
        let isComposite = true;
        while (dCopy !== n - 1n) {
            x = (x * x) % n;
            dCopy *= 2n;
            if (x === 1n) return false;
            if (x === n - 1n) {
                isComposite = false;
                break;
            }
        }
        if (isComposite) return false;
    }

    return true;
}

async function startFactorization() {
    try {
        if (isCalculating) return; // 計算中なら無視
        let inputValue = document.getElementById("numberInput").value.trim();
        if (!inputValue) return; // 空入力は無視

        let num = BigInt(inputValue);
        if (num < 2n) {
            document.getElementById("result").textContent = "有効な整数を入力してください";
            return;
        }

        // n >= 10^7 の場合、試し割りの前にミラー・ラビン素数判定
        if (num >= 10000000n && isPrimeMillerRabin(num)) {
            document.getElementById("result").textContent = `素数: ${num}`;
            return;
        }

        // UIを即座に更新
        document.getElementById("result").textContent = "";
        document.getElementById("time").textContent = "";
        document.getElementById("progress").textContent = "経過時間: 0.000 秒";
        document.getElementById("spinner").style.display = "block";
        document.getElementById("loading").style.display = "flex";
        document.getElementById("progress").style.display = "block";
        await new Promise(resolve => setTimeout(resolve, 10));

        isCalculating = true;
        startTime = performance.now(); // 計測開始
        progressInterval = setInterval(updateProgress, 1); // 1msごとに経過時間更新

        if (primes.length === 0) {
            await loadPrimes();
            if (primes.length === 0) {
                throw new Error("素数リストが空のため、計算できません");
            }
        }

        // まず試し割りを実施
        let { factors, remainder } = await trialDivisionFromFile(num); // `remainder` を取得

        // 残りが 1 より大きければ Pollard’s rho 法で分解
        if (remainder > 1n) {
            let extraFactors = await pollardsRhoFactorization(remainder);
            factors = factors.concat(extraFactors);
        }

        let elapsedTime = ((performance.now() - startTime) / 1000).toFixed(3);
        document.getElementById("result").textContent = `素因数:\n${factors.join(" × ")}`;
        document.getElementById("time").textContent = `計算時間: ${elapsedTime} 秒`;
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
    try {
        for (let i = 0; i < primes.length; i++) {
            let prime = primes[i];
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
    let factors = [];

    while (number > 1n) {
        if (isPrimeMillerRabin(number)) {
            factors.push(number);
            break;
        }

        let factor = null;

        // 20桁以上なら ECM を試す
        if (number > 10n ** 19n) {  
            factor = ecmFactorization(number);
        } 
        
        // ECM で因数を見つけられなかった場合、Pollard’s Rho を適用
        if (!factor) {  
            factor = pollardsRho(number);
        }

        if (factor) {
            factors.push(factor);
            while (number % factor === 0n) {
                number /= factor;
            }
            if (isPrimeMillerRabin(number)) {
                factors.push(number);
                break;
            }
            continue; // まだ素因数分解が必要ならループを継続
        }

        await new Promise(resolve => setTimeout(resolve, 0)); // 負荷分散
    }

    return factors;
}

function pollardsRho(n) {
    if (n % 2n === 0n) return 2n;

    let x = 2n, y = 2n, d = 1n, c = BigInt(Math.floor(Math.random() * 10) + 1);
    let m = 128n, g = 1n, q = 1n;
    function f(x) { return (x * x + c) % n; }

    x = f(x);
    y = f(f(y));

    while (d === 1n) {
        let ys = y;
        for (let i = 0n; i < m; i++) {
            y = f(y);
            q = (q * abs(x - y)) % n;
        }
        d = gcd(q, n);
        x = ys;
        if (d === 1n) m *= 2n; // サイクルの長さを2倍に拡張
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
