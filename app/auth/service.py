from datetime import datetime, timedelta, timezone
import hashlib
import re
import secrets

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.auth import schemas
from app.auth.email import send_otp_email
from app.auth.models import EmailOTP, User
from app.auth.security import create_access_token, decode_token, hash_password, verify_password
from app.database import get_db
from app.core.config import settings
from jose import jwt

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def _hash_otp(code_salt: str, code: str) -> str:
    return hashlib.sha256(f"{code_salt}:{code}".encode("utf-8")).hexdigest()

def _split_full_name(full_name: str) -> tuple[str, str]:
    parts = full_name.strip().split()
    if len(parts) <= 1:
        return full_name.strip(), ""
    return " ".join(parts[:-1]), parts[-1]

def _normalize_phone(phone: str | None) -> str | None:
    if not phone:
        return None
    phone = phone.strip()
    phone = phone.replace(" ", "").replace("-", "")
    if phone.startswith("+"):
        phone = phone[1:]
    return phone or None


def _build_unique_username(db: Session, email: str, first_name: str | None, last_name: str | None) -> str:
    base = (email.split("@", 1)[0] or "user").replace(".", "_").replace("-", "_")
    base = re.sub(r"[^a-zA-Z0-9_]", "", base) or "user"
    if first_name and last_name:
        base = f"{first_name[:12]}_{last_name[:12]}".lower().replace(" ", "_")
    candidate = base.lower()
    suffix = 1
    while db.query(User).filter(User.username == candidate).first():
        candidate = f"{base.lower()}_{suffix}"
        suffix += 1
    return candidate


def _verify_google_id_token(credential: str) -> dict:
    try:
        response = httpx.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": credential},
            timeout=10,
        )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to verify Google sign-in token",
        ) from exc

    payload = response.json()
    if payload.get("error"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google sign-in token")
    if not payload.get("email_verified"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google email is not verified")

    expected_aud = (settings.google_client_id or "").strip()
    aud = payload.get("aud")
    if expected_aud and aud and aud != expected_aud:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google client mismatch")
    return payload


def _validate_password_strength(password: str) -> None:
    if len(password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password is too short")
    if not any(ch.isalpha() for ch in password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must include letters")
    if not any(ch.isdigit() or not ch.isalnum() for ch in password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must include a number or special character",
        )

VALID_LANGUAGE_PREFERENCES = {"vi", "en"}
VALID_THEME_PREFERENCES = {"light", "dark", "system"}
VALID_LAYOUT_PREFERENCES = {"classic", "airy", "compact", "editorial"}


def _validate_preference_value(value: str, *, allowed: set[str], field_label: str) -> str:
    normalized = (value or "").strip().lower()
    if normalized not in allowed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid {field_label}")
    return normalized

def _create_and_send_email_otp(db: Session, db_user: User) -> str | None:
    code = f"{secrets.randbelow(1_000_000):06d}"
    salt = secrets.token_hex(16)

    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.otp_expire_minutes)
    otp = EmailOTP(
        user_id=db_user.id,
        code_salt=salt,
        code_hash=_hash_otp(salt, code),
        expires_at=expires_at,
        consumed_at=None,
    )
    db.add(otp)
    db.commit()

    try:
        send_otp_email(to_email=db_user.email, code=code)
    except RuntimeError as exc:
        # Allow local testing without SMTP configured.
        if settings.dev_return_otp:
            return code
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    return code if settings.dev_return_otp else None


def start_register(db: Session, user: schemas.RegisterStartRequest) -> str | None:
    full_name = user.full_name.strip()
    if not full_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Full name is required")

    username = user.username.strip()
    if not username:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username is required")

    phone = _normalize_phone(user.phone)

    existing_username = (
        db.query(User).filter(User.username == username).first()
    )

    exists = db.query(User).filter(User.email == user.email).first()
    if exists:
        # If not yet verified, allow updating profile + resend OTP.
        if exists.email_verified:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists")

        if existing_username and existing_username.id != exists.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already exists")

        first_name, last_name = _split_full_name(full_name)
        exists.first_name = first_name
        exists.last_name = last_name
        exists.phone = phone
        exists.username = username
        # No password yet; prevent login until set_password marks the account active.
        exists.hashed_password = hash_password(secrets.token_urlsafe(24))
        exists.is_active = False
        db.commit()
        return _create_and_send_email_otp(db, exists)

    if existing_username:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already exists")

    first_name, last_name = _split_full_name(full_name)
    db_user = User(
        email=user.email,
        username=username,
        first_name=first_name,
        last_name=last_name,
        phone=phone,
        hashed_password=hash_password(secrets.token_urlsafe(24)),
        email_verified=False,
        is_active=False,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    return _create_and_send_email_otp(db, db_user)


def authenticate_user(db: Session, user: schemas.UserLogin) -> schemas.Token:
    identifier = user.identifier.strip()
    db_user = db.query(User).filter(
        or_(User.email == identifier, User.username == identifier)
    ).first()
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not db_user.email_verified or not db_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email is not verified",
        )

    token = create_access_token(
        subject=str(db_user.id),
        email=db_user.email,
        is_active=bool(db_user.is_active),
    )
    return schemas.Token(access_token=token)


def authenticate_google_user(db: Session, user: schemas.GoogleAuthRequest) -> schemas.Token:
    profile = _verify_google_id_token(user.credential)
    email = (profile.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google account email is required")

    db_user = db.query(User).filter(User.email == email).first()
    if db_user is None:
        username = _build_unique_username(
            db,
            email,
            profile.get("given_name"),
            profile.get("family_name"),
        )
        db_user = User(
            email=email,
            username=username,
            first_name=profile.get("given_name"),
            last_name=profile.get("family_name"),
            hashed_password=hash_password(secrets.token_urlsafe(24)),
            email_verified=True,
            is_active=True,
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
    else:
        db_user.first_name = db_user.first_name or profile.get("given_name")
        db_user.last_name = db_user.last_name or profile.get("family_name")
        db_user.email_verified = True
        db_user.is_active = True
        if not db_user.username:
            db_user.username = _build_unique_username(
                db,
                email,
                db_user.first_name,
                db_user.last_name,
            )
        if not db_user.hashed_password:
            db_user.hashed_password = hash_password(secrets.token_urlsafe(24))
        db.commit()

    token = create_access_token(
        subject=str(db_user.id),
        email=db_user.email,
        is_active=bool(db_user.is_active),
    )
    return schemas.Token(access_token=token)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )

    subject = payload.get("sub")
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )

    try:
        user_id = int(subject)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        ) from None

    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return db_user


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user"
        )
    return current_user


def _create_action_token(*, user_id: int, email: str, purpose: str, minutes: int = 15) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    to_encode = {
        "sub": str(user_id),
        "email": email,
        "purpose": purpose,
        "exp": exp,
    }
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def _decode_action_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except Exception:
        return {}

def _find_matching_otp(db_user: User, code: str, db: Session) -> EmailOTP:
    now = datetime.now(timezone.utc)
    otps = (
        db.query(EmailOTP)
        .filter(
            EmailOTP.user_id == db_user.id,
            EmailOTP.consumed_at.is_(None),
            EmailOTP.expires_at > now,
        )
        .order_by(EmailOTP.created_at.desc(), EmailOTP.id.desc())
        .all()
    )
    if not otps:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OTP is expired")

    for otp in otps:
        if _hash_otp(otp.code_salt, code) == otp.code_hash:
            return otp

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OTP")


def verify_email_otp(db: Session, payload: schemas.VerifyOtpRequest) -> schemas.VerifyOtpResponse:
    db_user = db.query(User).filter(User.email == payload.email).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    matched = _find_matching_otp(db_user, payload.code, db)
    matched.consumed_at = datetime.now(timezone.utc)
    db_user.email_verified = True
    db_user.is_active = False
    db.commit()
    return schemas.VerifyOtpResponse(
        registration_token=_create_action_token(
            user_id=db_user.id, email=db_user.email, purpose="set_password"
        )
    )


def set_password(db: Session, payload: schemas.SetPasswordRequest) -> dict:
    decoded = _decode_action_token(payload.registration_token)
    if not decoded or decoded.get("purpose") != "set_password":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    sub = decoded.get("sub")
    email = decoded.get("email")
    if not sub or not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    try:
        user_id = int(sub)
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from None

    db_user = db.query(User).filter(User.id == user_id, User.email == email).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not db_user.email_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email is not verified")

    _validate_password_strength(payload.password)
    db_user.hashed_password = hash_password(payload.password)
    db_user.is_active = True
    db.commit()
    return {"message": "Password set"}


def resend_email_otp(db: Session, payload: schemas.ResendOtpRequest) -> dict:
    db_user = db.query(User).filter(User.email == payload.email).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if db_user.email_verified and db_user.is_active:
        return {"message": "Already verified"}

    _create_and_send_email_otp(db, db_user)
    return {"message": "OTP sent to email"}


def password_reset_start(db: Session, payload: schemas.PasswordResetStartRequest) -> dict:
    db_user = db.query(User).filter(User.email == payload.email).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not db_user.email_verified or not db_user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is not active")

    _create_and_send_email_otp(db, db_user)
    return {"message": "OTP sent to email"}


def password_reset_verify(
    db: Session, payload: schemas.PasswordResetVerifyRequest
) -> schemas.PasswordResetVerifyResponse:
    db_user = db.query(User).filter(User.email == payload.email).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not db_user.email_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email is not verified")

    matched = _find_matching_otp(db_user, payload.code, db)
    matched.consumed_at = datetime.now(timezone.utc)
    db.commit()

    return schemas.PasswordResetVerifyResponse(
        reset_token=_create_action_token(
            user_id=db_user.id, email=db_user.email, purpose="reset_password"
        )
    )


def password_reset_confirm(db: Session, payload: schemas.PasswordResetConfirmRequest) -> dict:
    decoded = _decode_action_token(payload.reset_token)
    if not decoded or decoded.get("purpose") != "reset_password":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    sub = decoded.get("sub")
    email = decoded.get("email")
    if not sub or not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    try:
        user_id = int(sub)
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from None

    db_user = db.query(User).filter(User.id == user_id, User.email == email).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not db_user.email_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email is not verified")

    _validate_password_strength(payload.password)
    db_user.hashed_password = hash_password(payload.password)
    db_user.is_active = True
    db.commit()
    return {"message": "Password reset"}



def update_profile(db: Session, current_user: User, payload: schemas.UserUpdate) -> User:
    data = payload.model_dump(exclude_unset=True)
    if "full_name" in data and data.get("full_name") is not None:
        full_name = data["full_name"].strip()
        if not full_name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Full name is required")
        first_name, last_name = _split_full_name(full_name)
        current_user.first_name = first_name
        current_user.last_name = last_name
    if "username" in data and data.get("username") is not None:
        username = data["username"].strip()
        if not username:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username is required")
        exists = db.query(User).filter(User.username == username, User.id != current_user.id).first()
        if exists:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already exists")
        current_user.username = username
    if "phone" in data:
        current_user.phone = _normalize_phone(data.get("phone"))
    if "language_preference" in data and data.get("language_preference") is not None:
        current_user.language_preference = _validate_preference_value(
            data["language_preference"], allowed=VALID_LANGUAGE_PREFERENCES, field_label="language preference"
        )
    if "theme_preference" in data and data.get("theme_preference") is not None:
        current_user.theme_preference = _validate_preference_value(
            data["theme_preference"], allowed=VALID_THEME_PREFERENCES, field_label="theme preference"
        )
    if "layout_preference" in data and data.get("layout_preference") is not None:
        current_user.layout_preference = _validate_preference_value(
            data["layout_preference"], allowed=VALID_LAYOUT_PREFERENCES, field_label="layout preference"
        )
    if "brand_color" in data and data.get("brand_color") is not None:
        current_user.brand_color = data["brand_color"].strip()
    if "onboarding_completed" in data and data.get("onboarding_completed") is not None:
        current_user.onboarding_completed = bool(data["onboarding_completed"])
    for field in (
        "push_notifications",
        "email_notifications",
        "threshold_alerts",
        "cloud_sync",
        "ai_opt_in",
        "keep_prompt_logs",
        "estimated_monthly_cost",
    ):
        if field in data and data.get(field) is not None:
            setattr(current_user, field, data[field])
    db.commit()
    db.refresh(current_user)
    return current_user


def change_password(db: Session, current_user: User, payload: schemas.ChangePasswordRequest) -> dict:
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password must be different")
    _validate_password_strength(payload.new_password)
    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password changed"}
