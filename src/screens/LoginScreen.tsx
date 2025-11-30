import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Logo } from "../components/Logo";
import { Eye, EyeOff, Building2, Loader2, AlertCircle, Info } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

interface LoginScreenProps {
  onLogin: () => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

  // Validation states
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmailValid = emailRegex.test(email);
  const isPasswordValid = password.length > 0;
  const isFormValid = isEmailValid && isPasswordValid;

  const showEmailError = emailTouched && email.length > 0 && !isEmailValid;
  const showPasswordError = passwordTouched && password.length === 0;

  // CapsLock detection
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.getModifierState && e.getModifierState("CapsLock")) {
      setCapsLockOn(true);
    } else {
      setCapsLockOn(false);
    }
  };

  // Google OAuth login
  const handleGoogleLogin = async () => {
    try {
      setIsGoogleLoading(true);
      setLoginError("");

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) {
        console.error('Google 로그인 오류:', error);
        setLoginError('Google 로그인에 실패했습니다. 다시 시도해주세요.');
        setIsGoogleLoading(false);
      }
      // Note: If successful, user will be redirected to Google login page
      // and then back to our app, so we don't need to set loading to false
    } catch (err) {
      console.error('Google 로그인 예외:', err);
      setLoginError('Google 로그인 중 오류가 발생했습니다.');
      setIsGoogleLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!isFormValid) return;

    setIsLoading(true);
    setLoginError("");

    // Simulate API call
    setTimeout(() => {
      // Simulate random success/failure for demo
      const success = Math.random() > 0.3; // 70% success rate

      if (success) {
        onLogin();
      } else {
        setIsLoading(false);
        setLoginError("이메일 또는 비밀번호가 올바르지 않습니다.");
      }
    }, 1500);
  };

  const handleEmailBlur = () => {
    setEmailTouched(true);
    setLoginError("");
  };

  const handlePasswordBlur = () => {
    setPasswordTouched(true);
    setLoginError("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && isFormValid) {
      handleLogin();
    }
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-[#F4F6FF] to-white flex flex-col items-center justify-center pt-6">
      {/* Logo */}
      <div className="mb-6 mt-50">
        <Logo size="md" />
      </div>

      {/* Login Card */}
      <div className="bg-white rounded-2xl shadow-lg border border-[rgba(0,0,0,0.06)] p-10 w-[440px]">
        <h1 className="text-2xl font-semibold text-[#030213] mb-2">로그인</h1>
        <p className="text-[#717182] mb-8 text-sm">
          집중이 필요한 발표와 회의를 한 곳에서 관리하세요.
        </p>

        <div className="space-y-6">
          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">이메일</Label>
            <Input
              id="email"
              type="email"
              placeholder="example@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={handleEmailBlur}
              onKeyDown={handleKeyPress}
              className={`h-11 rounded-lg border-[rgba(0,0,0,0.1)] ${showEmailError || loginError ? 'border-red-400 focus-visible:ring-red-400' : ''
                }`}
            />
            {showEmailError && (
              <div className="flex items-center gap-1.5 text-xs text-red-600 mt-1">
                <AlertCircle className="size-3" />
                <span>올바른 이메일 형식이 아닙니다.</span>
              </div>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">비밀번호</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={handlePasswordBlur}
                onKeyDown={(e) => {
                  handleKeyDown(e);
                  handleKeyPress(e);
                }}
                className={`h-11 rounded-lg border-[rgba(0,0,0,0.1)] pr-10 ${showPasswordError || loginError ? 'border-red-400 focus-visible:ring-red-400' : ''
                  }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#717182] hover:text-[#030213] transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>

            {/* CapsLock Warning */}
            {capsLockOn && password.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600 mt-1">
                <AlertCircle className="size-3" />
                <span>CapsLock이 켜져 있습니다.</span>
              </div>
            )}

            {showPasswordError && (
              <div className="flex items-center gap-1.5 text-xs text-red-600 mt-1">
                <AlertCircle className="size-3" />
                <span>비밀번호를 입력해주세요.</span>
              </div>
            )}
          </div>

          {/* Login Error Message */}
          {loginError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="size-4 text-red-600 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{loginError}</p>
            </div>
          )}

          {/* Remember Me Checkbox */}
          <div className="flex items-start gap-2">
            <Checkbox
              id="remember"
              checked={rememberMe}
              onCheckedChange={(checked: boolean) => setRememberMe(checked)}
            />
            <div className="flex flex-col">
              <label htmlFor="remember" className="text-sm text-[#030213] cursor-pointer">
                자동 로그인
              </label>
              <div className="flex items-center gap-1 mt-0.5">
                <Info className="size-3 text-[#717182]" />
                <span className="text-xs text-[#717182]">공용 기기에서는 사용하지 마세요.</span>
              </div>
            </div>
          </div>

          {/* Login Button */}
          <Button
            onClick={handleLogin}
            disabled={!isFormValid || isLoading}
            className={`w-full h-11 rounded-lg shadow-sm transition-all ${isFormValid && !isLoading
              ? 'bg-[#0064FF] hover:bg-[#0052CC] text-white'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed hover:bg-gray-200'
              }`}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                로그인 중…
              </span>
            ) : (
              '로그인'
            )}
          </Button>

          {/* Organization Login */}
          <div className="pt-4 border-t border-[rgba(0,0,0,0.08)]">
            <Button
              variant="outline"
              onClick={handleGoogleLogin}
              disabled={isGoogleLoading}
              className="w-full h-11 border-[rgba(0,0,0,0.15)] text-[#030213] hover:bg-[#F4F6FF] rounded-lg gap-2"
            >
              {isGoogleLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Google 로그인 중...
                </>
              ) : (
                <>
                  <Building2 className="size-4" />
                  Google 계정으로 회원 가입 및 로그인
                </>
              )}
            </Button>
            <p className="text-xs text-[#717182] text-center mt-2">
              Google Workspace 계정으로 간편하게 로그인하세요
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
