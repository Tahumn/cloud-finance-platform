import { useEffect, useRef, useState } from "react";
import { t } from "../../utils/i18n.js";

const buildPasswordRules = () => [
  { label: t("auth.password_rules_1"), test: (value) => value.length >= 8 },
  { label: t("auth.password_rules_2"), test: (value) => /[A-Za-z]/.test(value) },
  { label: t("auth.password_rules_3"), test: (value) => /[\d\W]/.test(value) }
];

const strengthLabel = (score) => {
  if (score <= 1) return t("auth.password_strength_weak");
  if (score === 2) return t("auth.password_strength_mid");
  return t("auth.password_strength_strong");
};

/* ─── SVG Icons ─────────────────────────────────────────────── */

function FinovaLogo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill="#C0392B"/>
      <path d="M14 28V16l6-4 6 4v12" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M18 28v-6h4v6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11 28h18" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  );
}

function EyeIcon({ open }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
      {!open && (
        <path
          d="M4 4l16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function SecurityIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 11 12 14 15 10" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107"/>
      <path d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00"/>
      <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50"/>
      <path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2"/>
    </svg>
  );
}

/* ─── Hero Illustration (Minimalist red landscape) ───────────── */
function HeroIllustration() {
  return (
    <svg viewBox="0 0 480 280" fill="none" xmlns="http://www.w3.org/2000/svg" className="auth-hero-illustration">
      {/* Sky */}
      <rect width="480" height="280" rx="20" fill="#FFF5F5"/>
      {/* Birds */}
      <path d="M340 55 Q346 50 352 55" stroke="#C0392B" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <path d="M360 42 Q367 36 374 42" stroke="#C0392B" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <path d="M390 60 Q395 55 401 60" stroke="#E57373" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      {/* Far mountains - lightest */}
      <ellipse cx="380" cy="165" rx="160" ry="65" fill="#FECDD3"/>
      <ellipse cx="120" cy="170" rx="140" ry="60" fill="#FECDD3"/>
      {/* Mid mountains */}
      <path d="M0 200 Q80 140 160 180 Q240 140 320 170 Q380 130 480 165 L480 280 L0 280 Z" fill="#F87171" opacity="0.55"/>
      {/* Reflective water */}
      <ellipse cx="240" cy="242" rx="220" ry="28" fill="#FCA5A5" opacity="0.35"/>
      {/* Ground platform */}
      <ellipse cx="240" cy="262" rx="180" ry="22" fill="#EF4444" opacity="0.25"/>
      {/* Pedestal */}
      <ellipse cx="240" cy="252" rx="52" ry="14" fill="#DC2626" opacity="0.7"/>
      <rect x="218" y="218" width="44" height="36" rx="8" fill="#DC2626" opacity="0.85"/>
      <ellipse cx="240" cy="218" rx="22" ry="7" fill="#EF4444"/>
      {/* Vase */}
      <ellipse cx="240" cy="212" rx="16" ry="9" fill="#F8F8F6"/>
      <path d="M228 212 Q226 198 232 192 Q240 186 248 192 Q254 198 252 212 Z" fill="#F8F8F6"/>
      {/* Plant stem */}
      <path d="M240 192 Q240 175 240 160" stroke="#C0392B" strokeWidth="2.5" strokeLinecap="round"/>
      {/* Leaves */}
      <path d="M240 175 Q228 165 222 155 Q232 160 240 170" fill="#C0392B"/>
      <path d="M240 168 Q252 158 258 148 Q248 155 240 165" fill="#C0392B"/>
      <path d="M240 182 Q225 174 218 162 Q230 168 240 178" fill="#DC2626"/>
      <path d="M240 178 Q255 170 262 158 Q250 164 240 174" fill="#DC2626"/>
      <path d="M240 190 Q230 183 226 174 Q234 180 240 188" fill="#E57373"/>
      <path d="M240 187 Q250 180 254 171 Q246 177 240 185" fill="#E57373"/>
      {/* Water ripples */}
      <ellipse cx="240" cy="265" rx="100" ry="6" fill="none" stroke="#FCA5A5" strokeWidth="1" opacity="0.5"/>
      <ellipse cx="240" cy="270" rx="140" ry="6" fill="none" stroke="#FCA5A5" strokeWidth="1" opacity="0.35"/>
    </svg>
  );
}

/* ─── Feature icons ──────────────────────────────────────────── */
function ChartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  );
}

function PlanIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>
      <path d="M22 12A10 10 0 0 0 12 2v10z"/>
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}

/* ─── Reusable sub-components ────────────────────────────────── */
function PasswordField({ label, name, placeholder, value, onChange, show, onToggle, required = true }) {
  return (
    <div className="auth-field-group">
      <label>{label}</label>
      <div className="auth-input-wrapper with-both-icons">
        <span className="auth-input-icon left">
          <LockIcon />
        </span>
        <input
          name={name}
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
        />
        <button
          className="auth-input-icon right toggle-btn"
          type="button"
          onClick={onToggle}
          aria-label={show ? t("auth.hide_password") : t("auth.show_password")}
        >
          <EyeIcon open={show} />
        </button>
      </div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────── */
export default function AuthScreen({
  mode = "login",
  setMode,
  onSubmit,
  onVerifyOtp,
  onResendOtp,
  onSetPassword,
  onResetPasswordStart,
  onResetPasswordVerify,
  onResetPasswordConfirm,
  onGoogleSubmit,
  onGoOnboarding,
  loading,
  error,
  notice
}) {
  const [step, setStep] = useState(mode === "login" ? "login" : "register");
  const [pendingEmail, setPendingEmail] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [registrationToken, setRegistrationToken] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [googleSupportError, setGoogleSupportError] = useState("");
  const [timer, setTimer] = useState(0);
  const otpRefs = useRef([]);
  const googleButtonRef = useRef(null);
  const googleSubmitRef = useRef(onGoogleSubmit);
  const rememberRef = useRef(remember);

  useEffect(() => {
    setStep(mode === "login" ? "login" : "register");
    setPendingEmail("");
    setResetEmail("");
    setOtpDigits(["", "", "", "", "", ""]);
    setRegistrationToken("");
    setResetToken("");
    setNewPassword("");
    setConfirmPassword("");
    setLoginPassword("");
    setShowLoginPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  }, [mode]);

  useEffect(() => {
    let interval;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  useEffect(() => {
    if (step === "otp" || step === "reset_otp") {
      setTimer(300);
      setOtpDigits(["", "", "", "", "", ""]);
      setTimeout(() => otpRefs.current[0]?.focus(), 0);
    }
  }, [step]);

  useEffect(() => {
    googleSubmitRef.current = onGoogleSubmit;
  }, [onGoogleSubmit]);

  useEffect(() => {
    rememberRef.current = remember;
  }, [remember]);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
    if (!clientId) {
      setGoogleReady(false);
      setGoogleSupportError("Đặt VITE_GOOGLE_CLIENT_ID để bật Google Sign-In.");
      return undefined;
    }

    const credentialHandler = async (response) => {
      try {
        if (!response?.credential) {
          throw new Error("Google chưa trả về thông tin đăng nhập.");
        }
        await googleSubmitRef.current?.(response.credential, rememberRef.current);
      } catch (err) {
        setGoogleSupportError(err.message || "Không thể đăng nhập bằng Google.");
      }
    };

    window.__finanzyGoogleCredentialHandler = credentialHandler;

    const initialize = () => {
      if (!window.google?.accounts?.id) {
        setGoogleReady(false);
        setGoogleSupportError("Không thể khởi tạo Google SDK.");
        return;
      }

      if (window.__finanzyGoogleClientId !== clientId) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => window.__finanzyGoogleCredentialHandler?.(response),
          auto_select: false,
          cancel_on_tap_outside: false,
          use_fedcm_for_button: false,
          locale: "vi",
        });
        window.__finanzyGoogleClientId = clientId;
      }

      setGoogleReady(true);
      setGoogleSupportError("");
    };

    if (window.google?.accounts?.id) {
      initialize();
    } else {
      const existing = document.getElementById("google-identity-script");
      if (existing) {
        existing.addEventListener("load", initialize, { once: true });
      } else {
        const script = document.createElement("script");
        script.id = "google-identity-script";
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.addEventListener("load", initialize, { once: true });
        script.onerror = () => {
          setGoogleReady(false);
          setGoogleSupportError("Không thể tải Google SDK.");
        };
        document.body.appendChild(script);
      }
    }

    return () => {
      if (window.__finanzyGoogleCredentialHandler === credentialHandler) {
        window.__finanzyGoogleCredentialHandler = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!googleReady || step !== "login" || !googleButtonRef.current) return;

    googleButtonRef.current.replaceChildren();
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      logo_alignment: "left",
      width: Math.min(400, googleButtonRef.current.clientWidth || 320),
    });
  }, [googleReady, step]);
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const otpCode = otpDigits.join("");
  const otpValid = otpCode.length === 6 && /^\d{6}$/.test(otpCode);

  const passwordRules = buildPasswordRules();
  const passwordScore = passwordRules.reduce(
    (acc, rule) => acc + (rule.test(newPassword) ? 1 : 0),
    0
  );

  const passwordOk = passwordScore >= 3;
  const confirmOk = newPassword && newPassword === confirmPassword;

  const handleOtpChange = (index, value) => {
    if (value.length > 1) {
      const pasted = value.slice(0, 6).split("");
      const next = [...otpDigits];
      pasted.forEach((char, i) => {
        if (index + i < 6 && /^\d$/.test(char)) {
          next[index + i] = char;
        }
      });
      setOtpDigits(next);
      const nextIndex = Math.min(index + pasted.length, 5);
      otpRefs.current[nextIndex]?.focus();
      return;
    }

    if (!/^\d?$/.test(value)) return;
    const next = [...otpDigits];
    next[index] = value;
    setOtpDigits(next);
    if (value && otpRefs.current[index + 1]) {
      otpRefs.current[index + 1].focus();
    }
  };

  const handleOtpKeyDown = (index, event) => {
    if (event.key === "Backspace" && !otpDigits[index] && otpRefs.current[index - 1]) {
      otpRefs.current[index - 1].focus();
    }
  };

  const handleRegisterSubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const full_name = String(form.get("full_name") || "");
    const username = String(form.get("username") || "");
    const email = String(form.get("email") || "");
    const phone = String(form.get("phone") || "");
    const result = await onSubmit({
      full_name,
      username,
      email,
      phone: phone || null,
      mode: "register"
    });
    if (result?.next === "otp") {
      setPendingEmail(email);
      setStep("otp");
    }
  };

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const identifier = String(form.get("identifier") || "");
    await onSubmit({ identifier, password: loginPassword, remember, mode: "login" });
  };

  const handleResetRequest = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "");
    const ok = await onResetPasswordStart(email);
    if (ok) {
      setResetEmail(email);
      setStep("reset_otp");
    }
  };

  const appBrand = t("app.brand", null, "Finanzy");

  const heroTitle =
    mode === "login" ? (
      <>
        {t("auth.hero_welcome", null, "Chào mừng bạn")}
        <br />
        {t("auth.hero_back", null, "trở lại")}{" "}
        <span className="auth-brand">{appBrand}</span>
      </>
    ) : (
      <>
        {t("auth.hero_start", null, "Bắt đầu cùng")}
        <br />
        <span className="auth-brand">{appBrand}</span>
      </>
    );

  const heroDesc =
    mode === "login"
      ? t(
          "auth.hero_login_desc",
          null,
          "Đăng nhập để tiếp tục quản lý tài chính cá nhân thông minh và hiệu quả."
        )
      : t(
          "auth.hero_register_desc",
          null,
          "Tạo tài khoản để quản lý chi tiêu, tiết kiệm và đầu tư thông minh hơn mỗi ngày."
        );

  return (
    <main className="auth-shell">
      <div className="auth-layout">
        {/* ── Hero Section (Left panel) ── */}
        <section className="auth-hero">
          <header className="auth-hero-header">
            <div className="auth-logo">
              <FinovaLogo size={38} />
              <div className="auth-logo-text-group">
                <span className="logo-text">{appBrand}</span>
                <span className="logo-tagline">Smart Finance</span>
              </div>
            </div>
          </header>

          <div className="auth-hero-inner">
            <h1 className="auth-hero-title">{heroTitle}</h1>
            <p className="auth-hero-desc">{heroDesc}</p>
            <HeroIllustration />
          </div>

          <div className="auth-hero-features">
            <div className="auth-feature-item">
              <span className="auth-feature-icon"><ChartIcon /></span>
              <div>
                <p className="auth-feature-title">{t("auth.feature_track", null, "Theo dõi chi tiêu")}</p>
                <p className="auth-feature-desc">{t("auth.feature_track_desc", null, "Mọi lúc, mọi nơi")}</p>
              </div>
            </div>
            <div className="auth-feature-item">
              <span className="auth-feature-icon"><PlanIcon /></span>
              <div>
                <p className="auth-feature-title">{t("auth.feature_plan", null, "Lập kế hoạch")}</p>
                <p className="auth-feature-desc">{t("auth.feature_plan_desc", null, "Mục tiêu rõ ràng")}</p>
              </div>
            </div>
            <div className="auth-feature-item">
              <span className="auth-feature-icon"><ShieldIcon /></span>
              <div>
                <p className="auth-feature-title">{t("auth.feature_secure", null, "Bảo mật tuyệt đối")}</p>
                <p className="auth-feature-desc">{t("auth.feature_secure_desc", null, "An toàn thông tin")}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Form Panel (Right) ── */}
        <section className="auth-panel">
          {/* Mobile-only header */}
          <div className="auth-mobile-header">
            <div className="auth-logo">
              <FinovaLogo size={42} />
              <div className="auth-logo-text-group">
                <span className="logo-text">{appBrand}</span>
                <span className="logo-tagline">Smart Finance</span>
              </div>
            </div>
          </div>

          <div className="auth-card">
            <div className="auth-card-badge">
              <FinovaLogo size={34} />
            </div>

            <h2 className="auth-card-title">
              {step === "login" && t("auth.login", null, "Đăng nhập")}
              {step === "register" && t("auth.register", null, "Tạo tài khoản mới")}
              {step === "otp" && t("auth.verify_otp", null, "Xác thực OTP")}
              {step === "set_password" && t("auth.set_password", null, "Thiết lập mật khẩu")}
              {step === "reset_request" && t("auth.forgot", null, "Quên mật khẩu?")}
              {step === "reset_otp" && t("auth.verify_otp", null, "Xác thực OTP")}
              {step === "reset_set_password" && t("auth.reset_password", null, "Đặt lại mật khẩu")}
            </h2>

            <p className="auth-card-subtitle">
              {step === "login" && t("auth.login_subtitle", null, "Quản lý tài chính cá nhân thông minh")}
              {step === "register" && t("auth.register_subtitle", null, "Bắt đầu hành trình quản lý tài chính thông minh")}
              {(step === "otp" || step === "reset_otp") && t("auth.otp_sent_to", null, "Mã xác thực đã được gửi đến email của bạn")}
              {step === "set_password" && t("auth.verified_hint", null, "Email đã xác thực. Tạo mật khẩu để kích hoạt tài khoản.")}
              {step === "reset_request" && t("auth.reset_subtitle", null, "Nhập email để nhận mã khôi phục mật khẩu")}
            </p>

            <div className="auth-content">
              {/* ── Register form ── */}
              {step === "register" && (
                <form className="auth-form" onSubmit={handleRegisterSubmit}>
                  <div className="auth-field-group">
                    <label>{t("auth.full_name", null, "Họ và tên")}</label>
                    <div className="auth-input-wrapper with-icon">
                      <span className="auth-input-icon left"><UserIcon /></span>
                      <input name="full_name" type="text" placeholder={t("auth.full_name_placeholder", null, "Nhập họ và tên của bạn")} maxLength={100} required />
                    </div>
                  </div>

                  <div className="auth-field-group">
                    <label>{t("auth.username", null, "Username")}</label>
                    <div className="auth-input-wrapper with-icon">
                      <span className="auth-input-icon left"><UserIcon /></span>
                      <input name="username" type="text" placeholder={t("auth.username_placeholder", null, "Nhập username của bạn")} maxLength={100} required />
                    </div>
                  </div>

                  <div className="auth-field-group">
                    <label>{t("auth.email", null, "Email")}</label>
                    <div className="auth-input-wrapper with-icon">
                      <span className="auth-input-icon left"><MailIcon /></span>
                      <input name="email" type="email" placeholder={t("auth.email_placeholder", null, "Nhập email của bạn")} required />
                    </div>
                  </div>

                  <div className="auth-field-group">
                    <label>{t("auth.phone", null, "Số điện thoại (optional)")}</label>
                    <div className="auth-input-wrapper with-icon">
                      <span className="auth-input-icon left"><PhoneIcon /></span>
                      <input name="phone" type="tel" placeholder={t("auth.phone_placeholder", null, "Nhập số điện thoại của bạn")} />
                    </div>
                  </div>

                  <div className="auth-info-row">
                    <SecurityIcon />
                    <span>{t("auth.otp_notice", null, "OTP sẽ được gửi để xác thực tài khoản")}</span>
                  </div>

                  <label className="auth-checkbox">
                    <input type="checkbox" required defaultChecked />
                    <span>
                      {t("auth.agree_prefix", null, "Tôi đồng ý với ")}
                      <a href="#terms" onClick={e => e.preventDefault()}>{t("auth.terms", null, "Điều khoản")}</a>
                      {t("auth.agree_and", null, " và ")}
                      <a href="#policy" onClick={e => e.preventDefault()}>{t("auth.policy", null, "Chính sách")}</a>
                    </span>
                  </label>

                  <button className="auth-btn-primary" type="submit" disabled={loading}>
                    <span>{t("auth.register_otp", null, "Đăng ký (Gửi OTP)")}</span>
                    <ArrowRightIcon />
                  </button>

                  <div className="auth-card-footer">
                    <span>{t("auth.login_exists", null, "Đã có tài khoản?")} </span>
                    <button type="button" className="auth-link-btn" onClick={() => setMode("login")}>
                      {t("auth.login", null, "Đăng nhập")}
                    </button>
                  </div>

                  {error && <p className="auth-form-error">{error}</p>}
                </form>
              )}

              {/* ── Login form ── */}
              {step === "login" && (
                <form className="auth-form" onSubmit={handleLoginSubmit}>
                  <div className="auth-field-group">
                    <label>{t("auth.identifier", null, "Email hoặc Username")}</label>
                    <div className="auth-input-wrapper with-icon">
                      <span className="auth-input-icon left"><UserIcon /></span>
                      <input
                        name="identifier"
                        type="text"
                        placeholder={t("auth.identifier_placeholder", null, "Nhập email hoặc username")}
                        required
                      />
                    </div>
                  </div>

                  <PasswordField
                    label={t("auth.password", null, "Mật khẩu")}
                    name="password"
                    placeholder={t("auth.password_placeholder", null, "Nhập mật khẩu")}
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    show={showLoginPassword}
                    onToggle={() => setShowLoginPassword((prev) => !prev)}
                  />

                  <div className="auth-form-row">
                    <label className="auth-checkbox">
                      <input
                        type="checkbox"
                        checked={remember}
                        onChange={(event) => setRemember(event.target.checked)}
                      />
                      <span>{t("auth.remember", null, "Ghi nhớ đăng nhập")}</span>
                    </label>
                    <button type="button" className="auth-forgot-link" onClick={() => setStep("reset_request")}>
                      {t("auth.forgot", null, "Quên mật khẩu?")}
                    </button>
                  </div>

                  <button className="auth-btn-primary" type="submit" disabled={loading}>
                    <span>{t("auth.login_label", null, "Đăng nhập")}</span>
                    <ArrowRightIcon />
                  </button>

                  {/* Divider "hoặc" */}
                  <div className="auth-or-divider">
                    <span className="auth-or-line" />
                    <span className="auth-or-text">hoặc</span>
                    <span className="auth-or-line" />
                  </div>

                  {/* Google button */}
                  <div className="auth-google-button" ref={googleButtonRef} aria-busy={!googleReady}>
                    {!googleReady && "Đang chuẩn bị Google..."}
                  </div>
                  {googleSupportError && <p className="auth-form-error">{googleSupportError}</p>}

                  {/* Security notice */}
                  <div className="auth-security-row">
                    <SecurityIcon />
                    <span>{t("auth.security_label", null, "Bảo mật SSL 256-bit • An toàn tuyệt đối")}</span>
                  </div>

                  <div className="auth-card-footer">
                    <span>{t("auth.no_account", null, "Chưa có tài khoản?")} </span>
                    <button type="button" className="auth-link-btn" onClick={() => setMode("register")}>
                      {t("auth.register_now", null, "Đăng ký ngay")}
                    </button>
                    <ArrowRightIcon />
                  </div>

                  {error && <p className="auth-form-error">{error}</p>}
                </form>
              )}

              {/* ── OTP Step ── */}
              {(step === "otp" || step === "reset_otp") && (
                <div className="auth-form">
                  <p className="auth-otp-hint">
                    {t("auth.otp_sent")} <strong>{step === "otp" ? pendingEmail : resetEmail}</strong>
                  </p>
                  <div className="auth-otp-inputs">
                    {otpDigits.map((digit, index) => (
                      <input
                        key={`otp-${index}`}
                        ref={(el) => (otpRefs.current[index] = el)}
                        value={digit}
                        inputMode="numeric"
                        maxLength={1}
                        onChange={(event) => handleOtpChange(index, event.target.value)}
                        onKeyDown={(event) => handleOtpKeyDown(index, event)}
                      />
                    ))}
                  </div>
                  <button
                    className="auth-btn-primary"
                    type="button"
                    disabled={loading || !otpValid}
                    onClick={async () => {
                      if (step === "otp") {
                        const result = await onVerifyOtp(pendingEmail, otpCode);
                        if (result?.registration_token) {
                          setRegistrationToken(result.registration_token);
                          setStep("set_password");
                        }
                      } else {
                        const result = await onResetPasswordVerify(resetEmail, otpCode);
                        if (result?.reset_token) {
                          setResetToken(result.reset_token);
                          setStep("reset_set_password");
                        }
                      }
                    }}
                  >
                    <span>{t("auth.verify_otp", null, "Xác thực mã OTP")}</span>
                    <ArrowRightIcon />
                  </button>

                  <div className="auth-otp-footer">
                    {timer > 0 ? (
                      <p className="auth-timer-text">
                        {t("auth.resend_in", null, "Gửi lại mã sau")} <strong>{formatTime(timer)}</strong>
                      </p>
                    ) : (
                      <button
                        className="auth-resend-btn"
                        type="button"
                        disabled={loading}
                        onClick={() => {
                          if (step === "otp") onResendOtp(pendingEmail);
                          else onResetPasswordStart(resetEmail);
                          setTimer(300);
                        }}
                      >
                        {t("auth.resend", null, "Gửi lại mã OTP")}
                      </button>
                    )}
                    <button className="auth-link-btn secondary" type="button" onClick={() => setStep(step === "otp" ? "register" : "reset_request")}>
                      {t("auth.change_email", null, "Đổi địa chỉ email")}
                    </button>
                  </div>
                  {error && <p className="auth-form-error">{error}</p>}
                </div>
              )}

              {/* ── Set Password Step ── */}
              {(step === "set_password" || step === "reset_set_password") && (
                <div className="auth-form">
                  <PasswordField
                    label={t("auth.new_password", null, "Mật khẩu mới")}
                    name="new_password"
                    placeholder={t("auth.new_password_placeholder", null, "Nhập mật khẩu mới")}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    show={showNewPassword}
                    onToggle={() => setShowNewPassword((prev) => !prev)}
                  />

                  <div className="auth-password-strength">
                    <div className="strength-meter">
                      <div className="strength-fill" style={{ width: `${(passwordScore / 3) * 100}%`, backgroundColor: passwordScore >= 3 ? "#10b981" : passwordScore >= 2 ? "#f59e0b" : "#ef4444" }} />
                    </div>
                    <span className="strength-label">
                      {t("auth.password_strength")}: <strong>{strengthLabel(passwordScore)}</strong>
                    </span>
                  </div>

                  <PasswordField
                    label={t("auth.confirm_password", null, "Xác nhận mật khẩu")}
                    name="confirm_password"
                    placeholder={t("auth.confirm_password_placeholder", null, "Nhập lại mật khẩu")}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    show={showConfirmPassword}
                    onToggle={() => setShowConfirmPassword((prev) => !prev)}
                  />

                  {!confirmOk && confirmPassword && (
                    <p className="auth-form-error">{t("auth.confirm_mismatch", null, "Mật khẩu xác nhận không khớp.")}</p>
                  )}

                  <button
                    className="auth-btn-primary"
                    type="button"
                    disabled={loading || !passwordOk || !confirmOk}
                    onClick={async () => {
                      if (step === "set_password") {
                        const ok = await onSetPassword(registrationToken, newPassword);
                        if (ok) {
                          await onSubmit({ identifier: pendingEmail, password: newPassword, remember, mode: "login" });
                        }
                      } else {
                        const ok = await onResetPasswordConfirm(resetToken, newPassword);
                        if (ok) {
                          setMode("login");
                          setStep("login");
                        }
                      }
                    }}
                  >
                    <span>{t("auth.save_password", null, "Hoàn tất & Đăng nhập")}</span>
                    <ArrowRightIcon />
                  </button>

                  {error && <p className="auth-form-error">{error}</p>}
                </div>
              )}

              {/* ── Reset Request Step ── */}
              {step === "reset_request" && (
                <form className="auth-form" onSubmit={handleResetRequest}>
                  <div className="auth-field-group">
                    <label>{t("auth.reset_email", null, "Email đã đăng ký")}</label>
                    <div className="auth-input-wrapper with-icon">
                      <span className="auth-input-icon left"><MailIcon /></span>
                      <input name="email" type="email" placeholder={t("auth.reset_email_placeholder", null, "Nhập email của bạn")} required />
                    </div>
                  </div>

                  <button className="auth-btn-primary" type="submit" disabled={loading}>
                    <span>{t("auth.reset_send", null, "Gửi mã xác thực")}</span>
                    <ArrowRightIcon />
                  </button>

                  <div className="auth-card-footer">
                    <button type="button" className="auth-link-btn" onClick={() => setStep("login")}>
                      {t("common.back", null, "Quay lại đăng nhập")}
                    </button>
                  </div>
                  {error && <p className="auth-form-error">{error}</p>}
                </form>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
