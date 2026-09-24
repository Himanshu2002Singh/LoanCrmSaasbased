// const s3 = require('../config/aws_config');
// const bucketName = process.env.AWS_BUCKET_NAME;

// async function createBucketIfNotExists() {
//   try {
//     const buckets = await s3.listBuckets().promise();
//     const exists = buckets.Buckets.some(bucket => bucket.Name === bucketName);

//     if (exists) {
//       console.log(`Bucket "${bucketName}" already exists.`);
//       return;
//     }

//     await s3.createBucket({
//       Bucket: bucketName,
//       ACL: 'public-read', // Bucket publicly readable
//       CreateBucketConfiguration: {
//         LocationConstraint: process.env.AWS_REGION,
//       },
//     }).promise();

//     console.log(`Bucket "${bucketName}" created successfully.`);
//   } catch (err) {
//     console.error("Error creating bucket:", err.message);
//   }
// }

// module.exports = { createBucketIfNotExists };
