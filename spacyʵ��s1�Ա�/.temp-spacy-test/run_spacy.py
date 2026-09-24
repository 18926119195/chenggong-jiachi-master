
import sys
import json
import spacy

# 加载 spaCy 模型
print(f"加载 spaCy 模型: fr_core_news_sm", file=sys.stderr)
nlp = spacy.load("fr_core_news_sm")

input_file = "C:\\Users\\Administrator\\Desktop\\2026-09-21-master\\.temp-spacy-test\\residuals.jsonl"
output_file = "C:\\Users\\Administrator\\Desktop\\2026-09-21-master\\.temp-spacy-test\\spacy-results.jsonl"

processed_count = 0
total_nouns = 0

with open(input_file, 'r', encoding='utf-8') as f_in:
    with open(output_file, 'w', encoding='utf-8') as f_out:
        for line in f_in:
            entry = json.loads(line.strip())
            chunk_key = entry['chunkKey']
            page = entry['page']
            text = entry['text']
            residual_start = entry['residualStart']
            residual_end = entry['residualEnd']
            
            # 用 spaCy 处理
            doc = nlp(text)
            
            # 提取名词（NOUN 和 PROPN）
            # start/end 换算成 chunk 全局偏移: residual_start + 局部偏移
            nouns = []
            for token in doc:
                if token.pos_ in ('NOUN', 'PROPN') and not token.is_stop and len(token.text.strip()) > 1:
                    nouns.append({
                        'text': token.text,
                        'lemma': token.lemma_,
                        'pos': token.pos_,
                        'start': residual_start + token.idx,
                        'end': residual_start + token.idx + len(token.text)
                    })
            
            result = {
                'chunkKey': chunk_key,
                'page': page,
                'residualStart': residual_start,
                'residualEnd': residual_end,
                'nouns': nouns
            }
            
            f_out.write(json.dumps(result, ensure_ascii=False) + '\n')
            
            processed_count += 1
            total_nouns += len(nouns)
            
            if processed_count % 100 == 0:
                print(f"已处理: {processed_count} chunks", file=sys.stderr)

print(f"\n完成！处理 {processed_count} 个 chunk，提取 {total_nouns} 个名词", file=sys.stderr)
