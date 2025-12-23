/**
 * TypeScript declarations for YAML file imports
 * Enables importing .yaml files as raw text strings
 */

declare module '*.yaml' {
  const content: string;
  export default content;
}

declare module '*.yaml?raw' {
  const content: string;
  export default content;
}

declare module '*.yml' {
  const content: string;
  export default content;
}

declare module '*.yml?raw' {
  const content: string;
  export default content;
}

