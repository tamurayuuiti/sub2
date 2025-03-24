try {
    console.log("🔄 ecmUtils.js のインポート開始...");
    importScripts("ecmUtils.js");
    console.log("✅ ecmUtils.js のインポート成功！");
} catch (error) {
    console.error(`❌ importScripts エラー: ${error.message}`);
    self.postMessage({ type: "log", message: `❌ ecmUtils.js のロード失敗: ${error.message}` });
}

console.log("🚀 Web Worker ecmWorker.js が開始されました！");

self.onmessage = async function(event) {
    console.log("📩 Worker がメッセージを受信しました！");

    try {
        const number = BigInt(event.data);
        console.log(`🚀 Worker: ECM を実行 (${number})`);
        self.postMessage({ type: "log", message: `🔄 Worker: ECM 実行開始 (${number})` });

        // Worker フリーズを防ぐために 1 秒ごとにログを出力
        const keepAlive = setInterval(() => console.log("⏳ Worker はまだ動作中..."), 1000);

        // ECM 実行
        const factor = await ecm(number, msg => self.postMessage({ type: "log", message: msg }));

        clearInterval(keepAlive); // 処理終了後にログ出力を停止

        if (!factor) {
            self.postMessage({ type: "log", message: "⚠️ 因数が見つからなかったため null を送信" });
        }

        self.postMessage({ type: "result", factor: factor ? factor.toString() : "null" });

    } catch (error) {
        console.error(`❌ Worker: エラー発生 - ${error.message}`);
        self.postMessage({ type: "log", message: `❌ Worker: エラー発生 - ${error.message}` });
        self.postMessage({ type: "result", factor: "null" });
    }
};
