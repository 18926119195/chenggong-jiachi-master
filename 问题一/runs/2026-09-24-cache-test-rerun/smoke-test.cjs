// smoke-test.cjs - smoke test for one question to verify setup
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = String.raw`C:\Users\Administrator\Desktop\chenggong-jiachi-master`;
const SRC_DIR = path.join(ROOT, '完整的运作');
const RUN_DIR = path.join(ROOT, '问题一', 'runs', '2026-09-24-cache-test-rerun');
const NODE_EXE = String.raw`C:\Program Files\nodejs\node.exe`;

function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !m[1].startsWith('#')) {
      const [, name, value] = m;
      process.env[name] = value;
    }
  }
}

function runNode(script, args, logFile, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(NODE_EXE, [script, ...args], {
      cwd: SRC_DIR,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const out = fs.openSync(logFile, 'a');
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString('utf-8');
      process.stdout.write(text);
      fs.writeSync(out, text);
    });
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString('utf-8');
      process.stderr.write(text);
      fs.writeSync(out, text);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      fs.closeSync(out);
      resolve(code);
    });
  });
}

async function main() {
  loadEnv();
  if (!process.env.LLM_API_KEY && !process.env.DEEPSEEK_API_KEY) {
    console.error('[fatal] no API key in .env');
    process.exit(1);
  }

  const env = {
    OUTPUT_PATH: path.join(RUN_DIR, 'noun-recall-results.json'),
    RECALL_RESULTS_PATH: path.join(RUN_DIR, 'noun-recall-results.json'),
    CANDIDATE_TEXTS_PATH: path.join(RUN_DIR, 'candidate-texts-for-llm.json'),
    TRACEBACK_MAP_PATH: path.join(RUN_DIR, 'material-traceback-map.json'),
    LLM_SNAPSHOT_DIR: path.join(RUN_DIR, 'smoke-snapshots'),
    LLM_CONCURRENCY: '8',
    DOCUVERSE_PATH: path.join(ROOT, 'docuverse_cartographies_squizoanalythiques_Fe_lix_Guattari_1789114122714.docuverse.json'),
    NOUN_INDEX_PATH: path.join(SRC_DIR, 'final-noun-index.json'),
    QUESTIONS_PATH: path.join(SRC_DIR, 'test-questions.json'),
  };

  if (!fs.existsSync(path.join(RUN_DIR, 'smoke-snapshots'))) {
    fs.mkdirSync(path.join(RUN_DIR, 'smoke-snapshots'), { recursive: true });
  }

  const qid = process.argv[2] || 'Z1-Q1';
  const logFile = path.join(RUN_DIR, 'logs', `smoke-${qid}.log`);
  if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

  console.log(`[smoke] testing recall for ${qid}`);
  const t0 = Date.now();
  const code = await runNode(path.join(SRC_DIR, 'recall-nouns-llm.js'), [qid], logFile, env);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[smoke] exit=${code} elapsed=${elapsed}s`);
  if (code === 0) {
    const outFile = path.join(RUN_DIR, 'noun-recall-results.json');
    if (fs.existsSync(outFile)) {
      const data = JSON.parse(fs.readFileSync(outFile, 'utf-8'));
      const found = data.find(d => d.questionId === qid);
      if (found) {
        console.log(`[smoke] ${qid} coarseYesCount=${found.coarseYesCount} recalled=${found.recalledTexts ? found.recalledTexts.length : 0}`);
      }
    }
  }
  process.exit(code);
}

main().catch(err => {
  console.error('[fatal]', err);
  process.exit(1);
});
