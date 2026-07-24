/// <reference types="@sveltejs/kit" />
/// <reference types="vite/client" />

declare module "*.card?raw" {
  const content: string;
  export default content;
}
