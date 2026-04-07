import { DispatcherCommunicationTimeoutError, message, msgDef } from "../message";


function timeout(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}


// 在 ./baidu 目录中可以找到各种搜索结果的 HTML 样本，这些样本是从百度搜索结果页面中提取的。每个样本都包含一个搜索结果条目的 HTML 结构，可以用来测试和调试搜索结果的解析逻辑。

console.log("baidu content script loaded");

/**
 * json 格式的搜索结果条目定义
 */
interface SearchResultEntry {

	url: string;

	title: string;

	summary: string;

	/**
	 * tpl 类型，调试用，用于快速确定有问题的结果类型
	 */
	tpl: string
}

function defineResultEntry(entry: SearchResultEntry): SearchResultEntry {
	return entry;
}

interface TplType {

	/**
	 * 用于提取结果标题的选择器，值不能为空字符串
	 */
	title_selector: string

	/**
	 * 用于提取结果摘要的选择器，值可以为空字符串，因为有些结果没有提供提要（可能是因为网站声明不允许搜索引擎抓取内容）
	 */
	summary_selector: string;

	/**
	 * 是否允许 summary 元素缺失，因为同样的搜索结果类型，有的结果没有提供提要（可能是因为网站声明不允许搜索引擎抓取内容）
	 */
	summary_may_be_missing?: boolean;

	/**
	 * 有些 tpl 类型不需要处理，比如【大家都在搜】
	 */
	skip?: boolean


	/**
	 * 有些搜索结果具有子集（比如视频搜索、学术搜索）
	 */
	subsets?: SubsetsDefinition;


	/**
	 * 有些 tpl 类型需要需要单独提取url
	 * @param entry_el 当前搜索结果条目的根元素
	 */
	url_extractor?: (entry_el: HTMLElement) => string;
}

// 搜索结果子集定义，子集的结果由专用的提取器提取
interface SubsetsDefinition {
	/**
	 * 子集选择器，指定了包含子集条目的元素
	 */
	selector: string;

	/**
	 * 子集条目选择器，指定了每个子集条目的元素
	 */
	entry_selector: string;

	/**
	 * 子集条目提取器，负责从每个子集条目的元素中提取出搜索结果条目
	 */
	entries_extractor: EntriesExtractor;

	/**
	 * 当前子集的超集内容提取器
	 */
	superset_extractor?: EntriesExtractor
}

// 搜索结果页面中带有 tpl 属性的结果才是有用的结果，以下是不同从 tpl 类型提取 url、title 和 summary 的配置。对于一些复杂的 tpl 类型，结果条目可能包含一个子集，子集中的每个条目都需要单独提取，这时可以使用 subsets 定义来指定子集的选择器和提取器。
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

/**
 * 百家号搜索结果将 url 存储在一个 data-show-ext 的属性中，这个属性的值是一个 JSON 字符串，包含了 url 和其他一些信息，但我们只需要 url
 */
interface BaiJiaHaoData {
	url: string
}



/**
 * 结果条目提取器，函数实现不能抛出异常
 * 
 * @param entry_el 当前搜索结果条目的根元素
 * @param index 当前搜索结果条目在其父容器中的索引位置，从0开始，属于预留参数，目前没什么实际用途，未来可能有用
 */
interface EntriesExtractor {
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

	get dispatcher() {
		return this.page.dispatcher;
	}

	get tpl() {
		const tpl = this.entry_el.getAttribute('tpl');
		return tpl;
	}

	*tryGetEntry(): Generator<SearchResultEntry> {

		try {

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


				const superset_extractor = config.subsets.superset_extractor;
				if (superset_extractor) {

					try {
						for (const e of superset_extractor(this.entry_el, 0)) {
							yield e;
						}
					} catch (e) {
						this.page.dispatcher.logError(e as Error);
					}

				}

				for (let i = 0, len = entries_els.length; i < len; i++) {
					const entry_el = entries_els[i]!;

					try {
						const subset_entries = config.subsets.entries_extractor(entry_el, i);
						for (const e of subset_entries) {
							yield e;
						}
					} catch (e) {
						this.page.dispatcher.logError(e as Error);
					}
				}

				return;
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

			yield {
				url: this.getUrl(config),
				title: title_el!.innerText.trim(),
				summary: summary,
				tpl
			}

		} catch (e) {
			this.page.dispatcher.logError(e as Error);
		}



		return true;
	}


	/**
	 * 通用的 url 提取逻辑
	 */
	private get _url() {

		const url = this.entry_el.getAttribute('mu');
		if (!url) {
			throw this.page.el_error(this.entry_el, "Result entry missing 'mu' attribute for url");
		}
		return url;
	}

	/**
	 * 保证一定能获取到 url 的提取逻辑，优先使用 config 中的 url_extractor，如果没有定义，则使用通用的 url 提取逻辑
	 */
	private getUrl(config: TplType): string {
		if (config.url_extractor) {
			return config.url_extractor(this.entry_el);
		} else {
			const url = this.entry_el.getAttribute('mu');
			return url || '';
		}
	}
}

/**
 * 表示百度搜索页面
 */
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

		try {
			setInput();
			clickSearchButton();
		} catch (e) {
			this.dispatcher.logError(e as Error);
			return [];
		}

		return await this.extractResults();
	}

	async extractResults(): Promise<SearchResultEntry[]> {

		try {
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

						for (const e of entry.tryGetEntry()) {
							yield e;
						}
					}
				}

				return [...enumChildEntries.call(this)];
			}

			return await enumResutEntry();
		} catch (e) {
			this.dispatcher.logError(e as Error);
			return [];
		}
	}

	private _content_left: HTMLDivElement | null = null;

	get _hasContentLeft() {

		if (!this._content_left) {
			this._content_left = document.querySelector('#content_left')
		}

		return this._content_left !== null;
	}

	dispatcher!: DispatcherPage;

	init(dispatcher: DispatcherPage): BaiduSearchPage {
		this.dispatcher = dispatcher;
		return this;
	}
}


class DispatcherPage {


	logError(error: Error) {
		console.error(error);
		message.logError.send(error);
	}

	async getSearchTask(): Promise<msgDef.GetSearchTaskResponseMessage | undefined> {

		for (let i = 0; i < 5; i++) {
			try {
				const result = await message.getSearchTask.send();
				return result;
			} catch (e) {
				if (DispatcherCommunicationTimeoutError.is(e)) {

				} else {
					this.logError(e as Error);
					break;
				}
			}

			await timeout(1000);
		}

		return undefined;
	}

	reportSearchResult(results: SearchResultEntry[]) {
		message.reportSearchResult.send(results);
	}
}



/**
 * 执行搜索任务
 * 
 * 创建必要对象，获取搜索任务，执行搜索并汇报结果。 这是一次性过程，如果中途出现任何错误都不会重试。
 */
async function execSearchTask() {
	// 创建必要的对象
	const dispatcher = new DispatcherPage();
	const search_page = new BaiduSearchPage().init(dispatcher);


	console.log("Ensuring search results page has loaded...", search_page);

	// 获取搜索任务
	const task_resp = await dispatcher.getSearchTask();

	if (task_resp) {
		// 如果有任务，则搜索指定关键词并汇报结果
		const results = await search_page.search(task_resp.keyword);
		dispatcher.reportSearchResult(results);
	} else {
		console.warn("No search task received from dispatcher after multiple attempts, giving up");
	}
}


(async () => {


	execSearchTask();

})();



