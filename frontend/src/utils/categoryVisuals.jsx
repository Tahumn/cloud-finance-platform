import React from "react";

const iconProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
};

const makeIcon = (paths) => function CategoryIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...iconProps}>
      {paths}
    </svg>
  );
};

const ICON_COMPONENTS = {
  utensils: makeIcon(<><path d="M4 3v7a2 2 0 0 0 2 2h3" /><path d="M8 3v18" /><path d="M12 3v7a2 2 0 0 0 2 2h1" /><path d="M18 2v20" /><path d="M15 7h3" /></>),
  car: makeIcon(<><path d="M14 16H9" /><path d="m2 12 1.5-3A2 2 0 0 1 5.3 8h8.9a2 2 0 0 1 1.65.88L18 12h2a2 2 0 0 1 2 2v2h-2" /><circle cx="6.5" cy="16.5" r="2.5" /><circle cx="17.5" cy="16.5" r="2.5" /></>),
  gamepad: makeIcon(<><path d="M6 12h4" /><path d="M8 10v4" /><path d="M15 11h.01" /><path d="M18 13h.01" /><rect x="2" y="7" width="20" height="10" rx="4" /></>),
  piggy: makeIcon(<><path d="M17.8 10.5a4.8 4.8 0 0 1 2.2 4V16h-2.1a4.9 4.9 0 0 1-4.9 4H7.6A3.6 3.6 0 0 1 4 16.4V12a5.5 5.5 0 0 1 5.5-5.5h4.8a4.5 4.5 0 0 1 3.5 1.7" /><path d="M16 9h3" /><path d="M8 12h.01" /></>),
  receipt: makeIcon(<><path d="M8 3h8l3 3v15l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6" /><path d="M9 12h6" /><path d="M9 16h4" /></>),
  briefcase: makeIcon(<><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /><path d="M3 12h18" /></>),
  chart: makeIcon(<><path d="M4 19h16" /><path d="M7 15v-4" /><path d="M12 15V8" /><path d="M17 15v-7" /></>),
  home: makeIcon(<><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9" /><path d="M9 20v-6h6v6" /></>),
  heart: makeIcon(<><path d="m12 20-1.2-1.1C5.2 13.8 2 10.9 2 7.3 2 4.7 4 3 6.5 3c1.7 0 3.4.8 4.5 2.1C12.1 3.8 13.8 3 15.5 3 18 3 20 4.7 20 7.3c0 3.6-3.2 6.5-8.8 11.6Z" /></>),
  wallet: makeIcon(<><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H19v14H5.5A2.5 2.5 0 0 1 3 16.5v-9Z" /><path d="M19 10h2v4h-2" /><path d="M16 12h.01" /></>),
  tag: makeIcon(<><path d="M20 10 10 20l-7-7V4h9Z" /><path d="M7.5 7.5h.01" /></>),
  plus: makeIcon(<><path d="M12 5v14" /><path d="M5 12h14" /></>)
};

export const CATEGORY_ICON_OPTIONS = [
  { key: "utensils", label: "Ăn uống" },
  { key: "car", label: "Di chuyển" },
  { key: "gamepad", label: "Giải trí" },
  { key: "piggy", label: "Tiết kiệm" },
  { key: "receipt", label: "Hóa đơn" },
  { key: "briefcase", label: "Thu nhập" },
  { key: "chart", label: "Đầu tư" },
  { key: "home", label: "Nhà cửa" },
  { key: "heart", label: "Sức khỏe" },
  { key: "wallet", label: "Ví / tài khoản" },
  { key: "tag", label: "Khác" }
];

export const DEFAULT_ONBOARDING_CATEGORIES = [
  { id: "food", name: "Ăn uống", iconKey: "utensils", color: "#ff8b5f", enabled: true },
  { id: "transport", name: "Di chuyển", iconKey: "car", color: "#38b6ff", enabled: true },
  { id: "fun", name: "Giải trí", iconKey: "gamepad", color: "#ffd166", enabled: true },
  { id: "saving", name: "Tiết kiệm", iconKey: "piggy", color: "#06d6a0", enabled: true },
  { id: "bill", name: "Hóa đơn", iconKey: "receipt", color: "#ff7b6b", enabled: true },
  { id: "income", name: "Thu nhập", iconKey: "briefcase", color: "#8e7dff", enabled: true },
  { id: "invest", name: "Cổ phiếu", iconKey: "chart", color: "#64748b", enabled: true }
];

export function renderCategoryIcon(iconKey, { size = 18, fallback = "tag" } = {}) {
  const Component = ICON_COMPONENTS[iconKey] || ICON_COMPONENTS[fallback] || ICON_COMPONENTS.tag;
  return <Component size={size} />;
}

export function renderStoredCategoryIcon(pref, { size = 18, fallback = "tag" } = {}) {
  if (typeof pref?.icon === "string" && pref.icon.trim()) {
    return pref.icon;
  }
  if (typeof pref?.iconKey === "string" && pref.iconKey.trim()) {
    return renderCategoryIcon(pref.iconKey, { size, fallback });
  }
  return renderCategoryIcon(fallback, { size, fallback });
}
