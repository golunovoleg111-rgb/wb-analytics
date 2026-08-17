const fs = require('fs');
const path = require('path');
const files = ['main.js','preload.js','lanServer.js','lanProtocol.js','lanClient.js','syncEngine.js','syncStorage.js','syncProtocol.js'];
for (const file of files) {
  const p = path.join(__dirname,file);
  if (!fs.existsSync(p)) throw new Error(`Missing desktop module: ${file}`);
  if (path.extname(file)==='.js') require(p);
}
console.log(`B-JOB desktop smoke test: ${files.length} modules loaded`);
