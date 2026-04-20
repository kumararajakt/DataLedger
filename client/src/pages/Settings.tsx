import React, { useState, useEffect } from 'react';
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from '../hooks/useCategories';
import {
  useAiSettings,
  useSaveAiSettings,
  useDeleteAiSettings,
  useTestAiConnection,
} from '../hooks/useAiSettings';
import {
  useDashboardConfig,
  useSaveDashboardConfig,
  useResetDashboardConfig,
} from '../hooks/useDashboardConfig';
import { useAuthStore } from '../store/authStore';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useToast } from '../components/ui/Toast';
import type { Category, AiProvider, DashboardWidget, WidgetType, StatMetric, TableSource, WidgetConfig, BankBreakdownWidgetConfig } from '../types';
import AppIcon from '../components/ui/AppIcon';

// ── Category form ───────────────────────────────────────────────────────────

interface CategoryFormData {
  name: string;
  color: string;
  icon: string;
}

const INITIAL_CAT_FORM: CategoryFormData = { name: '', color: '#3B82F6', icon: '📁' };

// ── AI settings form ────────────────────────────────────────────────────────

interface AiFormData {
  enabled: boolean;
  provider: AiProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
}

const PROVIDER_DEFAULTS: Record<AiProvider, { baseUrl: string; model: string; label: string }> = {
  anthropic:  { baseUrl: 'https://api.anthropic.com',    model: 'claude-haiku-4-5-20251001', label: 'Claude (Anthropic)' },
  openai:     { baseUrl: 'https://api.openai.com/v1',    model: 'gpt-4o-mini',               label: 'OpenAI (ChatGPT)' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini',        label: 'OpenRouter' },
  local:      { baseUrl: 'http://localhost:11434/v1',    model: 'llama3',                    label: 'Local (Ollama / LM Studio)' },
};

const INITIAL_AI_FORM: AiFormData = {
  enabled:  false,
  provider: 'openai',
  baseUrl:  PROVIDER_DEFAULTS.openai.baseUrl,
  apiKey:   '',
  model:    PROVIDER_DEFAULTS.openai.model,
};

// ── Dashboard widget helpers ─────────────────────────────────────────────────

const WIDGET_TYPE_LABELS: Record<WidgetType, string> = {
  stat:           'Number / Stat card',
  pie:            'Pie chart',
  line:           'Line chart',
  bar:            'Bar chart',
  table:          'Data table',
  bank_breakdown: 'Category breakdown bars',
};

const DEFAULT_CONFIGS: Record<WidgetType, WidgetConfig> = {
  stat:           { metric: 'income' as StatMetric, label: 'Income' },
  pie:            { title: 'Spending by category' },
  line:           { months: 6, title: 'Trend' },
  bar:            { months: 6, title: 'Monthly comparison' },
  table:          { source: 'recent_transactions' as TableSource, limit: 10, title: 'Recent transactions' },
  bank_breakdown: { title: 'Category Breakdown', limit: 6 } as BankBreakdownWidgetConfig,
};

const DEFAULT_SPANS: Record<WidgetType, { colSpan: number; rowSpan: number }> = {
  stat:           { colSpan: 3,  rowSpan: 1 },
  pie:            { colSpan: 6,  rowSpan: 2 },
  line:           { colSpan: 12, rowSpan: 2 },
  bar:            { colSpan: 12, rowSpan: 2 },
  table:          { colSpan: 12, rowSpan: 3 },
  bank_breakdown: { colSpan: 6,  rowSpan: 2 },
};

const STAT_METRIC_LABELS: Record<StatMetric, string> = {
  income:            'Total income',
  expense:           'Total expense',
  savings:           'Net savings',
  transaction_count: 'Transaction count',
};

// ── Component ───────────────────────────────────────────────────────────────

const Settings: React.FC = () => {
  const { user }                    = useAuthStore();
  const { showSuccess, showError }  = useToast();

  // ── Category state ──────────────────────────────────────────────────────

  const [catModalOpen, setCatModalOpen]   = useState(false);
  const [editingCat, setEditingCat]       = useState<Category | null>(null);
  const [catForm, setCatForm]             = useState<CategoryFormData>(INITIAL_CAT_FORM);
  const [catFormErrors, setCatFormErrors] = useState<Record<string, string>>({});

  const { data: categories = [], isLoading: catsLoading } = useCategories();
  const createMutation  = useCreateCategory();
  const updateMutation  = useUpdateCategory();
  const deleteMutation  = useDeleteCategory();

  // ── AI state ────────────────────────────────────────────────────────────

  const { data: aiConfig, isLoading: aiLoading } = useAiSettings();
  const saveMutation   = useSaveAiSettings();
  const removeMutation = useDeleteAiSettings();
  const testMutation   = useTestAiConnection();

  const [aiForm, setAiForm]                 = useState<AiFormData>(INITIAL_AI_FORM);
  const [showApiKey, setShowApiKey]         = useState(false);
  const [apiKeyChanged, setApiKeyChanged]   = useState(false);
  const [testResult, setTestResult]         = useState<{
    ok: boolean; msg: string; latencyMs?: number;
  } | null>(null);

  // Sync AI form when config loads
  useEffect(() => {
    if (aiConfig) {
      setAiForm({
        enabled:  aiConfig.enabled,
        provider: aiConfig.provider,
        baseUrl:  aiConfig.baseUrl || PROVIDER_DEFAULTS[aiConfig.provider].baseUrl,
        apiKey:   '',   // never pre-fill the key input
        model:    aiConfig.model || PROVIDER_DEFAULTS[aiConfig.provider].model,
      });
    }
  }, [aiConfig]);

  // ── Dashboard widget state ───────────────────────────────────────────────

  const { data: dashConfig, isLoading: dashLoading } = useDashboardConfig();
  const saveDashMutation  = useSaveDashboardConfig();
  const resetDashMutation = useResetDashboardConfig();

  const [localWidgets, setLocalWidgets]       = useState<DashboardWidget[]>([]);
  const [editingWidget, setEditingWidget]     = useState<DashboardWidget | null>(null);
  const [addingWidget, setAddingWidget]       = useState(false);
  const [newWidgetType, setNewWidgetType]     = useState<WidgetType>('stat');
  const [widgetConfigForm, setWidgetConfigForm] = useState<Record<string, unknown>>({});

  // Sync from server
  useEffect(() => {
    if (dashConfig) setLocalWidgets(dashConfig.widgets);
  }, [dashConfig]);

  // ── Category handlers ────────────────────────────────────────────────────

  const handleCatAdd = () => {
    setEditingCat(null);
    setCatForm(INITIAL_CAT_FORM);
    setCatFormErrors({});
    setCatModalOpen(true);
  };

  const handleCatEdit = (cat: Category) => {
    setEditingCat(cat);
    setCatForm({ name: cat.name, color: cat.color, icon: cat.icon });
    setCatFormErrors({});
    setCatModalOpen(true);
  };

  const handleCatDelete = async (cat: Category) => {
    if (!confirm(`Delete category "${cat.name}"? This may affect existing transactions.`)) return;
    try {
      await deleteMutation.mutateAsync(cat.id);
      showSuccess('Category deleted.');
    } catch {
      showError('Failed to delete category.');
    }
  };

  const validateCat = () => {
    const errs: Record<string, string> = {};
    if (!catForm.name.trim()) errs.name  = 'Name is required';
    if (!catForm.color)        errs.color = 'Color is required';
    if (!catForm.icon.trim())  errs.icon  = 'Icon is required';
    return errs;
  };

  const handleCatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateCat();
    if (Object.keys(errs).length > 0) { setCatFormErrors(errs); return; }
    try {
      if (editingCat) {
        await updateMutation.mutateAsync({ id: editingCat.id, ...catForm });
        showSuccess('Category updated.');
      } else {
        await createMutation.mutateAsync(catForm);
        showSuccess('Category created.');
      }
      setCatModalOpen(false);
    } catch {
      showError('Failed to save category.');
    }
  };

  const handleCatChange = (field: keyof CategoryFormData, value: string) => {
    setCatForm((f) => ({ ...f, [field]: value }));
    setCatFormErrors((e) => { const n = { ...e }; delete n[field]; return n; });
  };

  // ── AI handlers ──────────────────────────────────────────────────────────

  const handleProviderChange = (provider: AiProvider) => {
    const def = PROVIDER_DEFAULTS[provider];
    setAiForm((f) => ({
      ...f,
      provider,
      baseUrl: def.baseUrl,
      model:   def.model,
    }));
  };

  const handleAiSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestResult(null);
    try {
      await saveMutation.mutateAsync({
        enabled:  aiForm.enabled,
        provider: aiForm.provider,
        baseUrl:  aiForm.baseUrl,
        // Only send apiKey if the user typed something
        ...(apiKeyChanged && aiForm.apiKey.trim() ? { apiKey: aiForm.apiKey } : {}),
        model: aiForm.model,
      });
      setApiKeyChanged(false);
      showSuccess('AI settings saved.');
    } catch {
      showError('Failed to save AI settings.');
    }
  };

  const handleAiClear = async () => {
    if (!confirm('Clear all AI settings including your stored API key?')) return;
    try {
      await removeMutation.mutateAsync();
      setAiForm(INITIAL_AI_FORM);
      setApiKeyChanged(false);
      setTestResult(null);
      showSuccess('AI settings cleared.');
    } catch {
      showError('Failed to clear AI settings.');
    }
  };

  const handleTest = async () => {
    setTestResult(null);
    try {
      const res = await testMutation.mutateAsync();
      const d   = res.data.data;
      setTestResult({
        ok:        d.ok,
        msg:       d.ok ? `Connected — model replied: "${d.reply}"` : (d.error ?? 'Connection failed'),
        latencyMs: d.latencyMs,
      });
    } catch {
      setTestResult({ ok: false, msg: 'Request failed — check your settings and try again.' });
    }
  };

  // ── Dashboard widget handlers ────────────────────────────────────────────

  const moveWidget = (id: string, dir: 'up' | 'down') => {
    const sorted = [...localWidgets].sort((a, b) => a.position - b.position);
    const i = sorted.findIndex((w) => w.id === id);
    const j = dir === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= sorted.length) return;
    [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
    setLocalWidgets(sorted.map((w, k) => ({ ...w, position: k })));
  };

  const toggleWidget = (id: string) => {
    setLocalWidgets((ws) => ws.map((w) => w.id === id ? { ...w, enabled: !w.enabled } : w));
  };

  const deleteWidget = (id: string) => {
    const updated = localWidgets
      .filter((w) => w.id !== id)
      .sort((a, b) => a.position - b.position)
      .map((w, i) => ({ ...w, position: i }));
    setLocalWidgets(updated);
  };

  const openConfigure = (widget: DashboardWidget) => {
    setEditingWidget(widget);
    setWidgetConfigForm({
      ...(widget.config as Record<string, unknown>),
      __colSpan: widget.colSpan ?? 12,
      __rowSpan: widget.rowSpan ?? 1,
    });
  };

  const saveWidgetConfig = () => {
    if (!editingWidget) return;
    const colSpan = (widgetConfigForm.__colSpan as number | undefined) ?? editingWidget.colSpan;
    const rowSpan = (widgetConfigForm.__rowSpan as number | undefined) ?? editingWidget.rowSpan;
    // Strip internal keys before saving to config
    const { __colSpan: _c, __rowSpan: _r, ...config } = widgetConfigForm;
    setLocalWidgets((ws) =>
      ws.map((w) =>
        w.id === editingWidget.id
          ? { ...w, colSpan, rowSpan, config: config as WidgetConfig }
          : w
      )
    );
    setEditingWidget(null);
  };

  const openAddWidget = () => {
    setNewWidgetType('stat');
    setAddingWidget(true);
  };

  const confirmAddWidget = () => {
    const spans = DEFAULT_SPANS[newWidgetType];
    const newWidget: DashboardWidget = {
      id:       crypto.randomUUID(),
      type:     newWidgetType,
      enabled:  true,
      position: localWidgets.length,
      colSpan:  spans.colSpan,
      rowSpan:  spans.rowSpan,
      config:   DEFAULT_CONFIGS[newWidgetType],
    };
    setLocalWidgets((ws) => [...ws, newWidget]);
    setAddingWidget(false);
  };

  const handleSaveDashboard = async () => {
    const normalized = [...localWidgets]
      .sort((a, b) => a.position - b.position)
      .map((w, i) => ({ ...w, position: i }));
    try {
      await saveDashMutation.mutateAsync(normalized);
      showSuccess('Dashboard layout saved.');
    } catch {
      showError('Failed to save dashboard layout.');
    }
  };

  const handleResetDashboard = async () => {
    if (!confirm('Reset dashboard to default layout?')) return;
    try {
      await resetDashMutation.mutateAsync();
      showSuccess('Dashboard reset to defaults.');
    } catch {
      showError('Failed to reset dashboard.');
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────────

  const customCategories = categories.filter((c) => !c.isSystem);
  const systemCategories = categories.filter((c) => c.isSystem);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Workspace controls</p>
          <h1 className="page-title">Settings</h1>
          <p className="page-description">
            Manage categories, AI helpers, and account-level configuration for your finance workspace.
          </p>
        </div>
      </div>

      {/* Account Section */}
      <div className="card settings-section">
        <h2 className="settings-section-title">Account</h2>
        <div className="settings-field">
          <label className="form-label">Email Address</label>
          <p className="settings-value">{user?.email}</p>
        </div>
        <p className="text-muted settings-note">Password change functionality coming soon.</p>
      </div>

      {/* AI Assistant Section */}
      <div className="card settings-section">
        <h2 className="settings-section-title">AI Assistant <span className="badge badge-info" style={{ fontSize: '0.7rem', marginLeft: '0.5rem' }}>beta</span></h2>
        <p className="text-muted settings-note" style={{ marginBottom: '1rem' }}>
          Use your own AI API key to enrich imports with notes, improve categorization, and more.
          Your key is stored encrypted. Transaction descriptions are sent to your chosen AI provider.
        </p>

        {aiLoading ? (
          <LoadingSpinner centered />
        ) : (
          <form onSubmit={handleAiSave} className="form">

            {/* Enable toggle */}
            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.75rem' }}>
              <input
                id="ai-enabled"
                type="checkbox"
                checked={aiForm.enabled}
                onChange={(e) => setAiForm((f) => ({ ...f, enabled: e.target.checked }))}
                style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
              />
              <label htmlFor="ai-enabled" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>
                Enable AI features
              </label>
            </div>

            {/* Provider */}
            <div className="form-group">
              <label className="form-label" htmlFor="ai-provider">Provider</label>
              <select
                id="ai-provider"
                className="form-input"
                value={aiForm.provider}
                onChange={(e) => handleProviderChange(e.target.value as AiProvider)}
              >
                {(Object.keys(PROVIDER_DEFAULTS) as AiProvider[]).map((p) => (
                  <option key={p} value={p}>{PROVIDER_DEFAULTS[p].label}</option>
                ))}
              </select>
            </div>

            {/* Base URL */}
            <Input
              label="Base URL"
              type="url"
              value={aiForm.baseUrl}
              onChange={(e) => setAiForm((f) => ({ ...f, baseUrl: e.target.value }))}
              placeholder={PROVIDER_DEFAULTS[aiForm.provider].baseUrl}
              helperText="Pre-filled for cloud providers. Change only for custom/local endpoints."
            />

            {/* API Key */}
            <div className="form-group">
              <label className="form-label" htmlFor="ai-key">API Key</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  id="ai-key"
                  className="form-input"
                  type={showApiKey ? 'text' : 'password'}
                  value={aiForm.apiKey}
                  placeholder={
                    aiConfig?.hasApiKey && !apiKeyChanged
                      ? aiConfig.maskedApiKey + ' (leave blank to keep)'
                      : 'Paste your API key here'
                  }
                  onChange={(e) => {
                    setAiForm((f) => ({ ...f, apiKey: e.target.value }));
                    setApiKeyChanged(true);
                  }}
                  autoComplete="off"
                  style={{ flex: 1 }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowApiKey((v) => !v)}
                  title={showApiKey ? 'Hide' : 'Show'}
                >
                  {showApiKey ? '🙈' : '👁️'}
                </Button>
              </div>
            </div>

            {/* Model */}
            <Input
              label="Model (optional)"
              type="text"
              value={aiForm.model}
              onChange={(e) => setAiForm((f) => ({ ...f, model: e.target.value }))}
              placeholder={PROVIDER_DEFAULTS[aiForm.provider].model}
              helperText="Leave blank to use the default model for the selected provider."
            />

            {/* Test result */}
            {testResult && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  background: testResult.ok ? '#d1fae5' : '#fee2e2',
                  color:      testResult.ok ? '#065f46' : '#991b1b',
                  fontSize:   '0.875rem',
                }}
              >
                {testResult.ok ? '✓' : '✗'} {testResult.msg}
                {testResult.latencyMs !== undefined && (
                  <span style={{ marginLeft: '0.5rem', opacity: 0.7 }}>({testResult.latencyMs}ms)</span>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="form-actions">
              {aiConfig && (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={handleAiClear}
                  loading={removeMutation.isPending}
                >
                  Clear Configuration
                </Button>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleTest}
                  loading={testMutation.isPending}
                  disabled={!aiConfig?.hasApiKey && !apiKeyChanged}
                >
                  Test Connection
                </Button>
                <Button type="submit" variant="primary" loading={saveMutation.isPending}>
                  Save Settings
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Dashboard Section */}
      <div className="card settings-section">
        <div className="settings-section-header">
          <h2 className="settings-section-title">Dashboard</h2>
          <Button variant="primary" size="sm" onClick={openAddWidget}>
            <AppIcon name="spark" size={14} /> Add Widget
          </Button>
        </div>
        <p className="text-muted settings-note" style={{ marginBottom: '1rem' }}>
          Choose which charts and metrics appear on your dashboard, and drag them into order.
        </p>

        {dashLoading ? (
          <LoadingSpinner centered />
        ) : (
          <>
            {localWidgets.length === 0 ? (
              <EmptyState
                icon="📊"
                title="No widgets"
                description="Add a widget to get started."
                actionLabel="Add Widget"
                onAction={openAddWidget}
              />
            ) : (
              <div className="category-list" style={{ gap: '0.5rem' }}>
                {[...localWidgets]
                  .sort((a, b) => a.position - b.position)
                  .map((w, idx, arr) => {
                    const label =
                      (w.config as Record<string, unknown>).label as string ||
                      (w.config as Record<string, unknown>).title as string ||
                      WIDGET_TYPE_LABELS[w.type];
                    return (
                      <div
                        key={w.id}
                        className="category-item"
                        style={{ padding: '0.6rem 0.75rem', gap: '0.6rem' }}
                      >
                        <input
                          type="checkbox"
                          checked={w.enabled}
                          onChange={() => toggleWidget(w.id)}
                          style={{ width: '1rem', height: '1rem', cursor: 'pointer', flexShrink: 0 }}
                        />
                        <span className="badge badge-info" style={{ fontSize: '0.7rem', flexShrink: 0 }}>
                          {w.type}
                        </span>
                        <span className="category-name" style={{ flex: 1 }}>{label}</span>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <Button variant="ghost" size="sm" onClick={() => moveWidget(w.id, 'up')}  disabled={idx === 0}              title="Move up">↑</Button>
                          <Button variant="ghost" size="sm" onClick={() => moveWidget(w.id, 'down')} disabled={idx === arr.length - 1} title="Move down">↓</Button>
                          <Button variant="ghost" size="sm" onClick={() => openConfigure(w)} title="Configure">⚙️</Button>
                          <Button variant="danger" size="sm" onClick={() => deleteWidget(w.id)} title="Delete">🗑️</Button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            <div className="form-actions" style={{ marginTop: '1.25rem' }}>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={handleResetDashboard}
                loading={resetDashMutation.isPending}
              >
                Reset to defaults
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleSaveDashboard}
                loading={saveDashMutation.isPending}
                style={{ marginLeft: 'auto' }}
              >
                Save Layout
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Categories Section */}
      <div className="card settings-section">
        <div className="settings-section-header">
          <h2 className="settings-section-title">Categories</h2>
          <Button variant="primary" size="sm" onClick={handleCatAdd}>
            <AppIcon name="spark" size={14} /> Add Category
          </Button>
        </div>

        {catsLoading ? (
          <LoadingSpinner centered />
        ) : categories.length === 0 ? (
          <EmptyState
            icon="🏷️"
            title="No categories"
            description="Add categories to organize your transactions."
            actionLabel="Add Category"
            onAction={handleCatAdd}
          />
        ) : (
          <>
            {systemCategories.length > 0 && (
              <div className="category-group">
                <h3 className="category-group-title">System Categories</h3>
                <div className="category-list">
                  {systemCategories.map((cat) => (
                    <div key={cat.id} className="category-item">
                      <span className="category-color-dot" style={{ backgroundColor: cat.color }} />
                      <span className="category-icon">{cat.icon}</span>
                      <span className="category-name">{cat.name}</span>
                      <span className="badge badge-info">system</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {customCategories.length > 0 && (
              <div className="category-group">
                <h3 className="category-group-title">Custom Categories</h3>
                <div className="category-list">
                  {customCategories.map((cat) => (
                    <div key={cat.id} className="category-item">
                      <span className="category-color-dot" style={{ backgroundColor: cat.color }} />
                      <span className="category-icon">{cat.icon}</span>
                      <span className="category-name">{cat.name}</span>
                      <div className="category-actions">
                        <Button variant="ghost" size="sm" onClick={() => handleCatEdit(cat)} title="Edit">✏️</Button>
                        <Button variant="danger" size="sm" onClick={() => handleCatDelete(cat)} title="Delete">🗑️</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {customCategories.length === 0 && systemCategories.length > 0 && (
              <p className="text-muted settings-note">
                No custom categories yet. Click &quot;Add Category&quot; to create one.
              </p>
            )}
          </>
        )}
      </div>

      {/* Add Widget Modal */}
      <Modal
        isOpen={addingWidget}
        onClose={() => setAddingWidget(false)}
        title="Add Widget"
        size="sm"
      >
        <div className="form">
          <div className="form-group">
            <label className="form-label" htmlFor="new-widget-type">Widget type</label>
            <select
              id="new-widget-type"
              className="form-input"
              value={newWidgetType}
              onChange={(e) => setNewWidgetType(e.target.value as WidgetType)}
            >
              {(Object.keys(WIDGET_TYPE_LABELS) as WidgetType[]).map((t) => (
                <option key={t} value={t}>{WIDGET_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <p className="text-muted" style={{ fontSize: '0.8rem' }}>
            The widget will be added at the end of the list with default settings. You can configure it afterwards.
          </p>
          <div className="form-actions">
            <Button type="button" variant="secondary" onClick={() => setAddingWidget(false)}>Cancel</Button>
            <Button type="button" variant="primary" onClick={confirmAddWidget}>Add</Button>
          </div>
        </div>
      </Modal>

      {/* Configure Widget Modal */}
      <Modal
        isOpen={editingWidget !== null}
        onClose={() => setEditingWidget(null)}
        title={`Configure — ${editingWidget ? WIDGET_TYPE_LABELS[editingWidget.type] : ''}`}
        size="sm"
      >
        {editingWidget && (
          <div className="form">
            {/* Layout span fields — always shown */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="cfg-colspan">Col span (1–12)</label>
                <input
                  id="cfg-colspan"
                  className="form-input"
                  type="number"
                  min={1}
                  max={12}
                  value={(widgetConfigForm.__colSpan as number) ?? editingWidget.colSpan ?? 12}
                  onChange={(e) => setWidgetConfigForm((f) => ({ ...f, __colSpan: Number(e.target.value) }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="cfg-rowspan">Row span (1–4)</label>
                <input
                  id="cfg-rowspan"
                  className="form-input"
                  type="number"
                  min={1}
                  max={4}
                  value={(widgetConfigForm.__rowSpan as number) ?? editingWidget.rowSpan ?? 1}
                  onChange={(e) => setWidgetConfigForm((f) => ({ ...f, __rowSpan: Number(e.target.value) }))}
                />
              </div>
            </div>

            {/* Stat widget fields */}
            {editingWidget.type === 'stat' && (
              <>
                <div className="form-group">
                  <label className="form-label" htmlFor="cfg-metric">Metric</label>
                  <select
                    id="cfg-metric"
                    className="form-input"
                    value={(widgetConfigForm.metric as string) ?? 'income'}
                    onChange={(e) => setWidgetConfigForm((f) => ({ ...f, metric: e.target.value }))}
                  >
                    {(Object.keys(STAT_METRIC_LABELS) as StatMetric[]).map((m) => (
                      <option key={m} value={m}>{STAT_METRIC_LABELS[m]}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="cfg-label">Label</label>
                  <input
                    id="cfg-label"
                    className="form-input"
                    type="text"
                    value={(widgetConfigForm.label as string) ?? ''}
                    onChange={(e) => setWidgetConfigForm((f) => ({ ...f, label: e.target.value }))}
                    placeholder="Display label"
                  />
                </div>
              </>
            )}

            {/* Pie widget fields */}
            {editingWidget.type === 'pie' && (
              <div className="form-group">
                <label className="form-label" htmlFor="cfg-title">Title</label>
                <input
                  id="cfg-title"
                  className="form-input"
                  type="text"
                  value={(widgetConfigForm.title as string) ?? ''}
                  onChange={(e) => setWidgetConfigForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Chart title"
                />
              </div>
            )}

            {/* Line / Bar widget fields */}
            {(editingWidget.type === 'line' || editingWidget.type === 'bar') && (
              <>
                <div className="form-group">
                  <label className="form-label" htmlFor="cfg-months">Months to show</label>
                  <input
                    id="cfg-months"
                    className="form-input"
                    type="number"
                    min={1}
                    max={24}
                    value={(widgetConfigForm.months as number) ?? 6}
                    onChange={(e) => setWidgetConfigForm((f) => ({ ...f, months: Number(e.target.value) }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="cfg-title-trend">Title</label>
                  <input
                    id="cfg-title-trend"
                    className="form-input"
                    type="text"
                    value={(widgetConfigForm.title as string) ?? ''}
                    onChange={(e) => setWidgetConfigForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="Chart title"
                  />
                </div>
              </>
            )}

            {/* Table widget fields */}
            {editingWidget.type === 'table' && (
              <>
                <div className="form-group">
                  <label className="form-label" htmlFor="cfg-source">Data source</label>
                  <select
                    id="cfg-source"
                    className="form-input"
                    value={(widgetConfigForm.source as string) ?? 'recent_transactions'}
                    onChange={(e) => setWidgetConfigForm((f) => ({ ...f, source: e.target.value }))}
                  >
                    <option value="recent_transactions">Recent transactions</option>
                    <option value="top_categories">Top spending categories</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="cfg-limit">Row limit</label>
                  <input
                    id="cfg-limit"
                    className="form-input"
                    type="number"
                    min={1}
                    max={50}
                    value={(widgetConfigForm.limit as number) ?? 10}
                    onChange={(e) => setWidgetConfigForm((f) => ({ ...f, limit: Number(e.target.value) }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="cfg-title-table">Title</label>
                  <input
                    id="cfg-title-table"
                    className="form-input"
                    type="text"
                    value={(widgetConfigForm.title as string) ?? ''}
                    onChange={(e) => setWidgetConfigForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="Table title"
                  />
                </div>
              </>
            )}

            {/* Bank breakdown widget fields */}
            {editingWidget.type === 'bank_breakdown' && (
              <>
                <div className="form-group">
                  <label className="form-label" htmlFor="cfg-bb-limit">Categories to show</label>
                  <input
                    id="cfg-bb-limit"
                    className="form-input"
                    type="number"
                    min={2}
                    max={12}
                    value={(widgetConfigForm.limit as number) ?? 6}
                    onChange={(e) => setWidgetConfigForm((f) => ({ ...f, limit: Number(e.target.value) }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="cfg-bb-title">Title</label>
                  <input
                    id="cfg-bb-title"
                    className="form-input"
                    type="text"
                    value={(widgetConfigForm.title as string) ?? ''}
                    onChange={(e) => setWidgetConfigForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="Widget title"
                  />
                </div>
              </>
            )}

            <div className="form-actions">
              <Button type="button" variant="secondary" onClick={() => setEditingWidget(null)}>Cancel</Button>
              <Button type="button" variant="primary" onClick={saveWidgetConfig}>Apply</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Category Modal */}
      <Modal
        isOpen={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        title={editingCat ? 'Edit Category' : 'New Category'}
        size="sm"
      >
        <form onSubmit={handleCatSubmit} className="form">
          <Input
            label="Name"
            type="text"
            value={catForm.name}
            onChange={(e) => handleCatChange('name', e.target.value)}
            error={catFormErrors.name}
            placeholder="Category name"
            required
          />
          <div className="form-group">
            <label className="form-label">Color</label>
            <div className="color-input-row">
              <input
                type="color"
                className="color-picker"
                value={catForm.color}
                onChange={(e) => handleCatChange('color', e.target.value)}
              />
              <Input
                type="text"
                value={catForm.color}
                onChange={(e) => handleCatChange('color', e.target.value)}
                error={catFormErrors.color}
                placeholder="#3B82F6"
              />
            </div>
          </div>
          <Input
            label="Icon (emoji)"
            type="text"
            value={catForm.icon}
            onChange={(e) => handleCatChange('icon', e.target.value)}
            error={catFormErrors.icon}
            placeholder="e.g. 🍔"
            helperText="Enter any emoji character"
            required
          />
          <div className="category-preview">
            <span
              className="badge"
              style={{
                backgroundColor: catForm.color + '22',
                color:           catForm.color,
                borderColor:     catForm.color + '44',
              }}
            >
              {catForm.icon} {catForm.name || 'Preview'}
            </span>
          </div>
          <div className="form-actions">
            <Button type="button" variant="secondary" onClick={() => setCatModalOpen(false)}>Cancel</Button>
            <Button
              type="submit"
              variant="primary"
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {editingCat ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Settings;
