"""PolicyModerate tests: ruling guards + submit→moderate→appeal flow incl. an overturned removal."""


def test_normalize_ruling(contract):
    n = contract.normalize_ruling
    assert n({"decision": "removed", "clause": "3.1", "reason": "hate speech"})["decision"] == "removed"
    assert n({"decision": "REMOVED", "clause": "", "reason": "x"})["decision"] == "removed"
    assert n({})["decision"] == "allowed"          # conservative default
    assert n("garbage")["reason"] == "no reason"

def test_validate_ruling(contract):
    v = contract.validate_ruling
    assert v({"decision": "allowed", "clause": "", "reason": "fine"})
    assert not v({"decision": "ban", "reason": "x"})       # bad enum
    assert not v({"decision": "removed", "reason": "  "})   # empty reason


def _new(contract):
    return contract, contract.PolicyModerate()

def test_submit_moderate_appeal_flow(contract):
    mod, c = _new(contract)
    cid = c.submit("Buy cheap followers now!!!", "No spam or solicitation.")
    out = c.moderate(cid)
    assert out["decision"] == "allowed"     # offline default
    case = c.get_case(cid)
    assert case["state"] == "moderated"
    ap = c.appeal(cid)
    assert ap["appealed"] is True
    # appeal can't be used twice
    try:
        c.appeal(cid); assert False, "second appeal should fail"
    except Exception:
        pass
    assert c.stats()["total_cases"] == 1

def test_removal_then_overturn_on_appeal(contract):
    mod, c = _new(contract)
    cid = c.submit("borderline content", "Some policy.")
    # validators rule REMOVED
    mod.gl.nondet.exec_prompt = staticmethod(lambda *a, **k: {"decision": "removed", "clause": "2.a", "reason": "violation"})
    c.moderate(cid)
    assert c.get_case(cid)["decision"] == "removed"
    assert c.stats()["removed"] == 1
    # on appeal, validators rule ALLOWED -> removal overturned, counter decremented
    mod.gl.nondet.exec_prompt = staticmethod(lambda *a, **k: {"decision": "allowed", "clause": "", "reason": "fine on review"})
    c.appeal(cid)
    assert c.get_case(cid)["decision"] == "allowed"
    assert c.stats()["removed"] == 0
    mod.gl.nondet.exec_prompt = staticmethod(lambda *a, **k: {})
