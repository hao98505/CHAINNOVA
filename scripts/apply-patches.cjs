'use strict';
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'patches', 'bigint-buffer', 'dist', 'node.js');
const dest = path.join(__dirname, '..', 'node_modules', 'bigint-buffer', 'dist', 'node.js');

if (fs.existsSync(dest)) {
    fs.copyFileSync(src, dest);
    console.log('[patches] bigint-buffer: replaced native addon with pure JS (CVE GHSA-3gc7-fjrx-p6mg)');
} else {
    console.warn('[patches] bigint-buffer not found in node_modules, skipping');
}
