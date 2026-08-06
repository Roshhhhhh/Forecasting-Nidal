import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Search, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type Amenity,
  PropertyScoresPanel,
  calculateScores,
} from "./property-scores";

export type { Amenity };

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  selectedIds: number[];
  customTags: string[];
  onChange: (ids: number[]) => void;
  onCustomTagsChange: (tags: string[]) => void;
}

// ── Custom-tags input (Unique Selling Points) ─────────────────────────────────

function CustomTagsInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState("");

  const add = () => {
    const val = input.trim();
    if (val && !tags.includes(val)) onChange([...tags, val]);
    setInput("");
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="e.g. Formula 1 View, Private Elevator…"
          className="h-8 text-sm"
        />
        <Button type="button" variant="outline" size="sm" onClick={add} disabled={!input.trim()}>
          <Plus className="h-3 w-3 mr-1" />Add
        </Button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {tags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium
                         bg-amber-500 text-white border border-amber-600"
            >
              ✨ {tag}
              <button
                type="button"
                onClick={() => onChange(tags.filter(t => t !== tag))}
                className="ml-0.5 hover:opacity-70 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AmenitiesPicker({ selectedIds, customTags, onChange, onCustomTagsChange }: Props) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const { data: amenities = [], isLoading } = useQuery<Amenity[]>({
    queryKey: ["/api/amenities"],
    queryFn: async () => {
      const r = await fetch("/api/amenities");
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 5 * 60_000,
  });

  // Group by category (safe even if amenities is somehow not an array)
  const grouped = useMemo(() => {
    const map = new Map<string, Amenity[]>();
    if (!Array.isArray(amenities)) return map;
    for (const a of amenities) {
      if (!map.has(a.category)) map.set(a.category, []);
      map.get(a.category)!.push(a);
    }
    return map;
  }, [amenities]);

  // Filter by search
  const query = search.toLowerCase().trim();
  const filteredGroups = useMemo(() => {
    if (!query) return grouped;
    const out = new Map<string, Amenity[]>();
    grouped.forEach((items, cat) => {
      const matches = items.filter(a =>
        a.name.toLowerCase().includes(query) || cat.toLowerCase().includes(query)
      );
      if (matches.length > 0) out.set(cat, matches);
    });
    return out;
  }, [grouped, query]);

  const toggle = useCallback((id: number) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  }, [selectedIds, onChange]);

  const selectAll = (ids: number[]) => {
    onChange(Array.from(new Set([...selectedIds, ...ids])));
  };

  const clearCat = (ids: number[]) => {
    onChange(selectedIds.filter(id => !ids.includes(id)));
  };

  const toggleCollapse = (cat: string) => {
    setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const totalSelected = selectedIds.length + customTags.length;
  const scores = useMemo(() => calculateScores(amenities, selectedIds), [amenities, selectedIds]);

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {totalSelected > 0 ? (
            <Badge className="bg-amber-500 hover:bg-amber-500 text-white text-xs px-2.5 py-0.5">
              {totalSelected} selected
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">No amenities selected</span>
          )}
          {totalSelected > 0 && (
            <button
              type="button"
              onClick={() => { onChange([]); onCustomTagsChange([]); }}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Scores (shown when anything selected) */}
      {totalSelected > 0 && <PropertyScoresPanel scores={scores} />}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search amenities…"
          className="pl-9 h-9 text-sm"
        />
        {search && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setSearch("")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {isLoading && (
        <div className="text-sm text-muted-foreground text-center py-6">Loading amenities…</div>
      )}

      {/* Categories */}
      <div className="space-y-2">
        {Array.from(filteredGroups.entries()).map(([cat, items]) => {
          const catIds = items.map(a => a.id);
          const selectedInCat = catIds.filter(id => selectedIds.includes(id)).length;
          const isCollapsed = collapsed[cat] ?? false;
          const isCustomCat = cat === "Unique Selling Points";

          return (
            <div key={cat} className="border border-border/50 rounded-lg overflow-hidden">
              {/* Header */}
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors"
                onClick={() => toggleCollapse(cat)}
              >
                <div className="flex items-center gap-2">
                  {isCollapsed
                    ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                  <span className="text-sm font-semibold text-foreground">{cat}</span>
                  {selectedInCat > 0 && (
                    <Badge className="bg-amber-500 hover:bg-amber-500 text-white text-[10px] px-1.5 py-0 h-4">
                      {selectedInCat}
                    </Badge>
                  )}
                </div>
                {!isCustomCat && !isCollapsed && (
                  <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      className="text-[10px] text-amber-600 hover:text-amber-700 font-medium transition-colors px-1"
                      onClick={() => selectAll(catIds)}
                    >
                      Select all
                    </button>
                    {selectedInCat > 0 && (
                      <button
                        type="button"
                        className="text-[10px] text-muted-foreground hover:text-foreground font-medium transition-colors px-1"
                        onClick={() => clearCat(catIds)}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}
              </button>

              {/* Chips */}
              {!isCollapsed && (
                <div className="p-3">
                  {isCustomCat ? (
                    <CustomTagsInput tags={customTags} onChange={onCustomTagsChange} />
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
                      {items.map(amenity => {
                        const sel = selectedIds.includes(amenity.id);
                        return (
                          <button
                            key={amenity.id}
                            type="button"
                            onClick={() => toggle(amenity.id)}
                            className={cn(
                              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium",
                              "border transition-all duration-150 text-left",
                              "hover:scale-[1.02] active:scale-[0.98]",
                              sel
                                ? "bg-amber-500 text-white border-amber-600 shadow-sm shadow-amber-200/50"
                                : "bg-background text-foreground border-border hover:border-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-950/20"
                            )}
                          >
                            <span className="text-sm leading-none">{amenity.icon}</span>
                            <span className="truncate">{amenity.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Unique Selling Points always at bottom (when no search) */}
        {!filteredGroups.has("Unique Selling Points") && !query && (
          <div className="border border-border/50 rounded-lg overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors"
              onClick={() => toggleCollapse("Unique Selling Points")}
            >
              <div className="flex items-center gap-2">
                {collapsed["Unique Selling Points"]
                  ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                <span className="text-sm font-semibold text-foreground">Unique Selling Points</span>
                {customTags.length > 0 && (
                  <Badge className="bg-amber-500 hover:bg-amber-500 text-white text-[10px] px-1.5 py-0 h-4">
                    {customTags.length}
                  </Badge>
                )}
              </div>
            </button>
            {!collapsed["Unique Selling Points"] && (
              <div className="p-3">
                <p className="text-xs text-muted-foreground mb-2">
                  Add custom highlights unique to this property — shown in proposals and AI narrative.
                </p>
                <CustomTagsInput tags={customTags} onChange={onCustomTagsChange} />
              </div>
            )}
          </div>
        )}
      </div>

      {filteredGroups.size === 0 && !isLoading && query && (
        <div className="text-center py-6 text-sm text-muted-foreground">
          No amenities match "<strong>{query}</strong>"
        </div>
      )}
    </div>
  );
}
