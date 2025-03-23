import ("millerRabin.js", "ecmUtils.js"); // ECM に必要な関数を読み込む

self.onmessage = async function(event) {
    const number = BigInt(event.data);  // ✅ 文字列 → BigInt 変換
    console.log(`🔄 Worker: ECM 実行中 (${number})`);

    const factor = await ecm(number);  // ECM 実行

    self.postMessage(factor.toString());  // ✅ 結果を文字列にして送信
};
