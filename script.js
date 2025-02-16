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

async function loadPrimes() {
    const response = await fetch("primes.txt");
    const text = await response.text();
    primes = text.split(/\s+/).map(n => BigInt(n));
}

function updateProgress() {
    if (isCalculating) {
        document.getElementById("progress").textContent = `経過時間: ${( (performance.now() - startTime) / 1000).toFixed(3)} 秒`;
    } else {
        clearInterval(progressInterval);
    }
}

async function startFactorization() {
    if (isCalculating || currentInput === BigInt(document.getElementById("numberInput").value.trim())) return;
    let num = BigInt(document.getElementById("numberInput").value.trim());
    if (num < 2n) {
        document.getElementById("result").textContent = "有効な整数を入力してください";
        return;
    }

    if (currentInput !== num) {
        currentInput = num;
        document.getElementById("result").textContent = "";
        document.getElementById("time").textContent = "";
        document.getElementById("progress").textContent = "経過時間: 0.000 ms";
        startTime = performance.now();
    }
    document.getElementById("spinner").style.display = "block";
    document.getElementById("loading").style.display = "flex";
    document.getElementById("progress").style.display = "block";
    isCalculating = true;
    progressInterval = setInterval(updateProgress, 1);

    let factors = num <= 1000000n ? await trialDivisionFromFile(num) : await hybridFactorization(num);
    
    document.getElementById("spinner").style.display = "none";
    document.getElementById("loading").style.display = "none";
    document.getElementById("progress").style.display = "none";
    let elapsedTime = ((performance.now() - startTime) / 1000).toFixed(3);
    document.getElementById("result").textContent = `素因数:\n${factors.join(" × ")}`;
    document.getElementById("time").textContent = `計算時間: ${elapsedTime} 秒`;

    isCalculating = false;
    clearInterval(progressInterval);
}

// 外部ファイルを使った試し割り法
async function trialDivisionFromFile(number) {
    if (primes.length === 0) {
        await loadPrimes();
    }

    let factors = [];
    for (let prime of primes) {
        if (prime * prime > number) break;
        while (number % prime === 0n) {
            factors.push(prime);
            number /= prime;
        }
    }
    if (number > 1n) {
        factors.push(number);
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
    if (primes.length === 0) {
        await loadPrimes();
    }

    for (let prime of primes) {
        if (prime * prime > number) break;
        while (number % prime === 0n) {
            factors.push(prime);
            number /= prime;
        }
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
