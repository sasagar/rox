"use client";

/**
 * Role Badge Component
 *
 * Displays a user's public role as a styled badge.
 */

interface PublicRole {
  id: string;
  name: string;
  color: string | null;
  iconUrl: string | null;
}

interface RoleBadgeProps {
  role: PublicRole;
  size?: "sm" | "md";
}

/**
 * Determines if a color is light or dark to choose appropriate text color
 */
function isLightColor(hexColor: string): boolean {
  // Remove # if present
  const hex = hexColor.replace("#", "");

  // Parse RGB values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5;
}

export function RoleBadge({ role, size = "sm" }: RoleBadgeProps) {
  const bgColor = role.color || "#6366f1"; // Default to indigo if no color
  const textColor = isLightColor(bgColor) ? "#000000" : "#ffffff";

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClasses[size]}`}
      style={{
        backgroundColor: bgColor,
        color: textColor,
      }}
    >
      {role.iconUrl && (
        <img src={role.iconUrl} alt="" className={size === "sm" ? "w-3 h-3" : "w-4 h-4"} />
      )}
      {role.name}
    </span>
  );
}

interface RoleBadgeListProps {
  roles: PublicRole[];
  size?: "sm" | "md";
}

export function RoleBadgeList({ roles, size = "sm" }: RoleBadgeListProps) {
  if (roles.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((role) => (
        <RoleBadge key={role.id} role={role} size={size} />
      ))}
    </div>
  );
}
