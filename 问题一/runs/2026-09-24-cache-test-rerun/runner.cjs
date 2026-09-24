// runner.cjs - main entry point that handles Chinese path encoding correctly
// This script reads its config and invokes the actual scripts via spawn

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Use Buffer to ensure correct UTF-8 byte sequences for Chinese characters
function toPath(parts) {
  return parts.map(p => Buffer.from(p, 'utf-8').toString('utf-8')).join(path.sep);
}

const ROOT_RAW = 'C:\\Users\\Administrator\\Desktop\\chenggong-jiachi-master';
const SRC_DIR_RAW = ROOT_RAW + '\\完整的运作';
const RUN_DIR_RAW = ROOT_RAW + '\\问题一\\runs\\2026-09-24-cache-test-rerun';
const NODE_EXE = 'C:\\PROGRA~1\\nodejs\\node.exe';

const SRC_DIR = toPath([SRC_DIR_RAW]);
const RUN_DIR = toPath([RUN_DIR_RAW]);
const LOG_DIR = path.join(RUN_DIR, 'logs');
const SNAPSHOT_DIR = path.join(RUN_DIR, 'snapshots');
const FINAL_DIR = path.join(RUN_DIR, 'final');

function loadEnv() {
  const envPath = Buffer.from(ROOT_RAW + '\\.env', 'utf-8').toString('utf-8');
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !m[1].startsWith('#')) {
      const [, name, value] = m;
      process.env[name] = value;
    }
  }
}

function appendLog(file, text) {
  fs.appendFileSync(file, text + '\n', 'utf-8');
}

function nowStr() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
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

async function runOne(qid, env, logBase) {
  const t0 = Date.now();
  const logFile = path.join(LOG_DIR, `${logBase}-${qid}.log`);
  appendLog(path.join(LOG_DIR, 'pipeline.log'), `[${nowStr()}] start ${qid}`);

  // Step 1: noun recall
  appendLog(logFile, `\n[${nowStr()}] === recall-nouns-llm.js ${qid} ===`);
  let code = await runNode(path.join(SRC_DIR, 'recall-nouns-llm.js'), [qid], logFile, env);
  if (code !== 0) return { qid, ok: false, step: 'recall', elapsed: ((Date.now() - t0) / 1000).toFixed(1), code };

  // Step 2: build-prompt-with-traceback
  appendLog(logFile, `\n[${nowStr()}] === build-prompt-with-traceback.js ${qid} ===`);
  code = await runNode(path.join(SRC_DIR, 'build-prompt-with-traceback.js'), [qid], logFile, env);
  if (code !== 0) return { qid, ok: false, step: 'build-prompt', elapsed: ((Date.now() - t0) / 1000).toFixed(1), code };

  // Step 3: generate-multipath-prompt
  appendLog(logFile, `\n[${nowStr()}] === generate-multipath-prompt.js ${qid} ===`);
  code = await runNode(path.join(SRC_DIR, 'generate-multipath-prompt.js'), [qid], logFile, env);
  if (code !== 0) return { qid, ok: false, step: 'generate-prompt', elapsed: ((Date.now() - t0) / 1000).toFixed(1), code };

  // Step 4: run-reasoning
  appendLog(logFile, `\n[${nowStr()}] === run-reasoning.js ${qid} ===`);
  code = await runNode(path.join(SRC_DIR, 'run-reasoning.js'), [qid], logFile, env);
  if (code !== 0) return { qid, ok: false, step: 'reasoning', elapsed: ((Date.now() - t0) / 1000).toFixed(1), code };

  // Copy outputs from SRC_DIR to RUN_DIR (these scripts ignore env vars)
  const promptSrc = path.join(SRC_DIR, `multipath-prompt-${qid}.txt`);
  const promptDst = path.join(RUN_DIR, `multipath-prompt-${qid}.txt`);
  if (fs.existsSync(promptSrc)) fs.copyFileSync(promptSrc, promptDst);
  const reasonSrc = path.join(SRC_DIR, `reasoning-output-${qid}.json`);
  const reasonDst = path.join(RUN_DIR, `reasoning-output-${qid}.json`);
  if (fs.existsSync(reasonSrc)) fs.copyFileSync(reasonSrc, reasonDst);

  return { qid, ok: true, elapsed: ((Date.now() - t0) / 1000).toFixed(1), code: 0 };
}

async function main() {
  loadEnv();
  if (!process.env.LLM_API_KEY && !process.env.DEEPSEEK_API_KEY) {
    console.error('[fatal] no API key in .env');
    process.exit(1);
  }

  // Verify required dirs exist
  for (const d of [RUN_DIR, LOG_DIR, SNAPSHOT_DIR, FINAL_DIR]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }

  const docuverse = path.join(ROOT_RAW, 'docuverse_cartographies_squizoanalythiques_Fe_lix_Guattari_1789114122714.docuverse.json');
  if (!fs.existsSync(docuverse)) {
    console.error('[fatal] docuverse not found at', docuverse);
    process.exit(1);
  }
  if (!fs.existsSync(path.join(SRC_DIR, 'final-noun-index.json'))) {
    console.error('[fatal] final-noun-index.json not found at SRC_DIR');
    process.exit(1);
  }
  if (!fs.existsSync(path.join(SRC_DIR, 'test-questions.json'))) {
    console.error('[fatal] test-questions.json not found at SRC_DIR');
    process.exit(1);
  }

  console.log('[init] SRC_DIR =', SRC_DIR);
  console.log('[init] RUN_DIR =', RUN_DIR);
  console.log('[init] LOG_DIR =', LOG_DIR);
  console.log('[init] SNAPSHOT_DIR =', SNAPSHOT_DIR);
  console.log('[init] FINAL_DIR =', FINAL_DIR);
  console.log('[init] docuverse =', docuverse);

  const env = {
    OUTPUT_PATH: path.join(RUN_DIR, 'noun-recall-results.json'),
    RECALL_RESULTS_PATH: path.join(RUN_DIR, 'noun-recall-results.json'),
    CANDIDATE_TEXTS_PATH: path.join(RUN_DIR, 'candidate-texts-for-llm.json'),
    TRACEBACK_MAP_PATH: path.join(RUN_DIR, 'material-traceback-map.json'),
    LLM_SNAPSHOT_DIR: SNAPSHOT_DIR,
    LLM_CONCURRENCY: '8',
    DOCUVERSE_PATH: docuverse,
    NOUN_INDEX_PATH: path.join(SRC_DIR, 'final-noun-index.json'),
    QUESTIONS_PATH: path.join(SRC_DIR, 'test-questions.json'),
  };

  console.log('[init] env vars:');
  for (const [k, v] of Object.entries(env)) {
    console.log('  ' + k + ' = ' + v);
  }

  // Build question list (filter to those actually in test-questions.json)
  const validQuestions = JSON.parse(fs.readFileSync(path.join(SRC_DIR, 'test-questions.json'), 'utf-8')).map(q => q.id);
  const allQs = [];
  for (let z = 1; z <= 4; z++) {
    for (let q = 1; q <= 4; q++) {
      allQs.push(`Z${z}-Q${q}`);
    }
  }
  const runnable = allQs.filter(q => validQuestions.includes(q));
  console.log(`[init] ${runnable.length} questions to run: ${runnable.join(', ')}`);

  const startAll = Date.now();
  const summaryLines = [];
  summaryLines.push('============================================================');
  summaryLines.push('Cache-test rerun 2026-09-24');
  summaryLines.push(`Started: ${nowStr()}`);
  summaryLines.push(`RunDir:  ${RUN_DIR}`);
  summaryLines.push(`Valid questions: ${runnable.length}`);
  summaryLines.push('============================================================');
  summaryLines.push('');

  for (let i = 0; i < runnable.length; i++) {
    const qid = runnable[i];
    summaryLines.push(`--- [${i + 1}/${runnable.length}] ${qid} (${nowStr()}) ---`);
    const result = await runOne(qid, env, 'rerun');
    if (result.ok) {
      summaryLines.push(`  [OK] ${qid} elapsed=${result.elapsed}s`);
    } else {
      summaryLines.push(`  [FAIL] ${qid} step=${result.step} code=${result.code} elapsed=${result.elapsed}s`);
    }
  }

  const totalElapsed = ((Date.now() - startAll) / 1000).toFixed(1);
  summaryLines.push('');
  summaryLines.push('============================================================');
  summaryLines.push(`Finished: ${nowStr()}`);
  summaryLines.push(`Total elapsed: ${totalElapsed}s (${(totalElapsed / 60).toFixed(1)} min)`);
  summaryLines.push('============================================================');

  const summaryPath = path.join(LOG_DIR, 'rerun-summary.txt');
  fs.writeFileSync(summaryPath, summaryLines.join('\n'), 'utf-8');
  console.log('\n[done] summary:', summaryPath);

  // Copy final outputs to final/
  console.log('[copy] final/');
  const finalFiles = ['noun-recall-results.json', 'candidate-texts-for-llm.json', 'material-traceback-map.json'];
  for (const f of finalFiles) {
    const src = path.join(RUN_DIR, f);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(FINAL_DIR, f));
      console.log('  ' + f);
    }
  }
  for (const qid of runnable) {
    for (const [prefix, ext] of [['multipath-prompt', '.txt'], ['reasoning-output', '.json']]) {
      const name = `${prefix}-${qid}${ext}`;
      const src = path.join(RUN_DIR, name);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(FINAL_DIR, name));
      }
    }
  }
  console.log('[done] all steps complete');
}

main().catch(err => {
  console.error('[fatal]', err);
  process.exit(1);
});
