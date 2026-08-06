// Separate module so React Fast Refresh can hot-reload AmenitiesPicker without issues

export interface Amenity {
  id: number;
  category: string;
  name: string;
  icon: string;
  adrBoost: number;
  occupancyBoost: number;
  luxuryScore: number;
  guestAppealScore: number;
  familyScore: number;
  corporateScore: number;
  holidayHomeScore: number;
  isProposalHighlight: boolean;
  sortOrder: number;
}

export interface PropertyScores {
  luxury: number;
  guestAppeal: number;
  family: number;
  corporate: number;
  holidayHome: number;
  marketCompetitiveness: number;
}

export function calculateScores(amenities: Amenity[], selectedIds: number[]): PropertyScores {
  const selected = amenities.filter(a => selectedIds.includes(a.id));
  const luxury      = Math.min(100, selected.reduce((s, a) => s + a.luxuryScore,     0));
  const guestAppeal = Math.min(100, selected.reduce((s, a) => s + a.guestAppealScore, 0));
  const family      = Math.min(100, selected.reduce((s, a) => s + a.familyScore,      0));
  const corporate   = Math.min(100, selected.reduce((s, a) => s + a.corporateScore,   0));
  const holidayHome = Math.min(100, selected.reduce((s, a) => s + a.holidayHomeScore, 0));
  const marketCompetitiveness = Math.round((luxury + guestAppeal + family + corporate + holidayHome) / 5);
  return { luxury, guestAppeal, family, corporate, holidayHome, marketCompetitiveness };
}

function CircularGauge({ value, label, color }: { value: number; label: string; color: string }) {
  const r = 28;
  const circumference = 2 * Math.PI * r;
  const dash = (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="6" />
          <circle
            cx="36" cy="36" r={r}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeDasharray={`${dash} ${circumference}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-foreground">
          {value}
        </span>
      </div>
      <span className="text-[10px] text-center leading-tight text-muted-foreground font-medium max-w-[70px]">{label}</span>
    </div>
  );
}

export function PropertyScoresPanel({ scores }: { scores: PropertyScores }) {
  return (
    <div className="bg-muted/30 rounded-lg border border-border/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-foreground">Property Score</p>
        <span className="text-xs border border-amber-500/50 text-amber-600 rounded-full px-2 py-0.5">
          Market: {scores.marketCompetitiveness}/100
        </span>
      </div>
      <div className="flex items-center justify-around gap-2 flex-wrap">
        <CircularGauge value={scores.luxury}      label="Luxury"             color="#C9A84C" />
        <CircularGauge value={scores.guestAppeal} label="Guest Appeal"       color="#3B82F6" />
        <CircularGauge value={scores.family}      label="Family"             color="#10B981" />
        <CircularGauge value={scores.corporate}   label="Corporate"          color="#6366F1" />
        <CircularGauge value={scores.holidayHome} label="Holiday Home Ready" color="#F59E0B" />
      </div>
    </div>
  );
}
