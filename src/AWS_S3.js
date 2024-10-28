const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');

class AWS_S3 {
    constructor() {
        this.s3Client = new S3Client({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            }
        });
        this.bucket = process.env.AWS_BUCKET_NAME;
    }

    async deleteFolder(productId) {
        try {
            const folderKey = `products/${productId}/`;
            const listCommand = new ListObjectsV2Command({
                Bucket: this.bucket,
                Prefix: folderKey
            });

            const listedObjects = await this.s3Client.send(listCommand);

            if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
                console.log(`No objects found in folder ${folderKey}`);
                return;
            }

            const deleteCommand = new DeleteObjectsCommand({
                Bucket: this.bucket,
                Delete: {
                    Objects: listedObjects.Contents.map(({ Key }) => ({ Key })),
                    Quiet: false
                }
            });

            await this.s3Client.send(deleteCommand);

            if (listedObjects.IsTruncated) {
                await this.deleteFolder(productId);
            }

            console.log(`Successfully deleted folder ${folderKey} from S3`);
        } catch (error) {
            console.error(`Error deleting folder for product ${productId} from S3:`, error);
        }
    }
}

module.exports = AWS_S3;
