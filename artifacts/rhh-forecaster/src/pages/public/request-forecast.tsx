import { useState } from "react";
import {
  Building2, User, Phone, Mail, MapPin, Home, CheckCircle2,
  ChevronDown, Loader2, ArrowRight, Globe,
} from "lucide-react";

// ── Brand tokens ──────────────────────────────────────────────────────────────
const GOLD   = "#C9A84C";
const DARK   = "#1C1C1C";
const CREAM  = "#FDFCF8";

// ── Data ──────────────────────────────────────────────────────────────────────
const PROPERTY_TYPES = ["Apartment", "Duplex", "Penthouse", "Townhouse", "Villa", "Hotel Apartment", "Other"];
const LAYOUTS = ["Studio", "1 Bedroom", "2 Bedrooms", "3 Bedrooms", "4 Bedrooms", "5 Bedrooms", "6 Bedrooms", "7 Bedrooms", "8 Bedrooms", "9 Bedrooms", "10 Bedrooms", "10+ Bedrooms"];
const BATHROOMS_OPTS = ["1", "1.5", "2", "2.5", "3", "3.5", "4", "4.5", "5", "5+"];
const FURNISHINGS = ["Unfurnished", "Partially Furnished", "Fully Furnished", "Premium Furnished", "Previously Managed as Holiday Home"];
const VIEWS = ["Sea View", "Full Sea View", "Canal View", "Marina View", "Pool View", "Golf View", "Park View", "Community View", "City View", "Garden View", "Other"];
const EMIRATES = ["Abu Dhabi", "Dubai", "Sharjah", "Ras Al Khaimah", "Fujairah", "Ajman", "Umm Al Quwain"];
const ABU_DHABI_AREAS = [
  "Yas Island", "Saadiyat Island", "Al Reem Island", "Al Raha Beach", "Al Maryah Island",
  "Masdar City", "Khalifa City", "Al Reef", "Al Raha Gardens", "Al Muneera", "Al Zeina",
  "Al Bateen", "Corniche", "Al Khalidiyah", "Al Mushrif", "Al Manhal", "Al Rawdah",
  "Al Shamkha", "Al Ghadeer", "Al Hudayriyat", "Al Jubail Island", "Tourist Club Area",
  "Al Danah", "Al Nahyan", "Al Marina", "Other",
];
const DUBAI_AREAS = [
  "Downtown Dubai", "Dubai Marina", "Palm Jumeirah", "Business Bay", "JBR", "DIFC",
  "Jumeirah Village Circle", "Dubai Hills", "Al Barsha", "Arabian Ranches",
  "Dubai Creek Harbour", "Emaar Beachfront", "Other",
];

const AREAS_BY_EMIRATE: Record<string, string[]> = {
  "Abu Dhabi": ABU_DHABI_AREAS,
  "Dubai": DUBAI_AREAS,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function Field({
  label, required, children, hint,
}: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label style={{ color: "#4B4B4B", fontSize: 13, fontWeight: 600, display: "block" }}>
        {label}{required && <span style={{ color: "#E53E3E", marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {hint && <p style={{ color: "#888", fontSize: 11 }}>{hint}</p>}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 42,
  border: "1.5px solid #E2E0DB",
  borderRadius: 8,
  padding: "0 12px",
  fontSize: 14,
  color: DARK,
  background: "#FFFFFF",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.15s",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: "none",
  WebkitAppearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
  paddingRight: 36,
  cursor: "pointer",
};

function SSelect({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void;
  options: string[]; placeholder?: string;
}) {
  return (
    <select style={selectStyle} value={value} onChange={e => onChange(e.target.value)}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function SInput({ value, onChange, placeholder, type = "text" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      style={inputStyle}
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

function STextarea({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      style={{ ...inputStyle, height: "auto", padding: "10px 12px", resize: "vertical" }}
      rows={rows}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

function SectionHeader({ icon: Icon, label }: { icon: React.FC<any>; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
      <div style={{
        width: 30, height: 30, borderRadius: "50%",
        background: `${GOLD}18`, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={14} color={GOLD} />
      </div>
      <span style={{ fontSize: 14, fontWeight: 700, color: DARK }}>{label}</span>
    </div>
  );
}

// ── Thank-you screen ──────────────────────────────────────────────────────────
function ThankYou({ ref: refCode }: { ref: string }) {
  return (
    <div style={{
      minHeight: "100vh", background: CREAM, display: "flex", alignItems: "center",
      justifyContent: "center", padding: "24px 16px",
    }}>
      <div style={{
        maxWidth: 480, width: "100%", background: "#fff",
        borderRadius: 16, padding: "48px 36px", textAlign: "center",
        boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%", background: "#F0FDF4",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 20px",
        }}>
          <CheckCircle2 size={32} color="#16a34a" />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: DARK, marginBottom: 8 }}>
          Request Received
        </h2>
        <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6, marginBottom: 16 }}>
          Thank you for submitting your property details. Our Revenue Management team will review your request and be in touch within 1–2 business days.
        </p>
        <div style={{
          background: `${GOLD}12`, border: `1.5px solid ${GOLD}40`,
          borderRadius: 10, padding: "12px 20px", marginBottom: 24,
        }}>
          <p style={{ fontSize: 12, color: "#888", marginBottom: 2 }}>Reference Number</p>
          <p style={{ fontSize: 18, fontWeight: 700, color: GOLD, letterSpacing: "0.04em" }}>{refCode}</p>
        </div>
        <p style={{ fontSize: 12, color: "#aaa" }}>
          Royal Holiday Homes · Abu Dhabi, UAE
        </p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PublicRequestForecast() {
  const [ownerType, setOwnerType] = useState<"individual" | "company">("individual");
  const [title, setTitle]         = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [company, setCompany]     = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactPosition, setContactPosition] = useState("");
  const [nationality, setNationality] = useState("");
  const [email, setEmail]         = useState("");
  const [phone, setPhone]         = useState("");
  const [whatsapp, setWhatsapp]   = useState("");
  const [waSame, setWaSame]       = useState(false);

  const [emirate, setEmirate]     = useState("Abu Dhabi");
  const [area, setArea]           = useState("");
  const [areaOther, setAreaOther] = useState("");
  const [community, setCommunity] = useState("");
  const [building, setBuilding]   = useState("");
  const [unit, setUnit]           = useState("");
  const [propType, setPropType]   = useState("");
  const [layout, setLayout]       = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [size, setSize]           = useState("");
  const [furnishing, setFurnishing] = useState("");
  const [view, setView]           = useState("");
  const [waterfront, setWaterfront] = useState(false);

  const [notes, setNotes]         = useState("");
  const [error, setError]         = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);

  const areaOptions = AREAS_BY_EMIRATE[emirate] ?? ["Other"];

  if (submitted) return <ThankYou ref={submitted} />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Validation
    if (ownerType === "individual" && !firstName.trim()) {
      setError("First name is required."); return;
    }
    if (ownerType === "company" && !company.trim()) {
      setError("Company name is required."); return;
    }
    if (ownerType === "company" && !contactPerson.trim()) {
      setError("Contact person name is required."); return;
    }
    if (!phone.trim() && !email.trim()) {
      setError("Please provide at least a phone number or email address."); return;
    }

    const effectiveArea = area === "Other" ? areaOther : area;

    const payload: Record<string, any> = {
      ownerType,
      ownerTitle: title || null,
      ownerFirstName: firstName.trim() || null,
      ownerLastName: lastName.trim() || null,
      ownerCompanyName: company.trim() || null,
      ownerContactPerson: contactPerson.trim() || null,
      ownerContactPosition: contactPosition.trim() || null,
      ownerNationality: nationality.trim() || null,
      ownerEmail: email.trim() || null,
      ownerPhone: phone.trim() || null,
      ownerWhatsapp: waSame ? phone.trim() || null : whatsapp.trim() || null,
      propertyEmirate: emirate || null,
      propertyArea: effectiveArea || null,
      propertyCommunity: community || null,
      propertyDevelopment: building.trim() || null,
      propertyUnitNumber: unit.trim() || null,
      propertyType: propType || null,
      propertyLayout: layout || null,
      propertyBathrooms: bathrooms ? parseFloat(bathrooms) : null,
      propertyInternalArea: size ? parseFloat(size) : null,
      propertyFurnishing: furnishing || null,
      propertyView: view || null,
      propertyIsWaterfront: waterfront,
      notes: notes.trim() || null,
    };

    setSubmitting(true);
    try {
      const res = await fetch("/api/public/forecast-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Submission failed. Please try again.");
        return;
      }
      setSubmitted(data.ref);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const cardStyle: React.CSSProperties = {
    background: "#fff",
    border: "1.5px solid #ECEAE4",
    borderRadius: 14,
    padding: "24px",
    marginBottom: 16,
  };

  return (
    <div style={{ minHeight: "100vh", background: CREAM, fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── Hero ── */}
      <div style={{ background: DARK, paddingBottom: 32 }}>
        {/* Nav bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          maxWidth: 680, margin: "0 auto", padding: "20px 20px 0",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img
              src="/rhh-logo-mark.png"
              alt="Royal Holiday Homes"
              style={{ width: 40, height: 40, objectFit: "contain" }}
            />
            <div>
              <p style={{ color: "#fff", fontSize: 14, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
                Royal Holiday Homes
              </p>
              <p style={{ color: `${GOLD}CC`, fontSize: 11, margin: 0 }}>Abu Dhabi, UAE</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#888", fontSize: 12 }}>
            <Globe size={12} />
            <span>royalholidayhomes.ae</span>
          </div>
        </div>

        {/* Hero text */}
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "36px 20px 0" }}>
          <div style={{
            display: "inline-block", background: `${GOLD}22`, border: `1px solid ${GOLD}44`,
            borderRadius: 20, padding: "4px 14px", marginBottom: 16,
          }}>
            <span style={{ color: GOLD, fontSize: 12, fontWeight: 600 }}>
              Free Revenue Forecast
            </span>
          </div>
          <h1 style={{
            color: "#fff", fontSize: 28, fontWeight: 800, lineHeight: 1.25,
            margin: "0 0 12px", letterSpacing: "-0.02em",
          }}>
            What is your property worth<br />
            <span style={{ color: GOLD }}>as a holiday home?</span>
          </h1>
          <p style={{ color: "#aaa", fontSize: 15, lineHeight: 1.6, margin: 0 }}>
            Fill in your details below and our Revenue Management team will prepare a personalised income projection for your property — completely free of charge.
          </p>
        </div>
      </div>

      {/* ── Form ── */}
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 20px 60px" }}>
        <form onSubmit={handleSubmit}>

          {/* ── Owner details ── */}
          <div style={cardStyle}>
            <SectionHeader icon={User} label="Your Details" />

            {/* Owner type toggle */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {(["individual", "company"] as const).map(t => (
                <button
                  key={t} type="button"
                  onClick={() => setOwnerType(t)}
                  style={{
                    flex: 1, height: 38, borderRadius: 8, fontSize: 13, fontWeight: 600,
                    border: `1.5px solid ${ownerType === t ? GOLD : "#E2E0DB"}`,
                    background: ownerType === t ? `${GOLD}14` : "#fff",
                    color: ownerType === t ? GOLD : "#666",
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  {t === "individual" ? "Individual / Owner" : "Company / Corporate"}
                </button>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {ownerType === "individual" ? (
                <>
                  <Field label="Title">
                    <SSelect value={title} onChange={setTitle} placeholder="Select" options={["Mr.", "Mrs.", "Ms.", "Dr.", "Prof.", "Eng."]} />
                  </Field>
                  <Field label="First Name" required>
                    <SInput value={firstName} onChange={setFirstName} placeholder="e.g. Ahmed" />
                  </Field>
                  <div style={{ gridColumn: "span 2" }}>
                    <Field label="Last Name">
                      <SInput value={lastName} onChange={setLastName} placeholder="e.g. Al Mansoori" />
                    </Field>
                  </div>
                  <div style={{ gridColumn: "span 2" }}>
                    <Field label="Nationality">
                      <SInput value={nationality} onChange={setNationality} placeholder="e.g. UAE National" />
                    </Field>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ gridColumn: "span 2" }}>
                    <Field label="Company Name" required>
                      <SInput value={company} onChange={setCompany} placeholder="e.g. Al Mansoori Properties LLC" />
                    </Field>
                  </div>
                  <Field label="Contact Person" required>
                    <SInput value={contactPerson} onChange={setContactPerson} placeholder="Full name" />
                  </Field>
                  <Field label="Position">
                    <SInput value={contactPosition} onChange={setContactPosition} placeholder="e.g. Director" />
                  </Field>
                </>
              )}

              <Field label="Email Address">
                <SInput type="email" value={email} onChange={setEmail} placeholder="your@email.com" />
              </Field>
              <Field label="Mobile Number" required={!email}>
                <SInput type="tel" value={phone} onChange={setPhone} placeholder="+971 50 000 0000" />
              </Field>

              <div style={{ gridColumn: "span 2" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <input
                    type="checkbox" id="waSame" checked={waSame}
                    onChange={e => setWaSame(e.target.checked)}
                    style={{ width: 15, height: 15, accentColor: GOLD, cursor: "pointer" }}
                  />
                  <label htmlFor="waSame" style={{ fontSize: 13, color: "#555", cursor: "pointer" }}>
                    WhatsApp number is the same as mobile
                  </label>
                </div>
                {!waSame && (
                  <Field label="WhatsApp Number">
                    <SInput type="tel" value={whatsapp} onChange={setWhatsapp} placeholder="+971 50 000 0000" />
                  </Field>
                )}
              </div>
            </div>
          </div>

          {/* ── Property details ── */}
          <div style={cardStyle}>
            <SectionHeader icon={Home} label="Property Details" />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

              <Field label="Emirate">
                <SSelect
                  value={emirate} onChange={v => { setEmirate(v); setArea(""); }}
                  options={EMIRATES}
                />
              </Field>

              <Field label="Area / District">
                <SSelect
                  value={area} onChange={setArea}
                  options={areaOptions}
                  placeholder="Select area"
                />
              </Field>

              {area === "Other" && (
                <div style={{ gridColumn: "span 2" }}>
                  <Field label="Enter Area">
                    <SInput value={areaOther} onChange={setAreaOther} placeholder="Area name" />
                  </Field>
                </div>
              )}

              <div style={{ gridColumn: "span 2" }}>
                <Field label="Community / Project">
                  <SInput value={community} onChange={setCommunity} placeholder="e.g. Waters Edge, Mamsha Al Saadiyat" />
                </Field>
              </div>

              <Field label="Building">
                <SInput value={building} onChange={setBuilding} placeholder="Building name or number" />
              </Field>

              <Field label="Unit Number">
                <SInput value={unit} onChange={setUnit} placeholder="e.g. 402" />
              </Field>

              <Field label="Property Type">
                <SSelect value={propType} onChange={setPropType} options={PROPERTY_TYPES} placeholder="Select type" />
              </Field>

              <Field label="Layout">
                <SSelect value={layout} onChange={setLayout} options={LAYOUTS} placeholder="Select layout" />
              </Field>

              <Field label="Bathrooms">
                <SSelect value={bathrooms} onChange={setBathrooms} options={BATHROOMS_OPTS} placeholder="Select" />
              </Field>

              <Field label="Size (Sq Ft)">
                <SInput type="number" value={size} onChange={setSize} placeholder="e.g. 870" />
              </Field>

              <Field label="Furnishing">
                <SSelect value={furnishing} onChange={setFurnishing} options={FURNISHINGS} placeholder="Select furnishing" />
              </Field>

              <Field label="View">
                <SSelect value={view} onChange={setView} options={VIEWS} placeholder="Select view" />
              </Field>

              <div style={{ gridColumn: "span 2", display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox" id="waterfront" checked={waterfront}
                  onChange={e => setWaterfront(e.target.checked)}
                  style={{ width: 15, height: 15, accentColor: GOLD, cursor: "pointer" }}
                />
                <label htmlFor="waterfront" style={{ fontSize: 13, color: "#555", cursor: "pointer" }}>
                  Waterfront property
                </label>
              </div>
            </div>
          </div>

          {/* ── Notes ── */}
          <div style={cardStyle}>
            <SectionHeader icon={MapPin} label="Additional Information" />
            <Field label="Notes or Questions">
              <STextarea
                value={notes} onChange={setNotes} rows={4}
                placeholder="Any additional details about the property, your goals, or questions for our team…"
              />
            </Field>
          </div>

          {/* Honeypot (spam guard — hidden from real users) */}
          <input name="_hp" style={{ display: "none" }} tabIndex={-1} autoComplete="off" />

          {/* Error */}
          {error && (
            <div style={{
              background: "#FEF2F2", border: "1.5px solid #FECACA",
              borderRadius: 10, padding: "12px 16px", marginBottom: 16,
              color: "#991B1B", fontSize: 13,
            }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%", height: 50, borderRadius: 10, border: "none",
              background: submitting ? "#B8944A" : GOLD,
              color: "#fff", fontSize: 15, fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "background 0.15s",
              boxShadow: "0 4px 14px rgba(201,168,76,0.35)",
            }}
          >
            {submitting ? (
              <>
                <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                Submitting…
              </>
            ) : (
              <>
                Request My Free Forecast
                <ArrowRight size={18} />
              </>
            )}
          </button>

          <p style={{ textAlign: "center", fontSize: 12, color: "#aaa", marginTop: 14 }}>
            Your information is kept confidential and used only to prepare your forecast.
          </p>
        </form>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 32, paddingTop: 24, borderTop: "1px solid #E8E4DC" }}>
          <p style={{ fontSize: 12, color: "#aaa" }}>
            © {new Date().getFullYear()} Royal Holiday Homes · Abu Dhabi, UAE
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input:focus, select:focus, textarea:focus {
          border-color: ${GOLD} !important;
          box-shadow: 0 0 0 3px ${GOLD}22;
        }
      `}</style>
    </div>
  );
}
