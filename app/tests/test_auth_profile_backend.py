from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.auth import schemas, service
from app.auth.models import User
from app.auth.security import hash_password, verify_password
from app.database import Base


def make_session():
    engine = create_engine("sqlite:///:memory:", future=True)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    return Session()


def make_user(**overrides):
    payload = {
        "email": "ada@example.com",
        "username": "ada",
        "first_name": "Ada",
        "last_name": "Lovelace",
        "phone": "0901234567",
        "hashed_password": hash_password("Oldpass123!"),
        "email_verified": True,
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
    }
    payload.update(overrides)
    return User(**payload)


def test_update_profile_persists_identity_and_preferences():
    db = make_session()
    user = make_user()
    db.add(user)
    db.commit()
    db.refresh(user)

    updated = service.update_profile(
        db,
        user,
        schemas.UserUpdate(
            full_name="Ada Byron",
            username="ada_byron",
            phone="+84 901 222 333",
            push_notifications=False,
            language_preference="en",
            theme_preference="dark",
            layout_preference="airy",
            brand_color="#6d5bd0",
        ),
    )

    assert updated.first_name == "Ada"
    assert updated.last_name == "Byron"
    assert updated.username == "ada_byron"
    assert updated.phone == "84901222333"
    assert updated.push_notifications is False
    assert updated.language_preference == "en"
    assert updated.theme_preference == "dark"
    assert updated.layout_preference == "airy"
    assert updated.brand_color == "#6d5bd0"


def test_change_password_updates_hash_and_blocks_same_password():
    db = make_session()
    user = make_user()
    db.add(user)
    db.commit()
    db.refresh(user)

    service.change_password(
        db,
        user,
        schemas.ChangePasswordRequest(current_password="Oldpass123!", new_password="Newpass456!"),
    )
    assert verify_password("Newpass456!", user.hashed_password) is True

    try:
        service.change_password(
            db,
            user,
            schemas.ChangePasswordRequest(current_password="Newpass456!", new_password="Newpass456!"),
        )
        raise AssertionError("Expected HTTPException")
    except HTTPException as exc:
        assert exc.status_code == 400
        assert exc.detail == "New password must be different"
