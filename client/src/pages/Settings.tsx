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
import { useAuthStore } from '../store/authStore';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useToast } from '../components/ui/Toast';
import type { Category, AiProvider } from '../types';

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

  // Sync form when config loads
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

  // ── Derived ──────────────────────────────────────────────────────────────

  const customCategories = categories.filter((c) => !c.isSystem);
  const systemCategories = categories.filter((c) => c.isSystem);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
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

      {/* Categories Section */}
      <div className="card settings-section">
        <div className="settings-section-header">
          <h2 className="settings-section-title">Categories</h2>
          <Button variant="primary" size="sm" onClick={handleCatAdd}>
            + Add Category
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
