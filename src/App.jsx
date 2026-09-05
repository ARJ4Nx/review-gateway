import { useState, useEffect, useCallback } from "react";
import { Star, Store, ArrowRight, LogOut, Settings, BarChart3, MessageSquare, Copy, Check } from "lucide-react";
import { supabase } from "./supabaseClient";

// ---------- design tokens ----------
const T = {
  ink: "#20242F",
  inkSoft: "#565B6B",
  paper: "#F7F5F0",
  paperLine: "#E4DFD3",
  gold: "#D9A441",
  moss: "#3E7A5D",
  clay: "#B8563A",
};

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Inter:wght@400;500;600&display=swap');`;

const TIERS = {
  free: { name: "Free", price: "£0", limit: 30, period: "lifetime", blurb: "30 reviews, no time limit" },
  starter: { name: "Starter", price: "£5/mo", limit: 100, period: "month", blurb: "100 reviews a month" },
  growth: { name: "Growth", price: "£10/mo", limit: 300, period: "month", blurb: "300 reviews a month" },
  pro: { name: "Pro", price: "£20/mo", limit: 1000, period: "month", blurb: "1,000 reviews a month" },
};

const monthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}`;
};

const slugify = (s) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function limitFor(biz) {
  const tier = TIERS[biz.tier] || TIERS.free;
  if (biz.tier === "free" || !biz.tier) return { count: biz.reviews_total || 0, limit: tier.limit, tier };
  const stale = biz.month_key !== monthKey();
  return { count: stale ? 0 : biz.reviews_this_month || 0, limit: tier.limit, tier };
}

// ---------- data layer (Supabase) ----------
async function fetchBizBySlug(slug) {
  const { data, error } = await supabase.from("businesses").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data;
}
async function fetchBizByUserId(userId) {
  const { data, error } = await supabase.from("businesses").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}
async function updateBiz(id, patch) {
  const { error } = await supabase.from("businesses").update(patch).eq("id", id);
  if (error) throw error;
}
async function fetchReviews(businessId) {
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
async function insertReview(businessId, slug, rating, message) {
  const { error } = await supabase.from("reviews").insert({ business_id: businessId, rating, message });
  if (error) throw error;
  await supabase.rpc("increment_review_count", { p_slug: slug });
}
async function makeUniqueSlug(name) {
  const base = slugify(name) || "business";
  let slug = base;
  let n = 1;
  while (await fetchBizBySlug(slug)) {
    n += 1;
    slug = `${base}-${n}`;
  }
  return slug;
}

// ---------- shared UI bits ----------
function Stars({ value, onPick, size = 40 }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => onPick(n)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", lineHeight: 0 }}
        >
          <Star size={size} fill={value >= n ? T.gold : "none"} color={value >= n ? T.gold : T.paperLine} strokeWidth={1.5} />
        </button>
      ))}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "block", marginBottom: 16 }}>
      <span style={{ display: "block", fontSize: 13, color: T.inkSoft, marginBottom: 6 }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: `1px solid ${T.paperLine}`,
  borderRadius: 6,
  fontSize: 15,
  fontFamily: "Inter, sans-serif",
  boxSizing: "border-box",
  background: "#fff",
};

const btnPrimary = {
  background: T.ink,
  color: "#fff",
  border: "none",
  borderRadius: 6,
  padding: "12px 22px",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "Inter, sans-serif",
};

const btnGhost = {
  background: "none",
  border: `1px solid ${T.paperLine}`,
  borderRadius: 6,
  padding: "10px 18px",
  fontSize: 14,
  cursor: "pointer",
  fontFamily: "Inter, sans-serif",
  color: T.ink,
};

function CenteredShell({ children }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.ink,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "Inter, sans-serif",
      }}
    >
      {children}
    </div>
  );
}

// ---------- customer-facing flow ----------
function CustomerFlow({ slug, onExitDemo }) {
  const [biz, setBiz] = useState(undefined);
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [stage, setStage] = useState("rate");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchBizBySlug(slug).then(setBiz).catch(() => setBiz(null));
  }, [slug]);

  const submitReview = useCallback(
    async (finalRating, finalMessage) => {
      setSaving(true);
      try {
        await insertReview(biz.id, slug, finalRating, finalMessage || "");
      } finally {
        setSaving(false);
      }
    },
    [biz, slug]
  );

  if (biz === undefined) return <CenteredShell><p style={{ color: T.inkSoft }}>Loading…</p></CenteredShell>;
  if (biz === null) {
    return (
      <CenteredShell>
        <p style={{ color: "#fff", fontFamily: "Inter, sans-serif" }}>We couldn't find that business. Check the link and try again.</p>
        {onExitDemo && <button onClick={onExitDemo} style={{ ...btnGhost, marginTop: 16 }}>Back</button>}
      </CenteredShell>
    );
  }

  return (
    <CenteredShell>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontFamily: "Fraunces, serif", fontSize: 26, color: "#fff" }}>{biz.name}</div>
      </div>

      <div style={{ background: T.paper, borderRadius: 12, padding: "40px 32px", width: 380, maxWidth: "90vw", boxSizing: "border-box" }}>
        {stage === "rate" && (
          <div style={{ textAlign: "center" }}>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 16, color: T.ink, marginBottom: 24 }}>How was your experience?</p>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
              <Stars value={rating} onPick={setRating} />
            </div>
            <button
              disabled={!rating}
              onClick={async () => {
                if (rating >= 4) {
                  await submitReview(rating, "");
                  setStage("thanks-good");
                } else {
                  setStage("feedback");
                }
              }}
              style={{ ...btnPrimary, opacity: rating ? 1 : 0.4, width: "100%" }}
            >
              Continue
            </button>
          </div>
        )}

        {stage === "feedback" && (
          <div>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 16, color: T.ink, marginBottom: 4, fontWeight: 600 }}>Sorry to hear that.</p>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: T.inkSoft, marginBottom: 16 }}>
              Let us know what we can improve — it goes straight to the owner.
            </p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="What happened?"
              style={{ ...inputStyle, resize: "vertical", marginBottom: 16 }}
            />
            <button
              disabled={saving}
              onClick={async () => {
                await submitReview(rating, message);
                setStage("thanks-bad");
              }}
              style={{ ...btnPrimary, width: "100%" }}
            >
              {saving ? "Sending…" : "Send feedback"}
            </button>
          </div>
        )}

        {stage === "thanks-bad" && (
          <div style={{ textAlign: "center" }}>
            <p style={{ fontFamily: "Fraunces, serif", fontSize: 20, color: T.ink, marginBottom: 8 }}>Thank you.</p>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: T.inkSoft }}>
              Your feedback has been sent to {biz.name}. They'll use it to improve.
            </p>
          </div>
        )}

        {stage === "thanks-good" && (
          <div style={{ textAlign: "center" }}>
            <p style={{ fontFamily: "Fraunces, serif", fontSize: 20, color: T.ink, marginBottom: 8 }}>Thanks so much!</p>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: T.inkSoft, marginBottom: 20 }}>Mind sharing that on Google? It really helps.</p>
            <a
              href={biz.google_review_link || "#"}
              target="_blank"
              rel="noreferrer"
              style={{ ...btnPrimary, display: "inline-block", textDecoration: "none" }}
              onClick={(e) => { if (!biz.google_review_link) e.preventDefault(); }}
            >
              {biz.google_review_link ? "Leave a Google review" : "Google link not set up yet"}
            </a>
          </div>
        )}
      </div>

      {onExitDemo && (
        <button onClick={onExitDemo} style={{ ...btnGhost, marginTop: 24, background: "transparent", borderColor: "#454B5C", color: "#fff" }}>
          ← Back
        </button>
      )}
    </CenteredShell>
  );
}

// ---------- auth ----------
function AuthScreen({ mode, setMode, onAuthed }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    if (!email || !password || (mode === "signup" && !name)) {
      setError("Fill in all fields.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        const userId = data.user?.id;
        if (!userId) throw new Error("Check your email to confirm your account, then log in.");

        const slug = await makeUniqueSlug(name);
        const { data: biz, error: insertError } = await supabase
          .from("businesses")
          .insert({
            user_id: userId,
            slug,
            name,
            google_review_link: "",
            tier: "free",
            reviews_total: 0,
            reviews_this_month: 0,
            month_key: monthKey(),
          })
          .select()
          .single();
        if (insertError) throw insertError;
        onAuthed(biz.slug);
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        const biz = await fetchBizByUserId(data.user.id);
        if (!biz) throw new Error("No business found for this account.");
        onAuthed(biz.slug);
      }
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <CenteredShell>
      <div style={{ background: T.paper, borderRadius: 12, padding: 36, width: 380, maxWidth: "90vw", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
          <Store size={20} color={T.ink} />
          <span style={{ fontFamily: "Fraunces, serif", fontSize: 20, color: T.ink }}>
            {mode === "signup" ? "Create your account" : "Log in"}
          </span>
        </div>

        {mode === "signup" && (
          <Field label="Business name">
            <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="The Corner Cafe" />
          </Field>
        )}
        <Field label="Email">
          <input style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" />
        </Field>
        <Field label="Password">
          <input type="password" style={inputStyle} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </Field>

        {error && <p style={{ color: T.clay, fontSize: 13, marginBottom: 12 }}>{error}</p>}

        <button onClick={submit} disabled={busy} style={{ ...btnPrimary, width: "100%", marginTop: 4 }}>
          {busy ? "Working…" : mode === "signup" ? "Create account" : "Log in"}
        </button>

        <p style={{ fontSize: 13, color: T.inkSoft, marginTop: 16, textAlign: "center" }}>
          {mode === "signup" ? "Already have an account? " : "New here? "}
          <button
            onClick={() => setMode(mode === "signup" ? "login" : "signup")}
            style={{ background: "none", border: "none", color: T.ink, textDecoration: "underline", cursor: "pointer", fontSize: 13 }}
          >
            {mode === "signup" ? "Log in" : "Create one"}
          </button>
        </p>
      </div>
    </CenteredShell>
  );
}

// ---------- dashboard ----------
function Dashboard({ slug, onLogout }) {
  const [biz, setBiz] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [tab, setTab] = useState("overview");
  const [copied, setCopied] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");

  const refresh = useCallback(async () => {
    const b = await fetchBizBySlug(slug);
    setBiz(b);
    setLinkDraft(b?.google_review_link || "");
    if (b) setReviews(await fetchReviews(b.id));
  }, [slug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!biz) return <CenteredShell><p style={{ color: "#fff" }}>Loading…</p></CenteredShell>;

  const { count, limit, tier } = limitFor(biz);
  const good = reviews.filter((r) => r.rating >= 4).length;
  const bad = reviews.length - good;
  const avg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : "—";
  const baseUrl = window.location.href.split("?")[0].split("#")[0];
  const shareUrl = `${baseUrl}?biz=${biz.slug}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = shareUrl;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const nav = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "reviews", label: "Reviews", icon: MessageSquare },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: T.paper, fontFamily: "Inter, sans-serif" }}>
      <div style={{ width: 220, background: T.ink, color: "#fff", padding: "28px 18px", boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
        <div style={{ fontFamily: "Fraunces, serif", fontSize: 19, marginBottom: 4 }}>{biz.name}</div>
        <div style={{ fontSize: 12, color: "#9BA1B0", marginBottom: 32 }}>{tier.name} plan</div>
        {nav.map((n) => (
          <button
            key={n.id}
            onClick={() => setTab(n.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: tab === n.id ? "rgba(255,255,255,0.1)" : "transparent",
              border: "none",
              color: "#fff",
              padding: "10px 12px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 14,
              marginBottom: 4,
              textAlign: "left",
              fontFamily: "Inter, sans-serif",
            }}
          >
            <n.icon size={16} /> {n.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            onLogout();
          }}
          style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", color: "#9BA1B0", cursor: "pointer", fontSize: 14, padding: "10px 12px" }}
        >
          <LogOut size={16} /> Log out
        </button>
      </div>

      <div style={{ flex: 1, padding: "36px 44px", boxSizing: "border-box", maxWidth: 900 }}>
        {count >= limit && (
          <div style={{ background: "#F1E3DC", border: `1px solid ${T.clay}`, borderRadius: 8, padding: "12px 16px", marginBottom: 24, fontSize: 14, color: T.ink }}>
            You've used {count} of {limit} reviews {tier.period === "lifetime" ? "on the free plan" : "this month"}. New reviews are still being collected, but{" "}
            <button onClick={() => setTab("settings")} style={{ background: "none", border: "none", textDecoration: "underline", cursor: "pointer", color: T.ink, fontWeight: 600, padding: 0, fontSize: 14 }}>
              upgrade your plan
            </button>{" "}
            to keep growing without limits.
          </div>
        )}

        {tab === "overview" && (
          <div>
            <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 26, color: T.ink, marginBottom: 28 }}>Overview</h1>
            <div style={{ display: "flex", gap: 40, marginBottom: 36, flexWrap: "wrap" }}>
              <Stat label="Total reviews" value={reviews.length} />
              <Stat label="Average rating" value={avg} />
              <Stat label="Positive (4–5★)" value={good} color={T.moss} />
              <Stat label="Needs attention (≤3★)" value={bad} color={T.clay} />
              <Stat label={`Used this ${tier.period}`} value={`${count} / ${limit}`} />
            </div>
            <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 18, color: T.ink, marginBottom: 12 }}>Latest feedback</h2>
            <ReviewList reviews={reviews.slice(0, 4)} />
          </div>
        )}

        {tab === "reviews" && (
          <div>
            <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 26, color: T.ink, marginBottom: 24 }}>Reviews</h1>
            <ReviewList reviews={reviews} />
          </div>
        )}

        {tab === "settings" && (
          <div>
            <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 26, color: T.ink, marginBottom: 24 }}>Settings</h1>

            <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.ink, marginBottom: 10 }}>Your customer link</h2>
            <p style={{ fontSize: 13, color: T.inkSoft, marginBottom: 10 }}>Put this on your NFC card, or share it directly.</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 8, maxWidth: 480 }}>
              <input readOnly value={shareUrl} style={{ ...inputStyle, background: "#fff" }} />
              <button onClick={copyLink} style={{ ...btnGhost, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 28 }}>Give a different link to each business by changing the part after "?biz=".</p>

            <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.ink, marginBottom: 10 }}>Google review link</h2>
            <p style={{ fontSize: 13, color: T.inkSoft, marginBottom: 10 }}>Happy customers (4–5★) are sent here.</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 28, maxWidth: 480 }}>
              <input value={linkDraft} onChange={(e) => setLinkDraft(e.target.value)} placeholder="https://g.page/r/..." style={inputStyle} />
              <button
                onClick={async () => {
                  await updateBiz(biz.id, { google_review_link: linkDraft });
                  refresh();
                }}
                style={btnPrimary}
              >
                Save
              </button>
            </div>

            <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.ink, marginBottom: 10 }}>Plan</h2>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              {Object.entries(TIERS).map(([id, t]) => (
                <div key={id} style={{ border: `1px solid ${biz.tier === id ? T.ink : T.paperLine}`, borderRadius: 8, padding: 18, width: 160, background: "#fff" }}>
                  <div style={{ fontFamily: "Fraunces, serif", fontSize: 17, marginBottom: 4 }}>{t.name}</div>
                  <div style={{ fontSize: 14, color: T.inkSoft, marginBottom: 10 }}>{t.price}</div>
                  <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 14 }}>{t.blurb}</div>
                  {biz.tier === id ? (
                    <span style={{ fontSize: 12, color: T.moss, fontWeight: 600 }}>Current plan</span>
                  ) : (
                    <button
                      onClick={async () => {
                        await updateBiz(biz.id, { tier: id, month_key: monthKey(), reviews_this_month: 0 });
                        refresh();
                      }}
                      style={{ ...btnGhost, fontSize: 13, padding: "6px 12px" }}
                    >
                      Switch
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, color: T.inkSoft, marginTop: 14 }}>
              Switching plans here is instant and free for now — wire up Stripe when you're ready to actually charge for it.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontFamily: "Fraunces, serif", fontSize: 32, color: color || T.ink }}>{value}</div>
      <div style={{ fontSize: 13, color: T.inkSoft }}>{label}</div>
    </div>
  );
}

function ReviewList({ reviews }) {
  if (!reviews.length) {
    return <p style={{ fontSize: 14, color: T.inkSoft }}>No reviews yet. Share your customer link to start collecting feedback.</p>;
  }
  return (
    <div>
      {reviews.map((r) => (
        <div key={r.id} style={{ borderBottom: `1px solid ${T.paperLine}`, padding: "14px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: r.message ? 6 : 0 }}>
            <Stars value={r.rating} onPick={() => {}} size={16} />
            <span style={{ fontSize: 12, color: T.inkSoft }}>{new Date(r.created_at).toLocaleDateString()}</span>
          </div>
          {r.message && <p style={{ fontSize: 14, color: T.ink, margin: 0 }}>{r.message}</p>}
        </div>
      ))}
    </div>
  );
}

// ---------- landing ----------
function Landing({ goSignup, goLogin, goDemo }) {
  const [demoSlug, setDemoSlug] = useState("");
  return (
    <CenteredShell>
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div style={{ fontFamily: "Fraunces, serif", fontSize: 34, color: "#fff", marginBottom: 8 }}>Review Gateway</div>
        <div style={{ fontSize: 15, color: "#9BA1B0" }}>Catch problems privately. Send happy customers to Google.</div>
      </div>
      <div style={{ background: T.paper, borderRadius: 12, padding: 32, width: 380, maxWidth: "90vw", boxSizing: "border-box" }}>
        <button onClick={goSignup} style={{ ...btnPrimary, width: "100%", marginBottom: 10 }}>Create a business account</button>
        <button onClick={goLogin} style={{ ...btnGhost, width: "100%", marginBottom: 24 }}>Log in</button>
        <div style={{ borderTop: `1px solid ${T.paperLine}`, paddingTop: 20 }}>
          <p style={{ fontSize: 13, color: T.inkSoft, marginBottom: 8 }}>Try the customer view for a business link:</p>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={demoSlug} onChange={(e) => setDemoSlug(e.target.value)} placeholder="the-corner-cafe" style={inputStyle} />
            <button onClick={() => demoSlug && goDemo(slugify(demoSlug))} style={btnGhost}>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </CenteredShell>
  );
}

// ---------- app root ----------
export default function App() {
  const [screen, setScreen] = useState("checking"); // checking | landing | signup | login | dashboard | customer
  const [slug, setSlug] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bizParam = params.get("biz");
    if (bizParam) {
      setSlug(bizParam);
      setScreen("customer");
      return;
    }
    supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user;
      if (user) {
        const biz = await fetchBizByUserId(user.id);
        if (biz) {
          setSlug(biz.slug);
          setScreen("dashboard");
          return;
        }
      }
      setScreen("landing");
    });
  }, []);

  if (screen === "checking") {
    return <CenteredShell><p style={{ color: "#fff" }}>Loading…</p></CenteredShell>;
  }

  return (
    <>
      <style>{FONT_IMPORT}</style>
      {screen === "landing" && (
        <Landing
          goSignup={() => setScreen("signup")}
          goLogin={() => setScreen("login")}
          goDemo={(s) => { setSlug(s); setScreen("customer"); }}
        />
      )}
      {(screen === "signup" || screen === "login") && (
        <AuthScreen
          mode={screen}
          setMode={(m) => setScreen(m)}
          onAuthed={(s) => { setSlug(s); setScreen("dashboard"); }}
        />
      )}
      {screen === "dashboard" && slug && (
        <Dashboard slug={slug} onLogout={() => { setSlug(null); setScreen("landing"); }} />
      )}
      {screen === "customer" && slug && (
        <CustomerFlow slug={slug} onExitDemo={() => { setSlug(null); setScreen("landing"); }} />
      )}
    </>
  );
}
