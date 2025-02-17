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

async function startFactorization() {
    try {
        let num = BigInt(document.getElementById("numberInput").value.trim());
        if (num < 2n) {
            document.getElementById("result").textContent = "有効な整数を入力してください";
            return;
        }

        // Web Worker による試し割り
        let { factors, remainder } = await trialDivisionFromFile(num);

        // 残りが 1 より大きければ Pollard’s rho 法で分解
        if (remainder > 1n) {
            let extraFactors = await pollardsRhoFactorization(remainder);
            factors = factors.concat(extraFactors);
        }

        document.getElementById("result").textContent = `素因数:\n${factors.join(" × ")}`;
    } catch (error) {
        console.error("計算エラー:", error);
    }
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
        let factors = await trialDivisionFromFile(num);

        // 残りが 1 より大きければ Pollard’s rho 法で分解
        if (num > 1n) {
            let extraFactors = await pollardsRhoFactorization(num);
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
    return new Promise((resolve, reject) => {
        const worker = new Worker('trialDivisionWorker.js');  // Worker を作成
        worker.postMessage({ number: number.toString(), primes });  // Worker に `n` を送信

        worker.onmessage = function(event) {
            worker.terminate();  // 処理終了後に Worker を停止
            resolve(event.data);  // 試し割りの結果を返す
        };

        worker.onerror = function(error) {
            worker.terminate();
            reject(error);
        };
    });
}

// 改良版 Pollard’s rho 法
async function pollardsRhoFactorization(number) {
    let factors = [];
    while (number > 1n) {
        let factor = pollardsRho(number);
        if (!factor || factor === number) {
            factors.push(number);
            break;
        }
        while (number % factor === 0n) {
            factors.push(factor);
            number /= factor;
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
