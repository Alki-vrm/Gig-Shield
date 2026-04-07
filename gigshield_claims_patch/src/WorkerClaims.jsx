import { useEffect, useState } from "react";
import { listenToDatabase } from "./services/api";

export default function WorkerClaims() {
  const user = JSON.parse(localStorage.getItem("gigshieldUser"));
  const [claims, setClaims] = useState([]);

  useEffect(() => {
    listenToDatabase("Payouts", (data) => {
      const userClaims = (data || []).filter((c) => c.uid === user?.uid);
      setClaims(userClaims.reverse());
    });
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h2>My Claims</h2>

      {claims.length === 0 ? (
        <p>No claims yet</p>
      ) : (
        claims.map((c, i) => (
          <div key={i} style={{ border: "1px solid #333", borderRadius: 8, padding: 12, marginBottom: 8 }}>
            <p><b>Event:</b> {c.triggerEvent}</p>
            <p><b>Amount:</b> ₹{c.amount}</p>
            <p><b>Status:</b> {c.status}</p>
            <p><b>Date:</b> {new Date(c.date).toLocaleString()}</p>
          </div>
        ))
      )}
    </div>
  );
}
