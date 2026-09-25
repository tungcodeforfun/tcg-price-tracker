import type { ReactNode, ThHTMLAttributes } from "react";
import { Link, type LinkProps } from "react-router";

export interface DataTableProps {
  /** Screen-reader caption describing the table. */
  caption?: string;
  className?: string;
  /** `<thead>`, `<tbody>` and optional `<tfoot>`. */
  children: ReactNode;
}

/**
 * A dense table that scrolls sideways on narrow screens. Cells don't wrap; right-align figures
 * with `text-right`, hide low-priority columns with `hidden sm:table-cell`, and mark the
 * current row with `aria-selected="true"`.
 */
export function DataTable({ caption, className = "", children }: DataTableProps) {
  return (
    <div className={`relative overflow-x-auto ${className}`}>
      <table className="data-table">
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}

export interface ThProps extends ThHTMLAttributes<HTMLTableCellElement> {
  /** Right-align numeric columns. */
  numeric?: boolean;
}

/** A column header in the micro-caption style; `scope` defaults to "col". */
export function Th({ numeric = false, scope = "col", className = "", ...props }: ThProps) {
  return (
    <th scope={scope} className={`micro ${numeric ? "text-right" : ""} ${className}`} {...props} />
  );
}

/**
 * The link that makes a whole table row clickable: its hit area stretches over the row, and the
 * row gets one tab stop. Use one per row, in the cell that names the row.
 */
export function RowLink({ className = "", ...props }: LinkProps) {
  return <Link className={`row-link ${className}`} {...props} />;
}
