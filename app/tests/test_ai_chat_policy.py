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
