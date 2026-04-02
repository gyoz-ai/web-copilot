import { type CSSProperties } from "react";

export interface DecisionOption {
  text: string;
  description?: string;
  recommended?: boolean;
}

export interface DecisionCardProps {
  title: string;
  description?: string;
  options: DecisionOption[];
  onSelect: (option: string) => void;
}

const styles: Record<string, CSSProperties> = {
  card: {
    background: "var(--g-surface-1)",
    border: "1px solid var(--g-surface-border)",
    borderRadius: "12px",
    padding: "12px",
    margin: "8px 0",
    maxWidth: "100%",
  },
  title: {
    color: "var(--g-text-primary)",
    fontSize: "13px",
    fontWeight: 600,
    margin: "0 0 4px",
  },
  description: {
    color: "var(--g-text-secondary)",
    fontSize: "12px",
    margin: "0 0 10px",
    lineHeight: "1.4",
  },
  optionsGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  option: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid var(--g-surface-border)",
    background: "var(--g-surface-2)",
    cursor: "pointer",
    transition: "all 0.15s ease",
    textAlign: "left" as const,
  },
  optionRecommended: {
    borderColor: "var(--g-brand-500)",
    background: "oklch(0.18 0.03 72)",
  },
  optionText: {
    color: "var(--g-text-primary)",
    fontSize: "12px",
    fontWeight: 500,
    margin: 0,
  },
  optionDesc: {
    color: "var(--g-text-muted)",
    fontSize: "11px",
    margin: 0,
    lineHeight: "1.3",
  },
  badge: {
    display: "inline-block",
    fontSize: "10px",
    color: "var(--g-brand-400)",
    fontWeight: 600,
    marginLeft: "6px",
  },
};

export function DecisionCard({
  title,
  description,
  options,
  onSelect,
}: DecisionCardProps) {
  return (
    <div style={styles.card}>
      <p style={styles.title}>{title}</p>
      {description && <p style={styles.description}>{description}</p>}
      <div style={styles.optionsGrid as CSSProperties}>
        {options.map((opt, i) => (
          <button
            key={i}
            style={{
              ...styles.option,
              ...(opt.recommended ? styles.optionRecommended : {}),
            }}
            onClick={() => onSelect(opt.text)}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                "var(--g-surface-3)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                opt.recommended ? "oklch(0.18 0.03 72)" : "var(--g-surface-2)";
            }}
          >
            <p style={styles.optionText}>
              {opt.text}
              {opt.recommended && <span style={styles.badge}>Recommended</span>}
            </p>
            {opt.description && (
              <p style={styles.optionDesc}>{opt.description}</p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
