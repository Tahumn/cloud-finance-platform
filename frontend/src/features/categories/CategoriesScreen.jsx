import { useState } from "react";
import { colorFor, onColor } from "../../utils/colors.js";
import { getCategoryPrefs } from "../../utils/userPrefs.js";
import { t } from "../../utils/i18n.js";
import { renderStoredCategoryIcon } from "../../utils/categoryVisuals.jsx";

export default function CategoriesScreen({
  categories,
  onCreate,
  onUpdate,
  onDelete,
  onBack,
  loading,
  userEmail,
  embedded = false,
  collapsible = false,
  collapsed = false,
  onToggle
}) {
  const categoryPrefs = getCategoryPrefs(userEmail);
  const [categoryName, setCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState(null);

  const resetForm = () => {
    setCategoryName("");
    setEditingCategoryId(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const name = categoryName.trim();
    if (!name) return;
    if (editingCategoryId) {
      await onUpdate?.(editingCategoryId, { name });
    } else {
      await onCreate?.(name);
    }
    resetForm();
  };

  const startEdit = (category) => {
    setEditingCategoryId(category.id);
    setCategoryName(category.name || "");
  };

  const handleDelete = async (category) => {
    if (!onDelete) return;
    if (!window.confirm(`X?a danh m?c "${category.name}"?`)) return;
    await onDelete(category.id);
    if (editingCategoryId === category.id) resetForm();
  };

  return (
    <section className={`panel ${embedded ? "embedded-panel" : ""}`}>
      <div className="panel-header">
        <h3>{t("categories.title")}</h3>
        <div className="panel-actions">
          {onBack && (
            <button className="ghost" onClick={onBack} type="button">
              {t("common.back")}
            </button>
          )}
          {collapsible && (
            <button
              className="chevron-btn"
              type="button"
              onClick={onToggle}
              aria-expanded={!collapsed}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  d="M6 9l6 6 6-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
      {!collapsed && (
        <>
          <form className="form" onSubmit={handleSubmit}>
            <div className="row">
              <input
                name="name"
                type="text"
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                placeholder={t("categories.input")}
                required
              />
              <button className="primary" type="submit" disabled={loading}>
                {editingCategoryId ? t("common.save") : t("categories.add")}
              </button>
            </div>
            {editingCategoryId && (
              <div className="row-actions">
                <button className="ghost" type="button" onClick={resetForm}>
                  H?y
                </button>
              </div>
            )}
          </form>
          {categories.length === 0 ? (
            <p className="empty">{t("categories.empty")}</p>
          ) : embedded ? (
            <div className="category-picker categories-inline">
              {categories.map((category) => {
                const bg = colorFor(category.name, userEmail);
                return (
                  <div
                    key={category.id}
                    className="category-pill static color-pill"
                    style={{ "--pill-bg": bg, "--pill-fg": onColor(bg) }}
                  >
                    <span className="pill-icon" aria-hidden="true">
                      {renderStoredCategoryIcon(categoryPrefs[category.name], { size: 14 })}
                    </span>
                    <span className="pill-text">{category.name}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="list">
              {categories.map((category) => (
                <div key={category.id} className="item-row">
                  <div className="category-row">
                    <span className="dot" style={{ background: colorFor(category.name, userEmail) }} />
                    {categoryPrefs[category.name] && (
                      <span className="tag-chip">{renderStoredCategoryIcon(categoryPrefs[category.name], { size: 14 })}</span>
                    )}
                    <p>{category.name}</p>
                  </div>
                  <div className="row-actions">
                    <button className="ghost" type="button" onClick={() => startEdit(category)}>
                      S?a
                    </button>
                    <button className="ghost danger" type="button" onClick={() => handleDelete(category)}>
                      X?a
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
