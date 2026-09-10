const AWS = require("aws-sdk");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const s3 = new AWS.S3();
const S3_BUCKET = "demobucketsumitchi";

module.exports = { s3, S3_BUCKET };
