const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const target = path.join(root, 'www', 'nodejs');
fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });
fs.copyFileSync(path.join(root, 'modem.js'), path.join(target, 'modem.js'));
fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify({name:'vnpt-modem-node',version:'1.0.0',private:true,main:'modem.js'},null,2)+'\n');
for (const dir of ['g040h','ns_v1','ns_v2']) {
  fs.mkdirSync(path.join(target,dir),{recursive:true});
  fs.copyFileSync(path.join(root,dir,'main.js'),path.join(target,dir,'main.js'));
}
const oneLinkTarget = path.join(target, 'onelink');
fs.mkdirSync(oneLinkTarget, { recursive: true });
for (const file of ['main.js', 'index.html']) {
  fs.copyFileSync(path.join(root, 'onelink', file), path.join(oneLinkTarget, file));
}
console.log('Staged modem.js, modem modules, and OneLink.');
