// ecmWorker.js
import { ecm } from "./Scripts/ecmUtils.js"; // `importScripts` の代わりに `import` を使用

self.onmessage = async function(event) {
    console.log("📩 Worker がメッセージを受信しました！");

    try {
        const number = BigInt(event.data);
        console.log(`🚀 Worker: ECM を実行 (${number})`);
        self.postMessage({ type: "log", message: `🔄 Worker: ECM 実行開始 (${number})` });

        const keepAlive = setInterval(() => console.log("⏳ Worker はまだ動作中..."), 1000);

        // ECM 実行
        const factor = await ecm(number, msg => self.postMessage({ type: "log", message: msg }));

        clearInterval(keepAlive);

        if (!factor) {
            self.postMessage({ type: "log", message: "⚠️ 因数が見つからなかったため null を送信" });
        }

        self.postMessage({ type: "result", factor: factor ? factor.toString() : "null" });

    } catch (error) {
        console.error(`❌ Worker: エラー発生 - ${error.message}`);
        self.postMessage({ type: "log", message: `❌ Worker: エラー発生 - ${error.message}` });
        self.postMessage({ type: "result", factor: "null" });

        // Worker を強制終了
        self.close();
    }
};
