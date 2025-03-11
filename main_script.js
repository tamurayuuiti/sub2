// ミラー・ラビン素数判定法
import { isPrimeMillerRabin } from './millerRabin.js';

// Pollard’s rho 法
import { pollardsRhoFactorization } from './pollardsRho.js';

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

async function alternativeFactorization(n) {
    if (typeof n !== "bigint") {
        throw new TypeError(`エラー: alternativeFactorization() に渡された number (${n}) が BigInt ではありません。`);
    }

    console.log(`Quadratic Sieve を開始: ${n}`);

    // 素因数基数の設定（B値）
    let B = getOptimalB(n);
    let factorBase = getFactorBase(B);
    console.log(`素因数基数 (Factor Base) のサイズ: ${factorBase.length}`);

    // 平滑数の収集
    let smoothNumbers = [];
    let xValues = [];
    for (let x = Math.ceil(Math.sqrt(Number(n))); smoothNumbers.length < factorBase.length + 10; x++) {
        let value = (BigInt(x) ** 2n) % n;
        let factorization = trialDivision(value, factorBase);

        if (factorization) {
            smoothNumbers.push(factorization);
            xValues.push(BigInt(x));
        }

        if (x % 10000 === 0) await new Promise(resolve => setTimeout(resolve, 0)); // 非同期処理
    }

    console.log(`平滑数を ${smoothNumbers.length} 個収集`);

    // 線形代数（ガウス消去法）で平方合同を求める
    let { x, y } = findCongruentSquares(smoothNumbers, xValues, n);
    if (!x || !y) {
        console.error("平方合同が見つかりませんでした。");
        return [n]; // QS 失敗時にそのまま返す
    }

    // GCD を計算して因数を発見
    let factor = gcd(x - y, n);
    if (factor === 1n || factor === n) {
        console.error("QS で因数を発見できませんでした。");
        return [n];
    }

    console.log(`QS で見つかった因数: ${factor}`);

    // 残りの因数も求める
    let otherFactor = n / factor;
    let factors = [];

    if (isPrimeMillerRabin(factor)) {
        factors.push(factor);
    } else {
        let subFactors = await alternativeFactorization(factor);
        factors = factors.concat(subFactors);
    }

    if (isPrimeMillerRabin(otherFactor)) {
        factors.push(otherFactor);
    } else {
        let subFactors = await alternativeFactorization(otherFactor);
        factors = factors.concat(subFactors);
    }

    return factors;
}

loadPrimes();
