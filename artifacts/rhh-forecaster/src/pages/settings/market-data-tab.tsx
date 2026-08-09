import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, RefreshCw, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListBenchmarksQueryKey,
  getListMarketAreasQueryKey,
  getGetCompanySettingsQueryKey,
  useGetCompanySettings,
} from "@workspace/api-client-react";

interface ImportResult {
  areasCreated: number;
  benchmarksUpdated: number;
  benchmarksInserted: number;
  skipped: number;
  importedAt: string;
}

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
