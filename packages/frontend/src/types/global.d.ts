/**
 * Global type definitions for TypeScript
 * Allows importing CSS, images, and other non-TypeScript files
 */

/**
 * CSS module declarations
 * Allows importing .css files without type errors
 */
declare module "*.css" {
  const content: { [className: string]: string };
  export default content;
}

/**
 * Image file declarations
 */
declare module "*.svg" {
  const content: string;
  export default content;
}

declare module "*.png" {
  const content: string;
  export default content;
}

declare module "*.jpg" {
  const content: string;
  export default content;
}

declare module "*.jpeg" {
  const content: string;
  export default content;
}

declare module "*.gif" {
  const content: string;
  export default content;
}

declare module "*.webp" {
  const content: string;
  export default content;
}

/**
 * JSON module declarations
 */
declare module "*.json" {
  const content: any;
  export default content;
}
