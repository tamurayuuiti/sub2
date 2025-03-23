export async function ecm(n) {
    let attempt = 0;
    while (true) {
        let { a, B1, maxAttempts } = getECMParams(n, attempt);
        let x = getRandomX(n);
        let y = ((x * x * x + a * x + getRandomX(n)) * getRandomX(n)) % n;
        let P = { x, y };

        console.log(`🟢 試行 ${attempt + 1}: a = ${a}, P = (${x}, ${y}), B1 = ${B1}`);

        let factor = await ECM_step(n, P, a, B1);

        if (factor > 1n && factor !== n) {
            console.log(`✅ 試行 ${attempt + 1} で因数発見: ${factor}`);
            return factor;
        }

        attempt++;
        if (attempt >= maxAttempts) {
            console.log(`❌ 最大試行回数 ${maxAttempts} に達したため終了`);
            return null;
        }
    }
}

export function getECMParams(n, attempt = 0) {
    let logN = BigInt(n.toString().length);  
    let baseB1 = 10n ** (logN / 3n);
    let adaptiveB1 = baseB1 * (BigInt(attempt) + 1n);
    let maxB1 = 10n ** 7n;
    let minB1 = 10n ** 5n;
    let B1 = adaptiveB1 > maxB1 ? maxB1 : (adaptiveB1 < minB1 ? minB1 : adaptiveB1);
    let a = (getRandomX(n) * getRandomX(n) + getRandomX(n) + 1n) % n;
    let maxAttempts = 500;

    return { a, B1, maxAttempts };
}

export async function ECM_step(n, P, a, B1) {
    let x = P.x;
    let y = P.y;
    let gcdValue = 1n;

    for (let k = 2n; k <= B1; k++) {
        let newX = (x * x - a) % n;
        let newY = (y * y - 1n) % n;
        P.x = newX;
        P.y = newY;

        let z = abs(P.x);
        gcdValue = gcd(z, n);

        if (gcdValue > 1n && gcdValue !== n) {
            return gcdValue;
        }

        if (k % 1000n === 0n) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }
    return 1n;
}

export function getRandomX(n) {
    let randArray = new Uint32Array(2);
    crypto.getRandomValues(randArray);
    let randNum = (BigInt(randArray[0]) << 32n) | BigInt(randArray[1]);
    return (randNum % (n - 2n)) + 1n;
}

export function gcd(a, b) {
    while (b !== 0n) {
        [a, b] = [b, a % b];
    }
    return a;
}

export function abs(n) {
    return n < 0n ? -n : n;
}
