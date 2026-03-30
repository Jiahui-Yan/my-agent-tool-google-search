






import { defineConfig } from "rolldown";


export default defineConfig({

	input: {
		baidu: "./baidu.ts",
	},
	output: {
		dir: "../../dist/content_scripts",
		minify: false,
		sourcemap: true,
		assetFileNames: "[name].js",
		format: "cjs"
	},

})


