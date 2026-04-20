import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import apiClient from '../api/client';
import { useAuthStore } from '../store/authStore';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';
import AppIcon from '../components/ui/AppIcon';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const { showError } = useToast();
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.email) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Invalid email address';
    if (!form.password) errs.password = 'Password is required';
    else if (form.password.length < 8) errs.password = 'Password must be at least 8 characters';
    if (!form.confirmPassword) errs.confirmPassword = 'Please confirm your password';
    else if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match';
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
      const response = await apiClient.post('/api/auth/register', {
        email: form.email,
        password: form.password,
      });
      setAuth(response.data.user, response.data.accessToken);
      navigate('/');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      showError(msg || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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

  const handleChange = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((er) => { const n = { ...er }; delete n[field]; return n; });
  };

  return (
    <div className="auth-page">
      <div className="auth-hero">
        <div className="auth-hero-badge">
          <AppIcon name="spark" size={16} />
          Built for modern household finance
        </div>
        <h1>Start with a cleaner, more intentional money system.</h1>
        <p>
          Create your account to organize transactions, build budget discipline, and keep
          investment activity visible alongside day-to-day spending.
        </p>
        <div className="auth-feature-list">
          <div><AppIcon name="wallet" size={16} /> Track income and expenses</div>
          <div><AppIcon name="budgets" size={16} /> Set category budgets</div>
          <div><AppIcon name="settings" size={16} /> Bring your own AI tools</div>
        </div>
      </div>
      <div className="auth-card">
        <div className="auth-logo">
          <span className="auth-logo-mark">
            <AppIcon name="trend" size={18} />
          </span>
          <h1>FinanceTracker</h1>
        </div>
        <h2 className="auth-title">Create your account</h2>
        <form onSubmit={handleSubmit} className="form">
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={handleChange('email')}
            error={errors.email}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
          <Input
            label="Password"
            type="password"
            value={form.password}
            onChange={handleChange('password')}
            error={errors.password}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            required
          />
          <Input
            label="Confirm Password"
            type="password"
            value={form.confirmPassword}
            onChange={handleChange('confirmPassword')}
            error={errors.confirmPassword}
            placeholder="Repeat your password"
            autoComplete="new-password"
            required
          />
          <Button type="submit" variant="primary" loading={loading} className="btn-full">
            Create Account
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
          Already have an account?{' '}
          <Link to="/login" className="auth-link">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
