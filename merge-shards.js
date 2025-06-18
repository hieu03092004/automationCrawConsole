const fs = require('fs');
const path = require('path');

async function mergeShards() {
  const reportDir = './report';
  const shardFiles = fs.readdirSync(reportDir)
    .filter(file => file.startsWith('project-shard-') && file.endsWith('.json'));

  if (shardFiles.length === 0) {
    console.error('No shard files found to merge');
    process.exit(1);
  }

  // Read the first shard to get project metadata
  const firstShard = JSON.parse(fs.readFileSync(path.join(reportDir, shardFiles[0])));
  const mergedReport = {
    projectName: firstShard.projectName,
    buildNumber: firstShard.buildNumber,
    'items-object': {}
  };

  // Merge all shards
  for (const shardFile of shardFiles) {
    const shardData = JSON.parse(fs.readFileSync(path.join(reportDir, shardFile)));
    Object.assign(mergedReport['items-object'], shardData['items-object']);
  }

  // Write merged report
  const outputPath = path.join(reportDir, 'project.json');
  fs.writeFileSync(outputPath, JSON.stringify(mergedReport, null, 2));
  console.log(`Successfully merged ${shardFiles.length} shards into ${outputPath}`);
}

mergeShards().catch(console.error); 