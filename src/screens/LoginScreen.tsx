import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Logo } from "../components/Logo";
import { Eye, EyeOff, Building2, Loader2, AlertCircle, Info } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import googleLogo from "../assets/google_Logo.png";
import kakaoLogo from "../assets/kakao_Logo.png";

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
  const [isKakaoLoading, setIsKakaoLoading] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

  // Validation states
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [loginError, setLoginError] = useState<string>("");

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
    setIsGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        }
      });

      if (error) {
        console.error('Google 로그인 오류:', error);
        setLoginError('Google 로그인에 실패했습니다.');
      }
    } catch (error) {
      console.error('Google 로그인 예외:', error);
      setLoginError('Google 로그인 중 오류가 발생했습니다.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Kakao OAuth login
  const handleKakaoLogin = async () => {
    setIsKakaoLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            scope: 'profile_nickname profile_image', // 이메일 명시적 제외
          }
        }
      });

      if (error) {
        console.error('Kakao 로그인 오류:', error);
        setLoginError('카카오 로그인에 실패했습니다.');
      }
    } catch (error) {
      console.error('Kakao 로그인 예외:', error);
      setLoginError('카카오 로그인 중 오류가 발생했습니다.');
    } finally {
      setIsKakaoLoading(false);
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
    <div className="fixed inset-0 bg-gradient-to-br from-[#F4F6FF] to-white flex flex-col items-center justify-center">
      {/* Login Card */}
      <div className="bg-white rounded-2xl shadow-lg border border-[rgba(0,0,0,0.06)] p-10 w-[440px]">
        {/* Logo */}
        <div className="mb-6 mt-50 flex items-center justify-center mb-8 mt-2">
          <Logo size="sm" />
        </div>
        <h1 className="text-2xl font-semibold text-[#030213] mb-2 text-center">로그인</h1>
        <p className="text-[#717182] mb-6 text-sm text-center">
          집중이 필요한 발표와 회의를 한 곳에서 관리하세요.
        </p>
        {/* 구분선 - 짧고 두껍게 */}
        <div className="flex justify-center mb-12">
          <div
            style={{
              width: '96px',
              height: '1.5px',
              backgroundColor: '#9CA3AF'
            }}
          />
        </div>
        {/* Organization Login */}
        <div>
          {/* Google 버튼 - 둥글게 */}
          <Button
            variant="outline"
            onClick={handleGoogleLogin}
            disabled={isGoogleLoading}
            className="w-full h-12 border-[rgba(0,0,0,0.15)] text-[#030213] hover:bg-[#F4F6FF] rounded-full gap-2 mb-2"
          >
            {isGoogleLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Google 로그인 중...
              </>
            ) : (
              <>
                <img src={googleLogo} alt="Google" className="w-6 h-6" />
                구글 계정으로 계속하기
              </>
            )}
          </Button>

          {/* Kakao 버튼 추가 */}
          <Button
            variant="outline"
            onClick={handleKakaoLogin}
            disabled={isKakaoLoading}
            className="w-full h-12 rounded-full gap-2 !bg-[#FEE500] !text-black hover:!bg-[#F5D800] mb-2"
          >
            {isKakaoLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                로그인 중...
              </>
            ) : (
              <>
                <img src={kakaoLogo} alt="Kakao" className="w-6 h-6" />
                카카오톡 계정으로 계속하기
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
