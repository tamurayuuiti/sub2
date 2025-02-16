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

// 外部の素数リストを読み込む
async function loadPrimes() {
    try {
        const response = await fetch("https://tamurayuuiti.github.io/sub2/dataprimes.txt");
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

        let factors = num <= 1000000n ? await trialDivisionFromFile(num) : await hybridFactorization(num);

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
        if (number > 1n) {
            factors.push(number);
        }
    } catch (error) {
        console.error("試し割りエラー:", error);
        document.getElementById("result").textContent = "試し割り中にエラーが発生しました";
    }
    return factors;
}

// Pollard’s rho 法（Floyd's cycle detection）
function pollardsRho(n) {
    if (n % 2n === 0n) return 2n;
    let x = 2n, y = 2n, d = 1n;
    function f(x) { return (x * x + 1n) % n; }
    while (d === 1n) {
        x = f(x);
        y = f(f(y));
        d = gcd(abs(x - y), n);
    }
    return d === n ? null : d;
}

// 組み合わせ素因数分解（試し割り + Pollard’s rho）
async function hybridFactorization(number) {
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
        if (number > 1n) {
            while (number > 1n) {
                let factor = pollardsRho(number);
                if (!factor) {
                    factors.push(number);
                    break;
                }
                while (number % factor === 0n) {
                    factors.push(factor);
                    number /= factor;
                }
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
    } catch (error) {
        console.error("Pollard's rho 法のエラー:", error);
        document.getElementById("result").textContent = "素因数分解中にエラーが発生しました";
    }
    return factors;
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
