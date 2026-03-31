import { readFileSync, writeFileSync } from 'fs';

const version = JSON.parse(readFileSync('.claude-plugin/plugin.json', 'utf8')).version;

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
pkg.version = version;
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');

const marketplace = JSON.parse(readFileSync('.claude-plugin/marketplace.json', 'utf8'));
marketplace.metadata.version = version;
marketplace.plugins[0].version = version;
writeFileSync('.claude-plugin/marketplace.json', JSON.stringify(marketplace, null, 2) + '\n');

console.log(`version synced to ${version}`);
