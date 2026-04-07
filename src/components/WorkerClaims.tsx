// ─────────────────────────────────────────────────────────────────────────────
// WorkerClaims.tsx
// Self-contained: fetches its own data — does NOT rely on the parent prop
// so it works even when the Firestore composite-index query in App.tsx fails.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  FlaskConical,
  Loader2,
  TrendingUp,
  Zap,
} from "lucide-react";

// ── types ─────────────────────────────────────────────────────────────────────

export interface WorkerClaim {
  id: string;
  uid: string;
  amount: number;
  triggerEvent: string;
  status: "Pending" | "Approved";
  date: string;
}

// Props interface kept so App.tsx doesn't need any changes.
// The component uses its own internal fetching instead.
interface WorkerClaimsProps {
  claims?: WorkerClaim[];
}

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Merge two lists of claims without duplicates.
 * - Approved always beats Pending for the same id.
 * - Result is sorted newest-first.
 */
function mergeClaims(
  local: WorkerClaim[],
  incoming: WorkerClaim[]
): WorkerClaim[] {
  const map = new Map<string, WorkerClaim>();
  local.forEach((c) => map.set(c.id, c));
  incoming.forEach((c) => {
    const existing = map.get(c.id);
    if (!existing) {
      map.set(c.id, c);
    } else if (c.status === "Approved" && existing.status === "Pending") {
      map.set(c.id, { ...existing, status: "Approved" });
    }
  });
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

/**
 * Fetch claims for the current user from ALL available sources.
 * 1. Firestore `payouts` collection — getDocs (no composite index needed,
 *    filter client-side).
 * 2. localStorage key "payouts" — stored as { [id]: claimObject } object,
 *    so we use Object.values() to convert to an array.
 */
async function fetchAllClaims(uid: string): Promise<WorkerClaim[]> {
  const results: WorkerClaim[] = [];

  // ── Source 1: Firestore ───────────────────────────────────────────────────
  try {
    const snapshot = await getDocs(collection(db, "payouts"));
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as Omit<WorkerClaim, "id">;
      if (data.uid === uid) {
        results.push({
          id: docSnap.id,
          uid: data.uid,
          amount: data.amount ?? 0,
          triggerEvent: data.triggerEvent ?? "Unknown Event",
          status: data.status ?? "Pending",
          date: data.date ?? new Date().toISOString(),
        });
      }
    });
  } catch (err) {
    console.warn("[WorkerClaims] Firestore getDocs failed:", err);
  }

  // ── Source 2: localStorage (data stored as { [id]: claim } object) ────────
  // Use Object.entries so the storage KEY is used as the id — never Date.now()
  try {
    const raw = localStorage.getItem("payouts");
    if (raw) {
      const parsed = JSON.parse(raw);
      Object.entries(parsed).forEach(([key, c]: [string, any]) => {
        if (c && c.uid === uid) {
          results.push({
            id: key,                                   // use storage key as id
            uid: c.uid,
            amount: c.amount ?? 0,
            triggerEvent: c.triggerEvent ?? "Unknown Event",
            status: c.status ?? "Pending",
            date: c.date ?? new Date().toISOString(),
          });
        }
      });
    }
  } catch {
    // localStorage unavailable or malformed — silently skip
  }

  return results;
}

// ── component ─────────────────────────────────────────────────────────────────

export function WorkerClaims({ claims: _propClaims }: WorkerClaimsProps) {
  const [localClaims, setLocalClaims] = useState<WorkerClaim[]>([]);
  // pendingDemoId: ID of a demo claim that is still Pending.
  // Button stays disabled until this specific claim is Approved (or null).
  const [pendingDemoId, setPendingDemoId] = useState<string | null>(null);
  // isCreating: ref guard — blocks concurrent executions from rapid clicks
  const isCreating = useRef(false);

  // Derived: button is busy while writing OR while demo claim is still Pending
  const demoLoading =
    isCreating.current ||
    (pendingDemoId !== null &&
      localClaims.some(
        (c) => c.id === pendingDemoId && c.status === "Pending"
      ));

  // ── Self-contained data fetching with 1-second polling ────────────────────
  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const user = auth.currentUser;
      if (!user || cancelled) return;
      const fresh = await fetchAllClaims(user.uid);
      if (!cancelled) {
        setLocalClaims((prev) => mergeClaims(prev, fresh));
      }
    };

    // Fetch immediately on mount / user change
    refresh();

    // Poll every 1 second to catch updates (localStorage / offline Firestore)
    const interval = setInterval(refresh, 1000);

    // Cleanup: stop interval and mark stale async calls
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-approval: ref-based timer map (immune to useEffect re-runs) ──────
  const approvalTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  useEffect(() => {
    const pending = localClaims.filter(
      (c) => c.status === "Pending" && !approvalTimers.current.has(c.id)
    );

    pending.forEach((claim) => {
      const timer = setTimeout(async () => {
        // ① Update UI instantly
        setLocalClaims((prev) =>
          prev.map((c) =>
            c.id === claim.id ? { ...c, status: "Approved" } : c
          )
        );
        // ② Persist to Firestore (best-effort)
        try {
          await updateDoc(doc(db, "payouts", claim.id), {
            status: "Approved",
          });
        } catch (err) {
          console.warn("[WorkerClaims] Auto-approve write failed:", err);
        }
        // ③ Also update localStorage if present
        try {
          const raw = localStorage.getItem("payouts");
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed[claim.id]) {
              parsed[claim.id].status = "Approved";
              localStorage.setItem("payouts", JSON.stringify(parsed));
            }
          }
        } catch {
          // ignore
        }
        approvalTimers.current.delete(claim.id);
      }, 2000);

      approvalTimers.current.set(claim.id, timer);
    });
  }, [localClaims]);

  // ── Demo claim generator ──────────────────────────────────────────────────
  const handleDemoGenerate = async () => {
    // Guard 1: block if a write is already in progress
    if (isCreating.current) return;
    const user = auth.currentUser;
    if (!user) return;

    // Guard 2: block if a demo claim is still pending approval
    if (pendingDemoId !== null) return;

    isCreating.current = true;  // lock — prevents re-entry from rapid clicks

    // Generate the ID exactly once
    const claimId = `demo_${Date.now()}`;

    // Guard 3: ensure this ID doesn't already exist in local state
    const alreadyExists = localClaims.some((c) => c.id === claimId);
    if (alreadyExists) {
      isCreating.current = false;
      return;
    }

    try {
      const newClaim: WorkerClaim = {
        id: claimId,
        uid: user.uid,
        amount: 500,
        triggerEvent: "demo-event",
        status: "Pending",
        date: new Date().toISOString(),
      };

      // ① Track this demo claim — keeps button disabled until it's Approved
      setPendingDemoId(claimId);

      // ② Inject into local state INSTANTLY — visible before any DB write
      setLocalClaims((prev) => [newClaim, ...prev]);

      // ③ Persist to Firestore (best-effort)
      try {
        await setDoc(doc(collection(db, "payouts"), claimId), {
          uid: newClaim.uid,
          amount: newClaim.amount,
          triggerEvent: newClaim.triggerEvent,
          status: newClaim.status,
          date: newClaim.date,
        });
      } catch (err) {
        console.warn("[WorkerClaims] Firestore setDoc failed:", err);
      }

      // ④ Write to localStorage — include id field so polling never generates a new id
      try {
        const raw = localStorage.getItem("payouts") ?? "{}";
        const parsed = JSON.parse(raw);
        if (!parsed[claimId]) {                       // never overwrite existing entry
          parsed[claimId] = {
            id: claimId,                              // ← id stored, prevents Date.now() fallback
            uid: newClaim.uid,
            amount: newClaim.amount,
            triggerEvent: newClaim.triggerEvent,
            status: newClaim.status,
            date: newClaim.date,
          };
          localStorage.setItem("payouts", JSON.stringify(parsed));
        }
      } catch {
        // ignore — localStorage unavailable
      }
    } finally {
      isCreating.current = false;  // unlock after all writes complete
    }
  };

  // Clear pendingDemoId once the tracked claim reaches Approved
  useEffect(() => {
    if (pendingDemoId === null) return;
    const claim = localClaims.find((c) => c.id === pendingDemoId);
    if (claim?.status === "Approved") {
      setPendingDemoId(null);
    }
  }, [localClaims, pendingDemoId]);

  // ── Derived values ────────────────────────────────────────────────────────
  const totalApproved = localClaims
    .filter((c) => c.status === "Approved")
    .reduce((sum, c) => sum + c.amount, 0);

  const pendingCount = localClaims.filter(
    (c) => c.status === "Pending"
  ).length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between px-2">
        <h2 className="text-xl font-black text-white tracking-tight">
          My Claims
        </h2>
        <span className="text-xs text-slate-500 font-bold">
          {localClaims.length} total
        </span>
      </div>

      {/* ── Demo Claim Generator ── */}
      <div className="p-4 bg-slate-900 rounded-2xl border border-dashed border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-violet-500/20 rounded-lg border border-violet-500/20">
            <FlaskConical className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <p className="text-xs font-black text-violet-400 uppercase tracking-widest">
              Demo Mode
            </p>
            <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">
              For Testing Only
            </p>
          </div>
        </div>
        <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
          Generate a mock claim of{" "}
          <span className="text-white font-bold">₹500</span> instantly — no
          active weather alert required. Status auto-updates to{" "}
          <span className="text-teal-400 font-bold">Approved</span> in 2
          seconds.
        </p>
        <button
          id="demo-claim-generator-btn"
          onClick={handleDemoGenerate}
          disabled={demoLoading}
          className="w-full py-3 bg-violet-600 hover:bg-violet-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 text-white font-black text-sm rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-500/10"
        >
          {demoLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FlaskConical className="w-4 h-4" />
          )}
          {demoLoading
            ? pendingDemoId
              ? "Awaiting Approval..."
              : "Generating..."
            : "Generate Demo Claim"}
        </button>
      </div>

      {/* Summary Stats */}
      {localClaims.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-teal-400" />
              <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">
                Total Approved
              </span>
            </div>
            <p className="text-xl font-black text-teal-400">₹{totalApproved}</p>
          </div>
          <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">
                Pending
              </span>
            </div>
            <p className="text-xl font-black text-amber-400">{pendingCount}</p>
          </div>
        </div>
      )}

      {/* Claims List */}
      <div className="p-5 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 bg-amber-500/20 rounded-xl border border-amber-500/20">
            <FileText className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-tight">
              Payouts &amp; Claims
            </h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              Auto-processed within 2 seconds
            </p>
          </div>
        </div>

        {localClaims.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-700">
              <AlertTriangle className="w-8 h-8 text-slate-600" />
            </div>
            <p className="text-slate-400 font-bold text-sm mb-1">
              No Claims Yet
            </p>
            <p className="text-xs text-slate-600 max-w-xs mx-auto leading-relaxed">
              Use the{" "}
              <span className="text-violet-400 font-bold">
                Generate Demo Claim
              </span>{" "}
              button above, or file a claim from the Shield tab when hazardous
              conditions are detected.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {localClaims.map((claim) => {
              const isApproved = claim.status === "Approved";
              return (
                <div
                  key={claim.id}
                  className={`p-4 rounded-2xl border transition-all duration-500 ${
                    isApproved
                      ? "bg-teal-500/5 border-teal-500/20"
                      : "bg-amber-500/5 border-amber-500/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: icon + event info */}
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2.5 rounded-xl shrink-0 ${
                          isApproved ? "bg-teal-500/20" : "bg-amber-500/20"
                        }`}
                      >
                        {isApproved ? (
                          <CheckCircle2 className="w-5 h-5 text-teal-400" />
                        ) : (
                          <Clock className="w-5 h-5 text-amber-400 animate-pulse" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white leading-tight">
                          {claim.triggerEvent}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {new Date(claim.date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>

                    {/* Right: amount + status badge */}
                    <div className="text-right shrink-0">
                      <p className="text-base font-black text-teal-400">
                        +₹{claim.amount}
                      </p>
                      <span
                        className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                          isApproved
                            ? "bg-teal-500/20 text-teal-400"
                            : "bg-amber-500/20 text-amber-400"
                        }`}
                      >
                        {isApproved ? (
                          <CheckCircle2 className="w-2.5 h-2.5" />
                        ) : (
                          <Zap className="w-2.5 h-2.5" />
                        )}
                        {claim.status}
                      </span>
                    </div>
                  </div>

                  {/* Pending: animated progress bar */}
                  {!isApproved && (
                    <div className="mt-3 pt-3 border-t border-amber-500/10">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] text-amber-400 font-black uppercase tracking-widest">
                          Processing...
                        </span>
                        <span className="text-[9px] text-slate-500 font-bold">
                          Auto-approving
                        </span>
                      </div>
                      <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full animate-[progress_2s_linear_forwards]" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes progress {
          from { width: 0%; }
          to   { width: 100%; }
        }
        .animate-\\[progress_2s_linear_forwards\\] {
          animation: progress 2s linear forwards;
        }
      `}</style>
    </div>
  );
}
