// prepare-publish.cjs
// Copy only navigation artifacts to a clean publish folder, then commit+push
const fs = require('fs');
const path = require('path');

const ROOT = 'C:\\Users\\Administrator\\Desktop\\chenggong-jiachi-master';
const PUBLISH = 'C:\\Users\\Administrator\\Desktop\\jiayou-publish';

// Clean
if (fs.existsSync(PUBLISH)) {
    fs.rmSync(PUBLISH, { recursive: true, force: true });
}
fs.mkdirSync(PUBLISH, { recursive: true });

// Copy TODAY-INDEX.md
fs.copyFileSync(path.join(ROOT, 'TODAY-INDEX.md'), path.join(PUBLISH, 'TODAY-INDEX.md'));

// Copy chats/
function copyDir(src, dst) {
    fs.mkdirSync(dst, { recursive: true });
    for (const e of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, e.name);
        const d = path.join(dst, e.name);
        if (e.isDirectory()) copyDir(s, d);
        else fs.copyFileSync(s, d);
    }
}

copyDir(path.join(ROOT, 'chats'), path.join(PUBLISH, 'chats'));
copyDir(path.join(ROOT, 'file-notes'), path.join(PUBLISH, 'file-notes'));
copyDir(path.join(ROOT, 'terminals-index'), path.join(PUBLISH, 'terminals-index'));

// Add README
fs.writeFileSync(path.join(PUBLISH, 'README.md'), `# 加油 (jiayou) · 2026-09-24 改动文件导航

本仓库是 **2026-09-24 当天** 所有改动文件的 Markdown 导航集合。

## 📑 主索引

请先阅读 [\`TODAY-INDEX.md\`](./TODAY-INDEX.md) — 这是总入口。

## 📁 目录结构

- \`TODAY-INDEX.md\` — 主索引（所有文件的导航列表）
- \`chats/\` — 12 个聊天窗口的完整对话（每个会话一个 .md）
- \`file-notes/\` — 所有今日改动的 env / 脚本 / 配置文件导航
- \`terminals-index/\` — 11 个终端会话的输出快照

## 🔧 生成方式

由 Cursor 自动生成，使用 Node.js 脚本扫描文件系统，提取 2026-09-24 当天所有修改的文件，并为每个文件生成 Markdown 说明。

生成时间: ${new Date().toISOString()}
`);

console.log('[publish] prepared at', PUBLISH);

// List stats
function dirSize(p) {
    let total = 0, count = 0;
    function walk(d) {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const f = path.join(d, e.name);
            if (e.isDirectory()) walk(f);
            else { total += fs.statSync(f).size; count++; }
        }
    }
    walk(p);
    return { total, count };
}

const idx = dirSize(PUBLISH);
console.log(`[publish] ${idx.count} files, ${(idx.total / 1024 / 1024).toFixed(2)} MB total`);