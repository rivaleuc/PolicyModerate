# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
PolicyModerate — content judged against a WRITTEN policy, by GenLayer consensus.

Submit a piece of content together with the policy it must obey. `moderate` has
every validator independently decide allowed / removed and cite the exact policy
clause it violates; the result is accepted only when validators agree on the
DECISION (comparative equivalence on the decision string), not on the wording of
the reason. The author may `appeal` once, forcing a fresh consensus pass that can
overturn the call.

The verb is "judge content against a specific policy + appeal" — the policy is an
input, so the same engine enforces any ruleset, and removals are accountable
(clause-cited, re-judgeable).
"""
import json
from genlayer import *

DECISIONS = ("allowed", "removed")


def normalize_ruling(raw) -> dict:
    if not isinstance(raw, dict):
        raw = {}
    decision = str(raw.get("decision", "")).strip().lower()
    if decision not in DECISIONS:
        decision = "allowed"          # conservative: don't remove on an unclear/failed call
    clause = raw.get("clause")
    clause = clause[:200] if isinstance(clause, str) and clause.strip() else ""
    reason = raw.get("reason")
    reason = reason[:500] if isinstance(reason, str) and reason.strip() else "no reason"
    return {"decision": decision, "clause": clause, "reason": reason}


def validate_ruling(data) -> bool:
    if not isinstance(data, dict):
        return False
    if data.get("decision") not in DECISIONS:
        return False
    r = data.get("reason")
    return isinstance(r, str) and bool(r.strip())


class PolicyModerate(gl.Contract):
    cases: TreeMap[str, str]
    case_count: u256
    removed_count: u256

    def __init__(self):
        self.case_count = u256(0)
        self.removed_count = u256(0)

    @gl.public.write
    def submit(self, content: str, policy: str) -> str:
        content = str(content).strip()
        policy = str(policy).strip()
        if not content or not policy:
            raise Exception("content and policy required")
        key = str(int(self.case_count))
        rec = {
            "author": str(gl.message.sender_address),
            "content": content[:2000],
            "policy": policy[:1500],
            "state": "pending",        # pending -> moderated (-> appealed)
            "decision": "",
            "clause": "",
            "reason": "",
            "appealed": False,
        }
        self.cases[key] = json.dumps(rec)
        self.case_count += u256(1)
        return key

    def _apply(self, case_id: str):
        c = json.loads(self.cases[case_id])
        ruling = self._moderate(c["content"], c["policy"])
        prev_removed = c["decision"] == "removed"
        c["decision"] = ruling["decision"]
        c["clause"] = ruling["clause"]
        c["reason"] = ruling["reason"]
        now_removed = ruling["decision"] == "removed"
        if now_removed and not prev_removed:
            self.removed_count += u256(1)
        if prev_removed and not now_removed:      # appeal overturned a removal
            self.removed_count -= u256(1)
        return c, ruling

    @gl.public.write
    def moderate(self, case_id: str) -> dict:
        case_id = str(case_id)
        if case_id not in self.cases:
            raise Exception("unknown case")
        c = json.loads(self.cases[case_id])
        if c["state"] != "pending":
            raise Exception("already moderated")
        c, ruling = self._apply(case_id)
        c["state"] = "moderated"
        self.cases[case_id] = json.dumps(c)
        return {"case": case_id, "decision": ruling["decision"], "clause": ruling["clause"]}

    @gl.public.write
    def appeal(self, case_id: str) -> dict:
        """Re-judge once; can overturn the original decision."""
        case_id = str(case_id)
        if case_id not in self.cases:
            raise Exception("unknown case")
        c = json.loads(self.cases[case_id])
        if c["state"] != "moderated":
            raise Exception("only a moderated case can be appealed")
        if c["appealed"]:
            raise Exception("appeal already used")
        c, ruling = self._apply(case_id)
        c["appealed"] = True
        self.cases[case_id] = json.dumps(c)
        return {"case": case_id, "decision": ruling["decision"], "appealed": True}

    def _moderate(self, content: str, policy: str) -> dict:
        def rule() -> str:
            prompt = f"""You are a content moderator. Decide whether the CONTENT violates the POLICY.

POLICY:
{policy}

CONTENT:
{content}

If it violates a rule, decision="removed" and cite the specific clause; otherwise decision="allowed".
Reply ONLY JSON: {{"decision":"allowed|removed","clause":"<quoted/short clause or empty>","reason":"<short>"}}"""
            raw = gl.nondet.exec_prompt(prompt, response_format="json")
            if not isinstance(raw, dict):
                try:
                    raw = json.loads(str(raw))
                except Exception:
                    raw = {}
            return json.dumps(normalize_ruling(raw))

        result = gl.eq_principle.prompt_comparative(
            rule,
            principle="The 'decision' (allowed / removed) must be identical across validators. The cited clause and reason wording may differ.",
        )
        data = json.loads(result) if isinstance(result, str) else result
        if not validate_ruling(data):
            data = normalize_ruling(data if isinstance(data, dict) else {})
        return data

    @gl.public.view
    def get_case(self, case_id: str) -> dict:
        case_id = str(case_id)
        if case_id not in self.cases:
            return {"exists": False}
        c = json.loads(self.cases[case_id])
        c["exists"] = True
        return c

    @gl.public.view
    def stats(self) -> dict:
        return {"total_cases": int(self.case_count), "removed": int(self.removed_count)}
