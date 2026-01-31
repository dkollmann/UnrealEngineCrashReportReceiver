import { app } from "@azure/functions";
import { BlobServiceClient } from "@azure/storage-blob";
import crypto from "crypto";
import { Readable } from "stream";
import zlib from "zlib";

app.http("UnrealEngineCrashReportReceiver", {
    methods: ["POST"],
    authLevel: "anonymous",
    route: "CrashReporter/{*path}",

    handler: async (req, context) => {
        context.log(`CrashReporter endpoint hit: ${req.params.path}`);
        console.log(req.headers);

        const splitpath = req.params.path.split("/");
        const action = splitpath[0].toLowerCase();

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

                const timestamp = new Date().toISOString().replace(/[:.]/g, "_");
                const fileName = `crash_${timestamp}_${crypto.randomUUID()}.txt`;

                await containerClient.uploadBlockBlob(
                    fileName,
                    bodyBuffer,
                    bodyBuffer.length
                );

                context.log(`Uploaded crash report: ${fileName}`);
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
                context.log(`UploadReportFile body length: ${bodyBuffer.length}`);

                const timestamp = new Date().toISOString().replace(/[:.]/g, "_");
                const fileName = `crash_${timestamp}_${crypto.randomUUID()}.gz`;

                // save as gzip
                const bufferStream = Readable.from(bodyBuffer);
                const gzip = zlib.createGzip();
                const gzipStream = bufferStream.pipe(gzip);

                const blobClient = containerClient.getBlockBlobClient(fileName);

                await blobClient.uploadStream(gzipStream, 4 * 1024 * 1024);

                /*await containerClient.uploadBlockBlob(
                    fileName,
                    bodyBuffer,
                    bodyBuffer.length
                );*/

                context.log(`Uploaded crash report file: ${fileName}`);
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
