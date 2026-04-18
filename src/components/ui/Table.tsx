"use client";

import { ReactNode } from "react";
import { clsx } from "clsx";

interface TableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
}

interface TableProps<T extends { id: string | number }> {
  columns: TableColumn<T>[];
  data: T[];
  emptyMessage?: string;
  className?: string;
}

export function Table<T extends { id: string | number }>({
  columns,
  data,
  emptyMessage = "Nenhum dado encontrado",
  className,
}: TableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--color-brown-medium)]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={clsx("overflow-x-auto", className)}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-[var(--border)]">
            {columns.map((col) => (
              <th
                key={col.key}
                className={clsx(
                  "px-4 py-3 text-left text-xs font-medium text-[var(--color-brown-medium)] uppercase tracking-wider",
                  col.className
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={row.id}
              className="border-b border-[var(--border)] hover:bg-[var(--color-cream)] transition-folia"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={clsx("px-4 py-4 text-sm text-[var(--color-brown-dark)]", col.className)}
                >
                  {col.render ? col.render(row) : (row as any)[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}