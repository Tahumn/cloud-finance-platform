from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterStartRequest(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=100)
    username: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone: str | None = Field(default=None, pattern=r"^\+?[\d\s-]{6,20}$")


class UserLogin(BaseModel):
    identifier: str = Field(..., min_length=1, max_length=100)
    password: str


class GoogleAuthRequest(BaseModel):
    credential: str = Field(..., min_length=1, max_length=8192)


class UserRead(BaseModel):
    id: int
    email: EmailStr
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    push_notifications: bool = True
    email_notifications: bool = True
    threshold_alerts: bool = True
    cloud_sync: bool = False
    ai_opt_in: bool = True
    keep_prompt_logs: bool = True
    estimated_monthly_cost: int = 3
    language_preference: str = "vi"
    theme_preference: str = "light"
    layout_preference: str = "classic"
    brand_color: str = "#2e6bd1"
    onboarding_completed: bool = False
    created_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=100)
    username: str | None = Field(default=None, min_length=1, max_length=100)
    phone: str | None = Field(default=None, pattern=r"^\+?[\d\s-]{6,20}$")
    push_notifications: bool | None = None
    email_notifications: bool | None = None
    threshold_alerts: bool | None = None
    cloud_sync: bool | None = None
    ai_opt_in: bool | None = None
    keep_prompt_logs: bool | None = None
    estimated_monthly_cost: int | None = None
    language_preference: str | None = Field(default=None, min_length=2, max_length=5)
    theme_preference: str | None = Field(default=None, min_length=4, max_length=10)
    layout_preference: str | None = Field(default=None, min_length=4, max_length=24)
    brand_color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    onboarding_completed: bool | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RegisterResponse(BaseModel):
    message: str = "OTP sent to email"
    code: str | None = None


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")


class ResendOtpRequest(BaseModel):
    email: EmailStr


class PasswordResetStartRequest(BaseModel):
    email: EmailStr


class PasswordResetVerifyRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")


class PasswordResetVerifyResponse(BaseModel):
    reset_token: str


class PasswordResetConfirmRequest(BaseModel):
    reset_token: str
    password: str = Field(..., min_length=8)


class VerifyOtpResponse(BaseModel):
    registration_token: str


class SetPasswordRequest(BaseModel):
    registration_token: str
    password: str = Field(..., min_length=8)
