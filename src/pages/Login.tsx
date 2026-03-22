import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LogIn, Mail, Lock, AlertCircle, X, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Forgot password state
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotStep, setForgotStep] = useState<'email' | 'reset'>('email');
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const success = await login(email, password);
      if (success) {
        toast.success('Welcome back!');
        navigate('/dashboard');
      } else {
        setError('Invalid email or password');
        toast.error('Login failed. Please check your credentials.');
      }
    } catch (error) {
      setError('An error occurred during login');
      toast.error('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/auth/forgot-password`, { email: forgotEmail });
      // In dev mode the token is returned directly; in prod it would be emailed
      if (res.data.resetToken) {
        setResetToken(res.data.resetToken);
      }
      setForgotStep('reset');
      toast.success('Reset token generated. Enter it below along with your new password.');
    } catch {
      toast.error('Failed to send reset request. Check the email and try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setForgotLoading(true);
    try {
      await axios.post(`${API_BASE}/auth/reset-password`, { token: resetToken, newPassword });
      toast.success('Password reset successfully! Please log in.');
      setShowForgot(false);
      setForgotStep('email');
      setForgotEmail('');
      setResetToken('');
      setNewPassword('');
    } catch {
      toast.error('Invalid or expired reset token.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-glow">
              <span className="text-primary-foreground font-bold text-2xl">Q</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Welcome Back</h1>
            <p className="text-muted-foreground">Sign in to your QuoteFlow account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive animate-scale-in">
                <AlertCircle size={18} />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="input-field pl-11"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Password</label>
                <button
                  type="button"
                  onClick={() => { setShowForgot(true); setForgotStep('email'); }}
                  className="text-sm text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="input-field pl-11"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn size={18} />
                  Sign In
                </>
              )}
            </button>
          </form>

          <div className="mt-8 p-4 rounded-lg bg-muted border border-border">
            <p className="text-sm font-medium text-foreground mb-3">Demo Accounts:</p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p><span className="font-medium text-foreground">Super Admin:</span> admin@company.com / admin123</p>
              <p><span className="font-medium text-foreground">Admin:</span> priya@gmail.com / priya123</p>
              <p><span className="font-medium text-foreground">Staff:</span> rohit@gmail.com / rohit123</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Visual */}
      <div className="hidden lg:flex flex-1 bg-sidebar items-center justify-center p-12">
        <div className="max-w-lg text-center">
          <h2 className="text-4xl font-bold text-sidebar-foreground mb-4">
            Streamline Your <span className="gradient-text">Quotations</span>
          </h2>
          <p className="text-sidebar-muted text-lg">
            Create professional quotations, manage products, and track clients all in one powerful platform.
          </p>
          <div className="mt-12 grid grid-cols-3 gap-6">
            <div className="p-4 rounded-xl bg-sidebar-hover">
              <p className="text-3xl font-bold text-primary mb-1">500+</p>
              <p className="text-sm text-sidebar-muted">Quotations</p>
            </div>
            <div className="p-4 rounded-xl bg-sidebar-hover">
              <p className="text-3xl font-bold text-primary mb-1">150+</p>
              <p className="text-sm text-sidebar-muted">Clients</p>
            </div>
            <div className="p-4 rounded-xl bg-sidebar-hover">
              <p className="text-3xl font-bold text-primary mb-1">98%</p>
              <p className="text-sm text-sidebar-muted">Success Rate</p>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgot && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <KeyRound size={20} className="text-primary" />
                <h3 className="text-lg font-semibold text-foreground">
                  {forgotStep === 'email' ? 'Forgot Password' : 'Reset Password'}
                </h3>
              </div>
              <button onClick={() => setShowForgot(false)} className="p-1 rounded hover:bg-muted">
                <X size={18} />
              </button>
            </div>

            {forgotStep === 'email' ? (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <p className="text-sm text-muted-foreground">Enter your email to receive a reset token.</p>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="Your email address"
                    className="input-field pl-9"
                    required
                  />
                </div>
                <button type="submit" disabled={forgotLoading} className="w-full btn-primary disabled:opacity-50">
                  {forgotLoading ? 'Sending...' : 'Get Reset Token'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <p className="text-sm text-muted-foreground">Enter the reset token and your new password.</p>
                <input
                  type="text"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  placeholder="Reset token"
                  className="input-field"
                  required
                />
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password (min 6 chars)"
                    className="input-field pl-9"
                    required
                    minLength={6}
                  />
                </div>
                <button type="submit" disabled={forgotLoading} className="w-full btn-primary disabled:opacity-50">
                  {forgotLoading ? 'Resetting...' : 'Reset Password'}
                </button>
                <button type="button" onClick={() => setForgotStep('email')} className="w-full text-sm text-muted-foreground hover:text-foreground">
                  Back
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
