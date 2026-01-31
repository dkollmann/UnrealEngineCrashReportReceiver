import { app } from "@azure/functions";
import { BlobServiceClient } from "@azure/storage-blob";
import crypto from "crypto";
import zlib from "zlib";

app.http("UnrealEngineCrashReportReceiver", {
	methods: ["POST"],
	authLevel: "anonymous",
	route: "CrashReporter/{*path}",

	handler: async (req, context) => {
		context.log(`CrashReporter endpoint hit: ${req.params.path}`);
		console.log(req.headers);

		const action = req.params.path.toLowerCase();

		const currentFileName = req.query.filename || `crash__${new Date().toISOString().replace(/[:.]/g, "-")}__${crypto.randomUUID()}`;

		console.time(`CrashReporter:${action}`);

		// -----------------------------
		// Handle CheckReport
		// -----------------------------
		if (action === "checkreport") {
			console.timeEnd(`CrashReporter:${action}`);
			return {
				status: 200,
				headers: { "Content-Type": "application/xml" },
				body: `<CrashReporterResult bSuccess="true"/>`
			};
		}

		// -----------------------------
		// Handle SubmitReport
		// -----------------------------
		if (action === "submitreport") {
			try {
				const blobConn = process.env.CrashBlobConnection;
				if (!blobConn) {
					throw new Error("CrashBlobConnection environment variable not set.");
				}

				context.log(`Getting container 'crashes'...`);
				
				const blobService = BlobServiceClient.fromConnectionString(blobConn);
				const containerClient = blobService.getContainerClient("crashes");
				await containerClient.createIfNotExists();

				context.log(`Uploading to container 'crashes'...`);

				const bodyBuffer = Buffer.from(await req.arrayBuffer());
				context.log(`SubmitReport body length: ${bodyBuffer.length}`);

				await containerClient.uploadBlockBlob(
					currentFileName,
					bodyBuffer,
					bodyBuffer.length
				);

				context.log(`Uploaded crash report: ${currentFileName}`);
				console.timeEnd(`CrashReporter:${action}`);

				return {
					status: 200,
					headers: { "Content-Type": "application/xml" },
					body: `<CrashReporterResult bSuccess="true"/>`
				};

			} catch (err) {
				context.log(`Error: processing crash report: ${err}`);
				return { status: 500, body: "Failed to process crash report." };
			}
		}

		// -----------------------------
		// Handle UploadReportFile
		// -----------------------------
		if (action === "uploadreportfile") {
			try {
				const storage = process.env.CrashReportStorageConnectionString;
				if (!storage) {
					throw new Error("CrashReportStorageConnectionString environment variable not set.");
				}

				context.log(`Getting container 'crashes'...`);
				
				const storageService = BlobServiceClient.fromConnectionString(storage);
				const containerClient = storageService.getContainerClient("crashes");
				await containerClient.createIfNotExists();

				context.log(`Uploading to container 'crashes'...`);

				const bodyBuffer = Buffer.from(await req.arrayBuffer());

				// 1. Decompress the UE5 bundle
				const uncompressed = zlib.inflateSync(bodyBuffer);

				context.log(`UploadReportFile data size  compressed: ${bodyBuffer.length}  uncompressed: ${uncompressed.length}`);

				let offset = 0;
				const uploadPromises = [];

				// 2. Loop through the uncompressed buffer to find files
				// Note: This is a simplified parser for the standard UE4/UE5 binary format
				while (offset < uncompressed.length) {
					const fileIndex = uncompressed.readUInt32LE(offset);
					offset += 4;

					const nameLen = uncompressed.readUInt32LE(offset);
					offset += 4;

					context.log(`UploadReportFile file${fileIndex}: nameLen=${nameLen}`);

					if (nameLen !== 260)
						throw new Error(`Unexpected name length: ${nameLen}`);

					const nameData = uncompressed.slice(offset, offset + nameLen);
					offset += nameLen;

					const nameEnd = nameData.indexOf(0);
					const name = nameData.slice(0, nameEnd).toString("utf-8");

					context.log(`UploadReportFile file${fileIndex}: name=${name}`);

					const dataLen = uncompressed.readUInt32LE(offset);
					offset += 4;

					context.log(`UploadReportFile file${fileIndex}: dataLen=${dataLen}`);

					const data = uncompressed.slice(offset, offset + dataLen);
					offset += dataLen;

					// 3. Upload individual file to Azure
					const blobPath = `${currentFileName}__${name}`;
					const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
					uploadPromises.push(blockBlobClient.upload(data, data.length));
					
					context.log(`Extracted and uploading: ${name} (${dataLen} bytes)`);
				}

				await Promise.all(uploadPromises);

				context.log(`Uploaded crash report files: ${currentFileName}`);
				console.timeEnd(`CrashReporter:${action}`);

				return {
					status: 200,
					headers: { "Content-Type": "application/xml" },
					body: `<CrashReporterResult bSuccess="true"/>`
				};

			} catch (err) {
				context.log(`Error: processing crash report file: ${err}`);
				return { status: 500, body: "Failed to process crash report file." };
			}
		}

		// -----------------------------
		// Handle UploadComplete
		// -----------------------------
		if (action === "uploadcomplete") {
			return {
				status: 200,
				headers: { "Content-Type": "application/xml" },
				body: `<CrashReporterResult bSuccess="true"/>`
			};
		}

		// -----------------------------
		// Unknown endpoint
		// -----------------------------
		console.timeEnd(`CrashReporter:${action}`);
		context.log.warn(`Unknown CrashReporter endpoint: ${action}.`);
		return { status: 404, body: "Unknown CrashReporter endpoint." };
	}
});
