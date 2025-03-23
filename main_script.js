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
const inputField = document.getElementById("numberInput");
const charCounter = document.getElementById("charCounter");
const errorMessage = document.getElementById("errorMessage");

// 入力制御 & カウンター更新
function updateCounter() {
    charCounter.textContent = `現在の桁数: ${inputField.value.length} (最大30桁)`;

    if (inputField.value.length >= 30) {
        charCounter.classList.add("limit-reached");
        errorMessage.style.display = "block";
    } else {
        charCounter.classList.remove("limit-reached");
        errorMessage.style.display = "none";
    }
}

inputField.addEventListener("input", function() {
    const sanitized = this.value.replace(/[^0-9]/g, '').slice(0, 30);
    if (this.value !== sanitized) {
        console.log(`無効な文字を削除: ${this.value} → ${sanitized}`);
        this.value = sanitized;
    }
    updateCounter();
});

// 入力制限（記号・30桁超え防止）
inputField.addEventListener("keydown", function(event) {
    if (["e", "E", "+", "-", "."].includes(event.key) || 
        (this.value.length >= 30 && event.key >= "0" && event.key <= "9")) {
        event.preventDefault();
    }
});

// 外部の素数リスト読み込み
async function loadPrimes() {
    try {
        console.log("素数リストの読み込みを開始します");
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

        console.log("試し割り法を実行します");
        let { factors, remainder } = await trialDivisionFromFile(num);
        console.log(`試し割り法完了。残りの数: ${remainder}`);

        if (remainder > 1n) {
            console.log(`Pollard's rhoを開始: n = ${remainder}`);
            let extraFactors = await pollardsRhoFactorization(remainder);

            // **Pollard's Rho で因数分解できなかった場合**
            if (extraFactors.includes("FAIL")) {
                console.error(`Pollard's Rho では因数を発見できませんでした。Quadratic Sieve に移行`);
                extraFactors = await alternativeFactorization(remainder);
            }
            
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

    if (primes.length === 0) {
        console.warn("primes が未ロードのため、ロードを試行します...");
        await loadPrimes();
        if (primes.length === 0) {
            throw new Error("素数リストのロードに失敗しました。factorBase を生成できません。");
        }
    }

    console.log(`=== Quadratic Sieve を開始: ${n} ===`);

    let B = getOptimalB(n);
    let factorBase = getFactorBase(B);

    console.log("B:", B);
    console.log("factorBase.length:", factorBase.length);

    if (!factorBase || factorBase.length === 0) {
        throw new Error(`factorBase の生成に失敗しました。B=${B} に対して十分な素数がありません。`);
    }

    console.log(`素因数基数 (Factor Base) のサイズ: ${factorBase.length}, B = ${B}`);

    let factor = null;
    let smoothNumbers = [];
    let xValues = [];
    let sqrtN = sqrtBigInt(n);
    let minSmoothCount = factorBase.length;
    let maxAttempts = Math.min(Math.max(minSmoothCount * 3, Math.floor(Number(sqrtN) / 2)), 100_000_000);

    console.log(`平滑数を収集中 (最大 ${maxAttempts} 試行)...`);

    for (let x = Number(sqrtN), attempts = 0; smoothNumbers.length < minSmoothCount && attempts < maxAttempts; x++, attempts++) {
        let value = (BigInt(x) * BigInt(x)) % n;
        let factorization = trialDivision(value, factorBase);

        if (factorization) {
            smoothNumbers.push(factorization);
            xValues.push(BigInt(x));

            if (smoothNumbers.length % 10 === 0) {
                console.log(`平滑数 ${smoothNumbers.length}/${minSmoothCount} 取得`);
            }
        }

        if (attempts % 5000 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    if (smoothNumbers.length < minSmoothCount) {
        console.error(`平滑数が不足 (必要: ${minSmoothCount}, 取得: ${smoothNumbers.length}) → QS 失敗`);
        return [n];
    }

    console.log(`平滑数の収集完了！ 合計 ${smoothNumbers.length} 個`);
    
    console.log(`平方合同を探索中...`);
    let { x, y } = findCongruentSquares(smoothNumbers, xValues, factorBase, n);
    
    if (!x || !y) {
        console.error("平方合同が見つかりませんでした。");
        console.error("デバッグ情報: smoothNumbers.length =", smoothNumbers.length);
        return [n];
    }

    console.log(`平方合同が見つかりました！ x = ${x}, y = ${y}`);

    console.log(`GCD を計算中...`);
    let diff = abs(x - y);
    console.log(`x - y = ${diff}`);

    if (diff === 0n) {
        console.error("エラー: x と y が等しいため GCD 計算が無意味です");
        return [n];
    }
    
    if (factor === 1n) {
        console.error(`QS 失敗: ${diff} と ${n} は互いに素 (gcd = 1)`);
        return [n]; 
    }
    
    if (factor === n) {
        console.error(`QS 失敗: ${diff} は n の倍数 (gcd = n)`);
        return [n];
    }

    factor = gcd(diff, n);
    console.log(`GCD(${diff}, ${n}) = ${factor}`);
    
    let maxRetries = 5; 
    let retryCount = 0;

    while ((!x || !y) && retryCount < maxRetries) {
        console.warn(`平方合同が見つかりませんでした。再探索中... (${retryCount + 1}/${maxRetries})`);
        let newXY = findCongruentSquares(smoothNumbers, xValues, factorBase, n);
        if (!newXY.x || !newXY.y) {
            retryCount++;
            continue;
        }
        x = newXY.x;
        y = newXY.y;
    }

    if (!x || !y) {
        console.error("平方合同を見つけることができませんでした。");
        return [n];
    }

    console.log(`QS で見つかった因数: ${factor}`);

    let otherFactor = n / factor;
    let factors = [];

    if (isPrimeMillerRabin(factor)) {
        factors.push(factor);
    } else {
        console.log(`因数 ${factor} を再帰的に分解`);
        let subFactors = await alternativeFactorization(factor);
        factors = factors.concat(subFactors);
    }

    if (isPrimeMillerRabin(otherFactor)) {
        factors.push(otherFactor);
    } else {
        console.log(`因数 ${otherFactor} を再帰的に分解`);
        let subFactors = await alternativeFactorization(otherFactor);
        factors = factors.concat(subFactors);
    }

    return factors;
}

function getOptimalB(n) {
    let logN = n.toString().length * Math.LN10;
    let C = 0.56; // 補正係数
    return Math.floor(C * Math.exp(0.5 * Math.sqrt(logN * Math.log(logN))));
}

function sqrtBigInt(n) {
    if (n < 0n) throw new RangeError("負の数の平方根は計算できません");
    if (n < 2n) return n;
    
    let x0 = n;
    let x1 = (n + 1n) / 2n;
    
    while (x1 < x0) {
        x0 = x1;
        x1 = (x1 + n / x1) / 2n;
    }
    
    return x0;
}

function getFactorBase(B) {
    if (primes.length === 0) {
        throw new Error("素数リストが未読み込みです。");
    }

    let factorBase = primes.filter(p => p <= BigInt(B)).map(p => Number(p));

    if (factorBase.length === 0) {
        throw new Error(`factorBase が空です。B=${B} に対して十分な素数がありません。`);
    }

    return factorBase;
}

function trialDivision(value, factorBase) {
    let factorization = [];
    for (let prime of factorBase) {
        let bigPrime = BigInt(prime);
        let count = 0;
        while (value % bigPrime === 0n) {
            value /= bigPrime;
            count++;
        }
        if (count > 0) factorization.push({ prime, count });
    }
    return value === 1n ? factorization : null;
}

function findCongruentSquares(smoothNumbers, xValues, factorBase, n) {
    let matrix = createExponentMatrix(smoothNumbers, factorBase);
    let solution = gaussianElimination(matrix);

    if (!solution) {
        return { x: null, y: null };
    }

    let x = 1n, y = 1n;
    for (let i = 0; i < solution.length; i++) {
        if (solution[i]) {
            x *= xValues[i];
            y *= reconstructY(smoothNumbers[i], n);
        }
    }

    return { x: x % n, y: y % n };
}

function reconstructY(factorization, n) {
    let y = 1n;

    for (let { prime, count } of factorization) {
        let exp = BigInt(count) / 2n;
        y *= BigInt(prime) ** exp;
    }

    return y % n;
}

function createExponentMatrix(smoothNumbers, factorBase) {
    if (!smoothNumbers || !Array.isArray(smoothNumbers) || smoothNumbers.length === 0) {
        throw new Error("smoothNumbers が未定義または空です。指数行列を作成できません。");
    }
    if (!factorBase || !Array.isArray(factorBase) || factorBase.length === 0) {
        throw new Error("factorBase が未定義または空です。");
    }

    let matrix = [];

    for (let factorization of smoothNumbers) {
        let row = new Array(factorBase.length).fill(0);

        for (let { prime, count } of factorization) {
            let index = factorBase.indexOf(Number(prime));
            if (index !== -1) {
                row[index] = count % 2;
            }
        }
        matrix.push(row);
    }

    return matrix;
}

function gaussianElimination(matrix) {
    let rows = matrix.length, cols = matrix[0].length;
    let bitMatrix = new Array(rows).fill(0).map(() => new Uint8Array(Math.ceil(cols / 8)));

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (matrix[r][c]) {
                bitMatrix[r][c >> 3] |= (1 << (c & 7));
            }
        }
    }

    let solution = new Uint8Array(Math.ceil(cols / 8));
    for (let col = 0; col < cols; col++) {
        let pivotRow = -1;
        for (let row = col; row < rows; row++) {
            if (bitMatrix[row][col >> 3] & (1 << (col & 7))) {
                pivotRow = row;
                break;
            }
        }
        if (pivotRow === -1) continue;

        [bitMatrix[col], bitMatrix[pivotRow]] = [bitMatrix[pivotRow], bitMatrix[col]];

        for (let row = 0; row < rows; row++) {
            if (row !== col && (bitMatrix[row][col >> 3] & (1 << (col & 7)))) {
                bitMatrix[row].set(bitMatrix[col], 0);
            }
        }
    }

    for (let row = 0; row < rows; row++) {
        if (bitMatrix[row].every(v => v === 0)) continue;
        for (let col = 0; col < cols; col++) {
            if (bitMatrix[row][col >> 3] & (1 << (col & 7))) {
                solution[col >> 3] |= (1 << (col & 7));
                break;
            }
        }
    }

    return solution.some(v => v !== 0) ? solution : null;
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
