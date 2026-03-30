import { createApp, h } from 'vue'
import { Button } from 'ant-design-vue'

//@ts-ignore
import 'ant-design-vue/dist/reset.css'



const App = {
	setup() {
		const onClick = () => {

			chrome.tabs.create({
				url: 'https://www.baidu.com',
				active: false,
				
			})
		}


		return () => {
			return <div>
				<h2>Extension Options (Debug Page)</h2>
				<Button type="primary" onClick={onClick}>Start Debug Task</Button>
			</div>
		}
	}
}

console.log("hello");

createApp(App).mount('#app')
