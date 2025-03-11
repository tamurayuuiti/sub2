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
            extraFactors = alternativeFactorization(remainder);

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

    console.log(`=== Quadratic Sieve を開始: ${n} ===`);

    // 素因数基数の設定（B値）
    let B = getOptimalB(n);
    let factorBase = getFactorBase(B);
    console.log(`🔹 素因数基数 (Factor Base) のサイズ: ${factorBase.length}, B = ${B}`);

    // 平滑数の収集
    let smoothNumbers = [];
    let xValues = [];
    let sqrtN = Math.ceil(Math.sqrt(Number(n)));
    let maxAttempts = factorBase.length + 20; // 余裕を持たせる
    let logInterval = Math.max(1, Math.floor(maxAttempts / 10)); // 進捗ログの間隔

    console.log(`平滑数を収集中 (最大 ${maxAttempts} 試行)...`);

    for (let x = sqrtN, attempts = 0; smoothNumbers.length < factorBase.length + 10 && maxAttempts > 0; x++, attempts++) {
        let value = (BigInt(x) ** 2n) % n;
        let factorization = trialDivision(value, factorBase);

        if (factorization) {
            smoothNumbers.push(factorization);
            xValues.push(BigInt(x));

            if (smoothNumbers.length % 10 === 0) {
                console.log(`平滑数 ${smoothNumbers.length}/${factorBase.length + 10} 取得`);
            }
        }

        // 一定間隔ごとに進捗ログを出力
        if (attempts % logInterval === 0) {
            console.log(`試行 ${attempts}/${maxAttempts} 回目, 平滑数 ${smoothNumbers.length}/${factorBase.length + 10}`);
        }

        if (attempts % 5000 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0)); // 非同期処理でフリーズ防止
        }
        maxAttempts--;
    }

    if (smoothNumbers.length < factorBase.length) {
        console.error(`平滑数が不足 (必要: ${factorBase.length}, 取得: ${smoothNumbers.length}) → QS 失敗`);
        return [n]; // QS 失敗時にそのまま返す
    }

    console.log(`平滑数の収集完了！ 合計 ${smoothNumbers.length} 個`);

    // 線形代数（ガウス消去法）で平方合同を求める
    console.log(`平方合同を探索中...`);
    let { x, y } = findCongruentSquares(smoothNumbers, xValues, n);
    if (!x || !y) {
        console.error("平方合同が見つかりませんでした。");
        return [n]; // 失敗
    }
    console.log(`平方合同が見つかりました！`);

    // GCD を計算して因数を発見
    console.log(`GCD を計算中...`);
    let factor = gcd(x - y, n);
    if (factor === 1n || factor === n) {
        console.error("QS で有効な因数を発見できませんでした。");
        return [n];
    }

    console.log(`QS で見つかった因数: ${factor}`);

    // 残りの因数も求める
    let otherFactor = n / factor;
    let factors = [];

    if (isPrimeMillerRabin(factor)) {
        console.log(`🔹 ${factor} は素数`);
        factors.push(factor);
    } else {
        console.log(`🔹 ${factor} は合成数 → 再帰処理`);
        let subFactors = await alternativeFactorization(factor);
        factors = factors.concat(subFactors);
    }

    if (isPrimeMillerRabin(otherFactor)) {
        console.log(`🔹 ${otherFactor} は素数`);
        factors.push(otherFactor);
    } else {
        console.log(`🔹 ${otherFactor} は合成数 → 再帰処理`);
        let subFactors = await alternativeFactorization(otherFactor);
        factors = factors.concat(subFactors);
    }

    return factors;
}

function getOptimalB(n) {
    let logN = Math.log(Number(n));
    return Math.floor(Math.exp(0.5 * Math.sqrt(logN * Math.log(logN)))); // 最適な B の近似
}

function getFactorBase(B) {
    let primes = [];
    for (let p = 2; p <= B; p++) {
        if (isPrime(p)) primes.push(p);
    }
    return primes;
}

function isPrime(num) {
    if (num < 2) return false;
    for (let i = 2; i * i <= num; i++) {
        if (num % i === 0) return false;
    }
    return true;
}

function trialDivision(value, factorBase) {
    let factorization = [];
    for (let prime of factorBase) {
        let count = 0;
        while (value % BigInt(prime) === 0n) {
            value /= BigInt(prime);
            count++;
        }
        if (count > 0) factorization.push({ prime, count });
    }
    return value === 1n ? factorization : null;
}

function findCongruentSquares(smoothNumbers, xValues, n) {
    let exponentMatrix = smoothNumbers.map(row => row.map(f => f.count % 2)); // 各素因数の指数を2で割った余り
    let solution = gaussianElimination(exponentMatrix);

    if (!solution) return null;

    let x = 1n;
    let y = 1n;
    for (let i = 0; i < solution.length; i++) {
        if (solution[i]) {
            x *= xValues[i];
            for (let factor of smoothNumbers[i]) {
                y *= BigInt(factor.prime) ** BigInt(factor.count / 2);
            }
        }
    }

    return { x: x % n, y: y % n };
}

function gaussianElimination(matrix) {
    let rows = matrix.length, cols = matrix[0].length;
    let solution = new Array(cols).fill(0);

    for (let col = 0; col < cols; col++) {
        let pivotRow = -1;
        for (let row = col; row < rows; row++) {
            if (matrix[row][col] === 1) {
                pivotRow = row;
                break;
            }
        }
        if (pivotRow === -1) continue;

        [matrix[col], matrix[pivotRow]] = [matrix[pivotRow], matrix[col]];

        for (let row = 0; row < rows; row++) {
            if (row !== col && matrix[row][col] === 1) {
                for (let c = 0; c < cols; c++) {
                    matrix[row][c] ^= matrix[col][c];
                }
            }
        }
    }

    for (let row = 0; row < rows; row++) {
        if (matrix[row].every(v => v === 0)) continue;
        for (let col = 0; col < cols; col++) {
            if (matrix[row][col] === 1) {
                solution[col] = 1;
                break;
            }
        }
    }

    return solution.includes(1) ? solution : null;
}

loadPrimes();
