import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LogIn, Mail, Lock, AlertCircle, X, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import logoImage from '@/assets/quoteflow-logo.jpg';

const isValidEmail = (email: string) =>
  /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email);

const isValidPhone = (phone: string) =>
  /^[0-9]{6,15}$/.test(phone.replace(/\D/g, ''));

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, loginWithResponse } = useAuth();
  const navigate = useNavigate();

  // Login mode state
  const [loginMode, setLoginMode] = useState<'password' | 'otp'>('password');
  const [otpPhone, setOtpPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [mobileOtpEnabled, setMobileOtpEnabled] = useState(false);

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

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const normalizedPhone = otpPhone.replace(/\D/g, '');
    if (!isValidPhone(normalizedPhone)) {
      const message = 'Please enter a valid phone number';
      setError(message);
      toast.error(message);
      return;
    }
    setOtpLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/auth/request-login-otp`, { phone: normalizedPhone });
      setOtpRequested(true);
      setError('');
      const otp = response.data?.otp;
      if (otp) {
        toast.success(`OTP sent: ${otp}`);
      } else {
        toast.success('OTP sent to your mobile number');
      }
    } catch (error: any) {
      const message = error?.response?.data?.error || 'Failed to request OTP. Please try again.';
      setError(message);
      toast.error(message);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleOtpLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const normalizedPhone = otpPhone.replace(/\D/g, '');
    if (!isValidPhone(normalizedPhone)) {
      const message = 'Please enter a valid phone number';
      setError(message);
      toast.error(message);
      return;
    }
    if (!otpCode.trim()) {
      const message = 'Please enter the OTP';
      setError(message);
      toast.error(message);
      return;
    }
    setOtpLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/auth/verify-login-otp`, {
        phone: normalizedPhone,
        otp: otpCode.trim(),
      });
      const { accessToken, refreshToken, user: userData } = response.data;
      await loginWithResponse(accessToken, refreshToken, userData);
      setError('');
      toast.success('Logged in successfully');
      navigate('/dashboard');
    } catch (error: any) {
      const message = error?.response?.data?.error || 'OTP login failed. Please try again.';
      setError(message);
      toast.error(message);
    } finally {
      setOtpLoading(false);
    }
  };

  useEffect(() => {
    const fetchLoginFeatures = async () => {
      try {
        const response = await axios.get(`${API_BASE}/auth/login-features`);
        setMobileOtpEnabled(response.data?.mobileOtpEnabled === true);
      } catch (error) {
        setMobileOtpEnabled(false);
      }
    };

    fetchLoginFeatures();
  }, []);

  useEffect(() => {
    if (!mobileOtpEnabled && loginMode === 'otp') {
      setLoginMode('password');
    }
  }, [mobileOtpEnabled, loginMode]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = forgotEmail.trim();
    if (!isValidEmail(normalizedEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }
    setForgotLoading(true);
    try {
      await axios.post(`${API_BASE}/auth/forgot-password`, { email: normalizedEmail });
      setResetToken('');
      setForgotStep('reset');
      toast.success('A reset code has been sent to your email. Enter it below to change your password.');
    } catch (error: any) {
      const message = error?.response?.data?.error || 'Failed to send reset request. Check the email and try again.';
      toast.error(message);
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
    <div className="min-h-screen bg-slate-100 flex">
      {/* Left Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md rounded-[32px] border border-slate-200/70 bg-white/95 p-8 shadow-xl shadow-slate-900/10 backdrop-blur-xl">
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex h-28 w-28 items-center justify-center rounded-[36px] bg-gradient-to-br from-sky-500/20 via-white to-emerald-500/20 border border-sky-500/10 shadow-lg shadow-sky-500/10">
              <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-white shadow-sm overflow-hidden">
                <img src={logoImage} alt="QuoteFlow logo" className="h-full w-full object-contain" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-semibold tracking-tight text-slate-900">QuoteFlow</p>
              <p className="mt-1 text-sm text-slate-500">Gym Equipment Quotation Software</p>
            </div>
          </div>

          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-semibold text-foreground">Sign In</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setLoginMode('password');
                  setOtpRequested(false);
                  setOtpPhone('');
                  setOtpCode('');
                  setError('');
                }}
                className={`px-4 py-2 rounded-full text-sm ${loginMode === 'password' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                Password
              </button>
              <button
                type="button"
                onClick={() => {
                  if (mobileOtpEnabled) {
                    setLoginMode('otp');
                    setOtpRequested(false);
                    setOtpPhone('');
                    setOtpCode('');
                    setError('');
                  }
                }}
                disabled={!mobileOtpEnabled}
                className={`px-4 py-2 rounded-full text-sm transition-all ${mobileOtpEnabled ? (loginMode === 'otp' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200') : 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-50'}`}
              >
                Mobile OTP
              </button>
            </div>
          </div>

          {loginMode === 'password' ? (
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
                className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3 text-white shadow-lg shadow-orange-500/20 transition-all duration-150 hover:shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <LogIn size={18} />
                    Sign In
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={otpRequested ? handleOtpLogin : handleRequestOtp} className="space-y-5">
              {error && (
                <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive animate-scale-in">
                  <AlertCircle size={18} />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Mobile Number</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="tel"
                    value={otpPhone}
                    onChange={(e) => setOtpPhone(e.target.value)}
                    placeholder="Enter your mobile number"
                    className="input-field pl-11"
                    required
                  />
                </div>
              </div>

              {otpRequested && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">OTP Code</label>
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="Enter the 6-digit code"
                    className="input-field"
                    required
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={otpLoading}
                className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3 text-white shadow-lg shadow-orange-500/20 transition-all duration-150 hover:shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {otpLoading ? (
                  <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : otpRequested ? (
                  'Login with OTP'
                ) : (
                  'Request OTP'
                )}
              </button>

              {otpRequested && (
                <button
                  type="button"
                  onClick={() => setOtpRequested(false)}
                  className="w-full text-sm text-muted-foreground hover:text-foreground"
                >
                  Change number
                </button>
              )}
            </form>
          )}
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
                <p className="text-sm text-muted-foreground">Enter your email to receive a reset code by email.</p>
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
                  {forgotLoading ? 'Sending...' : 'Send Reset Code'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <p className="text-sm text-muted-foreground">Enter the code from your email and your new password.</p>
                <input
                  type="text"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  placeholder="6-digit reset code"
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
                <button type="button" onClick={() => { setForgotStep('email'); setResetToken(''); }} className="w-full text-sm text-muted-foreground hover:text-foreground">
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
