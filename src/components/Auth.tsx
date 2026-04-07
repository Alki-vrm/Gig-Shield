import { useState, useEffect } from "react";
import { 
  auth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  loginWithGoogle
} from "../firebase";
import { Shield, Mail, Lock, Loader2, ArrowRight, AlertCircle, CheckCircle2, LogIn } from "lucide-react";

export function Auth() {
  const [email, setEmail] = useState(auth.currentUser?.email || "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [verificationSent, setVerificationSent] = useState(auth.currentUser ? !auth.currentUser.emailVerified : false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (auth.currentUser) {
      setVerificationSent(!auth.currentUser.emailVerified);
      setEmail(auth.currentUser.email || "");
    }
  }, [auth.currentUser]);

  const handleRefreshStatus = async () => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        window.location.reload(); // Force app to re-check status
      } else {
        setError("Email still not verified. Please check your inbox.");
      }
    }
  };

  const handleResendEmail = async () => {
    if (auth.currentUser) {
      try {
        await sendEmailVerification(auth.currentUser);
        setError("Verification email resent!");
      } catch (err: any) {
        setError(err.message || "Failed to resend email.");
      }
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email address first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (err: any) {
      setError(err.message || "Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === "signup") {
        if (password.length < 6) {
          throw new Error("Password must be at least 6 characters long.");
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCredential.user);
        setVerificationSent(true);
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        if (!userCredential.user.emailVerified) {
          await sendEmailVerification(userCredential.user);
          setError("Please verify your email. A new verification link has been sent to your inbox.");
          // We don't sign them out, but App.tsx will block them if we check emailVerified there.
          // However, for better UX, we can show the verification screen.
          setVerificationSent(true);
        }
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      if (err.code === "auth/email-already-in-use") {
        setError("This email is already registered. Please sign in instead.");
        setMode("signin");
      } else if (err.code === "auth/weak-password") {
        setError("Password should be at least 6 characters.");
      } else if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        setError("Invalid email or password. Please check your credentials and try again.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many attempts. Please try again later.");
      } else {
        setError(err.message || "Authentication failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    // Clear verification state so Google users aren't stuck on email-verification screen
    setVerificationSent(false);
    try {
      await loginWithGoogle();
      // On success, onAuthStateChanged in App.tsx handles navigation automatically
    } catch (err: any) {
      console.error("Google Login Error:", err);
      if (err.code === "auth/popup-closed-by-user") {
        setError("Sign-in cancelled. Please try again.");
      } else if (err.code === "auth/cancelled-popup-request") {
        setError("Another sign-in was already in progress. Please try again.");
      } else if (err.code === "auth/unauthorized-domain") {
        setError(
          "This domain is not authorized. Go to Firebase Console → Authentication → Settings → Authorized Domains and add 'localhost'."
        );
      } else if (err.code === "auth/configuration-not-found") {
        setError(
          "Google Sign-In is not enabled. Go to Firebase Console → Authentication → Sign-in method and enable Google."
        );
      } else if (err.code === "auth/popup-blocked") {
        setError("Popup was blocked by your browser. Please allow popups for this site and try again.");
      } else {
        setError(`Google sign-in failed: ${err.message || "Unknown error. Please try again."}`);
      }
    } finally {
      setLoading(false);
    }
  };

  if (resetSent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0F172A] p-6 font-sans">
        <div className="w-full max-w-md bg-slate-900/50 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-sm text-center">
          <div className="w-20 h-20 bg-teal-500/20 rounded-3xl flex items-center justify-center mb-6 mx-auto border border-teal-500/30">
            <Mail className="w-12 h-12 text-teal-400" />
          </div>
          <h2 className="text-2xl font-black text-white mb-4">Reset link sent</h2>
          <p className="text-slate-400 mb-8 font-medium">
            We've sent a password reset link to <span className="text-white font-bold">{email}</span>.
          </p>
          <button
            onClick={() => setResetSent(false)}
            className="w-full py-4 bg-teal-500 text-slate-950 font-black rounded-2xl hover:bg-teal-400 transition-all shadow-lg shadow-teal-500/10"
          >
            BACK TO LOGIN
          </button>
        </div>
      </div>
    );
  }

  if (verificationSent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0F172A] p-6 font-sans">
        <div className="w-full max-w-md bg-slate-900/50 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-sm text-center">
          <div className="w-20 h-20 bg-teal-500/20 rounded-3xl flex items-center justify-center mb-6 mx-auto border border-teal-500/30">
            <CheckCircle2 className="w-12 h-12 text-teal-400" />
          </div>
          <h2 className="text-2xl font-black text-white mb-4">Check your inbox</h2>
          <p className="text-slate-400 mb-8 font-medium">
            We've sent a verification link to <span className="text-white font-bold">{email}</span>. 
            Please click the link in the email to verify your account.
          </p>
          
          {error && (
            <div className={`mb-6 p-4 rounded-2xl text-sm font-bold flex items-center gap-3 ${error.includes("resent") ? "bg-teal-500/10 border border-teal-500/20 text-teal-500" : "bg-rose-500/10 border border-rose-500/20 text-rose-500"}`}>
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={handleRefreshStatus}
              className="w-full py-4 bg-teal-500 text-slate-950 font-black rounded-2xl hover:bg-teal-400 transition-all shadow-lg shadow-teal-500/10"
            >
              I'VE VERIFIED MY EMAIL
            </button>
            <button
              onClick={handleResendEmail}
              className="w-full py-4 bg-slate-800 text-white font-black rounded-2xl hover:bg-slate-700 transition-all border border-slate-700"
            >
              RESEND EMAIL
            </button>
            <button
              onClick={async () => {
                await auth.signOut();
                setVerificationSent(false);
                setMode("signin");
              }}
              className="w-full py-4 bg-slate-900 text-slate-400 font-black rounded-2xl hover:bg-slate-800 transition-all border border-slate-800"
            >
              SIGN OUT
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0F172A] p-6 font-sans">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-16 h-16 bg-teal-500/20 rounded-2xl flex items-center justify-center mb-4 border border-teal-500/30">
            <Shield className="w-10 h-10 text-teal-400" />
          </div>
          <h1 className="text-3xl font-black text-white mb-2 tracking-tight">
            GigShield
          </h1>
          <p className="text-slate-400 font-medium">
            {mode === "signup" ? "Create your account to start securing your income." : "Sign in to access your protective shield."}
          </p>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-sm">
          {error && (
            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-500 text-sm font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="w-5 h-5 text-slate-500" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-slate-800/50 border border-slate-700 text-white text-lg font-bold rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-teal-500 transition-colors placeholder:text-slate-600"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2 ml-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Password
                </label>
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-[10px] font-black text-teal-500 uppercase tracking-widest hover:text-teal-400 transition-colors"
                  >
                    Forgot?
                  </button>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-slate-500" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-800/50 border border-slate-700 text-white text-lg font-bold rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-teal-500 transition-colors placeholder:text-slate-600"
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-teal-500 text-slate-950 font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-teal-400 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 shadow-lg shadow-teal-500/10"
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  {mode === "signup" ? "CREATE ACCOUNT" : "SIGN IN"}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest">
              <span className="bg-slate-900 px-4 text-slate-500">Or continue with</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-4 bg-slate-800/50 text-white font-black rounded-2xl flex items-center justify-center gap-3 hover:bg-slate-800 active:scale-95 transition-all disabled:opacity-50 border border-slate-700 shadow-lg"
          >
            <LogIn className="w-5 h-5" />
            GOOGLE SIGN IN
          </button>

          <div className="mt-8 text-center">
            <button
              onClick={() => {
                setMode(mode === "signup" ? "signin" : "signup");
                setError(null);
              }}
              className="text-slate-500 text-sm font-bold hover:text-teal-400 transition-colors"
            >
              {mode === "signup" 
                ? "Already have an account? Sign In" 
                : "Don't have an account? Create one"}
            </button>
          </div>
        </div>
        
        <p className="text-center text-slate-600 text-[10px] mt-8 uppercase font-black tracking-widest">
          Secure • Encrypted • Parametric
        </p>
      </div>
    </div>
  );
}
