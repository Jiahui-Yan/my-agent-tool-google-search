import { defineConfig } from 'vite'
// import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { resolve } from 'path'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
	plugins: [
		// vue(),
		vueJsx(),
		viteStaticCopy({
			targets: [
				{
					src: "../manifest.json",
					dest: "./dist"
				}
			]
		})
	],
	root: resolve(__dirname, 'src'),
	base: './',
	build: {
		outDir: resolve(__dirname, 'dist'),
		emptyOutDir: false,
		// Disable minification/optimization so generated JS is not mangled
		minify: false,
		// Emit sourcemaps for easier debugging
		sourcemap: true,
	},
	mode: "development",

})
