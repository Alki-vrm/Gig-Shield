/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { doc, onSnapshot, setDoc, collection, query, orderBy, limit, where } from "firebase/firestore";
import axios from "axios";
import { auth, db, logout, OperationType, handleFirestoreError, serverTimestamp, Timestamp } from "./firebase";
import { Header } from "./components/Header";
import { WeatherCard } from "./components/WeatherCard";
import { PolicyCard } from "./components/PolicyCard";
import { TelemetryCard } from "./components/TelemetryCard";
import { ClaimHistory } from "./components/ClaimHistory";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Auth } from "./components/Auth";
import { GigOnboarding, OnboardingData } from "./components/GigOnboarding";
import { PolicyActivationModal } from "./components/PolicyActivationModal";
import { WorkerClaims } from "./components/WorkerClaims";
import { Shield, Loader2, RefreshCw, FileText } from "lucide-react";

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isActivatingPolicy, setIsActivatingPolicy] = useState(false);
  const [policy, setPolicy] = useState<any>(null);
  const [weather, setWeather] = useState<any>(null);
  const [claims, setClaims] = useState<any[]>([]);
  const [location, setLocation] = useState({ lat: 19.1136, lng: 72.8697 });
  const [address] = useState("Andheri East, Mumbai");
  const [telemetry, setTelemetry] = useState({ speed: 0, distance: 0, deliveries: 0 });
  const [activeView, setActiveView] = useState<"shield" | "sync" | "history" | "claims">("shield");
  const [workerClaims, setWorkerClaims] = useState<any[]>([]);
  const [filingClaim, setFilingClaim] = useState(false);

  // Auth Listener
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (!u) {
        setProfileLoading(false);
        setProfile(null);
      }
    });
    return unsubscribeAuth;
  }, []);

  // Profile Listener
  useEffect(() => {
    if (!user) return;

    setProfileLoading(true);
    const unsubscribe = onSnapshot(doc(db, "users", user.uid), (doc) => {
      if (doc.exists()) {
        setProfile(doc.data());
      } else {
        setProfile(null);
      }
      setProfileLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      setProfileLoading(false);
    });
    return unsubscribe;
  }, [user]);

  // Geolocation
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      });
    }
  }, []);

  // Firestore Listeners (Policies & Claims)
  useEffect(() => {
    if (!user) return;

    // Policy Listener
    const policyQuery = query(collection(db, "users", user.uid, "policies"), limit(1));
    const unsubscribePolicy = onSnapshot(policyQuery, (snapshot) => {
      if (!snapshot.empty) {
        setPolicy(snapshot.docs[0].data());
      } else {
        setPolicy(null);
      }
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/policies`));

    // Claims Listener
    const claimsQuery = query(collection(db, "users", user.uid, "claims"), orderBy("timestamp", "desc"), limit(5));
    const unsubscribeClaims = onSnapshot(claimsQuery, (snapshot) => {
      setClaims(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/claims`));

    return () => {
      unsubscribePolicy();
      unsubscribeClaims();
    };
  }, [user]);

  // Payouts (Worker Claims) Listener
  useEffect(() => {
    if (!user) return;
    const payoutsQuery = query(
      collection(db, "payouts"),
      where("uid", "==", user.uid),
      orderBy("date", "desc")
    );
    const unsubscribePayouts = onSnapshot(
      payoutsQuery,
      (snapshot) => {
        setWorkerClaims(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (error) => console.error("Payouts listener error:", error)
    );
    return unsubscribePayouts;
  }, [user]);

  // Weather Polling
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await axios.get("/api/weather", {
          params: { lat: location.lat, lon: location.lng }
        });
        setWeather(res.data);
      } catch (error: any) {
        console.error("Failed to fetch weather:", error.message, error.response?.data);
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 60000); // Every minute
    return () => clearInterval(interval);
  }, [location]);

  // Simulated Telemetry
  useEffect(() => {
    const interval = setInterval(() => {
      setTelemetry(prev => ({
        speed: Math.floor(Math.random() * 40) + 10,
        distance: Number((prev.distance + 0.1).toFixed(1)),
        deliveries: prev.deliveries + (Math.random() > 0.98 ? 1 : 0)
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleCheckTrigger = async () => {
    if (!user || !policy) return;
    // Logic for checking triggers can be added here
  };

  const handleFileClaim = async () => {
    if (!user || !policy) return;
    setFilingClaim(true);
    try {
      const triggerEvent =
        weather?.rawAqi > 150
          ? "Severe Air Pollution (PM2.5 > 150)"
          : weather?.rain > 20
          ? "Heavy Rainfall (> 20mm/h)"
          : weather?.temp > 45
          ? "Extreme Heatwave (> 45\u00b0C)"
          : "Hazardous Weather Conditions";
      const claimId = `claim_${Date.now()}`;
      await setDoc(doc(db, "payouts", claimId), {
        uid: user.uid,
        amount: policy.maxPayout,
        triggerEvent,
        status: "Pending",
        date: new Date().toISOString(),
      });
      setActiveView("claims");
    } catch (err) {
      console.error("Failed to file claim:", err);
    } finally {
      setFilingClaim(false);
    }
  };

  const handleOnboardingSubmit = async (data: OnboardingData, premium: number) => {
    if (!user) return;
    setSubmitting(true);
    try {
      // 1. Create User Profile
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: user.email,
        phoneNumber: data.phoneNumber,
        targetPremium: data.targetPremium,
        platform: data.platform,
        city: data.city,
        companyEmail: data.companyEmail || "",
        dailySalary: data.dailySalary,
        activeDays: data.activeDays,
        role: "worker",
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      });

      // 2. Create Initial Policy
      await handleActivatePolicy(premium, data.dailySalary);

    } catch (error) {
      console.error("Onboarding failed:", error);
      alert("Failed to save your profile. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivatePolicy = async (premium: number, dailySalary?: number) => {
    if (!user) return;
    setSubmitting(true);
    try {
      const policyId = `policy_${Date.now()}`;
      const coverageStart = new Date();
      const coverageEnd = new Date();
      coverageEnd.setDate(coverageEnd.getDate() + 7);

      const salary = dailySalary || profile?.dailySalary || 800;

      await setDoc(doc(db, "users", user.uid, "policies", policyId), {
        userId: user.uid,
        status: "active",
        premiumPaid: premium,
        maxPayout: salary * 3, // Example: 3 days of coverage
        coverageStart: Timestamp.fromDate(coverageStart),
        coverageEnd: Timestamp.fromDate(coverageEnd),
        risks: ["Heavy Rain", "Severe AQI"],
        createdAt: serverTimestamp()
      });
      setIsActivatingPolicy(false);
    } catch (error) {
      console.error("Policy activation failed:", error);
      alert("Failed to activate policy. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <Loader2 className="w-12 h-12 text-teal-500 animate-spin" />
      </div>
    );
  }

  if (!user || !user.emailVerified) {
    return <Auth />;
  }

  if (!profile) {
    return <GigOnboarding onSubmit={handleOnboardingSubmit} loading={submitting} />;
  }

  const status = !weather 
    ? "SAFE" 
    : (weather.rawAqi > 150 || weather.rain > 20 || weather.temp > 45 ? "DANGER" : "SAFE");

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-950 pb-24">
        <Header 
          user={{
            displayName: user.email || "Gig Worker",
            photoURL: null
          }} 
          location={address} 
          status={status} 
        />

        <main className="p-4 space-y-4 max-w-md mx-auto">
          {activeView === "shield" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <WeatherCard data={weather} />
              <PolicyCard 
                policy={policy} 
                onActivate={() => setIsActivatingPolicy(true)}
                onViewDetails={() => {}}
              />
              {status === "DANGER" && policy && (
                <button
                  onClick={handleFileClaim}
                  disabled={filingClaim}
                  className="w-full py-4 bg-rose-500 text-white font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-rose-400 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 shadow-lg shadow-rose-500/20 animate-in fade-in duration-300"
                >
                  {filingClaim ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <FileText className="w-5 h-5" />
                      FILE A CLAIM — HAZARD DETECTED
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {activeView === "sync" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-xl font-black text-white tracking-tight px-2">Live Telemetry</h2>
              <TelemetryCard
                speed={telemetry.speed}
                distance={telemetry.distance}
                deliveries={telemetry.deliveries}
                coords={location}
              />
              <div className="p-6 bg-slate-900 rounded-3xl border border-slate-800">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Device Status</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">GPS Signal</span>
                    <span className="text-teal-500 font-bold">EXCELLENT</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">OBD-II Link</span>
                    <span className="text-teal-500 font-bold">CONNECTED</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">Last Sync</span>
                    <span className="text-slate-500">Just now</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeView === "history" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-xl font-black text-white tracking-tight px-2">Claims History</h2>
              <ClaimHistory claims={claims} />
            </div>
          )}

          {activeView === "claims" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <WorkerClaims claims={workerClaims} />
            </div>
          )}

          <button
            onClick={logout}
            className="w-full py-3 mt-8 text-slate-500 text-xs font-bold uppercase tracking-widest hover:text-rose-500 transition-colors"
          >
            Sign Out Session
          </button>
        </main>

        {/* Bottom Nav */}
        <nav className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900/80 backdrop-blur-xl border-t border-slate-800 flex justify-around items-center z-50">
          <button
            onClick={() => setActiveView("shield")}
            className={`flex flex-col items-center gap-1 transition-colors ${activeView === "shield" ? "text-teal-500" : "text-slate-500"}`}
          >
            <Shield className="w-6 h-6" />
            <span className="text-[8px] font-black uppercase">Shield</span>
          </button>
          <button
            onClick={() => setActiveView("sync")}
            className={`flex flex-col items-center gap-1 transition-colors ${activeView === "sync" ? "text-teal-500" : "text-slate-500"}`}
          >
            <RefreshCw className="w-6 h-6" />
            <span className="text-[8px] font-black uppercase">Sync</span>
          </button>
          <button
            onClick={() => setActiveView("history")}
            className={`flex flex-col items-center gap-1 transition-colors ${activeView === "history" ? "text-teal-500" : "text-slate-500"}`}
          >
            <History className="w-6 h-6" />
            <span className="text-[8px] font-black uppercase">History</span>
          </button>
          <button
            onClick={() => setActiveView("claims")}
            className={`flex flex-col items-center gap-1 transition-colors ${activeView === "claims" ? "text-teal-500" : "text-slate-500"}`}
          >
            <FileText className="w-6 h-6" />
            <span className="text-[8px] font-black uppercase">Claims</span>
          </button>
        </nav>

        <PolicyActivationModal
          isOpen={isActivatingPolicy}
          onClose={() => setIsActivatingPolicy(false)}
          onActivate={handleActivatePolicy}
          loading={submitting}
          defaultPremium={profile?.targetPremium || 30}
        />
      </div>
    </ErrorBoundary>
  );
}

function History({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}

