
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const commandType = args[0];
const filter = args[1];

if (!commandType) {
  console.error("Usage: node run-filter.js <command> <filter>");
  process.exit(1);
}

// Map command types to actual commands
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
console.log(`> Running filtered: ${cmd} ${cmdArgs.join(' ')} | grep "${filter || ''}"`);

const child = spawn(cmd, cmdArgs, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });

let output = '';

child.stdout.on('data', (data) => handleData(data));
child.stderr.on('data', (data) => handleData(data));

function handleData(data) {
  const str = data.toString();
  if (!filter) {
    process.stdout.write(str);
    return;
  }
  
  const lines = str.split('\n');
  for (const line of lines) {
    if (line.includes(filter)) {
      process.stdout.write(line + '\n');
    }
  }
}

child.on('close', (code) => {
  process.exit(code || 0);
});
