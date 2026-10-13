"""Lab 05: grade answers with an AI judge, then check the judge against human labels."""
from aie import config
from aie.config import EVALS
from aie.evalset import load_jsonl, load_qa
from aie.evaluate import keyword_pass
from aie.judge import judge

qa = {q["id"]: q for q in load_qa()}
labelled = load_jsonl(EVALS / "judge_calibration.jsonl")
print(f"Judge model: {config.JUDGE_MODEL}\n")

agree_judge = agree_keyword = 0
for row in labelled:
    q = qa[row["id"]]
    v = judge(row["question"], row["answer"], q["source"])
    judge_ok = v.verdict == "correct"
    keyword_ok = keyword_pass(q, row["answer"])
    agree_judge += judge_ok == row["human_correct"]
    agree_keyword += keyword_ok == row["human_correct"]
    flag = "" if judge_ok == row["human_correct"] else "   <-- judge disagrees with human"
    print(f"{row['id']}  human={'ok ' if row['human_correct'] else 'bad'}  judge={'ok ' if judge_ok else 'bad'}  keyword={'ok ' if keyword_ok else 'bad'}{flag}")
    if flag:
        print(f"      judge said: {v.reasoning[:160]}")

n = len(labelled)
print(f"\nAgreement with human labels: judge {agree_judge}/{n} = {agree_judge / n:.0%}, keyword check {agree_keyword}/{n} = {agree_keyword / n:.0%}")
