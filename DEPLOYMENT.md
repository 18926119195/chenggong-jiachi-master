# 部署指南 - 完整环境配置

本文档提供完整的环境部署步骤，确保项目可以直接运行。

## 系统要求

- Windows 10/11 或 Linux/macOS
- 至少 4GB 可用内存
- 至少 2GB 可用磁盘空间

## 一、安装 Node.js

### Windows

1. 访问 Node.js 官网：https://nodejs.org/
2. 下载 LTS 版本（推荐 v20.x 或更高版本）
3. 运行安装程序，按默认选项安装
4. 验证安装：
   ```powershell
   node --version
   npm --version
   ```

### Linux/macOS

```bash
# 使用 nvm 安装（推荐）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc  # 或 ~/.zshrc
nvm install 20
nvm use 20

# 验证安装
node --version
npm --version
```

## 二、安装 Python

### Windows

1. 访问 Python 官网：https://www.python.org/downloads/
2. 下载 Python 3.10 或更高版本
3. **重要**：安装时勾选 "Add Python to PATH"
4. 验证安装：
   ```powershell
   python --version
   pip --version
   ```

### Linux/macOS

```bash
# Linux (Ubuntu/Debian)
sudo apt update
sudo apt install python3 python3-pip

# macOS (使用 Homebrew)
brew install python@3.10

# 验证安装
python3 --version
pip3 --version
```

## 三、配置项目环境

### 1. 安装 Node.js 依赖

```bash
cd C:\Users\Administrator\Desktop\ni-zuibang-2026-09-20-main
npm install
```

### 2. 安装 Python 依赖

```bash
# Windows
pip install -r requirements.txt

# Linux/macOS
pip3 install -r requirements.txt
```

### 3. 下载 spaCy 法语模型

```bash
# Windows
python -m spacy download fr_core_news_sm

# Linux/macOS
python3 -m spacy download fr_core_news_sm
```

### 4. 配置环境变量

1. 复制环境变量模板：
   ```bash
   # Windows PowerShell
   Copy-Item .env.example .env
   
   # Linux/macOS
   cp .env.example .env
   ```

2. 编辑 `.env` 文件，填入你的 DeepSeek API Key：
   ```env
   LLM_API_KEY=sk-your-actual-api-key-here
   ```

   **如何获取 DeepSeek API Key：**
   - 访问：https://platform.deepseek.com/
   - 注册/登录账号
   - 进入 "API Keys" 页面创建新密钥

## 四、启动项目

### 方式一：分步启动（推荐用于调试）

#### 1. 启动 spaCy 服务（终端1）

```bash
# Windows
cd spacy-sidecar
python server.py

# Linux/macOS
cd spacy-sidecar
python3 server.py
```

服务启动后会显示：
```
Loading spaCy model: fr_core_news_sm...
Model loaded successfully.
Starting spaCy sidecar on http://localhost:5001
```

保持此终端运行，不要关闭。

#### 2. 测试 spaCy 服务（终端2 - 可选）

```bash
# Windows PowerShell
Invoke-WebRequest -Uri http://localhost:5001/health -Method GET

# Linux/macOS
curl http://localhost:5001/health
```

应该返回：
```json
{"status":"ok","model":"fr_core_news_sm","loaded":true}
```

#### 3. 运行完整流程（终端2）

```bash
# 方式A：运行单个问题
node run-full-pipeline.js Z1-Q1

# 方式B：运行所有问题
node run-full-pipeline.js
```

### 方式二：一键启动（Windows PowerShell）

```powershell
.\run-pipeline.ps1
```

## 五、验证安装

### 快速测试脚本

创建测试文件 `test-environment.js`：

```javascript
import { LLM_API_KEY, callLLM } from './src/core/llmClient.js';
import { execSync } from 'child_process';

async function testEnvironment() {
  console.log('='.repeat(60));
  console.log('环境验证测试');
  console.log('='.repeat(60));
  
  // 1. 检查 API Key
  console.log('\n1. 检查 LLM API Key...');
  if (!LLM_API_KEY || LLM_API_KEY.length < 10) {
    console.error('❌ API Key 未配置或无效');
    return false;
  }
  console.log('✅ API Key 已配置');
  
  // 2. 检查 spaCy 服务
  console.log('\n2. 检查 spaCy 服务...');
  try {
    const res = await fetch('http://localhost:5001/health');
    if (res.ok) {
      console.log('✅ spaCy 服务正常运行');
    } else {
      console.error('❌ spaCy 服务响应异常');
      return false;
    }
  } catch (err) {
    console.error('❌ spaCy 服务未启动，请先运行：python spacy-sidecar/server.py');
    return false;
  }
  
  // 3. 测试 LLM 调用
  console.log('\n3. 测试 LLM 调用...');
  const result = await callLLM('请回复：测试成功', { maxTokens: 50 });
  if (result && result.text) {
    console.log('✅ LLM 调用成功');
    console.log(`   响应: ${result.text.slice(0, 50)}...`);
  } else {
    console.error('❌ LLM 调用失败');
    return false;
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ 所有测试通过，环境配置正确');
  console.log('='.repeat(60));
  return true;
}

testEnvironment().catch(console.error);
```

运行测试：
```bash
node test-environment.js
```

## 六、常见问题

### 1. "node 不是内部或外部命令"

**原因**：Node.js 未安装或未添加到 PATH

**解决方案**：
- 重新安装 Node.js，确保勾选 "Add to PATH"
- 或手动添加到系统环境变量
- 重启终端/PowerShell

### 2. "python 不是内部或外部命令"

**原因**：Python 未安装或未添加到 PATH

**解决方案**：
- 重新安装 Python，勾选 "Add Python to PATH"
- 或手动添加：`C:\Users\<用户名>\AppData\Local\Programs\Python\Python3xx\`

### 3. "spaCy 服务连接失败"

**症状**：`ECONNREFUSED localhost:5001`

**解决方案**：
```bash
# 检查服务是否运行
# Windows
netstat -an | findstr 5001

# 启动服务
cd spacy-sidecar
python server.py
```

### 4. "LLM API 调用失败 (401)"

**原因**：API Key 无效或未配置

**解决方案**：
- 检查 `.env` 文件中的 `LLM_API_KEY`
- 确认 Key 没有多余的空格或引号
- 在 DeepSeek 平台确认 Key 是否有效

### 5. "Model fr_core_news_sm not found"

**原因**：spaCy 法语模型未下载

**解决方案**：
```bash
python -m spacy download fr_core_news_sm
```

### 6. 端口 5001 被占用

**解决方案**：
修改 `.env` 文件：
```env
PORT=5002
```

然后修改各脚本中的端口引用（或通过环境变量统一管理）。

## 七、项目文件结构

```
ni-zuibang-2026-09-20-main/
├── spacy-sidecar/
│   └── server.py              # Python spaCy HTTP 服务
├── src/
│   └── core/
│       └── llmClient.js       # LLM 客户端封装
├── validate-s0-quality.js     # 阶段1：spaCy 名词抽取
├── s1-llm-fill.js              # 阶段2：LLM 补缺
├── merge-s0-s1.js              # 阶段3：合并词表
├── recall-nouns-llm.js         # 阶段4：名词召回
├── build-prompt-with-traceback.js  # 阶段5：构建推理输入
├── generate-multipath-prompt.js    # 阶段6：生成推理 Prompt
├── run-reasoning.js            # 阶段7：执行推理
├── run-full-pipeline.js        # 一键运行阶段4-7
├── package.json                # Node.js 依赖
├── requirements.txt            # Python 依赖
├── .env                        # 环境变量（需自行创建）
├── .env.example                # 环境变量模板
├── test-questions.json         # 测试问题集
└── final-noun-index.json       # 预生成的名词表
```

## 八、下一步

环境配置完成后，可以：

1. **直接运行**（使用预生成的名词表）：
   ```bash
   node run-full-pipeline.js Z1-Q1
   ```

2. **从头生成名词表**（需要 docuverse.json 原始数据）：
   ```bash
   node generate-noun-index.js <docuverse.json路径>
   ```

3. **查看结果**：
   - `reasoning-output-Z1-Q1.json` - 推理结果
   - `noun-recall-results.json` - 召回的名词
   - `candidate-texts-for-llm.json` - LLM 输入材料

## 九、技术支持

如遇到其他问题，请检查：
- Node.js 版本 ≥ v18.0.0
- Python 版本 ≥ 3.8
- 网络连接（需访问 DeepSeek API）
- 防火墙设置（确保 localhost:5001 可访问）
