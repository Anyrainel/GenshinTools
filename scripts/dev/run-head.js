
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const commandType = args[0];
const MAX_LINES = Number(args[1]) || 20;

if (!commandType) {
  console.error("Usage: node run-head.js <command> [lines]");
  process.exit(1);
}

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
console.log(`> Running head (${MAX_LINES} lines): ${cmd} ${cmdArgs.join(' ')}`);

const child = spawn(cmd, cmdArgs, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });

let lineCount = 0;

child.stdout.on('data', handleData);
child.stderr.on('data', handleData);

function handleData(data) {
  const lines = data.toString().split('\n');
  for (const line of lines) {
    if (lineCount < MAX_LINES) {
      process.stdout.write(line + '\n');
      lineCount++;
    } else {
      process.stdout.write('... (Output truncated) ...\n');
      child.kill(); // Stop the process once limit reached
      process.exit(0);
    }
  }
}

child.on('close', (code) => {
  if (lineCount < MAX_LINES) {
    process.exit(code || 0);
  }
});
