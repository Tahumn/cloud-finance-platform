import { useEffect, useMemo, useState } from "react";
import { currency, formatNumberInput, parseNumberInput } from "../../utils/format.js";
import { getCatMeta } from "../../utils/categoryIcons.jsx";
import "./budgets.css";

const toD = (d) => d.toISOString().slice(0, 10);
const emptyForm = (defaults = {}) => ({
  categoryId: defaults.categoryId || "",
  amount: defaults.amount || "",
  periodStart: defaults.periodStart || "",
  periodEnd: defaults.periodEnd || "",
});
const normalizeStatus = (plan) => {
  const progress = Number(plan?.progress || 0);
  if (progress >= 100) return "exceeded";
  if (progress >= 80) return "warning";
  return "normal";
};

export default function BudgetsScreen({
  categories = [],
  budgets = [],
  filters = {},
  onCreateBudget,
  onUpdateBudget,
  onDeleteBudget,
  onFiltersChange,
  loading,
}) {
  const defaultStart = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    return toD(d);
  }, []);
  const defaultEnd = useMemo(() => toD(new Date()), []);

  const [form, setForm] = useState(() => emptyForm({ periodStart: filters.start || defaultStart, periodEnd: filters.end || defaultEnd }));
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sortMode, setSortMode] = useState("progress_desc");
  const [bdStart, setBdStart] = useState(filters.start || defaultStart);
  const [bdEnd, setBdEnd] = useState(filters.end || defaultEnd);

  useEffect(() => {
    setBdStart(filters.start || defaultStart);
    setBdEnd(filters.end || defaultEnd);
  }, [filters.start, filters.end, defaultStart, defaultEnd]);

  const plansWithStats = Array.isArray(budgets) ? budgets : [];
  const totalBudget = plansWithStats.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalSpent = plansWithStats.reduce((sum, p) => sum + Number(p.spent || 0), 0);
  const activePlansCount = plansWithStats.length;
  const overallProgress = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  const filteredPlans = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    const next = plansWithStats.filter((plan) => {
      const categoryName = String(plan.category || "").toLowerCase();
      if (query && !categoryName.includes(query)) return false;
      if (categoryFilter && String(plan.category_id) != String(categoryFilter)) return false;
      if (statusFilter && normalizeStatus(plan) !== statusFilter) return false;

      const planStart = plan.period_start || "";
      const planEnd = plan.period_end || "";
      if (bdStart && planEnd && planEnd < bdStart) return false;
      if (bdEnd && planStart && planStart > bdEnd) return false;
      return true;
    });

    next.sort((left, right) => {
      switch (sortMode) {
        case "progress_asc":
          return Number(left.progress || 0) - Number(right.progress || 0);
        case "amount_desc":
          return Number(right.amount || 0) - Number(left.amount || 0);
        case "amount_asc":
          return Number(left.amount || 0) - Number(right.amount || 0);
        case "spent_desc":
          return Number(right.spent || 0) - Number(left.spent || 0);
        case "spent_asc":
          return Number(left.spent || 0) - Number(right.spent || 0);
        case "name_asc":
          return String(left.category || "").localeCompare(String(right.category || ""), "vi");
        case "name_desc":
          return String(right.category || "").localeCompare(String(left.category || ""), "vi");
        case "progress_desc":
        default:
          return Number(right.progress || 0) - Number(left.progress || 0);
      }
    });

    return next;
  }, [bdEnd, bdStart, categoryFilter, plansWithStats, searchText, sortMode, statusFilter]);

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm({ periodStart: bdStart, periodEnd: bdEnd }));
  };

  const handleRangeChange = (field, value) => {
    if (field === "start") setBdStart(value);
    if (field === "end") setBdEnd(value);
    onFiltersChange?.((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const amount = parseNumberInput(form.amount);
    if (!(amount > 0) || !form.categoryId) return;

    const payload = {
      category_id: Number(form.categoryId),
      amount,
      period_start: form.periodStart || null,
      period_end: form.periodEnd || null,
    };

    if (editingId) {
      await onUpdateBudget?.(editingId, payload);
    } else {
      await onCreateBudget?.(payload);
    }
    closeForm();
  };

  const removePlan = async (planId, categoryName) => {
    if (!window.confirm(`Xóa ngân sách ${categoryName || "này"}?`)) return;
    await onDeleteBudget?.(planId);
    if (editingId === planId) closeForm();
  };

  const startEdit = (plan) => {
    setEditingId(plan.id);
    setForm(
      emptyForm({
        categoryId: String(plan.category_id || ""),
        amount: formatNumberInput(plan.amount),
        periodStart: plan.period_start || "",
        periodEnd: plan.period_end || "",
      })
    );
    setShowForm(true);
  };

  return (
    <div className="bgd-container">
      <div className="bgd-header-top">
        <div className="bgd-title-block">
          <h1 className="bgd-title">Ngân sách</h1>
        </div>
        <div className="bgd-header-actions">
          <button
            className="bgd-btn-add"
            onClick={() => {
              setForm(emptyForm({ periodStart: bdStart, periodEnd: bdEnd }));
              setEditingId(null);
              setShowForm(true);
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            <span className="btn-text">Ngân sách</span>
          </button>
        </div>
      </div>

      <div className="bgd-kpi-row">
        <div className="bgd-kpi-card">
          <div className="bgd-kpi-icon total"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg></div>
          <div className="bgd-kpi-text">
            <div className="bgd-kpi-label">Tổng ngân sách tháng</div>
            <div className="bgd-kpi-value total">{currency(totalBudget)}</div>
          </div>
        </div>
        <div className="bgd-kpi-card">
          <div className="bgd-kpi-icon spent"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg></div>
          <div className="bgd-kpi-text">
            <div className="bgd-kpi-label">Đã sử dụng</div>
            <div className="bgd-kpi-value spent">{currency(totalSpent)} <span className="pct">({overallProgress.toFixed(1)}%)</span></div>
            <div className="bgd-kpi-bar">
              <div className="bgd-kpi-bar-fill" style={{ width: `${Math.min(100, Math.max(0, overallProgress))}%` }}></div>
            </div>
          </div>
        </div>
        <div className="bgd-kpi-card">
          <div className="bgd-kpi-icon count"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></div>
          <div className="bgd-kpi-text">
            <div className="bgd-kpi-label">Đang hoạt động</div>
            <div className="bgd-kpi-value count">{activePlansCount} ngân sách</div>
          </div>
        </div>
      </div>

      <div className={`bgd-modal-overlay ${showForm ? "show" : ""}`}>
        <div className="bgd-modal-container">
          <form className="budget-form-card" onSubmit={handleSubmit}>
            <div className="bd-form-header">
              <h3>{editingId ? "Chỉnh sửa ngân sách" : "Thiết lập ngân sách"}</h3>
              <button type="button" className="bd-modal-close" onClick={closeForm} aria-label="Đóng">×</button>
            </div>

            <div className="bd-form-row">
              <div className="bd-field">
                <label>Danh mục</label>
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  required
                >
                  <option value="">Chọn danh mục</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="bd-field">
                <label>Ngân sách mục tiêu</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: formatNumberInput(e.target.value) })}
                  placeholder="0 đ"
                  required
                />
              </div>
            </div>

            <div className="bd-form-row">
              <div className="bd-field">
                <label>Từ ngày</label>
                <input type="date" value={form.periodStart} onChange={(e) => setForm({ ...form, periodStart: e.target.value })} />
              </div>
              <div className="bd-field">
                <label>Đến ngày</label>
                <input type="date" value={form.periodEnd} onChange={(e) => setForm({ ...form, periodEnd: e.target.value })} />
              </div>
            </div>

            <div className="bd-form-actions">
              <button type="button" className="bd-btn-cancel" onClick={closeForm}>Hủy</button>
              <button type="submit" className="bd-btn-save" disabled={loading}>Lưu ngân sách</button>
            </div>
          </form>
        </div>
      </div>

      <div className="bgd-filters-row">
        <div className="bgd-filters-left">
          <div className="bgd-date-range">
            <div className="bgd-date-field">
              <span>Từ ngày</span>
              <input type="date" value={bdStart} onChange={(e) => handleRangeChange("start", e.target.value)} />
            </div>
            <div className="bgd-date-field">
              <span>Đến ngày</span>
              <input type="date" value={bdEnd} onChange={(e) => handleRangeChange("end", e.target.value)} />
            </div>
          </div>
          <div className="bgd-searchbox">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input type="text" placeholder="Tìm kiếm ngân sách..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
          </div>
        </div>
        <div className="bgd-filters-right">
          <div className="bgd-fsel">
            <span>Danh mục:</span>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">Tất cả</option>
              {categories.map((cat) => (
                <option key={cat.id} value={String(cat.id)}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div className="bgd-fsel">
            <span>Trạng thái:</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Tất cả</option>
              <option value="normal">Bình thường</option>
              <option value="warning">Sắp vượt</option>
              <option value="exceeded">Vượt ngân sách</option>
            </select>
          </div>
          <div className="bgd-fsel">
            <span>Sắp xếp:</span>
            <select value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
              <option value="progress_desc">Tiến độ cao nhất</option>
              <option value="progress_asc">Tiến độ thấp nhất</option>
              <option value="amount_desc">Ngân sách lớn nhất</option>
              <option value="amount_asc">Ngân sách nhỏ nhất</option>
              <option value="spent_desc">Đã chi nhiều nhất</option>
              <option value="spent_asc">Đã chi ít nhất</option>
              <option value="name_asc">Tên A-Z</option>
              <option value="name_desc">Tên Z-A</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bgd-list">
        {filteredPlans.map((plan) => {
          const meta = getCatMeta(plan.category || "Khác");
          const statusKey = normalizeStatus(plan);
          let statusText = "Bình thường";
          let statusColor = "#10b981";
          let statusBg = "#d1fae5";

          if (statusKey === "exceeded") {
            statusText = "Vượt ngân sách";
            statusColor = "#ef4444";
            statusBg = "#fee2e2";
          } else if (statusKey === "warning") {
            statusText = "Sắp vượt";
            statusColor = "#f59e0b";
            statusBg = "#fef3c7";
          }

          return (
            <div key={plan.id} className="bgd-card" onClick={() => startEdit(plan)}>
              <div className="bgd-card-left">
                <div className="bgd-card-icon" style={{ background: meta.light, color: meta.bg }}>
                  <meta.SvgIcon size={24} />
                </div>
                <div className="bgd-card-info">
                  <h3>Ngân sách {plan.category || "Khác"}</h3>
                  <p>
                    Theo dõi: {plan.category || "Khác"}
                    {plan.period_start || plan.period_end ? ` • ${plan.period_start || "?"} • ${plan.period_end || "?"}` : " • Theo kỳ lọc hiện tại"}
                  </p>
                </div>
              </div>

              <div className="bgd-card-mid">
                <div className="bgd-progress-labels">
                  <span className="spent">{currency(plan.spent || 0)}</span>
                  <span className="budget">/ {currency(plan.amount || 0)}</span>
                </div>
                <div className="bgd-progress-bar">
                  <div className="bgd-bar-fill" style={{ width: `${Math.min(100, Math.max(0, Number(plan.progress || 0)))}%`, background: statusColor }}></div>
                </div>
                <div className="bgd-progress-rem">
                  Còn lại {currency(Math.max(0, Number(plan.remaining || 0)))} ({Math.max(0, 100 - Number(plan.progress || 0)).toFixed(0)}%)
                </div>
              </div>

              <div className="bgd-card-right">
                <div className="bgd-status-badge" style={{ background: statusBg, color: statusColor }}>
                  <span className="dot" style={{ background: statusColor }}></span> {statusText}
                </div>
                <button className="bgd-action-btn" type="button" onClick={(e) => { e.stopPropagation(); startEdit(plan); }} title="Sửa">Sửa</button>
                <button className="bgd-action-btn" type="button" onClick={(e) => { e.stopPropagation(); removePlan(plan.id, plan.category); }} title="Xóa">Xóa</button>
              </div>
            </div>
          );
        })}
        {!filteredPlans.length && <div className="bgd-card">Không có ngân sách nào khớp bộ lọc hiện tại.</div>}
      </div>
    </div>
  );
}
