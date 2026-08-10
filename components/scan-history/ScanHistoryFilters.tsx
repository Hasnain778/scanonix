"use client";

import type {
  ScanDateFilter,
  ScanRiskFilter,
  ScanSortOption,
  ScanTypeFilter,
} from "@/lib/scan-history/types";
import { FormField, SelectField, TextInput } from "@/components/ui/FormControls";
import { designTokens } from "@/lib/design/tokens";

export interface ScanHistoryFiltersState {
  search: string;
  risk: ScanRiskFilter;
  type: ScanTypeFilter;
  date: ScanDateFilter;
  dateFrom: string;
  dateTo: string;
  sort: ScanSortOption;
}

interface ScanHistoryFiltersProps {
  filters: ScanHistoryFiltersState;
  onChange: (next: Partial<ScanHistoryFiltersState>) => void;
}

const RISK_OPTIONS: { value: ScanRiskFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "low", label: "Low Risk" },
  { value: "medium", label: "Medium Risk" },
  { value: "high", label: "High Risk" },
  { value: "critical", label: "Critical" },
  { value: "clean", label: "Clean" },
  { value: "failed", label: "Failed" },
];

const TYPE_OPTIONS: { value: ScanTypeFilter; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "website", label: "Website Scan" },
  { value: "file", label: "File Scan" },
];

const DATE_OPTIONS: { value: ScanDateFilter; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "custom", label: "Custom range" },
];

const SORT_OPTIONS: { value: ScanSortOption; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "highest_risk", label: "Highest Risk" },
  { value: "lowest_risk", label: "Lowest Risk" },
];

const filterLabelClass = "text-table-header mb-2 block normal-case";

export function ScanHistoryFilters({ filters, onChange }: ScanHistoryFiltersProps) {
  return (
    <section
      aria-label="Scan history filters"
      className={`${designTokens.surfaceCard} ${designTokens.cardPaddingSm}`}
    >
      <div className="grid gap-4 xl:grid-cols-[1.2fr_repeat(4,minmax(0,1fr))]">
        <FormField id="scan-search" label="Search">
          <TextInput
            id="scan-search"
            type="search"
            value={filters.search}
            onChange={(event) => onChange({ search: event.target.value })}
            placeholder="File name, website URL, or scan ID"
          />
        </FormField>

        <FilterSelect
          id="scan-risk"
          label="Risk"
          value={filters.risk}
          options={RISK_OPTIONS}
          onChange={(value) => onChange({ risk: value as ScanRiskFilter })}
        />
        <FilterSelect
          id="scan-type"
          label="Type"
          value={filters.type}
          options={TYPE_OPTIONS}
          onChange={(value) => onChange({ type: value as ScanTypeFilter })}
        />
        <FilterSelect
          id="scan-date"
          label="Date"
          value={filters.date}
          options={DATE_OPTIONS}
          onChange={(value) => onChange({ date: value as ScanDateFilter })}
        />
        <FilterSelect
          id="scan-sort"
          label="Sort"
          value={filters.sort}
          options={SORT_OPTIONS}
          onChange={(value) => onChange({ sort: value as ScanSortOption })}
        />
      </div>

      {filters.date === "custom" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <FormField id="scan-date-from" label="From">
            <TextInput
              id="scan-date-from"
              type="date"
              value={filters.dateFrom}
              onChange={(event) => onChange({ dateFrom: event.target.value })}
            />
          </FormField>
          <FormField id="scan-date-to" label="To">
            <TextInput
              id="scan-date-to"
              type="date"
              value={filters.dateTo}
              onChange={(event) => onChange({ dateTo: event.target.value })}
            />
          </FormField>
        </div>
      ) : null}
    </section>
  );
}

function FilterSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className={filterLabelClass}>
        {label}
      </label>
      <SelectField id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-scanonix-surface">
            {option.label}
          </option>
        ))}
      </SelectField>
    </div>
  );
}
