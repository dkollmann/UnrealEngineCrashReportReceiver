import { app } from "@azure/functions";
import { BlobServiceClient } from "@azure/storage-blob";
import crypto from "crypto";

app.http("UnrealEngineCrashReportReceiver", {
    methods: ["POST"],
    authLevel: "anonymous",
    route: "CrashReporter/{*path}",

    handler: async (req, context) => {
        const path = req.params.path?.toLowerCase();
        console.time(`CrashReporter:${path}`);
        context.log(`CrashReporter endpoint hit: ${path}`);

        // -----------------------------
        // Handle CheckReport
        // -----------------------------
        if (path === "checkreport") {
            console.timeEnd(`CrashReporter:${path}`);
            return {
                status: 200,
                headers: { "Content-Type": "application/xml" },
                body: "<CrashReporterResult bSuccess=\"true\"/>"
            };
        }

        // -----------------------------
        // Handle SubmitReport
        // -----------------------------
        if (path === "submitreport") {
            try {
                const blobConn = process.env.CrashBlobConnection;
                if (!blobConn) {
                    throw new Error("CrashBlobConnection environment variable not set.");
                }

                const blobService = BlobServiceClient.fromConnectionString(blobConn);
                const containerClient = blobService.getContainerClient("crashes");
                await containerClient.createIfNotExists();

                const bodyBuffer = Buffer.from(await req.arrayBuffer());

                const timestamp = new Date().toISOString().replace(/[:.]/g, "_");
                const fileName = `crash_${timestamp}_${crypto.randomUUID()}.bin`;

                await containerClient.uploadBlockBlob(
                    fileName,
                    bodyBuffer,
                    bodyBuffer.length
                );

                context.log(`Uploaded crash payload: ${fileName}`);
                console.timeEnd(`CrashReporter:${path}`);

                return { status: 200, body: "OK" };

            } catch (err) {
                context.log.error("Error processing crash report", err);
                return { status: 500, body: "Failed to process crash report." };
            }
        }

        // -----------------------------
        // Unknown endpoint
        // -----------------------------
        console.timeEnd(`CrashReporter:${path}`);
        return { status: 404, body: "Unknown CrashReporter endpoint." };
    }
});
