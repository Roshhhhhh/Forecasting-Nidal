import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface SearchableOption {
  value: string;
  label: string;
  group?: string;
}

interface SearchableSelectProps {
  options: SearchableOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  /** Width of the popover, defaults to trigger width */
  popoverWidth?: string;
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results found.",
  className,
  disabled,
  popoverWidth,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);

  const selected = options.find(o => o.value === value);

  // Group options if any have a group
  const grouped = React.useMemo(() => {
    const groups: Record<string, SearchableOption[]> = {};
    const ungrouped: SearchableOption[] = [];
    for (const opt of options) {
      if (opt.group) {
        if (!groups[opt.group]) groups[opt.group] = [];
        groups[opt.group].push(opt);
      } else {
        ungrouped.push(opt);
      }
    }
    return { groups, ungrouped };
  }, [options]);

  const hasGroups = Object.keys(grouped.groups).length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal h-9 px-3",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn("p-0", popoverWidth ?? "w-[var(--radix-popover-trigger-width)]")}
        align="start"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {hasGroups ? (
              <>
                {grouped.ungrouped.length > 0 && (
                  <CommandGroup>
                    {grouped.ungrouped.map(opt => (
                      <OptionItem key={opt.value} opt={opt} value={value} onSelect={(v) => { onValueChange(v); setOpen(false); }} />
                    ))}
                  </CommandGroup>
                )}
                {Object.entries(grouped.groups).map(([group, opts], i) => (
                  <React.Fragment key={group}>
                    {(i > 0 || grouped.ungrouped.length > 0) && <CommandSeparator />}
                    <CommandGroup heading={group}>
                      {opts.map(opt => (
                        <OptionItem key={opt.value} opt={opt} value={value} onSelect={(v) => { onValueChange(v); setOpen(false); }} />
                      ))}
                    </CommandGroup>
                  </React.Fragment>
                ))}
              </>
            ) : (
              <CommandGroup>
                {options.map(opt => (
                  <OptionItem key={opt.value} opt={opt} value={value} onSelect={(v) => { onValueChange(v); setOpen(false); }} />
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function OptionItem({ opt, value, onSelect }: {
  opt: SearchableOption;
  value?: string;
  onSelect: (v: string) => void;
}) {
  return (
    <CommandItem
      value={opt.label}
      onSelect={() => onSelect(opt.value)}
      className="cursor-pointer"
    >
      <Check className={cn("mr-2 h-4 w-4", value === opt.value ? "opacity-100" : "opacity-0")} />
      {opt.label}
    </CommandItem>
  );
}
