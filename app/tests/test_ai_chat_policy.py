import json
from types import SimpleNamespace

from app.ai_agent import microservice_service as service


def test_create_transaction_executes_immediately(monkeypatch):
    transactions = [{"amount": 15_000_000, "transaction_type": "income", "description": "Nhan luong"}]

    monkeypatch.setattr(service, "_store_transaction_proposal", lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("should not ask confirmation")))
    monkeypatch.setattr(service, "_execute_create_transactions", lambda items, authorization: {"intent": "create_transaction", "total": sum(float(item["amount"]) for item in items)})

    result = service._create_transaction_response(None, None, "toi vua lanh luong 15 trieu", transactions, "Bearer token")

    assert result["intent"] == "create_transaction"
    assert result["total"] == 15_000_000


def test_create_transaction_missing_amount_keeps_ask_amount(monkeypatch):
    transactions = [{"amount": None, "transaction_type": "expense", "description": "An trua"}]

    monkeypatch.setattr(service, "_store_transaction_proposal", lambda *args, **kwargs: {"intent": "ask_amount", "requires_confirmation": False})
    monkeypatch.setattr(service, "_execute_create_transactions", lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("should not create without amount")))

    result = service._create_transaction_response(None, None, "an trua", transactions, "Bearer token")

    assert result["intent"] == "ask_amount"
    assert result["requires_confirmation"] is False


def test_pending_complete_create_transaction_does_not_block_other_chat(monkeypatch):
    cleared = []
    pending = SimpleNamespace(
        id=7,
        action_type="create_transaction",
        payload=json.dumps({"transactions": [{"amount": 15_000_000, "description": "Nhan luong"}], "missing_amount_indexes": []}),
    )

    monkeypatch.setattr(service, "_get_pending_action", lambda db, user: pending)
    monkeypatch.setattr(service, "_clear_pending_action", lambda db, item: cleared.append(item.id))

    result = service._handle_pending_action(None, SimpleNamespace(id=1), "hello", "Bearer token")

    assert result is None
    assert cleared == [7]


def test_pending_missing_amount_is_cleared_for_greeting(monkeypatch):
    cleared = []
    pending = SimpleNamespace(
        id=9,
        action_type="create_transaction",
        payload=json.dumps({"transactions": [{"amount": None, "description": "An trua"}], "missing_amount_indexes": [0]}),
    )

    monkeypatch.setattr(service, "_get_pending_action", lambda db, user: pending)
    monkeypatch.setattr(service, "_clear_pending_action", lambda db, item: cleared.append(item.id))

    result = service._handle_pending_action(None, SimpleNamespace(id=1), "hi", "Bearer token")

    assert result is None
    assert cleared == [9]


def test_execute_pending_update_uses_transaction_id(monkeypatch):
    calls = []
    pending = SimpleNamespace(
        action_type="update_transaction",
        payload=json.dumps({"transaction_id": 42, "update": {"amount": 123000}}),
    )

    def fake_request(method, path, authorization, payload=None, service=None, params=None):
        calls.append((method, path, payload))
        return {"amount": 123000}

    monkeypatch.setattr(service, "_request_json", fake_request)

    result = service._execute_pending_action(None, pending, "Bearer token")

    assert calls == [("PUT", "/transactions/42", {"amount": 123000})]
    assert result["intent"] == "update_transaction"
    assert result["total"] == 123000


def test_pending_missing_amount_executes_immediately_after_amount_reply(monkeypatch):
    cleared = []
    pending = SimpleNamespace(
        id=11,
        action_type="create_transaction",
        payload=json.dumps({"transactions": [{"amount": None, "transaction_type": "income", "description": "Nhan luong"}], "missing_amount_indexes": [0]}),
    )

    monkeypatch.setattr(service, "_get_pending_action", lambda db, user: pending)
    monkeypatch.setattr(service, "_clear_pending_action", lambda db, item: cleared.append(item.id))
    monkeypatch.setattr(
        service,
        "parse_transaction_text",
        lambda *args, **kwargs: {"amount": 15_000_000, "date": None, "category_name": "Luong", "category_id": None},
    )
    monkeypatch.setattr(
        service,
        "_execute_create_transactions",
        lambda items, authorization: {"intent": "create_transaction", "total": sum(float(item["amount"]) for item in items)},
    )

    result = service._handle_pending_action(None, SimpleNamespace(id=1), "15 trieu", "Bearer token")

    assert result["intent"] == "create_transaction"
    assert result["total"] == 15_000_000
    assert cleared == [11]


def test_non_transaction_chat_does_not_fall_into_ask_amount(monkeypatch):
    monkeypatch.setattr(service, "_handle_pending_action", lambda *args, **kwargs: None)
    monkeypatch.setattr(service, "_persist_chat_messages", lambda *args, **kwargs: None)
    monkeypatch.setattr(
        service,
        "parse_transaction_text",
        lambda *args, **kwargs: {
            "description": "thoi tiet hom nay",
            "amount": None,
            "transaction_type": "expense",
            "category_id": None,
            "category_name": None,
            "date": None,
            "warnings": ["amount_not_found"],
            "confidence": 0.4,
            "intent": "create_transaction",
            "period": None,
            "frequency": None,
            "is_multiple": False,
        },
    )
    monkeypatch.setattr(service, "_answer_general_question", lambda text: {"answer": f"general:{text}", "intent": "general_question"})

    result = service.answer_chat(None, SimpleNamespace(id=1), "thoi tiet hom nay", "Bearer token")

    assert result["intent"] == "general_question"
    assert result["answer"] == "general:thoi tiet hom nay"


def test_milk_tea_is_not_treated_as_update_request():
    assert service._is_update_request("uống trà sữa hết 50k") is False
    assert service._is_update_request("sửa giao dịch cà phê thành 60k") is True


def test_vietnamese_and_splits_transactions():
    text = "tôi vừa uống cà phê 50k, được mẹ cho 100k và uống trà sữa hết 50k"
    assert service._split_transaction_segments(text) == [
        "tôi vừa uống cà phê 50k",
        "được mẹ cho 100k",
        "uống trà sữa hết 50k",
    ]


def test_multiple_transactions_execute_without_confirmation(monkeypatch):
    created = []
    parsed_by_text = {
        "tôi vừa uống cà phê 50k": {"amount": 50_000, "transaction_type": "expense", "category_name": "Ăn uống", "description": "Cà phê"},
        "được mẹ cho 100k": {"amount": 100_000, "transaction_type": "income", "category_name": "Thu nhập khác", "description": "Mẹ cho"},
        "uống trà sữa hết 50k": {"amount": 50_000, "transaction_type": "expense", "category_name": "Ăn uống", "description": "Trà sữa"},
    }
    monkeypatch.setattr(service, "_handle_pending_action", lambda *args, **kwargs: None)
    monkeypatch.setattr(service, "_persist_chat_messages", lambda *args, **kwargs: None)
    monkeypatch.setattr(service, "parse_transaction_text", lambda db, user, text, **kwargs: parsed_by_text[text])

    def fake_create(parsed, **kwargs):
        created.append(parsed)
        return parsed.copy()

    monkeypatch.setattr(service, "create_transaction_from_parsed", fake_create)
    result = service.answer_chat(None, SimpleNamespace(id=1), "tôi vừa uống cà phê 50k, được mẹ cho 100k và uống trà sữa hết 50k", "Bearer token")

    assert result["intent"] == "create_transaction"
    assert result["total"] == 0
    assert [item["transaction_type"] for item in created] == ["expense", "income", "expense"]
    assert "requires_confirmation" not in result


def test_new_transaction_clears_pending_update(monkeypatch):
    cleared = []
    pending = SimpleNamespace(
        id=15,
        action_type="update_transaction",
        payload=json.dumps({"transaction_id": 42, "update": {"amount": 200_000}}),
    )
    monkeypatch.setattr(service, "_get_pending_action", lambda db, user: pending)
    monkeypatch.setattr(service, "_clear_pending_action", lambda db, item: cleared.append(item.id))

    result = service._handle_pending_action(
        None,
        SimpleNamespace(id=1),
        "tôi vừa uống cà phê 50k, được mẹ cho 100k và uống trà sữa hết 50k",
        "Bearer token",
    )

    assert result is None
    assert cleared == [15]


def test_confirmation_still_executes_pending_update(monkeypatch):
    cleared = []
    pending = SimpleNamespace(id=16, action_type="update_transaction", payload="{}")
    monkeypatch.setattr(service, "_get_pending_action", lambda db, user: pending)
    monkeypatch.setattr(service, "_clear_pending_action", lambda db, item: cleared.append(item.id))
    monkeypatch.setattr(service, "_execute_pending_action", lambda db, item, authorization: {"intent": "update_transaction"})

    result = service._handle_pending_action(None, SimpleNamespace(id=1), "xác nhận", "Bearer token")

    assert result["intent"] == "update_transaction"
    assert cleared == [16]


def test_pending_update_is_replaced_by_new_transaction_message(monkeypatch):
    cleared = []
    pending = SimpleNamespace(
        id=21,
        action_type="update_transaction",
        payload=json.dumps({"transaction_id": 42, "update": {"amount": 200_000}}),
    )
    monkeypatch.setattr(service, "_get_pending_action", lambda db, user: pending)
    monkeypatch.setattr(service, "_clear_pending_action", lambda db, item: cleared.append(item.id))

    result = service._handle_pending_action(
        None,
        SimpleNamespace(id=1),
        "tôi vừa uống cà phê 50k, được mẹ cho 100k và uống trà sữa hết 50k",
        "Bearer token",
    )

    assert result is None
    assert cleared == [21]


def test_create_budget_executes_without_confirmation(monkeypatch):
    calls = []
    monkeypatch.setattr(service, "_resolve_category", lambda *args, **kwargs: (7, "Mua sắm"))
    monkeypatch.setattr(service, "_save_pending_action", lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("create must not save pending action")))

    def fake_request(method, path, authorization, payload=None, service=None, params=None):
        calls.append((method, path, payload, service))
        return {"id": 1}

    monkeypatch.setattr(service, "_request_json", fake_request)
    result = service._store_resource_proposal(
        None,
        None,
        "create_budget",
        {"amount": 7_000_000, "description": "ngân sách mua sắm", "category_name": "Mua sắm", "period": "monthly"},
        "Bearer token",
    )

    assert calls == [("POST", "/budgets", {"category_id": 7, "amount": 7_000_000.0}, "finance")]
    assert result["intent"] == "create_budget"
    assert result["requires_confirmation"] is False
    assert result["pending_action_id"] is None
