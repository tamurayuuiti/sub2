importScripts("ecmUtils.js");

self.onmessage = async function(event) {
    const number = BigInt(event.data);
    self.postMessage({ type: "log", message: `🔄 Worker: ECM 実行開始 (${number})` });

    console.log(`[Worker] 🚀 ECM 実行開始 (${number})`);  // ✅ ここでログが出るか確認

    try {
        const factor = await ecm(number, msg => self.postMessage({ type: "log", message: msg }));

        console.log(`[Worker] ✅ ECM 完了: ${factor}`);  // ✅ ECM が完了したログ

        self.postMessage({ type: "log", message: `✅ Worker: ECM 終了 (${factor})` });
        self.postMessage({ type: "result", factor: factor ? factor.toString() : "null" });
    } catch (error) {
        console.error(`[Worker] ❌ ECM エラー: ${error.message}`);
        self.postMessage({ type: "log", message: `❌ Worker: エラー発生 - ${error.message}` });
        self.postMessage({ type: "result", factor: "null" });
    }
};
