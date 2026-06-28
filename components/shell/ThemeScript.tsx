import { THEME_STORAGE_KEY } from "@/lib/theme";

/*
 * Before-paint theme bootstrap. Renders as the first child of <body> so it runs
 * synchronously — after globals.css is parsed but before any content paints —
 * applying the persisted theme class so dark-mode users never see a light
 * flash. Logic mirrors lib/theme + useThemeController but is hand-inlined as a
 * raw string because it must execute before any module loads. color-scheme
 * follows the `.dark` class via globals.css (chunk 1 of #79).
 */
const bootstrap = `(function(){try{var p=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});var dark=p==="dark"||((p===null||p==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",dark);}catch(e){}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: bootstrap }} />;
}
