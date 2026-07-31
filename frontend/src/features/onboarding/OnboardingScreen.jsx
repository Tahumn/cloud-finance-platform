import { useEffect, useMemo, useState } from "react";
import {
  applyUserPrefs,
  getDefaultTimezone,
  saveCategoryPrefs,
  saveUserPrefs,
  setOnboardingDone
} from "../../utils/userPrefs.js";
import { applyUiPrefs, saveUiPrefs, UI_COLORS, UI_LAYOUTS } from "../../utils/uiPrefs.js";
import { updateMe } from "../../api/auth.js";
import { createAccount, createCategory, listAccounts, listCategories } from "../../api/finance.js";
import { currency, formatNumberInput, parseNumberInput } from "../../utils/format.js";
import {
  CATEGORY_ICON_OPTIONS,
  DEFAULT_ONBOARDING_CATEGORIES,
  renderCategoryIcon
} from "../../utils/categoryVisuals.jsx";
import "./onboarding.css";

const PROVIDERS = {
  bank: ["Vietcombank", "Techcombank", "BIDV", "Agribank", "Vietinbank", "MB Bank", "TPBank", "VPBank", "ACB", "OCB", "VIB"],
  wallet: ["MoMo", "ZaloPay", "ShopeePay", "Viettel Money", "Moca"],
  credit: ["Visa", "Mastercard", "JCB", "American Express"]
};

const ACCOUNT_TYPES = [
  { value: "cash", label: "Tiền mặt" },
  { value: "bank", label: "Ngân hàng" },
  { value: "wallet", label: "Ví điện tử" },
  { value: "credit", label: "Thẻ tín dụng" }
];

const LANGUAGE_OPTIONS = [
  { value: "vi", label: "Tiếng Việt" },
  { value: "en", label: "English" }
];

const THEME_OPTIONS = [
  { value: "light", label: "Sáng", description: "Nền sáng, chữ đậm, dễ đọc ban ngày." },
  { value: "dark", label: "Tối", description: "Nền tối, chữ sáng, đồng bộ toàn màn hình." }
];

const FONT_SCALE_OPTIONS = [
  { value: "small", label: "Nhỏ", scale: 0.92 },
  { value: "medium", label: "Trung bình", scale: 1 },
  { value: "large", label: "Lớn", scale: 1.08 }
];

const LAYOUT_COPY = {
  classic: { name: "Classic Stack", description: "Cân bằng, dễ đọc." },
  airy: { name: "Airy Space", description: "Rộng rãi, thoáng mắt." },
  compact: { name: "Compact Focus", description: "Gọn, tập trung dữ liệu." },
  editorial: { name: "Editorial", description: "Nhấn mạnh dữ liệu." }
};

const STEP_COPY = {
  1: "Hoàn tất thông tin cơ bản để khởi tạo tài khoản đầu tiên của bạn.",
  2: "Chọn các danh mục bạn thường dùng. Bạn có thể thêm mới và danh mục sẽ được tạo thật ở backend.",
  3: "Tùy chỉnh ngôn ngữ và giao diện. Khung xem trước bên dưới phản ánh đúng lựa chọn hiện tại.",
  4: "Xem lại toàn bộ thiết lập trước khi bắt đầu sử dụng."
};

const FONT_SCALE_MAP = FONT_SCALE_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item.scale;
  return acc;
}, {});

const normalizeCategories = (items) => {
  const seen = new Set();
  const duplicates = new Set();
  const normalized = [];

  items.forEach((item, index) => {
    const name = String(item?.name || "").trim();
    const key = name.toLowerCase();
    if (item?.enabled && !name) {
      duplicates.add(`blank-${index}`);
      return;
    }
    if (!item?.enabled || !name) return;
    if (seen.has(key)) {
      duplicates.add(key);
      return;
    }
    seen.add(key);
    normalized.push({ ...item, name, iconKey: item.iconKey || "tag", color: item.color || "#64748b" });
  });

  return { normalized, duplicates };
};

const accountTypeLabel = (type) => ACCOUNT_TYPES.find((item) => item.value === type)?.label || "Tài khoản";
const fontScaleLabel = (value) => FONT_SCALE_OPTIONS.find((item) => item.value === value)?.label || "Trung bình";
const themeLabel = (value) => THEME_OPTIONS.find((item) => item.value === value)?.label || "Sáng";
const layoutLabel = (value) => LAYOUT_COPY[value]?.name || UI_LAYOUTS[0]?.name || "Classic Stack";

export default function OnboardingScreen({ userEmail, currentUiPrefs, onComplete }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [iconPickerTarget, setIconPickerTarget] = useState(null);
  const [accName, setAccName] = useState("");
  const [accType, setAccType] = useState("wallet");
  const [accProvider, setAccProvider] = useState("");
  const [accLast4, setAccLast4] = useState("");
  const [accBalance, setAccBalance] = useState("");
  const [accLimit, setAccLimit] = useState("");
  const [categories, setCategories] = useState(() => DEFAULT_ONBOARDING_CATEGORIES.map((item) => ({ ...item })));
  const [language, setLanguage] = useState("vi");
  const [theme, setTheme] = useState(currentUiPrefs?.theme === "dark" ? "dark" : "light");
  const [primaryColor, setPrimaryColor] = useState(currentUiPrefs?.brandColor || UI_COLORS[0].value);
  const [layoutTemplate, setLayoutTemplate] = useState(currentUiPrefs?.templateId || UI_LAYOUTS[0].id);
  const [fontScale, setFontScale] = useState("medium");

  useEffect(() => {
    const handleClick = () => setIconPickerTarget(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  const { normalized: selectedCategories, duplicates } = useMemo(() => normalizeCategories(categories), [categories]);
  const activeLayout = useMemo(() => UI_LAYOUTS.find((item) => item.id === layoutTemplate) || UI_LAYOUTS[0], [layoutTemplate]);

  const previewStyle = useMemo(() => {
    const dark = theme === "dark";
    return {
      "--onb-primary": primaryColor,
      "--onb-preview-shell": dark ? "#0b1728" : "#ffffff",
      "--onb-preview-bg": dark ? "#07111f" : "#f8fbff",
      "--onb-preview-panel": dark ? "#122238" : "#ffffff",
      "--onb-preview-border": dark ? "rgba(148,163,184,0.16)" : "#dbe4f0",
      "--onb-preview-text": dark ? "#f8fafc" : "#0f172a",
      "--onb-preview-muted": dark ? "#94a3b8" : "#64748b",
      "--onb-preview-shadow": dark ? "0 24px 48px rgba(2,6,23,0.42)" : "0 20px 40px rgba(15,23,42,0.10)",
      "--onb-preview-radius": activeLayout.values.cardRadius,
      "--onb-preview-gap": activeLayout.values.gridGap,
      "--onb-preview-padding": activeLayout.values.panelPadding,
      "--onb-preview-title": `calc(${activeLayout.values.pageTitleSize} * 0.5)`,
      "--onb-preview-font-scale": String(FONT_SCALE_MAP[fontScale] || 1),
      "--onb-preview-sidebar": `min(88px, calc(${activeLayout.values.sidebarWidth} * 0.32))`
    };
  }, [activeLayout, fontScale, primaryColor, theme]);

  const validateStep = () => {
    setError("");
    if (step === 1) {
      if (!accName.trim()) return setError("Vui lòng nhập tên tài khoản hoặc thẻ đầu tiên."), false;
      if (!parseNumberInput(accBalance)) return setError("Vui lòng nhập số dư ban đầu lớn hơn 0."), false;
    }
    if (step === 2) {
      if (selectedCategories.length === 0) return setError("Vui lòng chọn ít nhất một danh mục để tiếp tục."), false;
      if (categories.some((item) => item.enabled && !String(item.name || "").trim())) return setError("Danh mục đang bật không được để trống tên."), false;
      if (duplicates.size > 0) return setError("Tên danh mục đang bị trùng. Vui lòng sửa trước khi tiếp tục."), false;
    }
    return true;
  };

  const updateCategory = (index, patch) => {
    setCategories((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };

  const addCategory = () => {
    setCategories((current) => [...current, { id: `custom-${Date.now()}`, name: "", iconKey: "tag", color: "#64748b", enabled: true, custom: true }]);
  };

  const goNext = () => {
    if (!validateStep()) return;
    setStep((current) => Math.min(4, current + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    setError("");
    setStep((current) => Math.max(1, current - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const handleFinish = async () => {
    if (!validateStep()) return;
    setSaving(true);
    setError("");

    try {
      const [existingCategories, existingAccounts] = await Promise.all([
        listCategories().catch(() => []),
        listAccounts().catch(() => [])
      ]);

      const existingCategoryNames = new Set(existingCategories.map((item) => String(item.name || "").trim().toLowerCase()));
      for (const category of selectedCategories) {
        const key = category.name.toLowerCase();
        if (!existingCategoryNames.has(key)) {
          await createCategory(category.name);
          existingCategoryNames.add(key);
        }
      }

      saveCategoryPrefs(
        userEmail,
        selectedCategories.reduce((acc, item) => {
          acc[item.name] = { iconKey: item.iconKey, color: item.color };
          return acc;
        }, {})
      );

      const accountName = accName.trim();
      const accountExists = existingAccounts.some(
        (item) => String(item?.name || "").trim().toLowerCase() === accountName.toLowerCase()
      );

      if (!accountExists) {
        await createAccount({
          name: accountName,
          type: accType,
          provider: accProvider || null,
          last4: accLast4 || null,
          balance: parseNumberInput(accBalance),
          credit_limit: parseNumberInput(accLimit) || null,
          color: primaryColor,
          currency: "VND"
        });
      }

      const nextUserPrefs = {
        language,
        currency: "VND",
        timezone: getDefaultTimezone(),
        theme,
        primaryColor,
        fontScale
      };
      const nextUiPrefs = {
        ...(currentUiPrefs || {}),
        theme,
        brandColor: primaryColor,
        templateId: layoutTemplate
      };

      saveUserPrefs(userEmail, nextUserPrefs);
      applyUserPrefs(nextUserPrefs);
      saveUiPrefs(userEmail, nextUiPrefs);
      applyUiPrefs(nextUiPrefs);

      const updatedUser = await updateMe({
        language_preference: language,
        theme_preference: theme,
        layout_preference: layoutTemplate,
        brand_color: primaryColor,
        onboarding_completed: true
      });

      setOnboardingDone(userEmail, true);
      onComplete?.(updatedUser);
    } catch (err) {
      setError(err?.message || "Không thể hoàn tất thiết lập. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="onb-shell">
      <div className="onb-card">
        <header className="onb-header">
          <div>
            <p className="onb-eyebrow">Thiết lập lần đầu</p>
            <h1>Bước {step} / 4</h1>
            <p className="onb-subtitle">{STEP_COPY[step]}</p>
          </div>
          <span className="onb-step-badge">{step}/4</span>
        </header>

        <div className="onb-progress" aria-hidden="true">
          <div className="onb-progress-bar" style={{ width: `${((step - 1) / 3) * 100}%` }}></div>
          {[1, 2, 3, 4].map((item) => (
            <span key={item} className={`onb-progress-dot ${item <= step ? "active" : ""}`}></span>
          ))}
        </div>

        {error ? <div className="onb-error">{error}</div> : null}

        {step === 1 ? (
          <section className="onb-step-grid">
            <div className="onb-panel">
              <div className="onb-panel-head">
                <h2>Tài khoản đầu tiên</h2>
                <p>Tài khoản này được tạo thật ở backend ngay khi hoàn tất thiết lập.</p>
              </div>

              <div className="onb-field-block">
                <label>Tên tài khoản / thẻ</label>
                <input value={accName} onChange={(event) => setAccName(event.target.value)} placeholder="Ví dụ: Ví điện tử, Techcombank, Thẻ lương..." />
              </div>

              <div className="onb-choice-grid onb-choice-grid-4">
                {ACCOUNT_TYPES.map((item) => (
                  <button key={item.value} type="button" className={`onb-choice-card ${accType === item.value ? "active" : ""}`} onClick={() => { setAccType(item.value); setAccProvider(""); }}>
                    <strong>{item.label}</strong>
                  </button>
                ))}
              </div>

              {accType !== "cash" ? (
                <div className="onb-field-block">
                  <label>Nhà cung cấp</label>
                  <select value={accProvider} onChange={(event) => setAccProvider(event.target.value)}>
                    <option value="">Chọn nhà cung cấp</option>
                    {(PROVIDERS[accType] || []).map((provider) => <option key={provider} value={provider}>{provider}</option>)}
                  </select>
                </div>
              ) : null}

              <div className="onb-field-row">
                {accType !== "cash" ? (
                  <div className="onb-field-block">
                    <label>4 số cuối</label>
                    <input value={accLast4} maxLength={4} onChange={(event) => setAccLast4(event.target.value.replace(/\D/g, ""))} placeholder="1234" />
                  </div>
                ) : null}
                <div className="onb-field-block">
                  <label>Số dư ban đầu</label>
                  <input value={accBalance} onChange={(event) => setAccBalance(formatNumberInput(event.target.value))} placeholder="Ví dụ: 15.000.000" />
                </div>
              </div>

              {accType === "credit" ? (
                <div className="onb-field-block">
                  <label>Hạn mức tín dụng</label>
                  <input value={accLimit} onChange={(event) => setAccLimit(formatNumberInput(event.target.value))} placeholder="Ví dụ: 20.000.000" />
                </div>
              ) : null}
            </div>

            <aside className="onb-preview-card">
              <p className="onb-preview-label">Xem trước tài khoản</p>
              <div className="onb-account-sample">
                <div className="onb-account-icon">{renderCategoryIcon("wallet", { size: 24 })}</div>
                <div>
                  <strong>{accName.trim() || "Tài khoản mới"}</strong>
                  <span>{accountTypeLabel(accType)}{accProvider ? ` • ${accProvider}` : ""}</span>
                </div>
                <b>{currency(parseNumberInput(accBalance) || 0)}</b>
              </div>
              <div className="onb-info-box">Số dư này sẽ được dùng làm số dư mở đầu ngay sau khi đăng nhập vào ứng dụng.</div>
            </aside>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="onb-panel">
            <div className="onb-panel-head onb-panel-head-row">
              <div>
                <h2>Danh mục sử dụng</h2>
                <p>Danh mục bật sẽ được tạo thật ở backend và xuất hiện sau khi đăng nhập.</p>
              </div>
              <button type="button" className="onb-secondary-btn" onClick={addCategory}>+ Thêm danh mục</button>
            </div>

            <div className="onb-category-list">
              {categories.map((category, index) => {
                const duplicateKey = String(category.name || "").trim().toLowerCase();
                const isDuplicate = duplicateKey && duplicates.has(duplicateKey);
                return (
                  <div key={category.id || index} className={`onb-category-row ${isDuplicate ? "duplicate" : ""}`}>
                    <label className="onb-switch-check">
                      <input type="checkbox" checked={Boolean(category.enabled)} onChange={(event) => updateCategory(index, { enabled: event.target.checked })} />
                      <span></span>
                    </label>

                    <div className="onb-category-icon-wrap" onClick={(event) => event.stopPropagation()}>
                      <button type="button" className="onb-category-icon" style={{ background: `${category.color}18`, color: category.color }} onClick={() => setIconPickerTarget(iconPickerTarget === index ? null : index)}>
                        {renderCategoryIcon(category.iconKey, { size: 18 })}
                      </button>
                      {iconPickerTarget === index ? (
                        <div className="onb-icon-picker">
                          {CATEGORY_ICON_OPTIONS.map((item) => (
                            <button key={item.key} type="button" className={`onb-icon-option ${category.iconKey === item.key ? "active" : ""}`} onClick={() => { updateCategory(index, { iconKey: item.key }); setIconPickerTarget(null); }} title={item.label}>
                              {renderCategoryIcon(item.key, { size: 16 })}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <input className="onb-category-name" value={category.name} onChange={(event) => updateCategory(index, { name: event.target.value })} placeholder="Tên danh mục" />
                    <label className="onb-color-picker"><span style={{ background: category.color }}></span><input type="color" value={category.color} onChange={(event) => updateCategory(index, { color: event.target.value })} /></label>
                    {category.custom ? <button type="button" className="onb-icon-btn danger" onClick={() => setCategories((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Xóa</button> : null}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
        {step === 3 ? (
          <section className="onb-step-grid onb-step-grid-wide">
            <div className="onb-panel">
              <div className="onb-panel-head">
                <h2>Ngôn ngữ & giao diện</h2>
                <p>Phần xem trước bên dưới thay đổi tức thời theo đúng lựa chọn của bạn.</p>
              </div>

              <div className="onb-form-stack">
                <div className="onb-setting-block">
                  <label>Ngôn ngữ</label>
                  <div className="onb-choice-grid onb-choice-grid-2">
                    {LANGUAGE_OPTIONS.map((item) => (
                      <button key={item.value} type="button" className={`onb-choice-card ${language === item.value ? "active" : ""}`} onClick={() => setLanguage(item.value)}>
                        <strong>{item.label}</strong>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="onb-setting-block">
                  <label>Chế độ màu</label>
                  <div className="onb-theme-grid">
                    {THEME_OPTIONS.map((item) => (
                      <button key={item.value} type="button" className={`onb-theme-card ${theme === item.value ? "active" : ""}`} onClick={() => setTheme(item.value)}>
                        <span className={`onb-theme-swatch ${item.value}`}></span>
                        <strong>{item.label}</strong>
                        <span>{item.description}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="onb-setting-block">
                  <label>Màu chủ đạo</label>
                  <div className="onb-color-row">
                    {UI_COLORS.map((item) => (
                      <button key={item.id} type="button" className={`onb-color-chip ${primaryColor === item.value ? "active" : ""}`} style={{ background: item.value }} onClick={() => setPrimaryColor(item.value)} aria-label={item.label}>
                        {primaryColor === item.value ? "✓" : ""}
                      </button>
                    ))}
                    <label className="onb-color-chip onb-color-custom" style={{ background: primaryColor }}>
                      +
                      <input type="color" value={primaryColor} onChange={(event) => setPrimaryColor(event.target.value)} />
                    </label>
                  </div>
                </div>

                <div className="onb-setting-block">
                  <label>Cỡ chữ</label>
                  <div className="onb-choice-grid onb-choice-grid-3">
                    {FONT_SCALE_OPTIONS.map((item) => (
                      <button key={item.value} type="button" className={`onb-choice-card ${fontScale === item.value ? "active" : ""}`} onClick={() => setFontScale(item.value)}>
                        <strong>{item.label}</strong>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="onb-setting-block">
                  <label>Bố cục hiển thị</label>
                  <div className="onb-layout-grid">
                    {UI_LAYOUTS.map((item) => (
                      <button key={item.id} type="button" className={`onb-layout-card ${layoutTemplate === item.id ? "active" : ""}`} onClick={() => setLayoutTemplate(item.id)}>
                        <div className={`onb-layout-mini onb-layout-mini-${item.id}`}>
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                        <div>
                          <strong>{LAYOUT_COPY[item.id]?.name || item.name}</strong>
                          <span>{LAYOUT_COPY[item.id]?.description || item.description}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <aside className="onb-preview-card">
              <p className="onb-preview-label">Demo giao diện theo lựa chọn hiện tại</p>
              <div className={`onb-live-preview ${theme}`} style={previewStyle}>
                <div className="onb-live-sidebar"><span className="active"></span><span></span><span></span></div>
                <div className="onb-live-main">
                  <div className="onb-live-topbar">
                    <div>
                      <strong>{language === "vi" ? "Tổng quan" : "Overview"}</strong>
                      <p>{language === "vi" ? "Bảng điều khiển tài chính cá nhân" : "Personal finance dashboard"}</p>
                    </div>
                    <span className="onb-live-avatar"></span>
                  </div>
                  <div className="onb-live-hero">
                    <label>{language === "vi" ? "Số dư khả dụng" : "Available balance"}</label>
                    <h3>{currency(15000000)}</h3>
                    <div className="onb-live-hero-row">
                      <div><span>{language === "vi" ? "Thu nhập" : "Income"}</span><strong>{currency(15000000)}</strong></div>
                      <div><span>{language === "vi" ? "Chi tiêu" : "Expense"}</span><strong>{currency(1200000)}</strong></div>
                    </div>
                  </div>
                  <div className="onb-live-grid">
                    <div className="onb-live-tile">
                      <small>{language === "vi" ? "Ngân sách" : "Budget"}</small>
                      <div className="onb-live-bar"><span style={{ width: "64%" }}></span></div>
                      <p>{language === "vi" ? "Đã dùng 64%" : "64% used"}</p>
                    </div>
                    <div className="onb-live-tile">
                      <small>{language === "vi" ? "Danh mục nổi bật" : "Top category"}</small>
                      <strong>{selectedCategories[0]?.name || "Ăn uống"}</strong>
                      <p>{language === "vi" ? "Theo màu và bố cục đã chọn" : "Styled with your theme"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </section>
        ) : null}

        {step === 4 ? (
          <section className="onb-step-grid onb-step-grid-wide">
            <div className="onb-panel">
              <div className="onb-panel-head">
                <h2>Xác nhận & hoàn tất</h2>
                <p>Tất cả lựa chọn dưới đây sẽ được áp dụng ngay và giữ lại cho các lần đăng nhập sau.</p>
              </div>

              <div className="onb-summary-grid">
                <div className="onb-summary-card"><span>Tài khoản / thẻ đầu tiên</span><strong>{accName.trim() || "Chưa đặt tên"}</strong><p>{accountTypeLabel(accType)}</p></div>
                <div className="onb-summary-card"><span>Số dư ban đầu</span><strong>{currency(parseNumberInput(accBalance) || 0)}</strong><p>{accProvider || "Sẵn sàng sử dụng"}</p></div>
                <div className="onb-summary-card"><span>Số danh mục đã chọn</span><strong>{selectedCategories.length} danh mục</strong><p>{selectedCategories.slice(0, 3).map((item) => item.name).join(" • ") || "Chưa có"}</p></div>
                <div className="onb-summary-card"><span>Ngôn ngữ</span><strong>{LANGUAGE_OPTIONS.find((item) => item.value === language)?.label || "Tiếng Việt"}</strong><p>Đã đồng bộ vào tài khoản</p></div>
                <div className="onb-summary-card"><span>Chế độ màu</span><strong>{themeLabel(theme)}</strong><p>Bố cục: {layoutLabel(layoutTemplate)}</p></div>
                <div className="onb-summary-card"><span>Cỡ chữ</span><strong>{fontScaleLabel(fontScale)}</strong><p>Màu chủ đạo đang chọn</p><div className="onb-summary-color" style={{ background: primaryColor }}></div></div>
              </div>

              <div className="onb-final-tags">
                {selectedCategories.map((item) => (
                  <span key={item.id || item.name} className="onb-final-tag" style={{ background: `${item.color}16`, color: item.color }}>
                    {renderCategoryIcon(item.iconKey, { size: 14 })}
                    {item.name}
                  </span>
                ))}
              </div>
            </div>

            <aside className="onb-preview-card">
              <p className="onb-preview-label">Tóm tắt giao diện sẽ được áp dụng</p>
              <div className={`onb-live-preview ${theme}`} style={previewStyle}>
                <div className="onb-live-sidebar"><span className="active"></span><span></span><span></span></div>
                <div className="onb-live-main">
                  <div className="onb-live-topbar">
                    <div><strong>{layoutLabel(layoutTemplate)}</strong><p>{themeLabel(theme)} • {fontScaleLabel(fontScale)}</p></div>
                    <span className="onb-live-avatar"></span>
                  </div>
                  <div className="onb-live-hero">
                    <label>{language === "vi" ? "Số dư khởi tạo" : "Starting balance"}</label>
                    <h3>{currency(parseNumberInput(accBalance) || 0)}</h3>
                    <div className="onb-live-hero-row compact">
                      <div><span>{language === "vi" ? "Danh mục" : "Categories"}</span><strong>{selectedCategories.length}</strong></div>
                      <div><span>{language === "vi" ? "Tài khoản" : "Account"}</span><strong>{accName.trim() || "—"}</strong></div>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </section>
        ) : null}

        <footer className="onb-actions">
          <button type="button" className="onb-back-btn" onClick={goBack} disabled={step === 1 || saving}>Quay lại</button>
          {step < 4 ? (
            <button type="button" className="onb-primary-btn" onClick={goNext} style={{ background: primaryColor }}>Tiếp tục</button>
          ) : (
            <button type="button" className="onb-primary-btn" onClick={handleFinish} disabled={saving} style={{ background: primaryColor }}>
              {saving ? "Đang xử lý..." : "Bắt đầu sử dụng"}
            </button>
          )}
        </footer>
      </div>
    </main>
  );
}
