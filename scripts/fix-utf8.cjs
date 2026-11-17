const fs = require('fs')
const file = process.argv[2]
if (!file) {
  console.error('Usage: node scripts/fix-utf8.cjs <file>')
  process.exit(1)
}
const buf = fs.readFileSync(file)
const text = new TextDecoder('utf-8', { fatal: false })
  .decode(buf)
  .replace(/\uFFFD+/g, '-')
  .replace(/\r\n/g, '\n')
fs.writeFileSync(file, text, 'utf8')
new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(file))
console.log('fixed', file)
