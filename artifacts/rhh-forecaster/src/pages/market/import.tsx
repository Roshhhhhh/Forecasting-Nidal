import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { UploadCloud, FileSpreadsheet, AlertCircle, CheckCircle2, ChevronRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function MarketImport() {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);

  return (
    <div className="p-8 max-w-[1000px] mx-auto space-y-6">
      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
        <Link href="/market" className="hover:text-foreground transition-colors">Market Data</Link>
        <span>/</span>
        <span className="text-foreground font-medium">Data Import Wizard</span>
      </div>

      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Import Market Data</h1>
        <p className="text-muted-foreground mt-1">Bulk update LTR and ADR benchmarks from CSV or Excel.</p>
      </div>

      <Card className="border-border/50 shadow-sm mt-8">
        <CardHeader className="bg-muted/20 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Upload File</CardTitle>
              <CardDescription>Step 1 of 3: Select data source</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-8">Download Template</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-12">
          <div className="border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center bg-muted/5 hover:bg-muted/10 transition-colors cursor-pointer text-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <UploadCloud className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-1">Drag and drop your file here</h3>
            <p className="text-sm text-muted-foreground mb-6">Supports .csv, .xlsx, .xls up to 10MB</p>
            <Button>Browse Files</Button>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/10 border-t border-border p-6 flex justify-between">
          <Link href="/market" className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium hover:bg-muted transition-colors">
            Cancel
          </Link>
          <Button disabled className="px-8">
            Next: Column Mapping <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
