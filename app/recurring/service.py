from __future__ import annotations

import os
from datetime import date as DateType

import httpx
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth_context import RequestUser
from app.recurring import models, schemas


def _clean_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _require_name(value: str | None, field_name: str) -> str:
    cleaned = (value or "").strip()
    if not cleaned:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{field_name} is required")
    return cleaned


def _service_url(env_key: str, default: str) -> str:
    return os.getenv(env_key, default).rstrip("/")


FINANCE_API_BASE = f"{_service_url('FINANCE_SERVICE_URL', 'http://finance:8000')}/api/v1/finance"


def _require_authorization(authorization: str | None) -> dict[str, str]:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header",
        )
    return {"Authorization": authorization}


def _service_error_detail(response: httpx.Response) -> str:
    try:
        payload = response.json()
        if isinstance(payload, dict) and payload.get("detail"):
            return str(payload["detail"])
    except Exception:
        pass
    return response.text.strip() or "Service request failed"


def _create_finance_expense_transaction(
    *,
    description: str,
    amount: float,
    authorization: str | None,
) -> None:
    headers = _require_authorization(authorization)
    payload = {
        "description": description,
        "amount": float(amount),
        "transaction_type": "expense",
        "date": DateType.today().isoformat(),
        "tag_ids": [],
    }
    with httpx.Client(timeout=15.0) as client:
        response = client.post(
            f"{FINANCE_API_BASE}/transactions",
            json=payload,
            headers=headers,
        )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=response.status_code,
            detail=f"Finance service error: {_service_error_detail(response)}",
        )


def create_subscription(
    db: Session,
    current_user: RequestUser,
    payload: schemas.SubscriptionCreate,
) -> models.Subscription:
    name = _require_name(payload.name, "Subscription name")
    exists = (
        db.query(models.Subscription)
        .filter(models.Subscription.user_id == current_user.id, models.Subscription.name == name)
        .first()
    )
    if exists:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Subscription already exists")
    db_item = models.Subscription(
        user_id=current_user.id,
        name=name,
        amount=payload.amount,
        start_date=payload.start_date,
        frequency=payload.frequency,
        is_active=payload.is_active,
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


def list_subscriptions(db: Session, current_user: RequestUser) -> list[models.Subscription]:
    return db.query(models.Subscription).filter(models.Subscription.user_id == current_user.id).all()


def update_subscription(
    db: Session,
    current_user: RequestUser,
    item_id: int,
    payload: schemas.SubscriptionUpdate,
) -> models.Subscription:
    db_item = (
        db.query(models.Subscription)
        .filter(models.Subscription.id == item_id, models.Subscription.user_id == current_user.id)
        .first()
    )
    if not db_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")

    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No subscription changes provided")
    if "name" in data and isinstance(data["name"], str):
        data["name"] = _require_name(data["name"], "Subscription name")
        exists = (
            db.query(models.Subscription)
            .filter(
                models.Subscription.user_id == current_user.id,
                models.Subscription.name == data["name"],
                models.Subscription.id != item_id,
            )
            .first()
        )
        if exists:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Subscription already exists")

    for key, value in data.items():
        setattr(db_item, key, value)

    db.commit()
    db.refresh(db_item)
    return db_item


def delete_subscription(db: Session, current_user: RequestUser, item_id: int) -> None:
    db_item = (
        db.query(models.Subscription)
        .filter(models.Subscription.id == item_id, models.Subscription.user_id == current_user.id)
        .first()
    )
    if not db_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")
    db.delete(db_item)
    db.commit()


def create_debt(db: Session, current_user: RequestUser, payload: schemas.DebtCreate) -> models.Debt:
    db_item = models.Debt(
        user_id=current_user.id,
        name=_require_name(payload.name, "Debt name"),
        amount=payload.amount,
        due_date=payload.due_date,
        frequency=payload.frequency,
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


def list_debts(db: Session, current_user: RequestUser) -> list[models.Debt]:
    return db.query(models.Debt).filter(models.Debt.user_id == current_user.id).all()


def update_debt(
    db: Session,
    current_user: RequestUser,
    item_id: int,
    payload: schemas.DebtUpdate,
) -> models.Debt:
    db_item = (
        db.query(models.Debt)
        .filter(models.Debt.id == item_id, models.Debt.user_id == current_user.id)
        .first()
    )
    if not db_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Debt not found")

    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No debt changes provided")
    if "name" in data and isinstance(data["name"], str):
        data["name"] = _require_name(data["name"], "Debt name")

    for key, value in data.items():
        setattr(db_item, key, value)

    db.commit()
    db.refresh(db_item)
    return db_item


def delete_debt(db: Session, current_user: RequestUser, item_id: int) -> None:
    db_item = (
        db.query(models.Debt)
        .filter(models.Debt.id == item_id, models.Debt.user_id == current_user.id)
        .first()
    )
    if not db_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Debt not found")
    db.delete(db_item)
    db.commit()


def create_reminder(
    db: Session,
    current_user: RequestUser,
    payload: schemas.ReminderCreate,
) -> models.Reminder:
    db_item = models.Reminder(
        user_id=current_user.id,
        label=_require_name(payload.label, "Reminder label"),
        remind_date=payload.remind_date,
        channel=payload.channel,
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


def list_reminders(db: Session, current_user: RequestUser) -> list[models.Reminder]:
    return db.query(models.Reminder).filter(models.Reminder.user_id == current_user.id).all()


def update_reminder(
    db: Session,
    current_user: RequestUser,
    item_id: int,
    payload: schemas.ReminderUpdate,
) -> models.Reminder:
    db_item = (
        db.query(models.Reminder)
        .filter(models.Reminder.id == item_id, models.Reminder.user_id == current_user.id)
        .first()
    )
    if not db_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found")

    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No reminder changes provided")
    if "label" in data and isinstance(data["label"], str):
        data["label"] = _require_name(data["label"], "Reminder label")

    for key, value in data.items():
        setattr(db_item, key, value)

    db.commit()
    db.refresh(db_item)
    return db_item


def delete_reminder(db: Session, current_user: RequestUser, item_id: int) -> None:
    db_item = (
        db.query(models.Reminder)
        .filter(models.Reminder.id == item_id, models.Reminder.user_id == current_user.id)
        .first()
    )
    if not db_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found")
    db.delete(db_item)
    db.commit()


def pay_subscription(
    db: Session,
    current_user: RequestUser,
    item_id: int,
    *,
    authorization: str | None,
) -> None:
    db_item = (
        db.query(models.Subscription)
        .filter(models.Subscription.id == item_id, models.Subscription.user_id == current_user.id)
        .first()
    )
    if not db_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")

    _create_finance_expense_transaction(
        description=f"Thanh toan dinh ky: {db_item.name}",
        amount=db_item.amount,
        authorization=authorization,
    )


def pay_debt(
    db: Session,
    current_user: RequestUser,
    item_id: int,
    *,
    authorization: str | None,
) -> None:
    db_item = (
        db.query(models.Debt)
        .filter(models.Debt.id == item_id, models.Debt.user_id == current_user.id)
        .first()
    )
    if not db_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Debt not found")

    _create_finance_expense_transaction(
        description=f"Tra no: {db_item.name}",
        amount=db_item.amount,
        authorization=authorization,
    )
