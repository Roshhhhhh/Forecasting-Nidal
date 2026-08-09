import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, RefreshCw, Clock, Globe, CheckCheck, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListBenchmarksQueryKey,
  getListMarketAreasQueryKey,
  getGetCompanySettingsQueryKey,
  useGetCompanySettings,
  useGetPortalCacheStatus,
  getGetPortalCacheStatusQueryKey,
} from "@workspace/api-client-react";
import type { PortalRefreshAllResult } from "@workspace/api-client-react";

interface ImportResult {
  areasCreated: number;
  benchmarksUpdated: number;
  benchmarksInserted: number;
  skipped: number;
  importedAt: string;
}

// ── Portal Data Section ───────────────────────────────────────────────────────

function bedroomLabel(n: number) {
  return n === 0 ? "Studio" : `${n}BR`;
}

function PortalDataSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: cacheEntries = [], isLoading: isCacheLoading } = useGetPortalCacheStatus();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<PortalRefreshAllResult | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    setRefreshError(null);
    setRefreshResult(null);

    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/market/portal/refresh-all`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(body.error ?? `Server error ${res.status}`);
      }

      const data: PortalRefreshAllResult = await res.json();
      setRefreshResult(data);
      await queryClient.invalidateQueries({ queryKey: getGetPortalCacheStatusQueryKey() });

      toast({
        title: "Portal refresh complete",
        description: `${data.succeeded} succeeded · ${data.failed} failed · ${data.cooldownSkipped} skipped (cooldown)`,
      });
    } catch (err: any) {
      const msg = err.message ?? "Refresh failed";
      setRefreshError(msg);
      toast({ title: "Refresh failed", description: msg, variant: "destructive" });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="border-b border-border bg-muted/20">
        <CardTitle className="text-lg font-serif flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          Portal Data
        </CardTitle>
        <CardDescription>
          Live rental price data fetched from Property Finder &amp; Bayut via AI web search. Used to
          validate benchmark ADR and LTR figures in forecasts.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-6 space-y-5">
        {/* Refresh button + result */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Refresh All Areas</p>
            <p className="text-xs text-muted-foreground">
              Fetches fresh portal data for every area &amp; bedroom count in your benchmark table.
              Each combination has a 60-second cooldown to prevent quota exhaustion.
            </p>
          </div>
          <Button
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            className="shrink-0"
          >
            {isRefreshing ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Refreshing…</>
            ) : (
              <><RefreshCw className="mr-2 h-4 w-4" /> Refresh All Areas</>
            )}
          </Button>
        </div>

        {/* Error banner */}
        {refreshError && (
          <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{refreshError}</span>
          </div>
        )}

        {/* Refresh result summary */}
        {refreshResult && !isRefreshing && (
          <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Refresh complete — {refreshResult.attempted} combinations processed
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="flex items-center gap-1 text-green-700 dark:text-green-400">
                <CheckCheck className="h-3.5 w-3.5" /> {refreshResult.succeeded} succeeded
              </span>
              {refreshResult.failed > 0 && (
                <span className="flex items-center gap-1 text-destructive">
                  <XCircle className="h-3.5 w-3.5" /> {refreshResult.failed} failed
                </span>
              )}
              {refreshResult.cooldownSkipped > 0 && (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <Clock className="h-3.5 w-3.5" /> {refreshResult.cooldownSkipped} skipped (cooldown)
                </span>
              )}
            </div>

            {/* Per-item breakdown */}
            {refreshResult.results.length > 0 && (
              <div className="overflow-x-auto mt-2">
                <table className="text-xs w-full border-collapse">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="px-2 py-1 border border-border/40 bg-muted/40 font-semibold">Area</th>
                      <th className="px-2 py-1 border border-border/40 bg-muted/40 font-semibold">Beds</th>
                      <th className="px-2 py-1 border border-border/40 bg-muted/40 font-semibold">Status</th>
                      <th className="px-2 py-1 border border-border/40 bg-muted/40 font-semibold">Sources</th>
                    </tr>
                  </thead>
                  <tbody>
                    {refreshResult.results.map((r, i) => (
                      <tr key={i} className="hover:bg-muted/10">
                        <td className="px-2 py-1 border border-border/40">{r.area}</td>
                        <td className="px-2 py-1 border border-border/40">{bedroomLabel(r.bedrooms)}</td>
                        <td className="px-2 py-1 border border-border/40">
                          {r.status === "success" && <span className="text-green-600 dark:text-green-400 font-medium">✓ Success</span>}
                          {r.status === "failed" && <span className="text-destructive font-medium">✗ Failed</span>}
                          {r.status === "cooldown" && <span className="text-amber-600 dark:text-amber-400">⏱ Cooldown</span>}
                        </td>
                        <td className="px-2 py-1 border border-border/40 text-muted-foreground">
                          {r.sources?.join(", ") ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Current cache status table */}
        <div>
          <p className="text-sm font-medium text-foreground mb-2">Current Cache</p>
          {isCacheLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading cache status…
            </div>
          ) : cacheEntries.length === 0 ? (
            <div className="rounded-lg border border-border/50 bg-muted/10 p-4 text-sm text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
              No portal data cached yet. Click "Refresh All Areas" to pull live data from Property Finder &amp; Bayut.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/50">
              <table className="text-xs w-full border-collapse">
                <thead>
                  <tr className="text-left text-muted-foreground bg-muted/30">
                    <th className="px-3 py-2 border-b border-border/40 font-semibold">Area</th>
                    <th className="px-3 py-2 border-b border-border/40 font-semibold">Beds</th>
                    <th className="px-3 py-2 border-b border-border/40 font-semibold">LTR (AED/yr)</th>
                    <th className="px-3 py-2 border-b border-border/40 font-semibold">ADR (AED/night)</th>
                    <th className="px-3 py-2 border-b border-border/40 font-semibold">Sources</th>
                    <th className="px-3 py-2 border-b border-border/40 font-semibold">Fetched</th>
                  </tr>
                </thead>
                <tbody>
                  {cacheEntries.map((e, i) => (
                    <tr key={i} className="hover:bg-muted/10 border-b border-border/30 last:border-0">
                      <td className="px-3 py-2 font-medium">{e.area}</td>
                      <td className="px-3 py-2">{bedroomLabel(e.bedrooms)}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {e.ltrMin != null && e.ltrMax != null
                          ? `${e.ltrMin.toLocaleString()} – ${e.ltrMax.toLocaleString()}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {e.adrMin != null && e.adrMax != null
                          ? `${e.adrMin.toLocaleString()} – ${e.adrMax.toLocaleString()}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{e.sources.join(", ")}</td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                        {new Date(e.fetchedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function MarketDataTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: settings } = useGetCompanySettings();

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && (dropped.name.endsWith(".xlsx") || dropped.name.endsWith(".xls"))) {
      setFile(dropped);
      setResult(null);
      setError(null);
    } else {
      setError("Please upload an .xlsx or .xls file.");
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setResult(null);
      setError(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${import.meta.env.BASE_URL}api/market/benchmarks/import`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(body.error ?? `Server error ${res.status}`);
      }

      const data: ImportResult = await res.json();
      setResult(data);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      await queryClient.invalidateQueries({ queryKey: getListBenchmarksQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getListMarketAreasQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getGetCompanySettingsQueryKey() });

      toast({
        title: "Import complete",
        description: `Updated ${data.benchmarksUpdated}, added ${data.benchmarksInserted} new, created ${data.areasCreated} area${data.areasCreated !== 1 ? "s" : ""}.`,
      });
    } catch (err: any) {
      setError(err.message ?? "Import failed");
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const lastImportAt: Date | null = (settings as any)?.lastBenchmarkImportAt
    ? new Date((settings as any).lastBenchmarkImportAt)
    : null;
  const lastSummary: string | null = (settings as any)?.lastBenchmarkImportSummary ?? null;

  return (
    <div className="space-y-6">
      {/* Portal Data section */}
      <PortalDataSection />

      {/* Last-import status card */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="border-b border-border bg-muted/20">
          <CardTitle className="text-lg font-serif">Benchmark Data Status</CardTitle>
          <CardDescription>Current freshness of the market area and unit benchmark data used in forecasts.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {lastImportAt ? (
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0 mt-0.5">
                <Clock className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Last refreshed</p>
                <p className="text-base font-semibold text-foreground mt-0.5">
                  {lastImportAt.toLocaleString()}
                </p>
                {lastSummary && (
                  <p className="text-sm text-muted-foreground mt-1">{lastSummary}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0 mt-0.5">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">No import recorded</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Benchmarks were seeded from the initial data load. Upload a file below to establish a refresh baseline.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import card */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="border-b border-border bg-muted/20">
          <CardTitle className="text-lg font-serif flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-primary" />
            Import / Refresh Benchmarks
          </CardTitle>
          <CardDescription>
            Upload an Excel file to update existing benchmarks or add new areas.
            Rows not in the file are <strong>left untouched</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-5">
          {/* Column layout reference */}
          <div className="rounded-lg bg-muted/30 border border-border/60 p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <FileSpreadsheet className="h-3.5 w-3.5" /> Expected Column Layout
            </p>
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse w-full">
                <thead>
                  <tr>
                    {["A: Area", "B: Type", "E: Project", "F: STD ADR", "G: STD LTR", "H–I: 1BR", "J–K: 2BR", "L–M: 3BR", "N–O: 4BR"].map(h => (
                      <th key={h} className="px-2 py-1 text-left font-semibold text-muted-foreground border border-border/40 bg-muted/60 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {["Khalidiyah", "Apartment", "Al Reef", "650", "65 000", "850 / 75 000", "1100 / 90 000", "NA", "NA"].map((v, i) => (
                      <td key={i} className="px-2 py-1 border border-border/40 text-muted-foreground">{v}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Sheet must be named with <code className="bg-muted px-1 rounded">(2)</code>. Header rows (starting with "Area", "Price", or "Main") are auto-skipped. Use <code className="bg-muted px-1 rounded">NA</code> for unavailable values.
            </p>
          </div>

          {/* Success result */}
          {result && (
            <div className="flex items-center gap-4 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 p-4">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-green-800 dark:text-green-300">Import successful</p>
                <p className="text-sm text-green-700 dark:text-green-400 mt-0.5">
                  {result.benchmarksInserted} new · {result.benchmarksUpdated} updated · {result.areasCreated} area{result.areasCreated !== 1 ? "s" : ""} created
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setResult(null)} className="shrink-0">
                Import another
              </Button>
            </div>
          )}

          {/* Drop zone */}
          {!result && (
            <div
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-colors cursor-pointer text-center ${isDragging ? "border-primary bg-primary/5" : "border-border hover:bg-muted/10"}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <UploadCloud className="h-6 w-6 text-primary" />
              </div>
              {file ? (
                <>
                  <div className="flex items-center gap-2 text-foreground font-medium text-sm">
                    <FileSpreadsheet className="h-4 w-4 text-primary" />
                    {file.name}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(file.size / 1024).toFixed(0)} KB · Click to change
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground">Drag and drop an .xlsx file here</p>
                  <p className="text-xs text-muted-foreground mt-1">or click to browse · up to 20 MB</p>
                </>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!result && (
            <div className="flex justify-end">
              <Button
                onClick={handleImport}
                disabled={!file || isUploading}
                className="px-8"
              >
                {isUploading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing…</>
                ) : (
                  <><RefreshCw className="mr-2 h-4 w-4" /> Import Benchmarks</>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
