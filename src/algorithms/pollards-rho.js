// pollards-rho.js - Pollard's Rho 法による因数分解アルゴリズム

import { isPrimeMillerRabin } from "./miller-rabin.js";

// ユークリッドの互除法
function gcd(a, b) {
    a = a < 0n ? -a : a;
    b = b < 0n ? -b : b;
    while (b !== 0n) {
        const t = a % b;
        a = b;
        b = t;
    }
    return a;
}

// 簡易乱数生成
function randomBigIntBelow(rangeBigInt) {
    if (rangeBigInt <= 0n) return 0n;
    const bits = rangeBigInt.toString(2).length;
    const chunks = Math.ceil(bits / 30);
    let r = 0n;
    for (let i = 0; i < chunks; i++) {
        const part = BigInt(Math.floor(Math.random() * (1 << 30)));
        r = (r << 30n) | part;
    }
    if (r >= rangeBigInt) r = r % rangeBigInt;
    return r;
}

// ランダムな x を生成
function getRandomX(n) {
    if (n <= 3n) return 2n;
    return randomBigIntBelow(n - 2n) + 2n;
}

// ランダムな c を生成
function randomC(range = 1000) {
    let c = BigInt(Math.floor(Math.random() * range));
    return c === 0n ? 1n : c;
}

// チャンク処理
function processChunk(x, stepLimit, state, PART_BLOCK, MAX_TRIALS) {
    let part = 1n;
    let inPart = 0;

    const n = state.n;
    const c = state.c;
    let y = state.y;
    let trial = state.trialCount;

    for (let i = 0; i < stepLimit && trial < MAX_TRIALS; i++) {
        y = (y * y + c) % n;
        trial++;

        const diff = x > y ? x - y : y - x;
        
        if (diff === 0n) {
            state.y = y;
            state.trialCount = trial;
            return { dFound: n, badCollision: true };
        }

        part = (part * diff) % n;
        inPart++;

        if (inPart >= PART_BLOCK) {
            const g = gcd(part, n);
            if (g > 1n && g < n) {
                state.y = y;
                state.trialCount = trial;
                return { dFound: g, badCollision: false };
            }
            if (g === n) {
                state.y = y;
                state.trialCount = trial;
                return { dFound: n, badCollision: true };
            }
            part = 1n;
            inPart = 0;
        }
    }

    if (inPart > 0) {
        const g = gcd(part, n);
        if (g > 1n && g < n) {
            state.y = y;
            state.trialCount = trial;
            return { dFound: g, badCollision: false };
        }
        if (g === n) {
            state.y = y;
            state.trialCount = trial;
            return { dFound: n, badCollision: true };
        }
    }

    state.y = y;
    state.trialCount = trial;
    return { dFound: 1n, badCollision: false };
}

// フォールバック処理
function doFallback(x_prev, state) {
    let ys = x_prev;
    const c = state.c;
    const n = state.n;
    
    let g = 1n;
    while (g === 1n) {
        ys = (ys * ys + c) % n;
        
        g = gcd(x_prev > ys ? x_prev - ys : ys - x_prev, n);
    }
    return g;
}

// Pollard's Rho アルゴリズム本体
function pollardsRho(n, initialX, c) {
    // パラメータ設定
    const PART_BLOCK = 32;
    const m = 32n;
    const MAX_TRIALS = 100_000; // 最大試行回数

    const state = {
        y: initialX,
        c: c,
        n: n,
        trialCount: 0
    };

    state.y = (state.y * state.y + c) % n;
    state.trialCount++;

    let x = state.y;
    let d = 1n;
    let r = 1n;

    while (d === 1n && state.trialCount < MAX_TRIALS) {
        const x_prev = x;
        x = state.y;

        let j = 0n;
        while (j < r && d === 1n && state.trialCount < MAX_TRIALS) {
            const stepLimitBI = (r - j) < m ? (r - j) : m;
            const stepLimit = Number(stepLimitBI);
            const res = processChunk(x, stepLimit, state, PART_BLOCK, MAX_TRIALS);
            
            if (res.dFound !== 1n) {
                if (res.badCollision) {
                    d = state.n;
                } else {
                    d = res.dFound;
                }
                break;
            }
            j += BigInt(stepLimit);
        }

        if (d === n) {
            const g = doFallback(x_prev, state);
            d = g;
            if (d === n) {
                return null;
            }
        }

        if (d === 1n) r *= 2n;
    }

    if (d > 1n && d < n) {
        return d;
    }
    return null;
}

// 再帰的に Pollard's Rho を回して素因数を求める
export async function pollardsRhoFactorization(number) {
    if (typeof number !== "bigint") {
        throw new TypeError(`Number must be BigInt.`);
    }

    if (number <= 1n) return [number];

    let factors = [];
    
    while (number > 1n) {
        if (isPrimeMillerRabin(number)) {
            console.log(`素因数を発見: ${number}`);
            factors.push(number);
            break;
        }

        let factor = null;
        
        // 再試行回数設定
        const MAX_RETRIES = 5; 
        
        for (let i = 0; i < MAX_RETRIES; i++) {
            const initialX = (i === 0) ? 2n : getRandomX(number);
            const c = randomC();

            console.log(`Pollard's rho 試行 ${i + 1}/${MAX_RETRIES} (c=${c})...`);

            factor = pollardsRho(number, initialX, c);
            
            if (factor) {
                console.log(`Pollard's rho 成功 (${i+1}回目): ${factor}`);
                break; 
            } else {
                if (i < MAX_RETRIES - 1) {
                    console.warn(`Pollard's rho 失敗 (${i+1}回目)。パラメータを変更して再試行します...`);
                }
            }
        }

        if (!factor) {
            console.error(`Pollard's Rho 失敗 (20桁以下)。ECMへ移行します。`);
            return ["FAIL"];
        }

        console.log(`因数を発見: ${factor}`);

        if (isPrimeMillerRabin(factor)) {
            factors.push(factor);
        } else {
            let subFactors = await pollardsRhoFactorization(factor);
            if (subFactors.includes("FAIL")) return ["FAIL"];
            factors = factors.concat(subFactors);
        }

        number /= factor;
    }

    return factors.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
