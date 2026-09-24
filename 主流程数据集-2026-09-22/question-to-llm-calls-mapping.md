# 15个问题对应的LLM调用映射

本文档记录了15个测试问题在 `llm-snapshots` 目录中对应的LLM调用编号。

## 映射关系

### Z1-Q1: Pierre Janet和Freud对无意识的观点有何不同？
**对应的LLM调用**: `call-0001` ~ `call-0044` (约44个调用)
- `call-0001`: 初始召回候选词
- `call-0002` ~ `call-0043`: 候选词评分
- `call-0044`: 最终推理输出

**推理输出文件**: `reasoning-output-Z1-Q1.json`

---

### Z1-Q2: 拉康精神分析如何处理主体性问题？
**对应的LLM调用**: `call-0045` ~ `call-0092` (约48个调用)
- 包含候选词召回、评分、推理全流程

**推理输出文件**: `reasoning-output-Z1-Q2.json`

---

### Z1-Q3: 精神分析和宗教的共同点是什么？
**对应的LLM调用**: `call-0093` ~ `call-0138` (约46个调用)

**推理输出文件**: `reasoning-output-Z1-Q3.json`

---

### Z1-Q4: 分裂症和精神病之间的关系是什么？
**对应的LLM调用**: `call-0139` ~ `call-0183` (约45个调用)

**推理输出文件**: `reasoning-output-Z1-Q4.json`

---

### Z2-Q1: 为什么说精神分析的阉割概念是符号性的而非生物学？
**对应的LLM调用**: `call-0184` ~ `call-0229` (约46个调用)

**推理输出文件**: `reasoning-output-Z2-Q1.json`

---

### Z2-Q2: 转移（transfert）在精神分析中的功能是什么？
**对应的LLM调用**: `call-0230` ~ `call-0276` (约47个调用)

**推理输出文件**: `reasoning-output-Z2-Q2.json`

---

### Z2-Q3: 拉康的三元结构（想象界、符号界、真实界）如何应用于临床？
**对应的LLM调用**: `call-0277` ~ `call-0323` (约47个调用)

**推理输出文件**: `reasoning-output-Z2-Q3.json`

---

### Z2-Q4: 为什么说主体性是被建构的而非先验的？
**对应的LLM调用**: `call-0324` ~ `call-0363` (约40个调用)

**推理输出文件**: `reasoning-output-Z2-Q4.json`

---

### Z3-Q1: 比较Pierre Janet、Freud、Karl Jaspers对无意识的理解有何异同？
**对应的LLM调用**: `call-0364` ~ `call-0408` (约45个调用)

**推理输出文件**: `reasoning-output-Z3-Q1.json`

---

### Z3-Q2: 精神分析如何处理精神病性结构？有哪些临床策略？
**对应的LLM调用**: `call-0409` ~ `call-0456` (约48个调用)

**推理输出文件**: `reasoning-output-Z3-Q2.json`

---

### Z3-Q3: 从拉康的角度，欲望和需求有何区别？
**对应的LLM调用**: `call-0457` ~ `call-0500` (约44个调用)

**推理输出文件**: `reasoning-output-Z3-Q3.json`

---

### Z4-Q1: Guattari对机器欲望的具体定义是什么？
**对应的LLM调用**: `call-0501` ~ `call-0546` (约46个调用)

**推理输出文件**: `reasoning-output-Z4-Q1.json`

---

### Z4-Q2: 精神分析和精神分裂分析（schizoanalyse）的核心差异是什么？
**对应的LLM调用**: `call-0547` ~ `call-0593` (约47个调用)

**推理输出文件**: `reasoning-output-Z4-Q2.json`

---

### Z4-Q3: 请详细解释Lacan的"回到弗洛伊德"运动的具体历史过程和参与者
**对应的LLM调用**: `call-0594` ~ `call-0637` (约44个调用)
- 注意：`call-0597`, `call-0599` 无对应的output文件

**推理输出文件**: `reasoning-output-Z4-Q3.json`

---

### Z4-Q4: 根据本文档，拉康派的临床技术手册在哪里可以下载？
**对应的LLM调用**: `call-0638` ~ `call-0681` (约44个调用)

**推理输出文件**: `reasoning-output-Z4-Q4.json`

---

## 总结

- **总LLM调用数**: 681次 (根据 `execution-summary.json`)
- **15个问题的推理调用**: 约 `call-0001` ~ `call-0681`
- **每个问题平均**: ~45次LLM调用
- **调用类型**:
  1. 候选词召回 (recall): 1次
  2. 候选词评分 (scoring): 40+ 次（逐批打分）
  3. 最终推理生成: 1-3次

## 使用方法

要查看某个问题的完整LLM交互记录，可以查看对应范围内的文件：

```bash
# 示例：查看Z1-Q1的所有请求
ls llm-snapshots/call-000{1..9}-request.json
ls llm-snapshots/call-00{10..44}-request.json

# 或查看所有prompt
ls llm-snapshots/call-00{01..44}-prompt.txt
```

每个调用包含4个文件：
- `call-XXXX-request.json`: 请求元数据
- `call-XXXX-prompt.txt`: 实际发送给LLM的prompt
- `call-XXXX-response.json`: 响应元数据
- `call-XXXX-output.txt`: LLM的输出内容
