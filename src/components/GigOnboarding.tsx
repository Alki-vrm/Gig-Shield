import { useState } from "react";
import { 
  Shield, 
  Phone, 
  IndianRupee, 
  Briefcase, 
  Mail, 
  TrendingUp, 
  ArrowRight, 
  ArrowLeft, 
  Loader2,
  CheckCircle2
} from "lucide-react";

import { calculateWeeklyPremium } from "../lib/pricingEngine";

interface GigOnboardingProps {
  onSubmit: (data: OnboardingData, premium: number) => void;
  loading?: boolean;
}

export interface OnboardingData {
  phoneNumber: string;
  targetPremium: number;
  platform: string;
  city: "Delhi" | "Mumbai";
  companyEmail?: string;
  dailySalary: number;
  activeDays: number;
}

const PLATFORMS = ["Zomato", "Swiggy", "Zepto", "Uber", "Rapido", "Other"];
const CITIES = ["Delhi", "Mumbai"];

export function GigOnboarding({ onSubmit, loading = false }: GigOnboardingProps) {
  const [step, setStep] = useState<2 | 3 | 4>(2);
  const [calculatedPremium, setCalculatedPremium] = useState<number | null>(null);
  const [manualPremium, setManualPremium] = useState<string>("");
  const [formData, setFormData] = useState<OnboardingData>({
    phoneNumber: "",
    targetPremium: 30,
    platform: "Zomato",
    city: "Mumbai",
    companyEmail: "",
    dailySalary: 800,
    activeDays: 20
  });

  const handleNext = () => setStep(3);
  const handleBack = () => setStep(step === 4 ? 3 : 2);

  const calculatePremium = () => {
    // Actuarial Algorithm implementation
    const probability = 0.05;
    const basePremium = probability * formData.dailySalary * 7;
    
    const cityMultiplier = formData.city === "Delhi" ? 1.2 : 1.0;
    
    let tierMultiplier = 1.0;
    if (formData.activeDays >= 20) {
      tierMultiplier = 0.9;
    } else if (formData.activeDays < 5) {
      tierMultiplier = 1.2;
    }

    const adjustedLoss = basePremium * cityMultiplier * tierMultiplier;
    const targetBCR = 0.65;
    let finalPremium = adjustedLoss / targetBCR;

    // Cap between ₹20 and ₹50
    finalPremium = Math.max(20, Math.min(50, finalPremium));
    
    setCalculatedPremium(Math.round(finalPremium));
    setManualPremium(Math.round(finalPremium).toString());
    setStep(4);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 2) {
      handleNext();
    } else if (step === 3) {
      calculatePremium();
    } else {
      if (calculatedPremium !== null) {
        const finalPremium = parseInt(manualPremium) || calculatedPremium;
        onSubmit(formData, finalPremium);
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 p-6">
      <div className="w-full max-w-md">
        {/* Progress Bar */}
        <div className="flex gap-2 mb-8">
          <div className={`h-1 flex-1 rounded-full transition-colors ${step >= 2 ? "bg-teal-400" : "bg-slate-800"}`} />
          <div className={`h-1 flex-1 rounded-full transition-colors ${step >= 3 ? "bg-teal-400" : "bg-slate-800"}`} />
          <div className={`h-1 flex-1 rounded-full transition-colors ${step >= 4 ? "bg-teal-400" : "bg-slate-800"}`} />
        </div>

        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-16 h-16 bg-teal-500/20 rounded-2xl flex items-center justify-center mb-4">
            {step === 4 ? (
              <CheckCircle2 className="w-10 h-10 text-teal-400" />
            ) : (
              <Shield className="w-10 h-10 text-teal-400" />
            )}
          </div>
          <h1 className="text-3xl font-black text-white mb-2 tracking-tighter">
            {step === 2 ? "Welcome! Let's secure your account." : 
             step === 3 ? "Tell us about your work." : 
             "Your Premium is Ready!"}
          </h1>
          <p className="text-slate-400 text-sm font-medium">
            {step === 2 ? "Basic details to get you started." : 
             step === 3 ? "This helps us tailor your coverage." : 
             "Based on your profile and risk factors."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          {step === 2 ? (
            <>
              {/* Step 2: Personal Details */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">
                  Mobile Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Phone className="w-5 h-5 text-slate-500" />
                  </div>
                  <input
                    type="tel"
                    required
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value.replace(/\D/g, "") })}
                    placeholder="Enter mobile number"
                    className="w-full bg-slate-800 border border-slate-700 text-white text-lg font-bold rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-teal-500 transition-colors placeholder:text-slate-600"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-end mb-2 ml-1">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Target Weekly Premium
                  </label>
                  <span className="text-teal-400 font-black text-lg">₹{formData.targetPremium}</span>
                </div>
                <div className="relative pt-2">
                  <input
                    type="range"
                    min="10"
                    max="200"
                    step="5"
                    value={formData.targetPremium}
                    onChange={(e) => setFormData({ ...formData, targetPremium: parseInt(e.target.value) })}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-400"
                  />
                  <div className="flex justify-between mt-2">
                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Min: ₹10</span>
                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Max: ₹200</span>
                  </div>
                </div>
                <p className="mt-4 text-[10px] text-slate-500 font-medium leading-relaxed italic">
                  "How much are you willing to pay weekly? e.g., ₹30"
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-teal-400 text-slate-950 font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-teal-300 active:scale-95 transition-all shadow-lg shadow-teal-500/20"
              >
                NEXT STEP
                <ArrowRight className="w-5 h-5" />
              </button>
            </>
          ) : step === 3 ? (
            <>
              {/* Step 3: Job Details */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">
                  Operating City
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CITIES.map(city => (
                    <button
                      key={city}
                      type="button"
                      onClick={() => setFormData({ ...formData, city: city as "Delhi" | "Mumbai" })}
                      className={`py-3 px-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border ${
                        formData.city === city 
                          ? "bg-teal-400 text-slate-950 border-teal-400 shadow-lg shadow-teal-500/20" 
                          : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600"
                      }`}
                    >
                      {city}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">
                  Company / Platform
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PLATFORMS.map(platform => (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => setFormData({ ...formData, platform })}
                      className={`py-3 px-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border ${
                        formData.platform === platform 
                          ? "bg-teal-400 text-slate-950 border-teal-400 shadow-lg shadow-teal-500/20" 
                          : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600"
                      }`}
                    >
                      {platform}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">
                  Company Email ID (Optional)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="w-5 h-5 text-slate-500" />
                  </div>
                  <input
                    type="email"
                    value={formData.companyEmail}
                    onChange={(e) => setFormData({ ...formData, companyEmail: e.target.value })}
                    placeholder="name@company.com"
                    className="w-full bg-slate-800 border border-slate-700 text-white text-lg font-bold rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-teal-500 transition-colors placeholder:text-slate-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">
                  Average Daily Earnings
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <IndianRupee className="w-5 h-5 text-slate-500" />
                  </div>
                  <input
                    type="number"
                    required
                    value={formData.dailySalary}
                    onChange={(e) => setFormData({ ...formData, dailySalary: parseInt(e.target.value) || 0 })}
                    placeholder="e.g., 800"
                    className="w-full bg-slate-800 border border-slate-700 text-white text-lg font-bold rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-teal-500 transition-colors placeholder:text-slate-600"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-end mb-2 ml-1">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Active Days (Last 30 Days)
                  </label>
                  <span className="text-teal-400 font-black text-lg">{formData.activeDays} Days</span>
                </div>
                <div className="relative pt-2">
                  <input
                    type="range"
                    min="1"
                    max="30"
                    step="1"
                    value={formData.activeDays}
                    onChange={(e) => setFormData({ ...formData, activeDays: parseInt(e.target.value) })}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-400"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex-1 py-4 bg-slate-800 text-white font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-700 transition-all"
                >
                  <ArrowLeft className="w-5 h-5" />
                  BACK
                </button>
                <button
                  type="submit"
                  className="flex-[2] py-4 bg-teal-400 text-slate-950 font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-teal-300 active:scale-95 transition-all shadow-lg shadow-teal-500/20"
                >
                  CALCULATE PREMIUM
                  <TrendingUp className="w-5 h-5" />
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Step 4: Result */}
              <div className="text-center py-4">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-teal-500/10 mb-6">
                  <IndianRupee className="w-10 h-10 text-teal-400" />
                </div>
                <div className="space-y-2">
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Calculated Weekly Premium</p>
                  <p className="text-6xl font-black text-white tracking-tighter">₹{calculatedPremium}</p>
                </div>

                <div className="mt-8 space-y-4">
                  <div className="text-left">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">
                      Override with Desired Premium (Optional)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <IndianRupee className="w-5 h-5 text-slate-500" />
                      </div>
                      <input
                        type="number"
                        value={manualPremium}
                        onChange={(e) => setManualPremium(e.target.value)}
                        placeholder="Enter desired premium"
                        className="w-full bg-slate-800 border border-slate-700 text-white text-lg font-bold rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-teal-500 transition-colors"
                      />
                    </div>
                    <p className="mt-2 text-[10px] text-slate-500 font-medium italic">
                      You can manually set a different premium amount if you wish.
                    </p>
                  </div>
                </div>
                
                <div className="mt-8 p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 text-left">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center">
                      <Shield className="w-4 h-4 text-teal-400" />
                    </div>
                    <p className="text-xs font-bold text-white">Full Coverage Active</p>
                  </div>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-[10px] text-slate-400">
                      <div className="w-1 h-1 rounded-full bg-teal-400" />
                      Automatic Payout on Weather Breach
                    </li>
                    <li className="flex items-center gap-2 text-[10px] text-slate-400">
                      <div className="w-1 h-1 rounded-full bg-teal-400" />
                      Health Coverage for Severe AQI
                    </li>
                    <li className="flex items-center gap-2 text-[10px] text-slate-400">
                      <div className="w-1 h-1 rounded-full bg-teal-400" />
                      Accident Support up to ₹2,400
                    </li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex-1 py-4 bg-slate-800 text-white font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-700 transition-all"
                >
                  <ArrowLeft className="w-5 h-5" />
                  BACK
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-[2] py-4 bg-teal-400 text-slate-950 font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-teal-300 active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-teal-500/20"
                >
                  {loading ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      GO TO DASHBOARD
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
