const s3 = require('../config/aws_config');
const bucketName = process.env.AWS_BUCKET_NAME;

// Upload file (Already there)
async function uploadFileToS3(file) {
  const params = {
    Bucket: bucketName,
    Key: `uploads/${Date.now()}-${file.originalname}`,
    Body: file.buffer,
    ContentType: file.mimetype,
    // ACL: 'public-read',
  };

  const data = await s3.upload(params).promise();
  return data.Location;
}

// Delete file
async function deleteFileFromS3(fileUrl) {
  console.log("checkpoint 3");
  if (!fileUrl) return;
  
  const key = getFileKeyFromUrl(fileUrl);
  if (!key) return;

  const params = {
    Bucket: bucketName,
    Key: key,
  };

  await s3.deleteObject(params).promise();
}

// Helper: Extract file key from full URL
function getFileKeyFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return decodeURIComponent(urlObj.pathname).substring(1); // remove leading "/"
  } catch (err) {
    console.error('Invalid file URL:', url);
    return null;
  }
}

module.exports = { uploadFileToS3, deleteFileFromS3 };
