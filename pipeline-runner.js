#!/usr/bin/env node
/**
 * PUIUX Pipeline Runner
 * 
 * Run complete pipelines (presales or delivery) with one command
 * 
 * Usage:
 *   node pipeline-runner.js --client=demo-acme --pipeline=presales
 *   node pipeline-runner.js --client=demo-acme --pipeline=delivery
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Pipeline definitions
const PIPELINES = {
  presales: ['PS0', 'PS1', 'PS2', 'PS3', 'PS4', 'PS5'],
  delivery: ['S2', 'S3']
};

async function runStage(client, stage) {
  console.log(`\n🚀 Running ${stage}...`);
  
  try {
    const { stdout, stderr } = await execPromise(
      `node orchestrator.js --client=${client} --stage=${stage}`
    );
    
    // Parse result
    const resultMatch = stdout.match(/ORCHESTRATOR RESULT[\s\S]*?({[\s\S]*?})\s*═/);
    if (resultMatch) {
      const result = JSON.parse(resultMatch[1]);
      
      if (result.status === 'success') {
        console.log(`✅ ${stage} completed successfully`);
        return { stage, status: 'success', result };
      } else if (result.status === 'blocked') {
        console.log(`⚠️  ${stage} blocked: ${result.reason}`);
        return { stage, status: 'blocked', reason: result.reason };
      } else {
        console.log(`❌ ${stage} failed`);
        return { stage, status: 'failed' };
      }
    }
    
    console.log(`✅ ${stage} completed`);
    return { stage, status: 'success' };
  } catch (error) {
    console.error(`❌ ${stage} failed:`, error.message);
    return { stage, status: 'failed', error: error.message };
  }
}

async function runPipeline(client, pipelineName) {
  const stages = PIPELINES[pipelineName];
  
  if (!stages) {
    console.error(`❌ Unknown pipeline: ${pipelineName}`);
    console.error(`Available pipelines: ${Object.keys(PIPELINES).join(', ')}`);
    process.exit(1);
  }

  console.log(`\n╔═══════════════════════════════════════════╗`);
  console.log(`║  PUIUX Pipeline Runner - ${pipelineName.toUpperCase()}        ║`);
  console.log(`╚═══════════════════════════════════════════╝`);
  console.log(`\nClient: ${client}`);
  console.log(`Stages: ${stages.join(' → ')}\n`);

  const results = [];
  let allSuccess = true;

  for (const stage of stages) {
    const result = await runStage(client, stage);
    results.push(result);

    if (result.status === 'blocked') {
      console.log(`\n⚠️  Pipeline blocked at ${stage}`);
      console.log(`Reason: ${result.reason}`);
      allSuccess = false;
      break;
    } else if (result.status === 'failed') {
      console.log(`\n❌ Pipeline failed at ${stage}`);
      allSuccess = false;
      break;
    }
  }

  // Summary
  console.log(`\n╔═══════════════════════════════════════════╗`);
  console.log(`║  Pipeline Summary                         ║`);
  console.log(`╚═══════════════════════════════════════════╝\n`);

  results.forEach(r => {
    const icon = r.status === 'success' ? '✅' : 
                 r.status === 'blocked' ? '⚠️ ' : '❌';
    console.log(`${icon} ${r.stage}: ${r.status}`);
  });

  console.log(`\nTotal: ${results.filter(r => r.status === 'success').length}/${results.length} stages completed`);

  if (allSuccess) {
    console.log(`\n✅ Pipeline completed successfully!\n`);
    process.exit(0);
  } else {
    console.log(`\n❌ Pipeline incomplete\n`);
    process.exit(1);
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const params = {};

  args.forEach(arg => {
    const [key, value] = arg.replace('--', '').split('=');
    params[key] = value;
  });

  if (!params.client || !params.pipeline) {
    console.error('Usage: node pipeline-runner.js --client=<slug> --pipeline=<presales|delivery>');
    process.exit(1);
  }

  await runPipeline(params.client, params.pipeline);
}

if (require.main === module) {
  main();
}

module.exports = { runPipeline, runStage };
