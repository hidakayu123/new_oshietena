/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_API_SCOPE_URI: string;
  // 他の環境変数を追加した場合はここにも追記
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}