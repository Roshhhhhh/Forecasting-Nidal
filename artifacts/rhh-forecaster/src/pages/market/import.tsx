import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListBenchmarksQueryKey, getListMarketAreasQueryKey, getGetCompanySettingsQueryKey } from "@workspace/api-client-react";

interface ImportResult {
  areasCreated: number;
  benchmarksUpdated: number;
  benchmarksInserted: number;
  skipped: number;
  importedAt: string;
}

export default function MarketImport() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      // Invalidate all market-related caches so pages refresh
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

  return (
    <div className="p-8 max-w-[780px] mx-auto space-y-6">
      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
        <Link href="/market" className="hover:text-foreground transition-colors">Market Data</Link>
        <span>/</span>
        <span className="text-foreground font-medium">Import / Refresh Benchmarks</span>
      </div>

      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Import / Refresh Benchmarks</h1>
        <p className="text-muted-foreground mt-1">
          Upload an Excel file in the standard RHH format to update existing benchmarks or add new areas.
          Existing data is <strong>never deleted</strong> — rows not present in the file are left untouched.
        </p>
      </div>

      {/* File format reference */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="bg-muted/20 border-b border-border pb-3 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-primary" />
            Expected Column Layout
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="overflow-x-auto">
            <table className="text-xs w-full border-collapse">
              <thead>
                <tr className="bg-muted/40">
                  {["A: Area", "B: Type", "C: Status", "D: Dev.", "E: Project", "F: STD ADR", "G: STD LTR", "H: 1BR ADR", "I: 1BR LTR", "J: 2BR ADR", "K: 2BR LTR", "L: 3BR ADR", "M: 3BR LTR", "N: 4BR ADR", "O: 4BR LTR"].map(h => (
                    <th key={h} className="px-2 py-1.5 text-left font-semibold text-muted-foreground border border-border/40 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {["Khalidiyah", "Apartment", "Ready", "ALDAR", "Al Reef", "650", "65000", "850", "75000", "1100", "90000", "1500", "110000", "NA", "NA"].map((v, i) => (
                    <td key={i} className="px-2 py-1 border border-border/40 text-muted-foreground">{v}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Use <code className="bg-muted px-1 rounded">NA</code> for unavailable values. Header rows (starting with "Area", "Price", or "Main") are skipped automatically. The file must use the sheet named with <code className="bg-muted px-1 rounded">(2)</code>.
          </p>
        </CardContent>
      </Card>

      {/* Upload card */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="bg-muted/20 border-b border-border">
          <CardTitle>Upload File</CardTitle>
          <CardDescription>Select an .xlsx file to import</CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          {result ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Import Successful</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {new Date(result.importedAt).toLocaleString()}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4 w-full max-w-sm mt-2">
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-2xl font-bold text-foreground">{result.benchmarksInserted}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">New benchmarks</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-2xl font-bold text-foreground">{result.benchmarksUpdated}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Updated</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-2xl font-bold text-foreground">{result.areasCreated}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">New areas</p>
                </div>
              </div>
              <Button variant="outline" onClick={() => { setFile(null); setResult(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                Import another file
              </Button>
            </div>
          ) : (
            <div
              className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-colors cursor-pointer text-center ${isDragging ? "border-primary bg-primary/5" : "border-border bg-muted/5 hover:bg-muted/10"}`}
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
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <UploadCloud className="h-7 w-7 text-primary" />
              </div>
              {file ? (
                <>
                  <div className="flex items-center gap-2 text-foreground font-medium">
                    <FileSpreadsheet className="h-5 w-5 text-primary" />
                    {file.name}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(file.size / 1024).toFixed(0)} KB · Click to change
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-base font-medium text-foreground mb-1">Drag and drop your file here</h3>
                  <p className="text-sm text-muted-foreground mb-4">or click to browse · .xlsx, .xls up to 20 MB</p>
                </>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </CardContent>
        {!result && (
          <CardFooter className="bg-muted/10 border-t border-border p-5 flex justify-between">
            <Link
              href="/market"
              className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-6 text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </Link>
            <Button
              onClick={handleImport}
              disabled={!file || isUploading}
              className="px-8"
            >
              {isUploading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing…</>
              ) : (
                "Import Benchmarks"
              )}
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
