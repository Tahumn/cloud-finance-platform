from datetime import date

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.auth_context import RequestUser
from app.database import Base
from app.planning import models as planning_models, schemas as planning_schemas, service as planning_service
from app.recurring import models as recurring_models, schemas as recurring_schemas, service as recurring_service


def make_session():
    engine = create_engine("sqlite:///:memory:", future=True)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    return Session()


def test_planning_goal_rejects_blank_name():
    db = make_session()
    user = RequestUser(id=1, email="user@example.com")

    with pytest.raises(HTTPException) as exc:
        planning_service.create_goal(
            db,
            user,
            planning_schemas.GoalCreate(name="   ", target_amount=5_000_000),
        )

    assert exc.value.status_code == 400
    assert exc.value.detail == "Goal name is required"


def test_planning_budget_update_requires_changes():
    db = make_session()
    user = RequestUser(id=1, email="user@example.com")
    item = planning_models.Budget(user_id=1, name="Budget A", amount=1_000_000, status="active")
    db.add(item)
    db.commit()
    db.refresh(item)

    with pytest.raises(HTTPException) as exc:
        planning_service.update_budget(db, user, item.id, planning_schemas.BudgetUpdate())

    assert exc.value.status_code == 400
    assert exc.value.detail == "No budget changes provided"


def test_recurring_subscription_rejects_duplicate_name():
    db = make_session()
    user = RequestUser(id=1, email="user@example.com")

    recurring_service.create_subscription(
        db,
        user,
        recurring_schemas.SubscriptionCreate(name="Netflix", amount=199000, start_date=date(2026, 7, 30)),
    )

    with pytest.raises(HTTPException) as exc:
        recurring_service.create_subscription(
            db,
            user,
            recurring_schemas.SubscriptionCreate(name="  Netflix  ", amount=199000, start_date=date(2026, 7, 30)),
        )

    assert exc.value.status_code == 400
    assert exc.value.detail == "Subscription already exists"


def test_recurring_debt_update_requires_changes():
    db = make_session()
    user = RequestUser(id=1, email="user@example.com")
    item = recurring_models.Debt(user_id=1, name="Friend loan", amount=1_500_000, due_date=date(2026, 8, 15), frequency="one_time")
    db.add(item)
    db.commit()
    db.refresh(item)

    with pytest.raises(HTTPException) as exc:
        recurring_service.update_debt(db, user, item.id, recurring_schemas.DebtUpdate())

    assert exc.value.status_code == 400
    assert exc.value.detail == "No debt changes provided"


def test_recurring_reminder_rejects_blank_label_on_update():
    db = make_session()
    user = RequestUser(id=1, email="user@example.com")
    item = recurring_models.Reminder(user_id=1, label="Pay rent", remind_date=date(2026, 8, 1), channel="email")
    db.add(item)
    db.commit()
    db.refresh(item)

    with pytest.raises(HTTPException) as exc:
        recurring_service.update_reminder(
            db,
            user,
            item.id,
            recurring_schemas.ReminderUpdate(label="   "),
        )

    assert exc.value.status_code == 400
    assert exc.value.detail == "Reminder label is required"
