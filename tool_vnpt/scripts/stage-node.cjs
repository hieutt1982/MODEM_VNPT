
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const target = path.join(root, 'www', 'nodejs');

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });

// Sao chép modem.js
fs.copyFileSync(
  path.join(root, 'modem.js'),
  path.join(target, 'modem.js')
);

// Tạo package.json cho Node.js
fs.writeFileSync(
  path.join(target, 'package.json'),
  JSON.stringify({
    name: 'vnpt-modem-node',
    version: '1.0.0',
    private: true,
    main: 'modem.js'
  }, null, 2) + '\n'
);

// Sao chép các module
for (const dir of ['g040h', 'ns_v1', 'ns_v2']) {
  const source = path.join(root, dir);
  const destination = path.join(target, dir);

  fs.mkdirSync(destination, { recursive: true });

  fs.copyFileSync(
    path.join(source, 'main.js'),
    path.join(destination, 'main.js')
  );
}

// Sao chép OneLink: chỉ sử dụng main.js
const oneLinkSource = path.join(root, 'onelink');
const oneLinkTarget = path.join(target, 'onelink');

fs.mkdirSync(oneLinkTarget, { recursive: true });

fs.copyFileSync(
  path.join(oneLinkSource, 'main.js'),
  path.join(oneLinkTarget, 'main.js')
);

console.log('Staged modem.js, modules, and OneLink main.js successfully.');
