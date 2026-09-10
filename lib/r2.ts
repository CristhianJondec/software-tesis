import { DeleteObjectCommand, S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const accountId = process.env.R2_ACCOUNT_ID!;
const bucket = process.env.R2_BUCKET_NAME!;

export const R2_BUCKET = bucket;

export const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
});

export const presignPut = async (key: string, contentType: string, expiresIn = 600) => {
    const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
    return getSignedUrl(r2, command, { expiresIn });
};

export const getObjectStream = async (key: string) => {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await r2.send(command);
    return {
        body: response.Body as ReadableStream | null,
        contentType: response.ContentType,
        contentLength: response.ContentLength,
    };
};

export const deleteObjects = async (keys: Array<string | null | undefined>) => {
    const uniqueKeys = [...new Set(keys.filter((key): key is string => Boolean(key)))];

    await Promise.all(
        uniqueKeys.map((key) => r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))),
    );
};
