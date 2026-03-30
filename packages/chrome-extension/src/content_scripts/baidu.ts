






console.log("baidu content script loaded");








function timeout(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}



function page_exists() {
	return document.querySelector('#page') !== null;
}

function ensure_page_exists() {
	for (let i = 0; i < 10; i++) {
		if (page_exists()) {
			return true;
		}
	}
	return false;
}


(async () => {

	function send_request(query: string) {
		let chat_area: HTMLTextAreaElement | null = document.querySelector('#chat-textarea')
		const btn: HTMLButtonElement | null = document.querySelector('#chat-submit-button');
		chat_area!.value = query;
		btn!.dispatchEvent(new MouseEvent('click'));
	}

	send_request("visual studio code release notes");

	await timeout(1500);

	if ((await ensure_page_exists())) {

		function *extract_results() {

			const results: NodeListOf<HTMLDivElement> = document.querySelectorAll(".result.c-container");

			for (let i = 0; i < results.length; i++) {
				const result_el = results[i]!;

				const url: string = result_el.getAttribute('mu')!;

				const title_el: HTMLDivElement = result_el.querySelector('.title-wrapper_6E6PV')!

				const title_text: string = title_el.innerText;

				const summary_el: HTMLDivElement | null = result_el.querySelector('.summary-gap_3Jb4I')!;

				yield {
					url: url,
					title: title_text,
					summary: summary_el.innerText
				}
			}
		}

		console.log([...extract_results()]);
	}
})();

