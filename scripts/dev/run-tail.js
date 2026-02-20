
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

child.stdout.on('data', handleData);
child.stderr.on('data', handleData);

function handleData(data) {
  const lines = data.toString().split('\n');
  for (const line of lines) {
    buffer.push(line);
    if (buffer.length > MAX_LINES) {
      buffer.shift();
    }
  }
}

child.on('close', (code) => {
  if (buffer.length === MAX_LINES) {
    process.stdout.write('... (Earlier output truncated) ...\n');
  }
  process.stdout.write(buffer.join('\n'));
  process.exit(code || 0);
});
