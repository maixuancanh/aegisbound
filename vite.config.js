import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
export default defineConfig({base:'./',resolve:{alias:{'@chain/casino-sdk/guest':fileURLToPath(new URL('./third_party/chain-casino-sdk/guest.ts',import.meta.url))}},server:{cors:true},build:{target:'es2022'}});
