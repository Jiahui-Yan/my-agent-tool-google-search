



function timeout(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}


// 在 ./baidu 目录中可以找到各种搜索结果的 HTML 样本，这些样本是从百度搜索结果页面中提取的。每个样本都包含一个搜索结果条目的 HTML 结构，可以用来测试和调试搜索结果的解析逻辑。

console.log("baidu content script loaded");

interface SearchResultEntry {
	url: string;
	title: string;
	summary: string;

	tpl: string
}


interface TplType {

	// tpl: string;
	title_selector: string

	summary_selector: string;

	summary_may_be_missing?: boolean;

	skip?: boolean

	subsets?: SubsetsDefinition;

	url_extractor?: (entry_el: HTMLElement) => string;
}

// 搜索结果子集定义，子集的结果由专用的提取器提取
interface SubsetsDefinition {
	selector: string;

	entry_selector: string;

	entries_extractor: SubsetsExtractor;

	// 当前子集的超集内容提取器
	superset_extractor?: SubsetsExtractor
}


const tpls: Record<string, TplType> = {
	"sg_kg_entity_san": {
		title_selector: '.ec_title,.kg-title_a60kU',
		summary_selector: '.kg-pc-paragraph-top_psUqk .right-link_NlGkt'
	},
	"bk_polysemy": {
		title_selector: '.c-title',
		summary_selector: '.main-info_4Q_kj'
	},
	"rel_base_realtime": {
		title_selector: '',
		summary_selector: '',
		subsets: {
			selector: '.cosc-card-content-border',
			entry_selector: '[eid]',
			entries_extractor: (entry_el, i) => {
				const title = entry_el.querySelector<HTMLElement>('.cosc-title')!.innerText.trim();
				const summary1 = entry_el.querySelector<HTMLElement>('.cos-text-body')!.innerText.trim();
				const summary2 = entry_el.querySelector<HTMLElement>('.source-wrap_3x2S1')!.innerText.trim();
				const url = entry_el.querySelector<HTMLAnchorElement>('a[href]')!.href;

				return [{
					url,
					title,
					summary: `${summary1}\n${summary2}`,
					tpl: "rel_base_realtime"
				}];
			},
		}
	},
	"jr_quote": {
		title_selector: '.header-container_3qP0n',
		summary_selector: '.pc-realtime-quote-container_7qOtb'
	},
	"jr_stock_comment_san": {
		title_selector: '.title-link_4K95D',
		summary_selector: '.comment-wrapper_7Hwvr'
	},
	"recommend_list": {
		title_selector: '',
		summary_selector: '',
		skip: true
	},

	"www_index": {
		title_selector: '.title-wrapper_6E6PV',
		summary_selector: '.summary-gap_3Jb4I',
		summary_may_be_missing: true
	},

	"jy_wenku_wenshu": {
		title_selector: '.card-title_5OKTo',
		summary_selector: '.info-wrap-first_4kNsH+div'
	},
	"game-page-multpost": {
		title_selector: '',
		summary_selector: '',
		skip: true
	},
	"se_com_default": {
		title_selector: '',
		summary_selector: '',
		skip: true
	},

	"short_video": {
		title_selector: '',
		summary_selector: '',
		skip: true
	},
	"guanfanghao_san": {
		title_selector: '',
		summary_selector: '',
		subsets: {
			selector: ".content-wrap_25tRf",
			entry_selector: ".content-item-wrap_34Sbv",
			entries_extractor: (entry_el) => {
				const json_str = entry_el.dataset["showExt"];
				const data: BaiJiaHaoData = JSON.parse(json_str!);

				const title = entry_el.querySelector<HTMLElement>('.title_7oZ5i')!.innerText.trim();

				return [{
					url: data.url,
					title,
					summary: '',
					tpl: "guanfanghao_san"
				}]
			}
		}
	},
	"www_struct": {
		title_selector: '.title-wrapper_6E6PV',
		summary_selector: '.content-space-between_44mGk',
	},
	"game-page-profession": {
		title_selector: '.title-box_2F79f',
		summary_selector: '.info-box-last_Usnv7',
	},
	"ai_agent_distribute": {
		title_selector: '',
		summary_selector: '',
		skip: true
	},
	"yl_vd_plot_intro_san": {
		title_selector: '.cosc-title',
		summary_selector: '.intro',
	},
	"med_mall_recommend_san": {
		title_selector: '',
		summary_selector: '',
		skip: true
	},
	"image_grid_san": {
		title_selector: '',
		summary_selector: '',
		skip: true
	},
	"xueshu_links": {
		title_selector: '',
		summary_selector: '',
		subsets: {
			selector: ".op-xueshu-links-d20-list",
			entry_selector: ".c-row",
			entries_extractor: (entry_el, i) => {

				const a = entry_el.querySelector<HTMLAnchorElement>('a[href]')!;

				if (a.parentElement!.classList.contains('op-xueshu-links-more')) {
					return [];
				}

				return [{
					url: a.href,
					title: a.innerText.trim(),
					summary: '',
					tpl: "xueshu_links"
				}]
			},
			superset_extractor: (entry_el) => {
				const a = entry_el.querySelector<HTMLAnchorElement>('.op-xueshu-links-d20-subtitle a')!;
				const subinfo = entry_el.querySelector<HTMLElement>('.op-xueshu-links-d20-subinfo')!.innerText.trim();

				return [{
					url: `${a.href} - ${subinfo}`,
					title: a.innerText.trim(),
					summary: '',
					tpl: "xueshu_links"
				}]
			}
		}
	},
	"note_lead": {
		title_selector: '',
		summary_selector: '',
		skip: true
	},
	"vmp_zxenterprise_new": {
		title_selector: 'h3',
		summary_selector: '.c-span-last .cos-line-clamp-4',
		url_extractor: (entry_el) => {
			const a = entry_el.querySelector<HTMLAnchorElement>('h3 a')!;
			return a.href;
		}
	},
	"poi_mapdots": {
		title_selector: '',
		summary_selector: '',
		subsets: {
			selector: ".right-content_1bNEg",
			entry_selector: ".item-bottom_6q3Oo",
			entries_extractor: (entry_el, i) => {

				const a = entry_el.querySelector<HTMLAnchorElement>('a[href]')!;

				return [{
					url: a.href,
					title: a.innerText.trim(),
					summary: entry_el.innerText.trim(),
					tpl: "poi_mapdots"
				}]
			},
		}
	},
	"new_baikan_index": {
		title_selector: '',
		summary_selector: '',
		skip: true,
	},
	"tieba_general": {
		title_selector: '',
		summary_selector: '',
		skip: true
	},
	"generaltable": {
		title_selector: '',
		summary_selector: '',
		skip: true
	},
	"sp_purc_pc": {
		title_selector: '',
		summary_selector: '',
		skip: true
	},
	"vmp_newproject_new": {
		title_selector: 'h3',
		summary_selector: '.c-span-last',
	},
	"app/toptip": {
		title_selector: '',
		summary_selector: '',
		skip: true
	},
	"wenda_generate": {
		title_selector: '',
		summary_selector: '',
		skip: true
	}


	// "": {
	// 	title_selector: '',
	// 	summary_selector: ''
	// },

}


interface BaiJiaHaoData {
	url: string
}




interface SubsetsExtractor {
	(entry_el: HTMLElement, index: number): SearchResultEntry[];
}



function out<T>(value: T | undefined = undefined): Out<T> {
	return { value };
}

export interface Out<T> {
	value: T | undefined;
}



class ElementError extends Error {
	constructor(public url: string, el: Element, public msg: string) {
		super(msg);
	}
}



class SearchResultEntryEl {

	constructor(private entry_el: HTMLDivElement, private page: BaiduSearchPage) {

	}

	get tpl() {
		const tpl = this.entry_el.getAttribute('tpl');
		return tpl;
	}

	tryGetEntry(out: Out<SearchResultEntry[]>): boolean {

		out.value = undefined;

		const tpl = this.tpl;

		if (!tpl) return false;

		const config = tpls[tpl];
		if (!config) {
			throw this.page.el_error(this.entry_el, `Unknown result entry template type '${tpl}'`);
		}

		if (config.skip) return false;

		if (config.subsets) {

			const subsets_el = this.entry_el.querySelector<HTMLElement>(config.subsets.selector)!;

			const entries_els = subsets_el.querySelectorAll<HTMLElement>(config.subsets.entry_selector);

			const entries: SearchResultEntry[] = [];

			config.subsets.superset_extractor?.(this.entry_el, 0).forEach(e => entries.push(e));

			for (let i = 0, len = entries_els.length; i < len; i++) {
				const entry_el = entries_els[i]!;

				const subset_entries = config.subsets.entries_extractor(entry_el, i);
				entries.push(...subset_entries);
			}

			out.value = entries;
			return true;
		}


		const title_el = this.entry_el.querySelector<HTMLElement>(config.title_selector);
		if (!title_el) {
			throw this.page.el_error(this.entry_el, `Result entry with tpl '${tpl}' missing title element with selector '${config.title_selector}'`);
		}

		let summary: string = '';
		if (config.summary_selector) {
			let summary_el = this.entry_el.querySelector<HTMLElement>(config.summary_selector);
			if (!summary_el) {
				if (config.summary_may_be_missing) {
					summary_el = title_el;
				} else {
					throw this.page.el_error(this.entry_el, `Result entry with tpl '${tpl}' missing summary element with selector '${config.summary_selector}'`);
				}
			}

			summary = summary_el.innerText.trim();
		}



		out.value = [{
			url: this.getUrl(config),
			title: title_el!.innerText.trim(),
			summary: summary,
			tpl
		}]

		return true;
	}


	private get _url() {

		const url = this.entry_el.getAttribute('mu');
		if (!url) {
			throw this.page.el_error(this.entry_el, "Result entry missing 'mu' attribute for url");
		}
		return url;
	}

	private getUrl(config: TplType): string {
		if (config.url_extractor) {
			return config.url_extractor(this.entry_el);
		} else {
			const url = this.entry_el.getAttribute('mu');
			return url || '';
		}
	}
}


class BaiduSearchPage {

	el_error(el: Element, msg: string): ElementError {
		return new ElementError(window.location.href, el, msg);
	}

	async search(query: string): Promise<SearchResultEntry[]> {


		const setInput = () => {

			const chat_textarea = document.querySelector<HTMLTextAreaElement>('#chat-textarea');
			if (!chat_textarea) {
				throw Error("Chat textarea not found");
			}

			chat_textarea.value = query;
		}

		const clickSearchButton = () => {
			const btn = document.querySelector<HTMLButtonElement>('#chat-submit-button');
			if (!btn) {
				throw Error("Chat submit button not found");
			}
			btn.dispatchEvent(new MouseEvent('click'));
		}

		setInput();
		clickSearchButton();

		return await this.extractResults();
	}

	async extractResults(): Promise<SearchResultEntry[]> {

		const tryGetResultContainer = async () => {

			for (let i = 0; i < 10; i++) {
				const container = document.querySelector<HTMLDivElement>('#content_left');
				if (container) {
					return container;
				} else {
					await timeout(1000);
				}
			}

			throw this.el_error(document.body, "Search results container not found (#content_left) after waiting 10 seconds");
		}

		const enumResutEntry = async () => {

			const container = await tryGetResultContainer();

			// enum each child element of container

			function* enumChildEntries(this: BaiduSearchPage) {
				for (let i = 0, len = container.children.length; i < len; i++) {
					const entry_el = container.children[i] as HTMLDivElement;
					const entry = new SearchResultEntryEl(entry_el, this);

					const out_entry = out<SearchResultEntry[]>();

					if (entry.tryGetEntry(out_entry)) {
						for (const e of out_entry.value!) {
							yield e;
						}
					}
				}
			}

			return [...enumChildEntries.call(this)];
		}

		return await enumResutEntry();
	}

	private _content_left: HTMLDivElement | null = null;

	get _hasContentLeft() {

		if (!this._content_left) {
			this._content_left = document.querySelector('#content_left')
		}

		return this._content_left !== null;
	}

	init(): BaiduSearchPage {
		return this;
	}
}








/**
 * Checks if the search results page has loaded by looking for the presence of the #page element, which contains the search results. This is a simple heuristic and may need to be adjusted if Baidu changes their page structure.
 */
function page_exists() {
	return document.querySelector('#page') !== null;
}

/**
 * Ensures that the search results page has loaded by repeatedly checking for the presence of the #page element.
 * Waits for a maximum of 10 seconds, checking every second.
 */
async function ensure_page_exists() {
	for (let i = 0; i < 10; i++) {
		if (page_exists()) {
			return true;
		} else {
			await timeout(1000);
		}
	}
	return false;
}


(async () => {

	const search_page = new BaiduSearchPage().init();

	let results: SearchResultEntry[];;

	console.log("Ensuring search results page has loaded...", search_page);

	const re_extract = async () => {
		if (search_page._hasContentLeft) {
			results = await search_page.extractResults();
		} else {
			results = await search_page.search("穿越火线");
		}
		console.log(results);
	}

	re_extract();

	//@ts-ignore
	window.re_extract = re_extract;

})();



