from datetime import date
import sys
import types

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

kafka_stub = types.ModuleType("app.core.kafka")
kafka_stub.producer_manager = types.SimpleNamespace(sync_send=lambda *args, **kwargs: None)
sys.modules.setdefault("app.core.kafka", kafka_stub)

from app.core.auth_context import RequestUser
from app.database import Base
from app.finance import models, schemas, service


def make_session():
    engine = create_engine("sqlite:///:memory:", future=True)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    return Session()


def mute_side_effects(monkeypatch):
    monkeypatch.setattr(service, "emit_finance_update", lambda *args, **kwargs: None)
    monkeypatch.setattr(service.producer_manager, "sync_send", lambda *args, **kwargs: None)


def test_delete_category_cleans_related_budget_transaction_and_bill(monkeypatch):
    mute_side_effects(monkeypatch)
    db = make_session()
    user = RequestUser(id=1, email="user@example.com")

    category = models.Category(user_id=1, name="Food")
    account = models.Account(user_id=1, name="Wallet", type="cash", opening_balance=0)
    db.add_all([category, account])
    db.commit()
    db.refresh(category)
    db.refresh(account)

    tx = models.Transaction(
        user_id=1,
        category_id=category.id,
        account_id=account.id,
        description="Lunch",
        amount=50_000,
        transaction_type="expense",
        date=date(2026, 7, 30),
    )
    budget = models.Budget(user_id=1, category_id=category.id, amount=500_000)
    bill = models.Bill(user_id=1, category_id=category.id, account_id=account.id, merchant="Store", total_amount=50_000, status="pending")
    db.add_all([tx, budget, bill])
    db.commit()
    tx_id = tx.id
    bill_id = bill.id
    budget_id = budget.id
    category_id = category.id

    service.delete_category(db, user, category_id)

    kept_tx = db.query(models.Transaction).filter_by(id=tx_id).first()
    kept_bill = db.query(models.Bill).filter_by(id=bill_id).first()
    removed_budget = db.query(models.Budget).filter_by(id=budget_id).first()
    removed_category = db.query(models.Category).filter_by(id=category_id).first()

    assert removed_category is None
    assert removed_budget is None
    assert kept_tx is not None and kept_tx.category_id is None
    assert kept_bill is not None and kept_bill.category_id is None


def test_delete_account_cleans_related_transaction_bill_and_history(monkeypatch):
    mute_side_effects(monkeypatch)
    db = make_session()
    user = RequestUser(id=1, email="user@example.com")

    account = models.Account(user_id=1, name="Bank", type="bank", opening_balance=1_000_000)
    db.add(account)
    db.commit()
    db.refresh(account)

    tx = models.Transaction(
        user_id=1,
        account_id=account.id,
        description="Salary",
        amount=15_000_000,
        transaction_type="income",
        date=date(2026, 7, 30),
    )
    bill = models.Bill(user_id=1, account_id=account.id, merchant="Power", total_amount=300_000, status="pending")
    history = models.AccountUpdateHistory(
        user_id=1,
        account_id=account.id,
        action="update",
        item_name="Bank",
        change_amount=100_000,
        performer="user@example.com",
    )
    db.add_all([tx, bill, history])
    db.commit()
    tx_id = tx.id
    bill_id = bill.id
    history_id = history.id
    account_id = account.id

    service.delete_account(db, user, account_id)

    kept_tx = db.query(models.Transaction).filter_by(id=tx_id).first()
    kept_bill = db.query(models.Bill).filter_by(id=bill_id).first()
    kept_history = db.query(models.AccountUpdateHistory).filter_by(id=history_id).first()
    removed_account = db.query(models.Account).filter_by(id=account_id).first()

    assert removed_account is None
    assert kept_history is None
    assert kept_tx is not None and kept_tx.account_id is None
    assert kept_bill is not None and kept_bill.account_id is None


def test_delete_tag_clears_transaction_relations(monkeypatch):
    mute_side_effects(monkeypatch)
    db = make_session()
    user = RequestUser(id=1, email="user@example.com")

    tag = models.Tag(user_id=1, name="Work", color="#111111")
    tx = models.Transaction(
        user_id=1,
        description="Meeting coffee",
        amount=45_000,
        transaction_type="expense",
        date=date(2026, 7, 30),
    )
    tx.tags = [tag]
    db.add_all([tag, tx])
    db.commit()

    service.delete_tag(db, user, tag.id)

    kept_tx = db.query(models.Transaction).filter_by(id=tx.id).first()
    removed_tag = db.query(models.Tag).filter_by(id=tag.id).first()

    assert removed_tag is None
    assert kept_tx is not None
    assert kept_tx.tags == []


def test_update_budget_can_change_category_and_amount(monkeypatch):
    mute_side_effects(monkeypatch)
    db = make_session()
    user = RequestUser(id=1, email="user@example.com")

    old_category = models.Category(user_id=1, name="Food")
    new_category = models.Category(user_id=1, name="Travel")
    db.add_all([old_category, new_category])
    db.commit()
    db.refresh(old_category)
    db.refresh(new_category)

    budget = models.Budget(user_id=1, category_id=old_category.id, amount=500_000)
    db.add(budget)
    db.commit()
    db.refresh(budget)

    updated = service.update_budget(
        db,
        user,
        budget.id,
        schemas.BudgetUpdate(category_id=new_category.id, amount=900_000),
    )

    assert updated.category_id == new_category.id
    assert updated.amount == 900_000
    assert updated.category == "Travel"


def test_delete_savings_goal_removes_contributions(monkeypatch):
    mute_side_effects(monkeypatch)
    db = make_session()
    user = RequestUser(id=1, email="user@example.com")

    goal = models.SavingsGoal(user_id=1, name="Laptop", target_amount=30_000_000, saved_amount=5_000_000)
    db.add(goal)
    db.commit()
    db.refresh(goal)

    contribution = models.SavingsContribution(
        user_id=1,
        goal_id=goal.id,
        amount=1_000_000,
        date=date(2026, 7, 30),
        description="Monthly save",
    )
    db.add(contribution)
    db.commit()
    goal_id = goal.id
    contribution_id = contribution.id

    service.delete_savings_goal(db, user, goal_id)

    removed_goal = db.query(models.SavingsGoal).filter_by(id=goal_id).first()
    removed_contribution = db.query(models.SavingsContribution).filter_by(id=contribution_id).first()

    assert removed_goal is None
    assert removed_contribution is None
