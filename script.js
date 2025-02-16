let currentInput = null;
let startTime = null;
let isCalculating = false;
let progressInterval = null;

document.getElementById("numberInput").addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        startFactorization();
    }
});

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

    await factorize(num);
    isCalculating = false;
    clearInterval(progressInterval);
}

async function factorize(number) {
    let factors = [];
    let divisor = 2n;
    while (number % divisor === 0n) {
        factors.push(divisor);
        number /= divisor;
    }
    divisor = 3n;
    while (divisor * divisor <= number) {
        while (number % divisor === 0n) {
            factors.push(divisor);
            number /= divisor;
        }
        divisor += 2n;
        await new Promise(resolve => setTimeout(resolve, 0));
    }
    if (number > 1n) factors.push(number);
    document.getElementById("spinner").style.display = "none";
    document.getElementById("loading").style.display = "none";
    document.getElementById("progress").style.display = "none";
    let elapsedTime = ((performance.now() - startTime) / 1000).toFixed(3);
    document.getElementById("result").textContent = `素因数:\n${factors.join(" × ")}`;
    document.getElementById("time").textContent = `計算時間: ${elapsedTime} 秒`;
}
