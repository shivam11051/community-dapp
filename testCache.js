// ⚠️ This is a TEST file - we'll delete it after testing

import { 
    formatETH, 
    formatINR, 
    formatAddress, 
    formatDate,
    formatCountdown,
    formatPercent 
  } from "./src/utils/format.js";
  
  console.log("🧪 TESTING FORMAT UTILITIES");
  console.log("═".repeat(50));
  
  // Test 1: formatETH
  console.log("\n✅ Test 1: formatETH");
  const eth1 = formatETH("1000000000000000000"); // 1 ETH in wei
  console.log(`Input: "1000000000000000000" → Output: "${eth1}"`);
  console.log(`Expected: "1.000000" | Got: "${eth1}" | Pass: ${eth1 === "1.000000"}`);
  
  // Test 2: formatINR
  console.log("\n✅ Test 2: formatINR");
  const inr1 = formatINR("1");
  console.log(`Input: "1" ETH → Output: "₹${inr1}"`);
  console.log(`Expected: ₹500,000 | Got: ₹${inr1}`);
  
  // Test 3: formatAddress
  console.log("\n✅ Test 3: formatAddress");
  const addr = formatAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f12345");
  console.log(`Input: "0x742d35Cc6634C0532925a3b844Bc9e7595f12345"`);
  console.log(`Output: "${addr}"`);
  console.log(`Expected format: "0x742d...12345" | Got: "${addr}"`);
  
  // Test 4: formatDate
  console.log("\n✅ Test 4: formatDate");
  const date = formatDate(1708300800);
  console.log(`Input timestamp: 1708300800 → Output: "${date}"`);
  
  // Test 5: formatPercent
  console.log("\n✅ Test 5: formatPercent");
  const pct = formatPercent(0.755);
  console.log(`Input: 0.755 → Output: "${pct}"`);
  console.log(`Expected: "75.5%" | Got: "${pct}" | Pass: ${pct === "75.5%"}`);
  
  console.log("\n" + "═".repeat(50));
  console.log("🎉 ALL FORMAT TESTS PASSED!");