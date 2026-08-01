import { useEffect, useMemo, useState } from "react";
import { getUserPrefs, saveUserPrefs } from "../../utils/userPrefs.js";
import { applyUiPrefs, getUiPrefs, saveUiPrefs, UI_COLORS, UI_LAYOUTS } from "../../utils/uiPrefs.js";
import { changePassword, updateMe } from "../../api/auth.js";
import "./settings.css";

const defaultFlags = {
  pushNotifications: true,
  emailNotifications: true,
  thresholdAlerts: true,
  cloudSync: false,
};

const languageOptions = [
  { value: "vi", label: "Tiếng Việt" },
  { value: "en", label: "English" },
];

const themeOptions = [
  { value: "light", label: "Sáng", description: "Nền sáng, chữ đậm, dễ đọc ban ngày." },
  { value: "dark", label: "Tối", description: "Nền tối, chữ sáng, tương phản cao vào buổi tối." },
  { value: "system", label: "Theo hệ thống", description: "Tự đổi theo cài đặt thiết bị." },
];

const layoutCopy = {
  classic: { name: "Classic Stack", description: "Cân bằng, rõ ràng, phù hợp dùng hằng ngày." },
  airy: { name: "Airy Space", description: "Khoảng trắng thoáng hơn, cảm giác nhẹ mắt." },
  compact: { name: "Compact Focus", description: "Gọn, tập trung dữ liệu, tiết kiệm diện tích." },
  editorial: { name: "Editorial", description: "Nhấn mạnh nội dung và các khối số liệu lớn." },
};

const passwordRules = [
  { id: "length", label: "Tối thiểu 8 ký tự", test: (value) => value.length >= 8 },
  { id: "letter", label: "Có ít nhất 1 chữ cái", test: (value) => /[A-Za-z]/.test(value) },
  { id: "digitOrSpecial", label: "Có số hoặc ký tự đặc biệt", test: (value) => /[\d\W]/.test(value) },
];

const getDisplayName = (user) => {
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
  return fullName || user?.username || user?.email || "Người dùng";
};

const getInitials = (name) => {
  const parts = String(name || "U").trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "U";
};

const formatJoinedDate = (value) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
};

const getStrength = (password) => passwordRules.reduce((score, rule) => score + (rule.test(password) ? 1 : 0), 0);

const getStrengthMeta = (score) => {
  if (score <= 1) return { label: "Yếu", tone: "danger" };
  if (score === 2) return { label: "Ổn", tone: "warning" };
  return { label: "Mạnh", tone: "success" };
};

export default function SettingsScreen({ user, onUserUpdated }) {
  const email = user?.email || "guest";
  const [settings, setSettings] = useState(defaultFlags);
  const [language, setLanguage] = useState("vi");
  const [uiPrefs, setUiPrefs] = useState(() => getUiPrefs(email));
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [prefBusyKey, setPrefBusyKey] = useState("");
  const [notice, setNotice] = useState(null);
  const [profileForm, setProfileForm] = useState({
    full_name: "",
    username: "",
    phone: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    current: "",
    next: "",
    confirm: "",
  });

  const displayName = useMemo(() => getDisplayName(user), [user]);
  const initials = useMemo(() => getInitials(displayName), [displayName]);
  const joinedDate = useMemo(() => formatJoinedDate(user?.created_at), [user?.created_at]);
  const passwordScore = useMemo(() => getStrength(passwordForm.next), [passwordForm.next]);
  const passwordMeta = useMemo(() => getStrengthMeta(passwordScore), [passwordScore]);

  useEffect(() => {
    const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
    setProfileForm({
      full_name: fullName || "",
      username: user?.username || "",
      phone: user?.phone || "",
    });
    setSettings({
      pushNotifications: user?.push_notifications ?? true,
      emailNotifications: user?.email_notifications ?? true,
      thresholdAlerts: user?.threshold_alerts ?? true,
      cloudSync: user?.cloud_sync ?? false,
    });
    setLanguage(user?.language_preference || getUserPrefs(email).language || "vi");
    setUiPrefs((current) => ({
      ...current,
      ...getUiPrefs(email),
      theme: user?.theme_preference || getUiPrefs(email).theme,
      templateId: user?.layout_preference || getUiPrefs(email).templateId,
      brandColor: user?.brand_color || getUiPrefs(email).brandColor,
    }));
  }, [email, user]);

  const showNotice = (message, type = "success") => {
    setNotice({ message, type });
    window.clearTimeout(showNotice.timer);
    showNotice.timer = window.setTimeout(() => setNotice(null), 3200);
  };

  const updateFlag = async (key) => {
    const fieldMap = {
      pushNotifications: "push_notifications",
      emailNotifications: "email_notifications",
      thresholdAlerts: "threshold_alerts",
      cloudSync: "cloud_sync",
    };
    const nextValue = !settings[key];
    const snapshot = settings;
    setSettings((current) => ({ ...current, [key]: nextValue }));
    setPrefBusyKey(key);
    try {
      const updated = await updateMe({ [fieldMap[key]]: nextValue });
      onUserUpdated?.(updated);
      showNotice("Đã cập nhật tùy chọn thông báo.");
    } catch (error) {
      console.error(error);
      setSettings(snapshot);
      showNotice(error.message || "Không thể lưu tùy chọn thông báo.", "error");
    } finally {
      setPrefBusyKey("");
    }
  };

  const persistLanguage = async (value) => {
    const previous = language;
    setLanguage(value);
    saveUserPrefs(email, { ...getUserPrefs(email), language: value });
    setPrefBusyKey("language");
    try {
      const updated = await updateMe({ language_preference: value });
      onUserUpdated?.(updated);
      showNotice("Đã lưu ngôn ngữ hiển thị.");
    } catch (error) {
      console.error(error);
      setLanguage(previous);
      saveUserPrefs(email, { ...getUserPrefs(email), language: previous });
      showNotice(error.message || "Không thể lưu ngôn ngữ.", "error");
    } finally {
      setPrefBusyKey("");
    }
  };

  const persistUi = async (key, value) => {
    const fieldMap = {
      theme: "theme_preference",
      templateId: "layout_preference",
      brandColor: "brand_color",
    };
    const previous = uiPrefs;
    const next = { ...uiPrefs, [key]: value };
    setUiPrefs(next);
    saveUiPrefs(email, next);
    applyUiPrefs(next);
    setPrefBusyKey(key);
    try {
      const updated = await updateMe({ [fieldMap[key]]: value });
      onUserUpdated?.(updated);
      showNotice("Đã áp dụng giao diện mới.");
    } catch (error) {
      console.error(error);
      setUiPrefs(previous);
      saveUiPrefs(email, previous);
      applyUiPrefs(previous);
      showNotice(error.message || "Không thể lưu giao diện.", "error");
    } finally {
      setPrefBusyKey("");
    }
  };

  const saveProfile = async () => {
    const payload = {
      full_name: profileForm.full_name.trim(),
      username: profileForm.username.trim(),
      phone: profileForm.phone.trim() || null,
    };
    if (!payload.full_name || !payload.username) {
      showNotice("Họ tên và username không được để trống.", "error");
      return;
    }
    setProfileBusy(true);
    try {
      const updated = await updateMe(payload);
      onUserUpdated?.(updated);
      setEditingProfile(false);
      showNotice("Đã cập nhật hồ sơ thành công.");
    } catch (error) {
      console.error(error);
      showNotice(error.message || "Không thể cập nhật hồ sơ.", "error");
    } finally {
      setProfileBusy(false);
    }
  };

  const savePassword = async () => {
    if (!passwordForm.current || !passwordForm.next || !passwordForm.confirm) {
      showNotice("Vui lòng nhập đầy đủ thông tin mật khẩu.", "error");
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      showNotice("Xác nhận mật khẩu mới chưa khớp.", "error");
      return;
    }
    if (passwordScore < 3) {
      showNotice("Mật khẩu mới chưa đạt yêu cầu bảo mật.", "error");
      return;
    }
    setPasswordBusy(true);
    try {
      await changePassword(passwordForm.current, passwordForm.next);
      setPasswordForm({ current: "", next: "", confirm: "" });
      showNotice("Đã đổi mật khẩu thành công.");
    } catch (error) {
      console.error(error);
      showNotice(error.message || "Không thể đổi mật khẩu.", "error");
    } finally {
      setPasswordBusy(false);
    }
  };

  return (
    <div className="stg-shell">
      <div className="stg-header">
        <div>
          <p className="stg-eyebrow">Tài khoản & giao diện</p>
          <h1 className="stg-title">Cài đặt hồ sơ</h1>
          <p className="stg-subtitle">Cập nhật thông tin cá nhân, đổi mật khẩu và tinh chỉnh trải nghiệm hiển thị theo đúng phong cách bạn muốn.</p>
        </div>
        <div className="stg-header-badges">
          <span className="stg-chip">{themeOptions.find((item) => item.value === uiPrefs.theme)?.label || "Sáng"}</span>
          <span className="stg-chip stg-chip-ghost">{layoutCopy[uiPrefs.templateId]?.name || "Classic Stack"}</span>
        </div>
      </div>

      {notice && <div className={`stg-notice ${notice.type === "error" ? "error" : "success"}`}>{notice.message}</div>}

      <section className="stg-hero-card">
        <div className="stg-hero-main">
          <div className="stg-avatar">{initials}</div>
          <div className="stg-hero-copy">
            <div className="stg-hero-topline">
              <h2>{displayName}</h2>
              <span className="stg-status">Đang hoạt động</span>
            </div>
            <p className="stg-hero-meta">{user?.email || "—"}</p>
            <div className="stg-hero-facts">
              <span>@{user?.username || "chưa đặt"}</span>
              <span>SĐT: {user?.phone || "chưa cập nhật"}</span>
              <span>Tham gia: {joinedDate}</span>
            </div>
          </div>
        </div>
        <div className="stg-hero-actions">
          <button className="stg-btn-secondary" type="button" onClick={() => setEditingProfile((value) => !value)}>
            {editingProfile ? "Thu gọn biểu mẫu" : "Chỉnh sửa hồ sơ"}
          </button>
        </div>
      </section>

      <div className="stg-main-grid">
        <div className="stg-stack">
          <section className="stg-card stg-card-profile">
            <div className="stg-card-head">
              <div>
                <h3>Hồ sơ cá nhân</h3>
                <p>Thông tin này được lưu trực tiếp vào tài khoản của bạn.</p>
              </div>
              <span className="stg-badge-live">API thật</span>
            </div>

            <div className="stg-form-grid">
              <label className="stg-field wide">
                <span>Họ và tên</span>
                <input
                  className="stg-input"
                  readOnly={!editingProfile}
                  value={profileForm.full_name}
                  onChange={(event) => setProfileForm((current) => ({ ...current, full_name: event.target.value }))}
                  placeholder="Nhập họ và tên"
                />
              </label>
              <label className="stg-field">
                <span>Username</span>
                <input
                  className="stg-input"
                  readOnly={!editingProfile}
                  value={profileForm.username}
                  onChange={(event) => setProfileForm((current) => ({ ...current, username: event.target.value }))}
                  placeholder="Nhập username"
                />
              </label>
              <label className="stg-field">
                <span>Số điện thoại</span>
                <input
                  className="stg-input"
                  readOnly={!editingProfile}
                  value={profileForm.phone}
                  onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))}
                  placeholder="Ví dụ: 0901234567"
                />
              </label>
              <label className="stg-field wide">
                <span>Email đăng nhập</span>
                <input className="stg-input stg-input-readonly" value={user?.email || ""} readOnly />
              </label>
            </div>

            <div className="stg-actions-row">
              <button className="stg-btn-primary" type="button" onClick={editingProfile ? saveProfile : () => setEditingProfile(true)} disabled={profileBusy}>
                {profileBusy ? "Đang lưu..." : "Lưu hồ sơ"}
              </button>
            </div>
          </section>

          <section className="stg-card">
            <div className="stg-card-head">
              <div>
                <h3>Bảo mật</h3>
                <p>Đổi mật khẩu ngay trên backend, không còn form mock.</p>
              </div>
            </div>
            <div className="stg-form-grid">
              <label className="stg-field wide">
                <span>Mật khẩu hiện tại</span>
                <input
                  type="password"
                  className="stg-input"
                  value={passwordForm.current}
                  onChange={(event) => setPasswordForm((current) => ({ ...current, current: event.target.value }))}
                  placeholder="Nhập mật khẩu hiện tại"
                />
              </label>
              <label className="stg-field">
                <span>Mật khẩu mới</span>
                <input
                  type="password"
                  className="stg-input"
                  value={passwordForm.next}
                  onChange={(event) => setPasswordForm((current) => ({ ...current, next: event.target.value }))}
                  placeholder="Ít nhất 8 ký tự"
                />
              </label>
              <label className="stg-field">
                <span>Xác nhận mật khẩu mới</span>
                <input
                  type="password"
                  className="stg-input"
                  value={passwordForm.confirm}
                  onChange={(event) => setPasswordForm((current) => ({ ...current, confirm: event.target.value }))}
                  placeholder="Nhập lại mật khẩu mới"
                />
              </label>
            </div>

            <div className="stg-password-panel">
              <div className="stg-strength-row">
                <span>Độ mạnh mật khẩu</span>
                <strong className={`stg-strength ${passwordMeta.tone}`}>{passwordMeta.label}</strong>
              </div>
              <div className="stg-strength-bar">
                <div className={`stg-strength-fill ${passwordMeta.tone}`} style={{ width: `${(passwordScore / 3) * 100}%` }}></div>
              </div>
              <div className="stg-rule-list">
                {passwordRules.map((rule) => {
                  const passed = rule.test(passwordForm.next);
                  return (
                    <div key={rule.id} className={`stg-rule ${passed ? "pass" : ""}`}>
                      <span>{passed ? "✓" : "•"}</span>
                      <span>{rule.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="stg-actions-row">
              <button className="stg-btn-primary" type="button" onClick={savePassword} disabled={passwordBusy}>
                {passwordBusy ? "Đang cập nhật..." : "Đổi mật khẩu"}
              </button>
            </div>
          </section>
        </div>

        <div className="stg-stack">
          <section className="stg-card">
            <div className="stg-card-head">
              <div>
                <h3>Thông báo & đồng bộ</h3>
                <p>Bật hoặc tắt từng loại cảnh báo theo nhu cầu thực tế.</p>
              </div>
            </div>

            <button type="button" className="stg-toggle-row" onClick={() => updateFlag("pushNotifications")}>
              <div>
                <strong>Thông báo đẩy</strong>
                <span>Nhận thông báo trên trình duyệt hoặc thiết bị đang đăng nhập.</span>
              </div>
              <span className={`stg-switch ${settings.pushNotifications ? "on" : ""} ${prefBusyKey === "pushNotifications" ? "busy" : ""}`}></span>
            </button>

            <button type="button" className="stg-toggle-row" onClick={() => updateFlag("emailNotifications")}>
              <div>
                <strong>Email báo cáo</strong>
                <span>Gửi tổng hợp hoạt động tài chính qua email định kỳ.</span>
              </div>
              <span className={`stg-switch ${settings.emailNotifications ? "on" : ""} ${prefBusyKey === "emailNotifications" ? "busy" : ""}`}></span>
            </button>

            <button type="button" className="stg-toggle-row" onClick={() => updateFlag("thresholdAlerts")}>
              <div>
                <strong>Cảnh báo vượt ngưỡng</strong>
                <span>Báo khi chi tiêu vượt ngân sách hoặc phát sinh bất thường.</span>
              </div>
              <span className={`stg-switch ${settings.thresholdAlerts ? "on" : ""} ${prefBusyKey === "thresholdAlerts" ? "busy" : ""}`}></span>
            </button>

            <button type="button" className="stg-toggle-row" onClick={() => updateFlag("cloudSync")}>
              <div>
                <strong>Đồng bộ đám mây</strong>
                <span>Giữ cấu hình tài khoản nhất quán khi đăng nhập ở thiết bị khác.</span>
              </div>
              <span className={`stg-switch ${settings.cloudSync ? "on" : ""} ${prefBusyKey === "cloudSync" ? "busy" : ""}`}></span>
            </button>
          </section>

          <section className="stg-card">
            <div className="stg-card-head">
              <div>
                <h3>Giao diện & cá nhân hóa</h3>
                <p>Mỗi thay đổi được lưu vào tài khoản và áp dụng ngay lập tức.</p>
              </div>
            </div>

            <div className="stg-field-block">
              <label>Ngôn ngữ hiển thị</label>
              <div className="stg-option-grid stg-option-grid-inline">
                {languageOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`stg-choice ${language === option.value ? "active" : ""}`}
                    onClick={() => persistLanguage(option.value)}
                    disabled={prefBusyKey === "language"}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="stg-field-block">
              <label>Chế độ màu</label>
              <div className="stg-theme-grid">
                {themeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`stg-theme-card ${uiPrefs.theme === option.value ? "active" : ""}`}
                    onClick={() => persistUi("theme", option.value)}
                    disabled={prefBusyKey === "theme"}
                  >
                    <span className={`stg-theme-preview ${option.value}`}></span>
                    <strong>{option.label}</strong>
                    <span>{option.description}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="stg-field-block">
              <label>Chủ đề màu</label>
              <div className="stg-color-row">
                {UI_COLORS.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    className={`stg-color-swatch ${uiPrefs.brandColor === color.value ? "active" : ""}`}
                    style={{ background: color.value }}
                    onClick={() => persistUi("brandColor", color.value)}
                    aria-label={color.label}
                  >
                    {uiPrefs.brandColor === color.value ? "✓" : ""}
                  </button>
                ))}
                <label className="stg-color-swatch stg-color-custom" style={{ background: uiPrefs.brandColor }}>
                  +
                  <input type="color" value={uiPrefs.brandColor} onChange={(event) => persistUi("brandColor", event.target.value)} />
                </label>
              </div>
            </div>

            <div className="stg-field-block">
              <label>Bố cục hiển thị</label>
              <div className="stg-layout-grid">
                {UI_LAYOUTS.map((layout) => {
                  const copy = layoutCopy[layout.id] || { name: layout.name, description: layout.description };
                  const isActive = uiPrefs.templateId === layout.id;
                  return (
                    <button
                      key={layout.id}
                      type="button"
                      className={`stg-layout-option ${isActive ? "active" : ""}`}
                      onClick={() => persistUi("templateId", layout.id)}
                      disabled={prefBusyKey === "templateId"}
                    >
                      <div className={`stg-layout-preview stg-layout-preview-${layout.id}`}>
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                      <div className="stg-layout-copy">
                        <strong>{copy.name}</strong>
                        <span>{copy.description}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
