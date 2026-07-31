from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, func

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=True)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)
    email_verified = Column(Boolean, nullable=False, server_default="false")
    is_active = Column(Boolean, nullable=False, server_default="false")
    push_notifications = Column(Boolean, nullable=False, server_default="true")
    email_notifications = Column(Boolean, nullable=False, server_default="true")
    threshold_alerts = Column(Boolean, nullable=False, server_default="true")
    cloud_sync = Column(Boolean, nullable=False, server_default="false")
    ai_opt_in = Column(Boolean, nullable=False, server_default="true")
    keep_prompt_logs = Column(Boolean, nullable=False, server_default="true")
    estimated_monthly_cost = Column(Integer, nullable=False, server_default="3")
    language_preference = Column(String, nullable=False, server_default="vi")
    theme_preference = Column(String, nullable=False, server_default="light")
    layout_preference = Column(String, nullable=False, server_default="classic")
    brand_color = Column(String, nullable=False, server_default="#2e6bd1")
    onboarding_completed = Column(Boolean, nullable=False, server_default="false")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class EmailOTP(Base):
    __tablename__ = "email_otps"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    code_salt = Column(String, nullable=False)
    code_hash = Column(String, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    consumed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
