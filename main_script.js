import { trialDivision } from './Scripts/trialDivision.js';
import { pollardsRhoFactorization } from './Scripts/pollardsRho.js';

let primes = [];

async function loadPrimes() {
    const response = await fetch("https://tamurayuuiti.github.io/sub2/data/primes.txt");
    const text = await response.text();
    primes = text.split(/\s+/).filter(n => n).map(n => BigInt(n));
    if (primes.length === 0) throw new Error("素数リストが空");
}

function generateRandomBigInt(minDigits, maxDigits) {
    const digits = Math.floor(Math.random() * (maxDigits - minDigits + 1)) + minDigits;
    let n = '';
    for (let i = 0; i < digits; i++) {
        n += (i === 0) ? (Math.floor(Math.random() * 9) + 1) : Math.floor(Math.random() * 10);
    }
    return BigInt(n);
}

function appendResultRow(index, n, factors, status, time) {
    const table = document.getElementById('resultTable');
    const row = table.insertRow();
    row.insertCell().textContent = index;
    row.insertCell().textContent = n;
    row.insertCell().textContent = factors.length > 0 ? factors.join(' × ') : '-';
    row.insertCell().textContent = status;
    row.insertCell().textContent = time;
}

function showSummary(results, totalElapsed) {
    const times = results.map(r => parseFloat(r.elapsedTime));
    const avg = (times.reduce((a, b) => a + b, 0) / times.length).toFixed(3);
    const maxTime = Math.max(...times);
    const maxRecord = results[times.indexOf(maxTime)];

    const summary = `
        平均タイム: ${avg} 秒<br>
        最大タイム: ${maxTime} 秒<br>
        最大タイムの試行:<br>
        n = ${maxRecord.n}<br>
        因数 = ${maxRecord.factors.join(' × ')}<br>
        状態 = ${maxRecord.status}<br><br>
        総計算時間: ${totalElapsed} 秒
    `;
    document.getElementById('summary').innerHTML = summary;
}

async function startTest(trialCount, minDigits, maxDigits) {
    if (minDigits > maxDigits || minDigits < 1 || maxDigits > 30) {
        alert("最小桁数・最大桁数の指定が不正です");
        return;
    }

    document.getElementById('resultTable').innerHTML = `
        <tr><th>#</th><th>n</th><th>因数</th><th>状態</th><th>計算時間(s)</th></tr>
    `;
    document.getElementById('summary').innerHTML = "";
    console.clear();

    const results = [];
    await loadPrimes();
    const totalStart = performance.now(); // --- 総計測開始

    for (let i = 0; i < trialCount; i++) {
        if (i % 5 === 0) {
            console.clear();
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        const n = generateRandomBigInt(minDigits, maxDigits);
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

    const totalElapsed = ((performance.now() - totalStart) / 1000).toFixed(3); // --- 総計算時間
    window.testResults = results;
    showSummary(results, totalElapsed); // --- 渡す
}

document.getElementById('startButton').addEventListener('click', () => {
    const count = parseInt(document.getElementById('trialCount').value);
    const minDigits = parseInt(document.getElementById('minDigits').value);
    const maxDigits = parseInt(document.getElementById('maxDigits').value);
    if (count > 0) startTest(count, minDigits, maxDigits);
});

document.getElementById('saveButton').addEventListener('click', () => {
    if (!window.testResults || window.testResults.length === 0) {
        alert("結果がありません");
        return;
    }
    const blob = new Blob([JSON.stringify(window.testResults, null, 2)], { type: "application/json" });
    saveAs(blob, "factorization_results.json");
});
