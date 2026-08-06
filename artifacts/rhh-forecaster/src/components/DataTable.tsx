/**
 * DataTable — reusable configurable table with:
 *  • Column picker ("Metrics" button) with show/hide per column
 *  • Drag-to-reorder column headers
 *  • Persistent preferences (localStorage per table id)
 *  • Export to Excel (.xlsx) and PDF
 */
import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Settings2, FileSpreadsheet, FileText,
  RotateCcw, X, GripHorizontal,
} from "lucide-react";

// ─── Public types ────────────────────────────────────────────────────────────

export interface ColumnDef<T> {
  key: string;
  label: string;
  /** Short description shown in the metrics picker */
  description?: string;
  /** Default true */
  defaultVisible?: boolean;
  render: (row: T) => React.ReactNode;
  /** Plain-text / number value used for Excel & PDF export */
  exportValue?: (row: T) => string | number | null;
  /** Tailwind min-width, e.g. "min-w-[140px]" */
  minWidth?: string;
}

export interface DataTableProps<T> {
  /** Unique ID for localStorage persistence */
  id: string;
  columns: ColumnDef<T>[];
  data: T[] | undefined;
  isLoading?: boolean;
  rowKey: (row: T) => string | number;
  /** Base name for downloaded files (no extension) */
  exportFileName?: string;
  emptyState?: React.ReactNode;
  /** Optional per-row action cell (right-aligned) */
  actions?: (row: T) => React.ReactNode;
  /** Extra class on the outer wrapper */
  className?: string;
}

// ─── localStorage helpers ────────────────────────────────────────────────────

interface Prefs { visible: Record<string, boolean>; order: string[] }

function defaultPrefs<T>(cols: ColumnDef<T>[]): Prefs {
  return {
    visible: Object.fromEntries(cols.map(c => [c.key, c.defaultVisible ?? true])),
    order:   cols.map(c => c.key),
  };
}

function loadPrefs<T>(id: string, cols: ColumnDef<T>[]): Prefs {
  try {
    const raw = localStorage.getItem(`dt_${id}`);
    if (raw) {
      const p = JSON.parse(raw) as Prefs;
      // Merge in any new columns added since last save
      const knownKeys = new Set(p.order);
      const newCols = cols.filter(c => !knownKeys.has(c.key));
      return {
        visible: {
          ...Object.fromEntries(cols.map(c => [c.key, c.defaultVisible ?? true])),
          ...p.visible,
        },
        order: [...p.order, ...newCols.map(c => c.key)],
      };
    }
  } catch { /* ignore */ }
  return defaultPrefs(cols);
}

function savePrefs(id: string, p: Prefs) {
  try { localStorage.setItem(`dt_${id}`, JSON.stringify(p)); } catch { /* ignore */ }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DataTable<T>({
  id, columns, data, isLoading, rowKey,
  exportFileName = "export", emptyState, actions, className = "",
}: DataTableProps<T>) {
  const [prefs, setPrefs]           = useState<Prefs>(() => loadPrefs(id, columns));
  const [metricsOpen, setMetricsOpen] = useState(false);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const metricsRef = useRef<HTMLDivElement>(null);
  const draggedKey = useRef<string | null>(null);

  // Close metrics panel on outside click
  useEffect(() => {
    if (!metricsOpen) return;
    const handle = (e: MouseEvent) => {
      if (metricsRef.current && !metricsRef.current.contains(e.target as Node))
        setMetricsOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [metricsOpen]);

  const update = (p: Prefs) => { setPrefs(p); savePrefs(id, p); };
  const toggleCol = (key: string) =>
    update({ ...prefs, visible: { ...prefs.visible, [key]: !prefs.visible[key] } });
  const reset = () => update(defaultPrefs(columns));

  // Columns in current order (all)
  const orderedAll = [
    ...prefs.order.map(k => columns.find(c => c.key === k)).filter(Boolean) as ColumnDef<T>[],
    ...columns.filter(c => !prefs.order.includes(c.key)),
  ];

  // Columns that are visible
  const visibleCols = orderedAll.filter(c => prefs.visible[c.key] !== false);

  const hiddenCount = orderedAll.filter(c => !prefs.visible[c.key]).length;
  const colCount    = visibleCols.length + (actions ? 1 : 0);

  // ── Drag-and-drop ──────────────────────────────────────────────────────────

  const onDragStart = (key: string) => (e: React.DragEvent) => {
    draggedKey.current = key;
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (key: string) => (e: React.DragEvent) => {
    e.preventDefault();
    if (dragOverKey !== key) setDragOverKey(key);
  };

  const onDrop = (targetKey: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const from = draggedKey.current;
    draggedKey.current = null;
    setDragOverKey(null);
    if (!from || from === targetKey) return;
    const cur = [...prefs.order];
    const fi = cur.indexOf(from);
    const ti = cur.indexOf(targetKey);
    if (fi === -1 || ti === -1) return;
    cur.splice(fi, 1);
    cur.splice(ti, 0, from);
    update({ ...prefs, order: cur });
  };

  const onDragEnd = () => { draggedKey.current = null; setDragOverKey(null); };

  // ── Export to Excel ────────────────────────────────────────────────────────

  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const headers = visibleCols.map(c => c.label);
    const rows = (data ?? []).map(row =>
      visibleCols.map(c => (c.exportValue ? c.exportValue(row) : "") ?? "")
    );
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, `${exportFileName}.xlsx`);
  };

  // ── Export to PDF ──────────────────────────────────────────────────────────

  const exportPdf = async () => {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(13);
    doc.setTextColor(30, 30, 30);
    doc.text(exportFileName, 14, 14);
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text(`Exported ${new Date().toLocaleDateString()}  |  ${(data ?? []).length} records`, 14, 20);
    autoTable(doc, {
      startY: 26,
      head: [visibleCols.map(c => c.label)],
      body: (data ?? []).map(row =>
        visibleCols.map(c => {
          const v = c.exportValue ? c.exportValue(row) : null;
          return v !== null && v !== undefined ? String(v) : "";
        })
      ),
      headStyles:        { fillColor: [193, 154, 71], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
      bodyStyles:        { fontSize: 7, textColor: [40, 40, 40] },
      alternateRowStyles:{ fillColor: [250, 247, 241] },
      styles:            { cellPadding: 2, overflow: "ellipsize" },
    });
    doc.save(`${exportFileName}.pdf`);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={className}>
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-b border-border/50 bg-muted/10">
        {/* Metrics picker */}
        <div className="relative" ref={metricsRef}>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setMetricsOpen(v => !v)}
          >
            <Settings2 className="h-3.5 w-3.5" />
            Metrics
            {hiddenCount > 0 && (
              <span className="ml-0.5 bg-primary text-primary-foreground rounded-full text-[10px] px-1.5 py-px leading-none">
                {hiddenCount}
              </span>
            )}
          </Button>

          {metricsOpen && (
            <div className="absolute right-0 top-full mt-1.5 z-50 w-72 bg-background border border-border rounded-xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                <span className="text-sm font-semibold">Column Metrics</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={reset}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" /> Reset
                  </button>
                  <button onClick={() => setMetricsOpen(false)} className="p-1 rounded hover:bg-muted">
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>

              {/* Column list */}
              <div className="max-h-64 overflow-y-auto divide-y divide-border/40">
                {orderedAll.map(col => (
                  <label
                    key={col.key}
                    className="flex items-start gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={prefs.visible[col.key] !== false}
                      onChange={() => toggleCol(col.key)}
                      className="h-3.5 w-3.5 mt-0.5 accent-primary cursor-pointer"
                    />
                    <div>
                      <p className="text-sm text-foreground leading-tight">{col.label}</p>
                      {col.description && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{col.description}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>

              {/* Footer hint */}
              <div className="px-4 py-2 bg-muted/20 border-t border-border">
                <p className="text-[11px] text-muted-foreground">
                  Drag column headers to reorder &nbsp;•&nbsp;
                  {visibleCols.length} / {columns.length} columns shown
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Export buttons */}
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={exportExcel}>
          <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" />
          Excel
        </Button>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={exportPdf}>
          <FileText className="h-3.5 w-3.5 text-red-500" />
          PDF
        </Button>
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
            <tr>
              {visibleCols.map(col => (
                <th
                  key={col.key}
                  draggable
                  onDragStart={onDragStart(col.key)}
                  onDragOver={onDragOver(col.key)}
                  onDrop={onDrop(col.key)}
                  onDragEnd={onDragEnd}
                  className={[
                    "px-6 py-4 font-medium whitespace-nowrap select-none cursor-grab active:cursor-grabbing transition-colors",
                    col.minWidth ?? "",
                    dragOverKey === col.key ? "bg-primary/10 text-primary" : "",
                  ].join(" ")}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <GripHorizontal className="h-3 w-3 opacity-25 shrink-0" />
                    {col.label}
                  </span>
                </th>
              ))}
              {actions && (
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={colCount} className="text-center py-12 text-muted-foreground animate-pulse">
                  Loading…
                </td>
              </tr>
            ) : !data || data.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="text-center py-16 text-muted-foreground">
                  {emptyState ?? <p className="text-sm">No records found.</p>}
                </td>
              </tr>
            ) : (
              data.map(row => (
                <tr key={rowKey(row)} className="hover:bg-muted/30 transition-colors group">
                  {visibleCols.map(col => (
                    <td key={col.key} className={`px-6 py-4 ${col.minWidth ?? ""}`}>
                      {col.render(row)}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-6 py-4 text-right">
                      {actions(row)}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
