import https from "https";
import { ByteProgressUnit, Progress } from "../Progress.js";
import FormData from "form-data";
import { IncomingHttpHeaders } from "http";
import ProgressStream from "progress-stream";
import { Readable } from "stream";

function getHeadersFromBody(
	body?: FormData | Buffer,
): https.RequestOptions["headers"] {
	if (body instanceof FormData) {
		return body.getHeaders();
	} else {
		return {};
	}
}

export function progressHttp(
	url: string | URL,
	options?: https.RequestOptions,
	body?: FormData | Buffer,
): Progress<[Buffer, ProgressHttpResponse]> {
	return Progress.runAsync("sending HTTP request", (progress) => {
		progress.setUnit(new ByteProgressUnit());

		return new Promise<[Buffer, ProgressHttpResponse]>(
			(resolve, reject) => {
				const request = https.request(
					url,
					{
						...options,
						headers: {
							...getHeadersFromBody(body),
							...options?.headers,
						},
					},
					(response) => {
						// response.setEncoding("binary");

						let length = parseInt(
							response.headers["content-length"] ?? "NaN",
						);

						if (isNaN(length)) {
							length = 0;
						}

						progress
							.setStatus("downloading")
							.setProgress(0, length);

						const chunks: Buffer[] = [];
						response.on("data", (chunk: Buffer) => {
							chunks.push(chunk);

							progress.currentProgress += chunk.byteLength;
						});

						response.on("end", () => {
							resolve([
								Buffer.concat(chunks),
								{
									status: response.statusCode,
									statusText: response.statusMessage,
									headers: response.headers,
								},
							]);
						});
					},
				);

				if (body) {
					const progressStream = ProgressStream();

					progress.setStatus("uploading").setProgress(0, 0);

					progressStream.on("progress", (p) => {
						progress.setProgress(p.transferred, p.remaining);
					});

					let readableCompatible: Readable;

					if (body instanceof FormData) {
						readableCompatible = body;
					} else {
						readableCompatible = Readable.from(body);
					}

					readableCompatible.pipe(progressStream).pipe(request);
				} else {
					request.end();
				}
			},
		);
	});
}

export function progressHttpJson<T = any>(
	...args: Parameters<typeof progressHttp>
): Progress<[T, ProgressHttpResponse]> {
	return Progress.runAsync(
		"sending HTTP request, parsing body as json",
		async (progress) => {
			const [body, response] = await progress.defer(
				progressHttp(...args),
			);

			const bodyString = body.toString("utf-8");
			const json: T = JSON.parse(bodyString);

			return [json, response];
		},
	);
}

export interface ProgressHttpResponse {
	status?: number;
	statusText?: string;
	headers: IncomingHttpHeaders;
}
