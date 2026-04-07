import { useState } from "react";
import { Shield, IndianRupee, X, Loader2, ArrowRight } from "lucide-react";

interface PolicyActivationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActivate: (premium: number) => void;
  loading?: boolean;
  defaultPremium: number;
}

export function PolicyActivationModal({ 
  isOpen, 
  onClose, 
  onActivate, 
  loading = false,
  defaultPremium 
}: PolicyActivationModalProps) {
  const [premium, setPremium] = useState<string>(defaultPremium.toString());

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative animate-in zoom-in-95 duration-300">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 bg-teal-500/20 rounded-2xl flex items-center justify-center mb-4 border border-teal-500/30">
            <Shield className="w-10 h-10 text-teal-400" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Activate Weekly Shield</h2>
          <p className="text-slate-400 text-sm font-medium">
            Set your desired premium for the next 7 days of coverage.
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">
              Desired Premium Amount
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <IndianRupee className="w-5 h-5 text-slate-500" />
              </div>
              <input
                type="number"
                value={premium}
                onChange={(e) => setPremium(e.target.value)}
                placeholder="Enter premium amount"
                className="w-full bg-slate-800 border border-slate-700 text-white text-lg font-bold rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-teal-500 transition-colors"
              />
            </div>
            <p className="mt-2 text-[10px] text-slate-500 font-medium italic">
              Suggested default: ₹{defaultPremium}
            </p>
          </div>

          <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
            <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-3">Policy Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-400">Duration</span>
                <span className="text-white font-bold">7 Days</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-400">Coverage Type</span>
                <span className="text-white font-bold">Parametric Weather</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-400">Payout Trigger</span>
                <span className="text-teal-500 font-bold">AQI &gt; 150 or Rain &gt; 20mm</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onActivate(parseInt(premium) || defaultPremium)}
            disabled={loading}
            className="w-full py-4 bg-teal-500 text-slate-950 font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-teal-400 active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-teal-500/20"
          >
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                CONFIRM & ACTIVATE
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
