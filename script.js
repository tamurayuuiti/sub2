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

// ミラー・ラビン素数判定法
function isPrimeMillerRabin(n) {
    console.log(`ミラー・ラビン素数判定を実行: n = ${n}`);
    if (n < 2n) return false;
    if (n === 2n || n === 3n) return true;
    if (n % 2n === 0n) return false;

    let d = n - 1n;
    let r = 0n;
    while (d % 2n === 0n) {
        d /= 2n;
        r++;
    }
    console.log(`n - 1 を 2 で割り続けた結果: d = ${d}, r = ${r}`);

    function powerMod(base, exp, mod) {
        let result = 1n;
        base %= mod;
        console.log(`  powerMod 計算開始: base = ${base}, exp = ${exp}, mod = ${mod}`);
        while (exp > 0n) {
            if (exp & 1n) {
                result = (result * base) % mod;
                console.log(`    result 更新: ${result}`);
            }
            exp >>= 1n;
            base = (base * base) % mod;
        }
        console.log(`  powerMod 計算完了: result = ${result}`);
        return result;
    }

    const witnesses = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n];

    let isCompositeConfirmed = false;
    for (let a of witnesses) {
        if (a >= n) continue;
        console.log(`証人 a = ${a} によるテスト開始`);
        let x = powerMod(a, d, n);
        console.log(`  x = ${x}`);

        if (x === 1n || x === n - 1n) {
            console.log(`  a = ${a} は合格 (x = ${x})`);
            continue;
        }

        let dCopy = d;
        let isComposite = true;
        for (let i = 0n; i < r - 1n; i++) {
            x = (x * x) % n;
            dCopy *= 2n;
            console.log(`    2^${i + 1n} * d のステップ: x = ${x}, dCopy = ${dCopy}`);

            if (x === 1n) {
                console.log(`  証人 a = ${a} により合成数判定`);
                isCompositeConfirmed = true;
                break;
            }
            if (x === n - 1n) {
                console.log(`  x が n-1 に到達 (x = ${x})、a = ${a} は合格`);
                isComposite = false;
                break;
            }
        }
        if (isComposite) {
            console.log(`  証人 a = ${a} により合成数確定`);
            isCompositeConfirmed = true;
            break;
        }
    }
    
    if (isCompositeConfirmed) {
        console.log(`n = ${n} は合成数と確定。追加の因数分解が必要。`);
        return false;
    }
    
    console.log(`n = ${n} は素数と判定`);
    return true;
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
            if (remainder >= 10n ** 17n) {
                extraFactors = await ecmFactorization(remainder);
            } else {
                extraFactors = await pollardsRhoFactorization(remainder);
            }

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

async function processFactor(factor, remainder) {
    if (isPrimeMillerRabin(factor)) {
        console.log(`  ECM因数分解成功: 素数 factor = ${factor}`);
        factors.push(factor); // 🔥 直接 factors に追加
    } else if (factor >= 10n ** 17n) {
        factors.push(...(await ecmFactorization(factor))); 
    } else {
        factors.push(...(await pollardsRhoFactorization(factor)));
    }
    
    if (isPrimeMillerRabin(remainder)) {
        factors.push(remainder); // 🔥 直接 factors に追加
    } else if (remainder >= 10n ** 17n) {
        factors.push(...(await ecmFactorization(remainder)));
    } else {
        factors.push(...(await pollardsRhoFactorization(remainder)));
    }
}

async function ecmFactorization(n) {
    console.log(`ECM因数分解を開始: n = ${n}`);
    
    // 事前に素数判定し、素数ならすぐ返す
    if (isPrimeMillerRabin(n)) {
        console.log(`  初期チェック: ${n} は素数`);
        factors.push(n);  // 🔥 直接 factors に追加する
        return;  // 処理終了
    }
    
    // 最大公約数を求める関数
    function gcd(a, b) {
        while (b) {
            let temp = b;
            b = a % b;
            a = temp;
        }
        return a;
    }

    // モジュラー逆元を求める関数
    function modInverse(a, m) {
        let m0 = m, t, q;
        let x0 = 0n, x1 = 1n;
        if (m === 1n) return 0n;
        while (a > 1n) {
            q = a / m;
            t = m;
            m = a % m;
            a = t;
            t = x0;
            x0 = x1 - q * x0;
            x1 = t;
        }
        return x1 < 0n ? x1 + m0 : x1;
    }

    let maxCurves = n > 10n ** 20n ? 10 : 5; // 大きな数には試行回数を増やす
    let B1 = 1000n, B2 = 2000n;
    
    while (true) { // 因数が見つかるまで繰り返す
        for (let i = 0; i < maxCurves; i++) {
            let a = BigInt(Math.floor(Math.random() * Number(n))); // ランダムな係数
            let x = BigInt(Math.floor(Math.random() * Number(n))); // ランダムな点
            let y = (x ** 3n + a * x + 1n) % n; // 楕円曲線の方程式

            console.log(`  ECM曲線 ${i + 1}/${maxCurves}: a = ${a}, x = ${x}, y = ${y}`);

            // Stage 1: B1 の範囲で因数探索
            let k = 2n;
            while (k < B1) {
                x = (x * x + a) % n;
                y = (y * y + a) % n;
                k *= 2n;
                let factor = gcd(x - y, n);
                if (factor > 1n && factor < n) {
                    let remainder = n / factor;
                    return await processFactor(factor, remainder);
                }
            }
            
            // Stage 2: B2 の範囲で因数探索
            console.log(`  ECM Stage 2 開始: B1 = ${B1}, B2 = ${B2}`);
            for (let j = B1; j < B2; j *= 2n) {
                x = (x * modInverse(j, n)) % n;
                y = (y * modInverse(j + 1n, n)) % n;
                let factor = gcd(x - y, n);
                if (factor > 1n && factor < n) {
                    let remainder = n / factor;
                    return await processFactor(factor, remainder);
                }
            }
        }
    }
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
