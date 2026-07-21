const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const url = require('url');

const APP_ID = 'd3b0jjr2gwui4f';
const BRANCH_NAME = 'staging';
const ZIP_FILE_PATH = path.join(__dirname, 'deploy.zip');

function log(msg) {
  console.log(`[Deploy] ${msg}`);
}

async function run() {
  try {
    // 1. Compress files to deploy.zip using tar
    log('Compressing build output...');
    if (fs.existsSync(ZIP_FILE_PATH)) {
      fs.unlinkSync(ZIP_FILE_PATH);
    }
    execSync('tar -a -c -f deploy.zip index.html menu.html style.css script.js assets', { stdio: 'inherit' });

    // 2. Create Amplify Deployment
    log('Creating Amplify deployment...');
    const createResRaw = execSync(`aws amplify create-deployment --app-id ${APP_ID} --branch-name ${BRANCH_NAME}`, { encoding: 'utf8' });
    const createRes = JSON.parse(createResRaw);
    
    const jobId = createRes.jobId;
    const zipUploadUrl = createRes.zipUploadUrl;
    
    if (!jobId || !zipUploadUrl) {
      throw new Error('Failed to obtain jobId or zipUploadUrl from AWS Amplify');
    }
    
    log(`Deployment created. Job ID: ${jobId}`);

    // 3. Upload zip file to pre-signed S3 URL
    log('Uploading zip archive to AWS S3...');
    const zipData = fs.readFileSync(ZIP_FILE_PATH);
    await uploadZip(zipUploadUrl, zipData);
    log('Upload completed successfully!');

    // 4. Start Amplify Deployment
    log('Starting Amplify deployment job...');
    const startResRaw = execSync(`aws amplify start-deployment --app-id ${APP_ID} --branch-name ${BRANCH_NAME} --job-id ${jobId}`, { encoding: 'utf8' });
    const startRes = JSON.parse(startResRaw);
    
    log('Deployment started successfully!');
    log(`Status: ${startRes.jobSummary.status}`);
    log('Your changes will be live on AWS Amplify in a few seconds!');
    
    // Clean up
    if (fs.existsSync(ZIP_FILE_PATH)) {
      fs.unlinkSync(ZIP_FILE_PATH);
    }
  } catch (error) {
    console.error('Deployment failed:', error);
    process.exit(1);
  }
}

function uploadZip(uploadUrl, data) {
  return new Promise((resolve, reject) => {
    const parsedUrl = url.parse(uploadUrl);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.path,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/zip',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        resolve();
      } else {
        reject(new Error(`S3 upload failed with status code ${res.statusCode}`));
      }
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(data);
    req.end();
  });
}

run();
