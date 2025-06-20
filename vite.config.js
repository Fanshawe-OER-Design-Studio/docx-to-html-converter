import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import banner2 from 'rollup-plugin-banner2';

import pkg from './package.json' with { type: 'json' };

// Prepare your license text
const licenseText = `/*!
 * ${pkg.name} v${pkg.version}
 * (c) ${new Date().getFullYear()} ${pkg.author}
 * Released under the ${pkg.license} License.
 */`;

export default defineConfig({
  plugins: [tailwindcss(), banner2(() => licenseText)],
  base: '/pandoc-webapp/',
});
