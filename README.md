# PolicyModerate

**Content judged against a WRITTEN policy, by GenLayer validator consensus — with an appeal.**

Submit content together with the policy it must obey. `moderate` has every validator independently
decide **allowed / removed** and cite the exact policy clause violated; the result is accepted only when
validators agree on the **decision** (comparative equivalence on the decision), not on the reason
wording. The author may `appeal` once, forcing a fresh consensus pass that can overturn the call.

The verb is **"judge content against a specific policy + appeal"** — the policy is an *input*, so the
same engine enforces any ruleset, and removals are accountable (clause-cited, re-judgeable).

- **Contract (Bradbury, chain 4221):** `0x18FdaE70d8DB3F8ba15afFFA79806693AABfe980`
- **Deployed from:** `rivale` (`0xc388…51A44`)
- **Explorer:** https://explorer-bradbury.genlayer.com/contract/0x18FdaE70d8DB3F8ba15afFFA79806693AABfe980

---

## Why GenLayer is essential

Applying a written policy to messy content is judgment, and centralized moderation is opaque and
unaccountable. GenLayer makes the call by **multi-validator consensus on the decision**, cites the
clause, and lets the author appeal for a fresh consensus pass — transparency a bare EVM can't offer.

## Workflow

| Step | Method | What happens |
| --- | --- | --- |
| Submit | `submit(content, policy)` | Queues content + the ruleset it must obey. |
| Moderate | `moderate(id)` | Consensus rules allowed/removed + cites the clause. |
| Appeal | `appeal(id)` | One re-judge that can overturn the decision. |
| Read | `get_case(id)` / `stats()` | Decision, clause, reason, appeal status. |

### Correctness check

`_moderate` wraps the ruling in **`gl.eq_principle.prompt_comparative`** — principle: *"the decision
(allowed / removed) must be identical across validators."* `validate_ruling` enforces the decision enum +
non-empty reason; `normalize_ruling` defaults the unclear/failed call to **allowed** (never remove
on uncertainty). The `removed` counter is adjusted correctly when an appeal overturns a removal.
Unit-tested incl. a removal that is **overturned on appeal**.

## Architecture

```
PolicyModerate/
├── contracts/policy_moderate.py  ← GenLayer Intelligent Contract (policy-grounded ruling + appeal)
├── tests/                        ← pytest: ruling guards + moderate/appeal flow incl. overturn
└── app/                          ← React + Vite + Tailwind v4 + Framer Motion (21st.dev style)
                                    amber rulebook theme, moderation queue + clause citation + appeal
```

## Tests

```bash
cd PolicyModerate
python3 -m venv .venv && .venv/bin/pip install pytest -q
.venv/bin/python -m pytest tests/ -q
```
Covers `normalize_ruling` / `validate_ruling`, a submit→moderate→appeal flow, and a monkeypatched
**removed → overturned-on-appeal** run (counter decremented). **On-chain smoke-tested:** `submit` write +
`get_case` read verified live on Bradbury.

## Deploy

```bash
genlayer deploy --contract contracts/policy_moderate.py
```
