import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // When deploying to GitHub Pages under https://<user>.github.io/Wordle-Solver-App/
  // the base should include leading and trailing slashes.
  base: "/Wordle-Solver-App/",
});
