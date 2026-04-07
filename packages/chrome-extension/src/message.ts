






export namespace msgDef {

	export interface IMessage {
		receiver: string;
		action: string
	}

	export interface IError extends Error {
		errorType: string

	}

	export interface LogErrorMessage extends IMessage {

		receiver: "dispatcher";
		action: "log-error";

		error: IError
	}

	export const LogErrorMessage = {
		is(msg: unknown): msg is LogErrorMessage {
			if (msg === null || typeof msg !== "object") {
				return false;
			}
			const m = (msg as LogErrorMessage);
			if (m.receiver !== "dispatcher" || m.action !== "log-error") {
				return false;
			}
			return true;
		},
		define(msg: LogErrorMessage): LogErrorMessage {
			return msg;
		}
	}



	export interface GetSearchTaskMessage extends IMessage {

		receiver: "dispatcher";
		action: "get-search-task";
	}


	export const GetSearchTaskMessage = {
		is(msg: unknown): msg is GetSearchTaskMessage {
			if (msg === null || typeof msg !== "object") {
				return false;
			}

			const m = (msg as GetSearchTaskMessage);

			if (m.receiver !== "dispatcher" || m.action !== "get-search-task") {
				return false;
			}

			return false;
		},
		define(msg: GetSearchTaskMessage): GetSearchTaskMessage {
			return msg;
		}
	}


	export interface GetSearchTaskResponseMessage extends IMessage {

		receiver: "content_script";

		tab_id: number

		action: "get-search-task-response";

		keyword: string

	}

	export const GetSearchTaskResponseMessage = {
		is(msg: unknown): msg is GetSearchTaskResponseMessage {
			if (msg === null || typeof msg !== "object") {
				return false;
			}

			const m = (msg as GetSearchTaskResponseMessage);

			if (m.receiver !== "content_script" || m.action !== "get-search-task-response") {
				return false;
			}

			if (typeof m.keyword !== "string") {
				return false;
			}

			if (typeof m.tab_id !== "number" || isNaN(m.tab_id)) {
				return false;
			}

			return true;
		},
		define(msg: GetSearchTaskResponseMessage): GetSearchTaskResponseMessage {
			return msg;
		}
	}

	/**
	 * json 格式的搜索结果条目定义
	 */
	export interface SearchResultEntry {

		url: string;

		title: string;

		summary: string;

		/**
		 * tpl 类型，调试用，用于快速确定有问题的结果类型
		 */
		tpl?: string
	}


	export interface ReportSearchResultMessage extends IMessage {
		receiver: "dispatcher";
		action: "report-search-result";

		results: SearchResultEntry[];
	}


	export const ReportSearchResultMessage = {

		is(msg: unknown): msg is ReportSearchResultMessage {
			if (msg === null || typeof msg !== "object") {
				return false;
			}

			const m = (msg as ReportSearchResultMessage);

			if (m.receiver !== "dispatcher" || m.action !== "report-search-result") {
				return false;
			}

			if (!Array.isArray(m.results)) {
				return false;
			}

			return true;
		},
		define(msg: ReportSearchResultMessage): ReportSearchResultMessage {
			return msg;
		}
	}
}









function defineMessage<T>(message: T): T {
	return message;
}


export interface SenderChecker {
	checkSender(sender: chrome.runtime.MessageSender): boolean;
}


/**
 * content_script 和 options_page 之间的通信接口定义
 * content_script 通过这个接口向 dispatcher 请求搜索任务和汇报搜索结果，dispatcher 通过这个接口接收 content_script 的请求并发送响应
 * dispatcher 还可以通过这个接口向 options_page 发送错误日志，方便调试
 */
export const message = {

	/**
	 * 向 dispatcher 发送错误日志，日志会在 options_page 中显示，方便调试
	 */
	logError: {
		send(error: Error) {
			const msg = defineMessage<msgDef.LogErrorMessage>({
				receiver: "dispatcher",
				action: "log-error",
				error: Object.assign(error, {
					errorType: error.constructor.name
				})
			});
			chrome.runtime.sendMessage(msg)
		},
		handle(onError: (error: msgDef.IError) => void) {
			chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
				if (msgDef.LogErrorMessage.is(message)) {
					onError(message.error)
				}
			});
		}
	},

	/**
	 * 向 dispatcher 请求搜索任务
	 * 
	 * dispatcher 不会向 content_script 发送搜索任务，而是由 content_script 主动向 dispatcher 请求搜索任务，这样可以避免 dispatcher 在 content_script 没有准备好时就发送消息导致消息丢失的问题
	 */
	getSearchTask: {
		send(): Promise<msgDef.GetSearchTaskResponseMessage> {

			const msg = defineMessage<msgDef.GetSearchTaskMessage>({
				receiver: "dispatcher",
				action: "get-search-task"
			});

			return msg_promise<msgDef.GetSearchTaskResponseMessage>(msg, 5000, (resolve, reject) => {
				chrome.runtime.sendMessage(msg, (response) => {
					if (msgDef.GetSearchTaskResponseMessage.is(response)) {
						resolve(response);
					}
				})
			})

		},
		handle(impl: (message: msgDef.GetSearchTaskMessage, sender: chrome.runtime.MessageSender) => any) {

			chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
				async () => {
					if (!msgDef.GetSearchTaskMessage.is(message)) return;

					const result = await impl(message, sender);
					if (result == undefined) return;

					const resp = msgDef.GetSearchTaskResponseMessage.define({
						receiver: "content_script",
						action: "get-search-task-response",
						tab_id: sender.tab?.id ?? -1,
						keyword: result
					})

					sendResponse(resp);
				}
			});
		}

	},

	/**
	 * 向 dispatcher 汇报搜索结果
	 */
	reportSearchResult: {

		send(results: msgDef.SearchResultEntry[]) {
			const msg = defineMessage<msgDef.ReportSearchResultMessage>({
				receiver: "dispatcher",
				action: "report-search-result",
				results
			});

			chrome.runtime.sendMessage(msg);
		},
		handle(impl: (message: msgDef.ReportSearchResultMessage, sender: chrome.runtime.MessageSender) => any) {

			chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
				if (!msgDef.ReportSearchResultMessage.is(message)) return;
				impl(message, sender);
			})
		}
	}

}


enum PromiseState {
	running = 0,
	finished = 1,
	rejected = 2,
	timeout = 3
}



interface PromiseExecutor<T = any> {

	(resolve: (value: T) => void, reject: (reason?: any) => void): void;
}

/**
 * 创建一个带有超时功能的Promise，如果在指定时间内Promise没有完成，则自动reject
 * @param msg 消息对象
 * @param timeout_ms 超时时间，单位毫秒
 * @param executor 执行器函数
 * @returns 返回一个Promise对象
 */
export function msg_promise<T>(msg: msgDef.IMessage, timeout_ms: number, executor: PromiseExecutor<T>): Promise<T> {

	return new Promise<T>((resolve, reject) => {
		let state = PromiseState.running;
		const timeoutId = setTimeout(() => {
			if (state === PromiseState.running) {
				state = PromiseState.timeout;
				reject(new DispatcherCommunicationTimeoutError(`Message (${msg.action} send to ${msg.receiver}) timeout after ${timeout_ms}ms`));
			}
		}, timeout_ms);

		const resolve_wrapper = (value: T) => {
			if (state === PromiseState.running) {
				state = PromiseState.finished;
				clearTimeout(timeoutId);
				resolve(value);
			}
		};

		const reject_wrapper = (reason?: any) => {
			if (state === PromiseState.running) {
				state = PromiseState.rejected;
				clearTimeout(timeoutId);
				reject(reason);
			}
		}

		executor(
			resolve_wrapper,
			reject_wrapper
		);
	});
}




export class DispatcherCommunicationTimeoutError extends Error {

	static is(error: unknown): error is DispatcherCommunicationTimeoutError {
		return error instanceof DispatcherCommunicationTimeoutError;
	}
}

