import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ReportPagination({
  page,
  pageSize,
  total,
  busy,
  onPage,
  onPageSize,
}: {
  page: number;
  pageSize: number;
  total: number;
  busy: boolean;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) {
  const { t } = useTranslation();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const sizes = [10, 25, 50].map((value) => ({ value, label: String(value) }));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 text-xs text-muted-foreground sm:px-7">
      <span role="status" aria-live="polite">
        {t("tasks:reports.rowRange", {
          from: total ? (page - 1) * pageSize + 1 : 0,
          to: Math.min(page * pageSize, total),
          total,
        })}
      </span>
      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-2 sm:flex">
          <label htmlFor="report-page-size">
            {t("tasks:reports.rowsPerPage")}
          </label>
          <Select
            items={sizes}
            value={pageSize}
            onValueChange={(value) => {
              if (value) onPageSize(value);
            }}
            disabled={busy}
          >
            <SelectTrigger
              id="report-page-size"
              size="sm"
              className="w-16 min-w-16"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              {sizes.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </div>
        <span className="tabular-nums">
          {t("tasks:reports.pageOf", { page, total: pageCount })}
        </span>
        <Pagination className="w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                render={
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1 || busy}
                    onClick={() => onPage(page - 1)}
                  />
                }
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                render={
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= pageCount || busy}
                    onClick={() => onPage(page + 1)}
                  />
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
