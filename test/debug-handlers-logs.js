const fs = require('fs');
const path = require('path');
const logs = fs.readFileSync(path.join(__dirname,'..','reports','logs','handlers.log'),'utf8');
console.log(logs);
