// testProgram.js
import { trialDivision } from './Scripts/trialDivision.js';
import { pollardsRhoFactorization } from './Scripts/pollardsRho.js';

let primes = [];

// --- 設定 ---
const MAX_DIGITS = 30;

// --- 素数リスト読み込み ---
async function loadPrimes() {
    const response = await fetch("https://tamurayuuiti.github.io/sub2/data/primes.txt");
    const text = await response.text();
    primes = text.split(/\s+/).filter(n => n).map(n => BigInt(n));
    if (primes.length === 0) throw new Error("素数リストが空");
}

// --- ランダムn生成 ---
function generateRandomBigInt() {
    const digits = Math.floor(Math.random() * MAX_DIGITS) + 1;
    let n = '';
    for (let i = 0; i < digits; i++) {
        n += (i === 0) ? (Math.floor(Math.random() * 9) + 1) : Math.floor(Math.random() * 10);
    }
    return BigInt(n);
}

// --- テーブル出力 ---
function appendResultRow(index, n, factors, status, time) {
    const table = document.getElementById('resultTable');
    const row = table.insertRow();
    row.insertCell().textContent = index;
    row.insertCell().textContent = n;
    row.insertCell().textContent = factors.length > 0 ? factors.join(' × ') : '-';
    row.insertCell().textContent = status;
    row.insertCell().textContent = time;
}

// --- メイン処理 ---
async function startTest(trialCount) {
    document.getElementById('resultTable').innerHTML = `
        <tr><th>#</th><th>n</th><th>因数</th><th>状態</th><th>計算時間(s)</th></tr>
    `;

    const results = [];
    await loadPrimes();

    for (let i = 0; i < trialCount; i++) {
        const n = generateRandomBigInt();
        const start = performance.now();
        let factors = [];
        let status = "SUCCESS";

        try {
            let { factors: trialFactors, remainder } = await trialDivision(n, primes, () => {});
            factors = trialFactors;

            if (remainder > 1n) {
                const extraFactors = await pollardsRhoFactorization(remainder);
                if (extraFactors.includes("FAIL")) {
                    status = "FAIL";
                } else {
                    factors = factors.concat(extraFactors);
                }
            }
        } catch {
            status = "ERROR";
        }

        const elapsed = ((performance.now() - start) / 1000).toFixed(3);
        results.push({ n: n.toString(), factors: factors.map(f => f.toString()), status, elapsedTime: elapsed });

        appendResultRow(i + 1, n, factors.map(f => f.toString()), status, elapsed);
        console.log(`[${i + 1}/${trialCount}] n=${n} status=${status} time=${elapsed}s`);
    }

    window.testResults = results; // 保存用
}

// --- ボタンイベント ---
document.getElementById('startButton').addEventListener('click', () => {
    const count = parseInt(document.getElementById('trialCount').value);
    if (count > 0) startTest(count);
});

document.getElementById('saveButton').addEventListener('click', () => {
    if (!window.testResults || window.testResults.length === 0) {
        alert("結果がありません");
        return;
    }
    const blob = new Blob([JSON.stringify(window.testResults, null, 2)], { type: "application/json" });
    saveAs(blob, "factorization_results.json");
});
