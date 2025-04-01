import { trialDivision, loadPrimes } from './Scripts/trialDivision.js';
        import { pollardsRhoFactorization } from './Scripts/pollardsRhoFactorization.js';
        
        document.getElementById("startTest").addEventListener("click", startTest);
        document.getElementById("numberInput").addEventListener("input", function() {
            this.value = this.value.slice(0, 30);
            document.getElementById("charCounter").textContent = `現在の桁数: ${this.value.length} (最大30桁)`;
        });
        
        async function startTest() {
            let numStr = document.getElementById("numberInput").value.trim();
            let trialCount = parseInt(document.getElementById("trialCount").value, 10);
            if (!numStr || isNaN(trialCount) || trialCount < 1) return;
            
            let num = BigInt(numStr);
            let primes = await loadPrimes();
            let times = [];
            let resultsTable = document.getElementById("resultsTable");
            resultsTable.innerHTML = "";
            
            for (let i = 0; i < trialCount; i++) {
                if (i % 10 === 0 && i !== 0) {
                    console.clear();
                }


                    
                let start = performance.now();
                let { factors, remainder } = await trialDivision(num, primes);
                
                if (remainder > 1n) {
                    factors = factors.concat(await pollardsRhoFactorization(remainder));
                }
                
                let end = performance.now();
                let elapsed = ((end - start) / 1000).toFixed(3);
                times.push(parseFloat(elapsed));
                
                let row = resultsTable.insertRow();
                row.insertCell(0).textContent = i + 1;
                row.insertCell(1).textContent = elapsed;
            }
            
            let total = times.reduce((a, b) => a + b, 0).toFixed(3);
            let avg = (total / times.length).toFixed(3);
            let max = Math.max(...times).toFixed(3);
            let min = Math.min(...times).toFixed(3);
            
            document.getElementById("summary").textContent = `総時間: ${total}秒, 平均: ${avg}秒, 最大: ${max}秒, 最小: ${min}秒`;
        }
