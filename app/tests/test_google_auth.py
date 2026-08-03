from app.auth import schemas, service
from app.auth.models import User
from app.auth.security import hash_password


class DummyQuery:
    def __init__(self, rows):
        self.rows = rows

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self.rows[0] if self.rows else None


class DummySession:
    def __init__(self, users):
        self.users = list(users)
        self.added = []

    def query(self, model):
        if model is User:
            return DummyQuery([user for user in self.users if isinstance(user, User)])
        raise AssertionError(f"Unexpected model {model}")

    def add(self, obj):
        self.added.append(obj)
        self.users.append(obj)

    def commit(self):
        return None

    def refresh(self, obj):
        return None


def test_google_auth_creates_user_for_new_email(monkeypatch):
    session = DummySession([])

    monkeypatch.setattr(
        service,
        "_verify_google_id_token",
        lambda credential: {
            "email": "ada@example.com",
            "given_name": "Ada",
            "family_name": "Lovelace",
            "sub": "google-123",
        },
    )

    token = service.authenticate_google_user(session, schemas.GoogleAuthRequest(credential="token"))

    assert token.access_token
    created_user = next(user for user in session.added if user.email == "ada@example.com")
    assert created_user.onboarding_completed in (False, None)


def test_google_auth_links_existing_email_account(monkeypatch):
    existing = User(
        email="ada@example.com",
        username="ada",
        hashed_password=hash_password("dummy"),
        email_verified=True,
        is_active=True,
        onboarding_completed=True,
    )
    session = DummySession([existing])

    monkeypatch.setattr(
        service,
        "_verify_google_id_token",
        lambda credential: {
            "email": "ada@example.com",
            "given_name": "Ada",
            "family_name": "Lovelace",
            "sub": "google-123",
        },
    )

    token = service.authenticate_google_user(session, schemas.GoogleAuthRequest(credential="token"))

    assert token.access_token
    assert session.added == []
    assert existing.onboarding_completed is True
