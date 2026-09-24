// generate-mds.js
// Generate markdown navigation for everything modified today (2026-09-24)
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2] || 'C:\\Users\\Administrator\\Desktop\\chenggong-jiachi-master';
const TRANSCRIPT_ROOT = 'C:\\Users\\Administrator\\.cursor\\projects\\c-Users-Administrator-Desktop-chenggong-jiachi-master';
const OUT = ROOT;

const TODAY = new Date('2026-09-24T00:00:00');

function isToday(d) {
    const t = new Date(d);
    return t >= TODAY;
}

function safeRead(p) {
    try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; }
}

function safeStat(p) {
    try { return fs.statSync(p); } catch (e) { return null; }
}

function safeReaddir(p) {
    try { return fs.readdirSync(p, { withFileTypes: true }); } catch (e) { return []; }
}

// Walk and collect files
function walk(dir, exclude, results = []) {
    const entries = safeReaddir(dir);
    for (const e of entries) {
        if (exclude.includes(e.name)) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            walk(full, exclude, results);
        } else if (e.isFile()) {
            const st = safeStat(full);
            if (st && isToday(st.mtime)) {
                results.push({ path: full, size: st.size, mtime: st.mtime });
            }
        }
    }
    return results;
}

const EXCLUDE_DIRS = ['node_modules', '.git', '.today-files.csv', '.today-top.csv', '.today-walk.csv', '.chats.csv', '.scan-today.ps1', '.scan-top.ps1', '.scan-walk.ps1', '.scan-chats.ps1'];

console.log('[scan] walking workspace...');
const todayFiles = walk(ROOT, EXCLUDE_DIRS);
console.log(`[scan] ${todayFiles.length} files modified today`);

// Split: top-level vs nested
const topLevel = todayFiles.filter(f => path.dirname(f.path) === ROOT);
const nested = todayFiles.filter(f => path.dirname(f.path) !== ROOT);

// Make directories for output
const chatsDir = path.join(OUT, 'chats');
const notesDir = path.join(OUT, 'file-notes');
const terminalsDir = path.join(OUT, 'terminals-index');
fs.mkdirSync(chatsDir, { recursive: true });
fs.mkdirSync(notesDir, { recursive: true });
fs.mkdirSync(terminalsDir, { recursive: true });

// =====================
// 1. CHAT TRANSCRIPTS
// =====================
console.log('[chats] generating markdown for each chat transcript...');
const chatDirs = fs.readdirSync(path.join(TRANSCRIPT_ROOT, 'agent-transcripts'), { withFileTypes: true })
    .filter(d => d.isDirectory()).map(d => d.name);

const chatIndex = [];
for (const dir of chatDirs) {
    const jsonlPath = path.join(TRANSCRIPT_ROOT, 'agent-transcripts', dir, `${dir}.jsonl`);
    const st = safeStat(jsonlPath);
    if (!st) continue;
    if (!isToday(st.mtime)) continue;
    const content = safeRead(jsonlPath);
    if (!content) continue;

    // Parse JSONL
    const lines = content.split(/\r?\n/).filter(l => l.trim());
    const messages = [];
    for (const line of lines) {
        try {
            const obj = JSON.parse(line);
            if (obj.role && obj.message && Array.isArray(obj.message.content)) {
                const texts = obj.message.content
                    .filter(c => c.type === 'text')
                    .map(c => c.text)
                    .join('\n');
                if (texts.trim()) messages.push({ role: obj.role, text: texts });
            }
        } catch (e) {}
    }

    // Get first user query as title
    const firstUser = messages.find(m => m.role === 'user');
    const firstAssistant = messages.find(m => m.role === 'assistant');

    let title = '(empty)';
    let timestamp = '';
    let summary = '';
    if (firstUser) {
        const text = firstUser.text;
        // Extract timestamp
        const tsMatch = text.match(/<timestamp>([^<]+)<\/timestamp>/);
        if (tsMatch) timestamp = tsMatch[1].trim();
        // Extract user_query
        const qMatch = text.match(/<user_query>([\s\S]*?)<\/user_query>/);
        const query = qMatch ? qMatch[1].trim() : text.slice(0, 200);
        title = query.slice(0, 80).replace(/\s+/g, ' ');
        summary = query.slice(0, 300);
    }

    // Count user/assistant turns
    const userTurns = messages.filter(m => m.role === 'user').length;
    const assistantTurns = messages.filter(m => m.role === 'assistant').length;

    // Extract tools used
    const toolCounts = {};
    for (const m of messages) {
        if (m.role === 'assistant') {
            const tcs = m.text.match(/<tool_use[^>]*name="([^"]+)"/g) || [];
            for (const tc of tcs) {
                const name = tc.match(/name="([^"]+)"/);
                if (name) toolCounts[name[1]] = (toolCounts[name[1]] || 0) + 1;
            }
        }
    }

    // Build markdown
    const md = [];
    md.push(`# 聊天: ${title}`);
    md.push('');
    md.push(`> **Chat ID**: \`${dir}\`  `);
    md.push(`> **时间**: ${timestamp || st.mtime.toISOString()}  `);
    md.push(`> **消息数**: 用户 ${userTurns} 条 / 助手 ${assistantTurns} 条  `);
    md.push(`> **原始文件**: \`${jsonlPath}\` (${(st.size / 1024).toFixed(1)} KB)  `);
    md.push('');
    md.push('## 首个提问');
    md.push('');
    md.push('```');
    md.push(summary);
    md.push('```');
    md.push('');
    if (Object.keys(toolCounts).length) {
        md.push('## 工具调用统计');
        md.push('');
        md.push('| 工具 | 次数 |');
        md.push('|------|------|');
        for (const [name, count] of Object.entries(toolCounts).sort((a, b) => b[1] - a[1])) {
            md.push(`| ${name} | ${count} |`);
        }
        md.push('');
    }
    md.push('## 完整对话');
    md.push('');
    md.push('<details>');
    md.push('<summary>点击展开完整对话</summary>');
    md.push('');
    for (let i = 0; i < messages.length; i++) {
        const m = messages[i];
        const role = m.role === 'user' ? '👤 用户' : '🤖 助手';
        md.push(`### ${i + 1}. ${role}`);
        md.push('');
        md.push('```');
        md.push(m.text.slice(0, 4000));
        if (m.text.length > 4000) md.push('\n... (截断)');
        md.push('```');
        md.push('');
    }
    md.push('</details>');
    md.push('');

    const outPath = path.join(chatsDir, `${dir}.md`);
    fs.writeFileSync(outPath, md.join('\n'), 'utf8');
    chatIndex.push({
        id: dir,
        title,
        timestamp,
        turns: userTurns + assistantTurns,
        size: st.size,
        md: path.relative(ROOT, outPath),
    });
}

console.log(`[chats] wrote ${chatIndex.length} chat markdown files`);

// =====================
// 2. ENV / SCRIPTS
// =====================
console.log('[notes] generating notes for env / scripts / config...');

// Identify "important" files (env, scripts, configs, key outputs)
const fileNotes = [];
for (const f of todayFiles) {
    const rel = path.relative(ROOT, f.path);
    const name = path.basename(f.path);
    const ext = path.extname(f.path).toLowerCase();

    // Skip obvious outputs that are too large to be useful as individual notes
    const isTooLarge = f.size > 1_000_000; // > 1MB
    const isNoise = /^audit-progress-\d+\.json$/.test(name)
        || /^call-\d{4}-(prompt|request)\.(txt|json)$/.test(name)
        || /^call-\d{4}-output\.txt$/.test(name)
        || /^call-\d{4}-response\.json$/.test(name)
        || /^chunk_overlap/.test(name) && isTooLarge
        || /^multipath-prompt-/.test(name) && isTooLarge
        || name === 'execution-summary.json'
        || name === 'material-traceback-map.json'
        || name === 'candidate-texts-for-llm.json'
        || name === 'noun-recall-results.json'
        || name === 'today-files.csv';

    // Categorize
    let category = '其他';
    if (name === '.env') category = '环境配置';
    else if (['.ps1', '.bat', '.sh'].includes(ext)) category = '脚本';
    else if (['.js', '.cjs', '.mjs', '.ts', '.py'].includes(ext)) category = '代码';
    else if (['.txt', '.log'].includes(ext)) category = '文本输出';
    else if (ext === '.json') category = '配置 / 数据';
    else if (ext === '.md') category = '文档';
    else if (['.csv'].includes(ext)) category = '数据';

    // Build note
    const md = [];
    md.push(`# ${name}`);
    md.push('');
    md.push(`> **路径**: \`${rel}\`  `);
    md.push(`> **分类**: ${category}  `);
    md.push(`> **大小**: ${(f.size / 1024).toFixed(1)} KB  `);
    md.push(`> **最后修改**: ${f.mtime.toISOString()}  `);
    md.push('');

    // Try to extract content header / first lines
    if (f.size < 500_000) {
        const content = safeRead(f.path);
        if (content) {
            const firstLines = content.split(/\r?\n/).slice(0, 50);
            md.push('## 文件开头预览');
            md.push('');
            md.push('```' + ext.replace('.', ''));
            md.push(firstLines.join('\n'));
            md.push('```');
            md.push('');
        }
    } else {
        md.push('> ⚠️ 文件过大 (> 500KB)，未读取全部内容');
        md.push('');
    }

    const outName = rel.replace(/[\\\/]/g, '__') + '.md';
    const outPath = path.join(notesDir, outName);
    fs.writeFileSync(outPath, md.join('\n'), 'utf8');
    fileNotes.push({
        rel,
        category,
        size: f.size,
        mtime: f.mtime,
        md: path.relative(ROOT, outPath),
    });
}

console.log(`[notes] wrote ${fileNotes.length} file notes`);

// =====================
// 3. TERMINALS
// =====================
console.log('[terminals] generating terminal session notes...');
const terminalDir = path.join(TRANSCRIPT_ROOT, 'terminals');
const termFiles = fs.readdirSync(terminalDir).filter(f => f.endsWith('.txt'));
const terminalNotes = [];
for (const tf of termFiles) {
    const fp = path.join(terminalDir, tf);
    const st = safeStat(fp);
    if (!st || !isToday(st.mtime)) continue;
    const content = safeRead(fp);
    if (!content) continue;

    // Parse header: pid, cwd, last_command, last_exit_code
    const lines = content.split(/\r?\n/);
    const meta = {};
    for (const l of lines.slice(0, 20)) {
        const m = l.match(/^(pid|cwd|last_command|last_exit_code):\s*(.*)$/);
        if (m) meta[m[1]] = m[2];
    }

    const md = [];
    md.push(`# 终端会话: ${tf}`);
    md.push('');
    md.push(`> **文件**: \`${fp}\` (${(st.size / 1024).toFixed(1)} KB)  `);
    md.push(`> **修改时间**: ${st.mtime.toISOString()}  `);
    if (meta.pid) md.push(`> **PID**: ${meta.pid}  `);
    if (meta.cwd) md.push(`> **工作目录**: \`${meta.cwd}\`  `);
    if (meta.last_command) md.push(`> **最后命令**: \`${meta.last_command}\`  `);
    if (meta.last_exit_code !== undefined) md.push(`> **退出码**: \`${meta.last_exit_code}\`  `);
    md.push('');
    if (content.length < 50_000) {
        md.push('## 输出内容');
        md.push('');
        md.push('```');
        md.push(content);
        md.push('```');
    } else {
        md.push(`> ⚠️ 输出过大 (>50KB)，仅预览前 200 行`);
        md.push('');
        md.push('```');
        md.push(lines.slice(0, 200).join('\n'));
        md.push('```');
    }
    md.push('');

    const outPath = path.join(terminalsDir, `${tf}.md`);
    fs.writeFileSync(outPath, md.join('\n'), 'utf8');
    terminalNotes.push({
        file: tf,
        pid: meta.pid,
        cwd: meta.cwd,
        lastCommand: meta.last_command,
        exitCode: meta.last_exit_code,
        size: st.size,
        md: path.relative(ROOT, outPath),
    });
}

console.log(`[terminals] wrote ${terminalNotes.length} terminal notes`);

// =====================
// 4. MAIN INDEX
// =====================
console.log('[index] writing main TODAY-INDEX.md...');
const idx = [];
idx.push('# 加油 · 2026-09-24 改动文件导航');
idx.push('');
idx.push(`> 本文档由 Cursor 自动生成于 ${new Date().toISOString()}  `);
idx.push(`> 范围: 2026-09-24 全天改动的所有文件  `);
idx.push(`> 工作区: \`${ROOT}\``);
idx.push('');
idx.push('## 📊 总览');
idx.push('');
idx.push(`- 📁 **总改动文件数**: ${todayFiles.length}`);
idx.push(`- 💬 **聊天窗口数**: ${chatIndex.length}`);
idx.push(`- 📝 **文件导航笔记**: ${fileNotes.length}`);
idx.push(`- 🖥️ **终端会话数**: ${terminalNotes.length}`);
idx.push('');
idx.push('---');
idx.push('');

idx.push('## 💬 一、聊天窗口 (12 个会话)');
idx.push('');
idx.push('每个聊天窗口的完整对话均已生成独立 markdown 文件。');
idx.push('');
idx.push('| # | 标题 | 时间 | 消息数 | 大小 | 详情 |');
idx.push('|---|------|------|--------|------|------|');
for (let i = 0; i < chatIndex.length; i++) {
    const c = chatIndex[i];
    idx.push(`| ${i + 1} | ${c.title.slice(0, 40)}${c.title.length > 40 ? '…' : ''} | ${c.timestamp} | ${c.turns} | ${(c.size / 1024).toFixed(0)}KB | [查看](${c.md.replace(/\\/g, '/')}) |`);
}
idx.push('');
idx.push('---');
idx.push('');

idx.push('## 📝 二、文件导航笔记');
idx.push('');

// Group by category
const byCat = {};
for (const n of fileNotes) {
    if (!byCat[n.category]) byCat[n.category] = [];
    byCat[n.category].push(n);
}
const catOrder = ['环境配置', '脚本', '代码', '配置 / 数据', '文档', '文本输出', '数据', '其他'];
const cats = [...new Set([...catOrder, ...Object.keys(byCat)])].filter(c => byCat[c]);
for (const c of cats) {
    idx.push(`### ${c} (${byCat[c].length} 个)`);
    idx.push('');
    idx.push('| 路径 | 大小 | 修改时间 | 详情 |');
    idx.push('|------|------|----------|------|');
    for (const n of byCat[c].slice(0, 100)) {
        idx.push(`| \`${n.rel}\` | ${(n.size / 1024).toFixed(1)}KB | ${n.mtime.toISOString()} | [查看](${n.md.replace(/\\/g, '/')}) |`);
    }
    if (byCat[c].length > 100) {
        idx.push(`| ... 还有 ${byCat[c].length - 100} 个 | | | |`);
    }
    idx.push('');
}
idx.push('---');
idx.push('');

idx.push('## 🖥️ 三、终端会话');
idx.push('');
if (terminalNotes.length === 0) {
    idx.push('_今日无终端会话_');
} else {
    idx.push('| 文件 | PID | 工作目录 | 最后命令 | 退出码 | 大小 | 详情 |');
    idx.push('|------|-----|----------|----------|--------|------|------|');
    for (const t of terminalNotes) {
        idx.push(`| \`${t.file}\` | ${t.pid || '?'} | \`${t.cwd || '?'}\` | \`${(t.lastCommand || '').slice(0, 30)}\` | \`${t.exitCode || '?'}\` | ${(t.size / 1024).toFixed(1)}KB | [查看](${t.md.replace(/\\/g, '/')}) |`);
    }
}
idx.push('');
idx.push('---');
idx.push('');

idx.push('## 📁 四、所有今日改动文件 (原始清单)');
idx.push('');
idx.push(`共 ${todayFiles.length} 个文件，完整清单见 \`.today-files.csv\`。`);
idx.push('');
idx.push('| 路径 | 大小 | 修改时间 |');
idx.push('|------|------|----------|');
for (const f of todayFiles.slice(0, 200)) {
    idx.push(`| \`${path.relative(ROOT, f.path)}\` | ${(f.size / 1024).toFixed(1)}KB | ${f.mtime.toISOString()} |`);
}
if (todayFiles.length > 200) {
    idx.push(`| ... 还有 ${todayFiles.length - 200} 个 | | |`);
}
idx.push('');

fs.writeFileSync(path.join(ROOT, 'TODAY-INDEX.md'), idx.join('\n'), 'utf8');
console.log('[done] TODAY-INDEX.md written');
console.log(`[stats] files: ${todayFiles.length} | chats: ${chatIndex.length} | notes: ${fileNotes.length} | terminals: ${terminalNotes.length}`);