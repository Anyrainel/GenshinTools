
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const commandType = args[0];
const MAX_LINES = Number(args[1]) || 20;

if (!commandType) {
  console.error("Usage: node run-tail.js <command> [lines]");
  process.exit(1);
}

// Map command types
const commands = {
  'type-check': ['tsc', ['-b', '--noEmit']],
  'lint': ['biome', ['check', '.']],
  'test': ['vitest', ['run']],
};

const cmdConfig = commands[commandType];
if (!cmdConfig) {
  console.error(`Unknown command: ${commandType}`);
  process.exit(1);
}

const [cmd, cmdArgs] = cmdConfig;
console.log(`> Running tail (${MAX_LINES} lines): ${cmd} ${cmdArgs.join(' ')}`);

const child = spawn(cmd, cmdArgs, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
const buffer = [];
let remainder = '';

child.stdout.on('data', handleData);
child.stderr.on('data', handleData);

const stripAnsi = (str) => str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');

function handleData(data) {
  remainder += data.toString();
  const lines = remainder.split('\n');
  remainder = lines.pop() || '';
  
  for (const line of lines) {
    if (stripAnsi(line).trim().length > 0) {
      buffer.push(line);
      if (buffer.length > MAX_LINES) {
        buffer.shift();
      }
    }
  }
}

child.on('close', (code) => {
  if (stripAnsi(remainder).trim().length > 0) {
    buffer.push(remainder);
    if (buffer.length > MAX_LINES) {
      buffer.shift();
    }
  }
  
  if (buffer.length === MAX_LINES) {
    process.stdout.write('... (Earlier output truncated) ...\n');
  }
  if (buffer.length > 0) {
    process.stdout.write(buffer.join('\n') + '\n');
  }
  process.exit(code || 0);
});
