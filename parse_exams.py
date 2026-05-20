"""
Parse exam .docx files into JSON.
Usage: python3 parse_exams.py
Input:  examDatabase/*.docx + examDatabase/*答案.docx
Output: examDatabase/parsed/*.json
"""
import zipfile, xml.etree.ElementTree as ET, json, os, re, glob

DB = "/mnt/d/###xystudent/事业编/公共基础知识/opencode/examDatabase"
OUT = os.path.join(DB, "parsed")
os.makedirs(OUT, exist_ok=True)

def read_docx(path):
    """Extract all paragraph texts from a .docx file"""
    z = zipfile.ZipFile(path)
    xml = z.read("word/document.xml")
    tree = ET.fromstring(xml)
    ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
    texts = []
    for p in tree.iter("{%s}p" % ns):
        t = "".join((n.text or "") for n in p.iter("{%s}t" % ns)).strip()
        if t:
            texts.append(t)
    return texts

def parse_answer_file(path):
    """Parse answer docx into dict: {question_section_index: {answer, explanation}}"""
    texts = read_docx(path)
    answers = {}
    current_section = 0
    for t in texts:
        # Section header like "一、是非判断题"
        sec = re.match(r"^[一二三四五六七八九十]+[、.](.+?)$", t)
        if sec and any(kw in t for kw in ["判断", "单项", "多项", "选择"]):
            current_section += 1
            continue
        # Answer line like "1.【答案】A。解析：..."
        m = re.match(r"^(\d+)\.[【\[]答案[】\]](.*?)[。\.]\s*解析[：:]\s*([\s\S]*)", t)
        if m:
            key = f"{current_section}_{m.group(1)}"
            answers[key] = {
                "answer": m.group(2).strip(),
                "explanation": m.group(3).strip()
            }
    return answers

def parse_question_file(path, answers):
    """Parse question docx into structured JSON"""
    texts = read_docx(path)
    title = texts[0] if texts else "未知专题"
    
    sections = []
    current_section = None
    current_qid = None
    current_stem = ""
    current_options = []
    section_idx = 0
    
    def flush_question():
        nonlocal current_qid, current_stem, current_options, section_idx
        if current_qid is None or not current_stem:
            return
        key = f"{section_idx}_{current_qid}"
        ans = answers.get(key, {})
        q = {
            "id": current_qid,
            "stem": current_stem,
            "answer": ans.get("answer", ""),
            "explanation": ans.get("explanation", "")
        }
        if current_options:
            q["options"] = current_options
        if current_section:
            current_section["questions"].append(q)
        current_qid = None
        current_stem = ""
        current_options = []
    
    for t in texts[1:]:  # skip title
        # Section header: "一、是非判断题", "二、单项选择题", etc.
        sec = re.match(r"^[一二三四五六七八九十]+[、.](.+?)$", t)
        if sec and any(kw in t for kw in ["判断", "单选", "多选", "选择"]):
            flush_question()
            label = t.strip()
            qtype = "judge"
            if "多选" in t or "多项" in t: qtype = "multi"
            elif "单选" in t or "单项" in t: qtype = "single"
            current_section = {"type": qtype, "label": label, "questions": []}
            sections.append(current_section)
            section_idx += 1
            continue
        
        # Skip pure numeric lines (page numbers, etc.)
        if re.match(r"^\d+$", t):
            continue
        
        # Option line: "A.xxx", "A.xxx    B.xxx" (inline), or "A xxx"
        opt_match = re.match(r"^([A-E])[\.．\s、](.+)$", t)
        if opt_match:
            label = opt_match.group(1)
            text = opt_match.group(2).strip()
            # Check for inline options: "A.xxx    B.xxx"
            inline = re.split(r"\s{2,}", text)
            if len(inline) > 1:
                # First part belongs to the original label (e.g., "政治权利" for A)
                current_options.append({"label": label, "text": inline[0].strip()})
                # Remaining parts have their own labels (e.g., "B.监督权")
                for part in inline[1:]:
                    pm = re.match(r"^([A-E])[\.．\s、]?(.*?)$", part.strip())
                    if pm and pm.group(2).strip():
                        current_options.append({"label": pm.group(1), "text": pm.group(2).strip()})
            else:
                current_options.append({"label": label, "text": text})
            continue
        
        # Question number: "1.", "1、", "1.", "5."
        qnum = re.match(r"^(\d+)[\.、]\s*(.+)", t)
        if qnum:
            flush_question()
            current_qid = int(qnum.group(1))
            current_stem = qnum.group(2).strip()
            # Remove trailing ( ) or （ ） from stem
            current_stem = re.sub(r"[（(]\s*[）)]\s*$", "", current_stem)
            # Check for inline options at end of stem: "...（ ）A.xxx   B.xxx   C.xxx   D.xxx"
            stem_opts = re.findall(r'([A-E])[．\.、]\s*(.+?)(?=\s{2,}[A-E][．\.、]|$)', current_stem)
            if len(stem_opts) >= 2:
                for label, opt_text in stem_opts:
                    current_options.append({"label": label, "text": opt_text.strip()})
                # Remove option text from stem
                current_stem = re.sub(r'\s*[A-E][．\.、]\s*.+$', '', current_stem).strip()
                # Also remove trailing full-width parenthesized placeholder
                current_stem = re.sub(r"[（(]\s*[）)]\s*$", "", current_stem)
            continue
        
        # Continuation of stem (multi-line stem)
        if current_qid is not None and not re.match(r"^[A-E][\.．\s、]", t):
            current_stem += t.strip()
    
    flush_question()
    return {"title": title, "sections": sections}

# ---- Main ----
# Find all question files (not answer files)
qfiles = sorted(glob.glob(os.path.join(DB, "*.docx")))
qfiles = [f for f in qfiles if "答案" not in os.path.basename(f) and "解析" not in os.path.basename(f)]

for qf in qfiles:
    base = os.path.basename(qf).replace(".docx", "")
    
    # Find matching answer file — try multiple patterns
    afile = None
    name = os.path.basename(qf)
    name_noext = name.replace(".docx", "")
    
    # Pattern 1: exact base + 答案.docx
    patterns = [
        os.path.join(DB, name_noext + "答案.docx"),
        # Pattern 2: strip leading number and dot
        os.path.join(DB, re.sub(r'^\d+\.\s*', '', name_noext) + "答案.docx"),
        # Pattern 3: search by similar prefix
    ]
    
    # Also search for any file with same prefix containing 答案
    prefix = re.sub(r'[\.\s]', '', name_noext[:5])
    for f in os.listdir(DB):
        fn = f.replace(".docx", "")
        if "答案" in fn:
            # Match by removing number prefix
            clean_q = re.sub(r'^[\d\.\s]+', '', name_noext.lower())
            clean_a = re.sub(r'^[\d\.\s]+', '', fn.lower().replace("答案", ""))
            if clean_q == clean_a or clean_q[:4] == clean_a[:4] or clean_a[:4] == clean_q[:4]:
                afile = os.path.join(DB, f)
                break
    
    for ap in patterns:
        if os.path.exists(ap):
            afile = ap
            break
    
    if not afile:
        print(f"SKIP {base}: no answer file found")
        continue
    
    print(f"Parsing {base}...")
    answers = parse_answer_file(afile)
    data = parse_question_file(qf, answers)
    
    # Count questions
    total = sum(len(s["questions"]) for s in data["sections"])
    
    outpath = os.path.join(OUT, base + ".json")
    with open(outpath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  → {total} questions in {len(data['sections'])} sections → {outpath}")

print("\nDone!")
