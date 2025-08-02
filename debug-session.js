// Debug script to test session state
const {
  getSessionState,
  resetSessionState,
} = require("./build/server/socketHandler");

console.log("Current session state:");
console.log(getSessionState());

console.log("\nResetting session state...");
resetSessionState();

console.log("\nSession state after reset:");
console.log(getSessionState());
