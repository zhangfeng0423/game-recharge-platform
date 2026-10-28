import type React from "react";

interface SkuButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}

export function SkuButton({
  onClick,
  children,
  className = "",
}: SkuButtonProps) {
  return (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  );
}
