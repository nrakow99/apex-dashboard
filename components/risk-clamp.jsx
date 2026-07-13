"use client";

import Link from "next/link";
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ensureRiskClampSettings,
  fetchRiskClampTrades,
  upsertRiskClampSettings,
  insertRiskClampTrade,
  deleteRiskClampTrades,
  resetRiskClampAccount,
} from "@/lib/supabase/risk-clamp";

/* ---------- constants ---------- */

const POINT_VALUES = {
  NQ: 20,
  MNQ: 2,
  ES: 50,
  MES: 5,
};

const FAMILIES = {
  NQ: { full: "NQ", micro: "MNQ", label: "NQ / MNQ" },
  ES: { full: "ES", micro: "MES", label: "ES / MES" },
};

const HARD_CEILING = 500;
const STORAGE_KEY = "riskclamp:state";

const palette = {
  bg: "#0A0E13",
  panel: "#10151C",
  panelAlt: "#161D26",
  border: "#263140",
  borderSoft: "#1B2430",
  text: "#E8EDF2",
  textMuted: "#6B7A8C",
  textFaint: "#465162",
  safe: "#35D07F",
  caution: "#E8A33D",
  danger: "#E5484D",
  info: "#4C8DFF",
};

const mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Roboto Mono", monospace';
const sans = '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Helvetica, Arial, sans-serif';

/* ---------- helpers ---------- */

function money(n) {
  const sign = n < 0 ? "-" : "";
  return sign + "$" + Math.abs(Math.round(n)).toLocaleString();
}

function computeSizing({ buffer, stopPoints, numAccounts, family }) {
  const bufferSeventh = buffer / 7;
  const ceilingPerAccount = HARD_CEILING / Math.max(1, numAccounts);
  const maxAllowed = Math.min(bufferSeventh, ceilingPerAccount);
  const binding =
    bufferSeventh <= ceilingPerAccount ? "buffer" : "ceiling";

  const fam = FAMILIES[family];
  const results = {};
  for (const key of [fam.full, fam.micro]) {
    const pv = POINT_VALUES[key];
    const dollarPerContract = stopPoints * pv;
    const contracts =
      dollarPerContract > 0 ? Math.floor(maxAllowed / dollarPerContract) : 0;
    const actualRisk = contracts * dollarPerContract;
    results[key] = {
      pv,
      dollarPerContract,
      contracts,
      actualRisk,
      noTrade: contracts === 0,
    };
  }

  return { bufferSeventh, ceilingPerAccount, maxAllowed, binding, results };
}

/* ---------- small UI atoms ---------- */

function Eyebrow({ children }) {
  return (
    <div
      style={{
        fontFamily: sans,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: palette.info,
      }}
    >
      {children}
    </div>
  );
}

function Panel({ title, children, style }) {
  return (
    <div
      style={{
        background: palette.panel,
        border: `1px solid ${palette.border}`,
        borderRadius: 10,
        padding: "16px 18px",
        ...style,
      }}
    >
      {title && (
        <div
          style={{
            fontFamily: sans,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: palette.textMuted,
            marginBottom: 12,
          }}
        >
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

function NumField({ label, value, onChange, prefix, suffix, min = 0, step = 1 }) {
  return (
    <label style={{ display: "block" }}>
      <div
        style={{
          fontFamily: sans,
          fontSize: 12,
          color: palette.textMuted,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          background: palette.panelAlt,
          border: `1px solid ${palette.border}`,
          borderRadius: 8,
          padding: "8px 12px",
        }}
      >
        {prefix && (
          <span style={{ color: palette.textFaint, fontFamily: mono, marginRight: 4 }}>
            {prefix}
          </span>
        )}
        <input
          type="number"
          value={value}
          min={min}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            background: "transparent",
            border: "none",
            outline: "none",
            color: palette.text,
            fontFamily: mono,
            fontSize: 16,
            width: "100%",
          }}
        />
        {suffix && (
          <span style={{ color: palette.textFaint, fontFamily: mono, marginLeft: 4, fontSize: 12 }}>
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

function FamilyToggle({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {Object.entries(FAMILIES).map(([key, f]) => {
        const active = value === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            style={{
              flex: 1,
              padding: "9px 10px",
              borderRadius: 8,
              border: `1px solid ${active ? palette.info : palette.border}`,
              background: active ? "rgba(76,141,255,0.12)" : palette.panelAlt,
              color: active ? palette.info : palette.textMuted,
              fontFamily: mono,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 120ms ease",
            }}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}

/* sequential clamp gauge — the signature element.
   Shows the ordered checks: structure sets the stop, then two size caps,
   with whichever cap actually binds lit up. */
function ClampSequence({ stopPoints, bufferSeventh, ceilingPerAccount, binding, numAccounts }) {
  const steps = [
    {
      n: 1,
      label: "STRUCTURE",
      desc: "Stop distance from chart",
      value: `${stopPoints} pts`,
      state: "fixed",
    },
    {
      n: 2,
      label: "BUFFER ÷ 7",
      desc: "Scales with account balance",
      value: money(bufferSeventh),
      state: binding === "buffer" ? "binding" : "clear",
    },
    {
      n: 3,
      label: numAccounts > 1 ? `$500 ÷ ${numAccounts} ACCTS` : "$500 CEILING",
      desc: numAccounts > 1 ? "Portfolio-wide hard cap, split" : "Hard cap, never exceeded",
      value: money(ceilingPerAccount),
      state: binding === "ceiling" ? "binding" : "clear",
    },
  ];

  return (
    <div style={{ display: "flex", gap: 10 }}>
      {steps.map((s, i) => (
        <React.Fragment key={s.n}>
          <div
            style={{
              flex: 1,
              borderRadius: 8,
              padding: "12px 14px",
              background:
                s.state === "binding" ? "rgba(232,163,61,0.10)" : palette.panelAlt,
              border: `1px solid ${
                s.state === "binding" ? palette.caution : palette.borderSoft
              }`,
              position: "relative",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontFamily: sans,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: palette.textFaint,
                }}
              >
                {s.n}
              </span>
              {s.state === "binding" && (
                <span
                  style={{
                    fontFamily: sans,
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    color: palette.caution,
                    background: "rgba(232,163,61,0.15)",
                    padding: "2px 6px",
                    borderRadius: 4,
                  }}
                >
                  BINDING
                </span>
              )}
              {s.state === "clear" && (
                <span style={{ color: palette.safe, fontSize: 11 }}>✓</span>
              )}
            </div>
            <div
              style={{
                fontFamily: sans,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.06em",
                color: palette.textMuted,
                textTransform: "uppercase",
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                fontFamily: mono,
                fontSize: 20,
                color: palette.text,
                margin: "4px 0 2px",
              }}
            >
              {s.value}
            </div>
            <div style={{ fontFamily: sans, fontSize: 10.5, color: palette.textFaint }}>
              {s.desc}
            </div>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

function ReadoutCard({ symbol, res }) {
  const ok = !res.noTrade;
  return (
    <div
      style={{
        flex: 1,
        borderRadius: 10,
        padding: "16px 18px",
        background: ok ? palette.panel : "rgba(229,72,77,0.08)",
        border: `1px solid ${ok ? palette.border : palette.danger}`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <span style={{ fontFamily: mono, fontSize: 13, color: palette.textMuted }}>
          {symbol}
        </span>
        <span
          style={{
            fontFamily: sans,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.06em",
            color: ok ? palette.safe : palette.danger,
          }}
        >
          {ok ? "VALID" : "NO TRADE"}
        </span>
      </div>
      <div
        style={{
          fontFamily: mono,
          fontSize: 42,
          fontWeight: 600,
          color: ok ? palette.text : palette.danger,
          lineHeight: 1.1,
          marginTop: 6,
        }}
      >
        {res.contracts}
        <span style={{ fontSize: 16, color: palette.textFaint, marginLeft: 6 }}>
          contracts
        </span>
      </div>
      <div style={{ fontFamily: mono, fontSize: 15, color: palette.textMuted, marginTop: 4 }}>
        {money(res.actualRisk)} actual risk
        <span style={{ color: palette.textFaint }}>
          {" "}
          · {money(res.dollarPerContract)}/contract
        </span>
      </div>
    </div>
  );
}

/* ---------- main app ---------- */

export default function RiskClamp({
  accountId,
  initialBuffer,
  mode = accountId ? "account" : "standalone",
} = {}) {
  const useSupabase = Boolean(accountId);
  const isAccountMode = mode === "account" || useSupabase;

  const [buffer, setBuffer] = useState(
    typeof initialBuffer === "number" ? initialBuffer : 2000
  );
  const [stopPoints, setStopPoints] = useState(30);
  const [numAccounts, setNumAccounts] = useState(1);
  const [family, setFamily] = useState("NQ");

  const [tradeLog, setTradeLog] = useState([]);
  const [pnlInput, setPnlInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);

  const skipNextPersist = useRef(true);

  /* load persisted state */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoaded(false);
      setLoadError(false);
      setSaveError(false);
      skipNextPersist.current = true;

      if (useSupabase) {
        try {
          const settingsResult = await ensureRiskClampSettings(accountId, {
            buffer: typeof initialBuffer === "number" ? initialBuffer : 2000,
          });
          if (cancelled) return;

          if (settingsResult.error || !settingsResult.data) {
            setLoadError(true);
            if (typeof initialBuffer === "number") setBuffer(initialBuffer);
          } else {
            setBuffer(settingsResult.data.buffer);
            setStopPoints(settingsResult.data.stopPoints);
            setNumAccounts(settingsResult.data.numAccounts);
            setFamily(settingsResult.data.family);
          }

          const tradesResult = await fetchRiskClampTrades(accountId);
          if (cancelled) return;

          if (tradesResult.error) {
            setLoadError(true);
            setTradeLog([]);
          } else {
            setTradeLog(tradesResult.data ?? []);
          }
        } catch (e) {
          if (!cancelled) setLoadError(true);
        } finally {
          if (!cancelled) setLoaded(true);
        }
        return;
      }

      try {
        const raw = localStorage.getItem(STORAGE_KEY);

        if (raw) {
          const parsed = JSON.parse(raw);
          if (typeof parsed.buffer === "number") setBuffer(parsed.buffer);
          if (Array.isArray(parsed.tradeLog)) setTradeLog(parsed.tradeLog);
          if (typeof parsed.numAccounts === "number") setNumAccounts(parsed.numAccounts);
        } else if (typeof initialBuffer === "number") {
          setBuffer(initialBuffer);
        }
      } catch (e) {
        // no saved state yet
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [accountId, useSupabase]); // initialBuffer only seeds first create; omit to avoid reload loops

  const persistLocal = useCallback((nextBuffer, nextLog, nextNumAccounts) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          buffer: nextBuffer,
          tradeLog: nextLog,
          numAccounts: nextNumAccounts,
        })
      );
      setSaveError(false);
    } catch (e) {
      setSaveError(true);
    }
  }, []);

  /* standalone localStorage persist */
  useEffect(() => {
    if (!loaded || useSupabase) return;
    persistLocal(buffer, tradeLog, numAccounts);
  }, [buffer, tradeLog, numAccounts, loaded, useSupabase, persistLocal]);

  /* account-mode settings upsert */
  useEffect(() => {
    if (!loaded || !useSupabase || !accountId) return;
    if (skipNextPersist.current) {
      skipNextPersist.current = false;
      return;
    }

    let cancelled = false;
    (async () => {
      const result = await upsertRiskClampSettings(accountId, {
        buffer,
        stopPoints,
        numAccounts,
        family,
      });
      if (cancelled) return;
      setSaveError(Boolean(result.error));
    })();

    return () => {
      cancelled = true;
    };
  }, [buffer, stopPoints, numAccounts, family, loaded, useSupabase, accountId]);

  const sizing = computeSizing({ buffer, stopPoints, numAccounts, family });
  const fam = FAMILIES[family];

  async function logTrade() {
    const pnl = Number(pnlInput);
    if (!pnlInput || Number.isNaN(pnl) || busy) return;

    const balanceAfter = buffer + pnl;
    const tradeDate = new Date().toISOString().slice(0, 10);

    if (useSupabase) {
      setBusy(true);
      try {
        const insertResult = await insertRiskClampTrade(accountId, {
          tradeDate,
          family,
          stopPoints,
          pnl,
          note: noteInput.trim(),
          balanceAfter,
        });
        if (insertResult.error || !insertResult.data) {
          setSaveError(true);
          return;
        }

        const settingsResult = await upsertRiskClampSettings(accountId, {
          buffer: balanceAfter,
          stopPoints,
          numAccounts,
          family,
        });
        if (settingsResult.error) setSaveError(true);
        else setSaveError(false);

        skipNextPersist.current = true;
        setTradeLog((prev) => [insertResult.data, ...prev]);
        setBuffer(balanceAfter);
        setPnlInput("");
        setNoteInput("");
      } catch (e) {
        setSaveError(true);
      } finally {
        setBusy(false);
      }
      return;
    }

    const entry = {
      id: Date.now(),
      date: tradeDate,
      family,
      stopPoints,
      pnl,
      note: noteInput.trim(),
      balanceAfter,
    };
    setTradeLog((prev) => [entry, ...prev]);
    setBuffer(balanceAfter);
    setPnlInput("");
    setNoteInput("");
  }

  async function clearLog() {
    if (busy) return;

    if (useSupabase) {
      setBusy(true);
      try {
        const result = await deleteRiskClampTrades(accountId);
        if (result.error) {
          setSaveError(true);
          return;
        }
        setSaveError(false);
        setTradeLog([]);
      } catch (e) {
        setSaveError(true);
      } finally {
        setBusy(false);
      }
      return;
    }

    setTradeLog([]);
  }

  async function resetAccount() {
    if (busy) return;

    if (useSupabase) {
      setBusy(true);
      try {
        const result = await resetRiskClampAccount(accountId);
        if (result.error) {
          setSaveError(true);
          return;
        }
        skipNextPersist.current = true;
        setBuffer(2000);
        setStopPoints(30);
        setNumAccounts(1);
        setFamily("NQ");
        setTradeLog([]);
        setSaveError(false);
      } catch (e) {
        setSaveError(true);
      } finally {
        setBusy(false);
      }
      return;
    }

    setBuffer(2000);
    setTradeLog([]);
    setNumAccounts(1);
  }

  if (!loaded) {
    return (
      <div
        style={{
          minHeight: isAccountMode ? undefined : "100vh",
          background: palette.bg,
          color: palette.textMuted,
          padding: isAccountMode ? "24px 16px" : "32px 20px",
          fontFamily: sans,
          fontSize: 14,
        }}
      >
        Loading Risk Clamp…
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: isAccountMode ? undefined : "100vh",
        background: palette.bg,
        color: palette.text,
        padding: isAccountMode ? "20px 16px 28px" : "32px 20px 60px",
        fontFamily: sans,
        borderRadius: isAccountMode ? 16 : 0,
        border: isAccountMode ? `1px solid ${palette.borderSoft}` : "none",
      }}
    >
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        {/* header */}
        {!isAccountMode && (
          <div style={{ marginBottom: 12 }}>
            <Link
              href="/"
              style={{
                color: palette.textMuted,
                fontSize: 13,
                textDecoration: "none",
              }}
            >
              ← Dashboard
            </Link>
          </div>
        )}
        <Eyebrow>PB × TJR RISK ENGINE</Eyebrow>
        <h1
          style={{
            fontFamily: mono,
            fontSize: isAccountMode ? 24 : 32,
            fontWeight: 600,
            margin: "6px 0 4px",
            letterSpacing: "-0.01em",
          }}
        >
          Risk Clamp
        </h1>
        <p style={{ color: palette.textMuted, fontSize: 14, margin: "0 0 28px", maxWidth: 520 }}>
          Structure sets the stop. These caps set the size. Contract count is
          always derived — never chosen first.
        </p>

        {(loadError || saveError) && (
          <div style={{ color: palette.caution, fontSize: 12, marginBottom: 14 }}>
            {loadError
              ? "Could not load saved Risk Clamp data — showing defaults."
              : useSupabase
                ? "Could not save to Supabase — changes may not persist."
                : "Storage unavailable — values will not persist between sessions."}
          </div>
        )}

        {/* inputs */}
        <div style={{ display: "flex", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 200px" }}>
            <Panel title="Account Buffer">
              <NumField
                label="Current balance above floor"
                value={buffer}
                onChange={setBuffer}
                prefix="$"
                step={50}
              />
            </Panel>
          </div>
          <div style={{ flex: "1 1 200px" }}>
            <Panel title="Structural Stop">
              <NumField
                label="Distance from entry to invalidation"
                value={stopPoints}
                onChange={setStopPoints}
                suffix="pts"
                step={1}
              />
            </Panel>
          </div>
          <div style={{ flex: "1 1 200px" }}>
            <Panel title="Portfolio Mode">
              <NumField
                label="Accounts trading this same signal"
                value={numAccounts}
                onChange={(v) => setNumAccounts(Math.max(1, v))}
                min={1}
                step={1}
              />
            </Panel>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <Panel title="Market Family">
            <FamilyToggle value={family} onChange={setFamily} />
          </Panel>
        </div>

        {/* sequence gauge */}
        <div style={{ marginBottom: 14 }}>
          <Panel title="Sizing Sequence">
            <ClampSequence
              stopPoints={stopPoints}
              bufferSeventh={sizing.bufferSeventh}
              ceilingPerAccount={sizing.ceilingPerAccount}
              binding={sizing.binding}
              numAccounts={numAccounts}
            />
          </Panel>
        </div>

        {/* readouts */}
        <div style={{ display: "flex", gap: 14, marginBottom: 28 }}>
          <ReadoutCard symbol={fam.full} res={sizing.results[fam.full]} />
          <ReadoutCard symbol={fam.micro} res={sizing.results[fam.micro]} />
        </div>

        {sizing.results[fam.micro].noTrade && sizing.results[fam.full].noTrade && (
          <div
            style={{
              background: "rgba(229,72,77,0.1)",
              border: `1px solid ${palette.danger}`,
              borderRadius: 8,
              padding: "12px 16px",
              color: palette.danger,
              fontSize: 13,
              marginTop: -14,
              marginBottom: 28,
            }}
          >
            Even 1 micro exceeds the allowed risk at this stop distance. Do not
            tighten the stop to fit. Skip the trade or wait for a tighter
            structural level.
          </div>
        )}

        {/* trade log */}
        <Panel title="Trade Log — updates buffer automatically">
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 140px" }}>
              <NumField
                label="Realized P&L this trade"
                value={pnlInput}
                onChange={(v) => setPnlInput(String(v))}
                prefix="$"
                step={1}
              />
            </div>
            <div style={{ flex: "2 1 220px" }}>
              <div style={{ fontSize: 12, color: palette.textMuted, marginBottom: 6 }}>
                Note (setup grade, session, etc.)
              </div>
              <input
                type="text"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="e.g. A+ / NY session / clean 1M trigger"
                style={{
                  width: "100%",
                  background: palette.panelAlt,
                  border: `1px solid ${palette.border}`,
                  borderRadius: 8,
                  padding: "10px 12px",
                  color: palette.text,
                  fontSize: 13,
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button
                onClick={logTrade}
                disabled={busy}
                style={{
                  background: palette.info,
                  color: "#04101F",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 18px",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: busy ? "wait" : "pointer",
                  opacity: busy ? 0.7 : 1,
                }}
              >
                Log Trade
              </button>
            </div>
          </div>

          {tradeLog.length === 0 ? (
            <div style={{ color: palette.textFaint, fontSize: 13, padding: "8px 2px" }}>
              No trades logged yet. Entries update the account buffer above
              automatically.
            </div>
          ) : (
            <div style={{ maxHeight: 260, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ color: palette.textFaint, textAlign: "left" }}>
                    <th style={{ fontWeight: 500, padding: "6px 8px" }}>Date</th>
                    <th style={{ fontWeight: 500, padding: "6px 8px" }}>Mkt</th>
                    <th style={{ fontWeight: 500, padding: "6px 8px" }}>Stop</th>
                    <th style={{ fontWeight: 500, padding: "6px 8px" }}>P&L</th>
                    <th style={{ fontWeight: 500, padding: "6px 8px" }}>Balance</th>
                    <th style={{ fontWeight: 500, padding: "6px 8px" }}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {tradeLog.map((t) => (
                    <tr key={t.id} style={{ borderTop: `1px solid ${palette.borderSoft}` }}>
                      <td style={{ padding: "6px 8px", color: palette.textMuted, fontFamily: mono }}>
                        {t.date}
                      </td>
                      <td style={{ padding: "6px 8px", fontFamily: mono }}>{t.family}</td>
                      <td style={{ padding: "6px 8px", fontFamily: mono, color: palette.textMuted }}>
                        {t.stopPoints}pt
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",
                          fontFamily: mono,
                          color: t.pnl >= 0 ? palette.safe : palette.danger,
                        }}
                      >
                        {money(t.pnl)}
                      </td>
                      <td style={{ padding: "6px 8px", fontFamily: mono }}>
                        {money(t.balanceAfter)}
                      </td>
                      <td style={{ padding: "6px 8px", color: palette.textMuted }}>{t.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
            <button
              onClick={clearLog}
              disabled={busy}
              style={{
                background: "transparent",
                border: `1px solid ${palette.border}`,
                color: palette.textMuted,
                borderRadius: 8,
                padding: "8px 14px",
                fontSize: 12,
                cursor: busy ? "wait" : "pointer",
              }}
            >
              Clear log
            </button>
            <button
              onClick={resetAccount}
              disabled={busy}
              style={{
                background: "transparent",
                border: `1px solid ${palette.border}`,
                color: palette.textMuted,
                borderRadius: 8,
                padding: "8px 14px",
                fontSize: 12,
                cursor: busy ? "wait" : "pointer",
              }}
            >
              Reset to $2,000 buffer
            </button>
          </div>
        </Panel>

        <div style={{ color: palette.textFaint, fontSize: 11.5, marginTop: 20, lineHeight: 1.6 }}>
          Contracts are always rounded down. If both readouts show NO TRADE,
          the correct action is skipping the trade — never shrinking the stop
          to force a size. Portfolio mode divides the $500 ceiling across the
          number of accounts trading the same signal; it does not multiply
          your total risk.
        </div>
      </div>
    </div>
  );
}
