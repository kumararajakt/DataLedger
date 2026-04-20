import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import apiClient from '../api/client';
import { useAuthStore } from '../store/authStore';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';
import AppIcon from '../components/ui/AppIcon';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const { showError } = useToast();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    try {
      const response = await apiClient.post('/api/auth/google', {
        credential: credentialResponse.credential,
      });
      setAuth(response.data.user, response.data.accessToken);
      navigate('/');
    } catch {
      showError('Google sign-in failed. Please try again.');
    }
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.email) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Invalid email address';
    if (!form.password) errs.password = 'Password is required';
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setLoading(true);
    try {
      const response = await apiClient.post('/api/auth/login', form);
      setAuth(response.data.user, response.data.accessToken);
      navigate('/');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      showError(msg || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-hero">
        <div className="auth-hero-badge">
          <AppIcon name="shield" size={16} />
          Secure personal finance workspace
        </div>
        <h1>Track money, budgets, and investments in one dashboard.</h1>
        <p>
          FinanceTracker gives you a clean operating view across spending, imports, and
          long-term investing without spreadsheet sprawl.
        </p>
        <div className="auth-feature-list">
          <div><AppIcon name="dashboard" size={16} /> Unified wealth dashboard</div>
          <div><AppIcon name="import" size={16} /> CSV and PDF statement import</div>
          <div><AppIcon name="trend" size={16} /> Investment activity tracking</div>
        </div>
      </div>
      <div className="auth-card">
        <div className="auth-logo">
          <span className="auth-logo-mark">
            <AppIcon name="trend" size={18} />
          </span>
          <h1>FinanceTracker</h1>
        </div>
        <h2 className="auth-title">Sign in to your account</h2>
        <form onSubmit={handleSubmit} className="form">
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => {
              setForm((f) => ({ ...f, email: e.target.value }));
              setErrors((er) => { const n = { ...er }; delete n.email; return n; });
            }}
            error={errors.email}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
          <Input
            label="Password"
            type="password"
            value={form.password}
            onChange={(e) => {
              setForm((f) => ({ ...f, password: e.target.value }));
              setErrors((er) => { const n = { ...er }; delete n.password; return n; });
            }}
            error={errors.password}
            placeholder="Your password"
            autoComplete="current-password"
            required
          />
          <Button type="submit" variant="primary" loading={loading} className="btn-full">
            Sign In
          </Button>
        </form>
        <div className="auth-divider"><span>or</span></div>
        <div className="auth-google">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => showError('Google sign-in failed. Please try again.')}
            width="100%"
          />
        </div>
        <p className="auth-footer">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="auth-link">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
