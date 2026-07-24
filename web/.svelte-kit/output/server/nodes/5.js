

export const index = 5;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/firmware/_page.svelte.js')).default;
export const imports = ["_app/immutable/nodes/5.CytbyzdE.js","_app/immutable/chunks/CDajq3PT.js","_app/immutable/chunks/xihTtKlq.js","_app/immutable/chunks/CLfHbjpm.js","_app/immutable/chunks/BDO5b4V0.js"];
export const stylesheets = [];
export const fonts = [];
