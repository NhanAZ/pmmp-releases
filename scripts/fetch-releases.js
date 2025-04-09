const fs = require('fs');
const path = require('path');
const https = require('https');

// Function to make a GET request to the GitHub API
function fetchGitHubAPI(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'PMMP-Releases-Generator',
        // Add a GitHub token if you have one to avoid rate limits
        // 'Authorization': 'token YOUR_GITHUB_TOKEN'
      }
    };

    https.get(url, options, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`API request failed with status ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(new Error('Failed to parse API response'));
        }
      });
    }).on('error', reject);
  });
}

async function fetchAllReleases() {
  const owner = 'pmmp';
  const repo = 'PocketMine-MP';
  const perPage = 100;
  const maxPages = 10; // Fetch up to 1000 releases instead of 500
  
  let allReleases = [];
  let page = 1;
  let hasMoreReleases = true;
  
  console.log('Starting to fetch PocketMine-MP releases...');
  
  while (hasMoreReleases && page <= maxPages) {
    console.log(`Fetching page ${page}...`);
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/releases?per_page=${perPage}&page=${page}`;
      const releases = await fetchGitHubAPI(url);
      
      console.log(`Fetched ${releases.length} releases from page ${page}`);
      
      if (releases.length === 0) {
        hasMoreReleases = false;
      } else {
        allReleases = allReleases.concat(releases);
        if (releases.length < perPage) {
          hasMoreReleases = false;
        }
      }
      
      page++;
      
      // Add a small delay to avoid hitting rate limits
      if (hasMoreReleases) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`Error fetching page ${page}:`, error);
      hasMoreReleases = false;
    }
  }
  
  console.log(`Total releases fetched: ${allReleases.length}`);
  if (allReleases.length > 0) {
    console.log(`First release: ${allReleases[0]?.tag_name}, Last release: ${allReleases[allReleases.length-1]?.tag_name}`);
  }
  
  return allReleases;
}

async function processAndSaveReleases() {
  try {
    const allReleases = await fetchAllReleases();
    
    // Process releases to add additional properties
    const processedReleases = allReleases.map(release => {
      // Extract Minecraft version from the release body
      const mcVersionMatch = release.body && release.body.match(/For Minecraft: Bedrock Edition (\d+\.\d+\.\d+)/i);
      let mcVersion = null;
      if (mcVersionMatch && mcVersionMatch[1]) {
        mcVersion = mcVersionMatch[1];
      }
      
      // Determine release type based on tag
      let releaseType = 'stable';
      if (release.tag_name.includes('alpha')) {
        releaseType = 'alpha';
      } else if (release.tag_name.includes('beta')) {
        releaseType = 'beta';
      }
      
      // Keep only essential data to reduce file size
      return {
        url: release.url,
        html_url: release.html_url,
        id: release.id,
        tag_name: release.tag_name,
        name: release.name || release.tag_name,
        body: release.body || '',
        created_at: release.created_at,
        assets: (release.assets || []).map(asset => ({
          name: asset.name,
          browser_download_url: asset.browser_download_url
        })),
        mcVersion: mcVersion,
        releaseType: releaseType
      };
    });
    
    // Log some release info for debugging
    if (processedReleases.length > 0) {
      console.log('Sample of releases that will be saved:');
      for (let i = 0; i < Math.min(5, processedReleases.length); i++) {
        console.log(`- ${processedReleases[i].tag_name} (${processedReleases[i].releaseType}, MC ${processedReleases[i].mcVersion || 'unknown'})`);
      }
      console.log(`...and ${processedReleases.length - 5} more.`);
    }
    
    // Create directory if it doesn't exist
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Save to file
    const outputFile = path.join(dataDir, 'releases.json');
    fs.writeFileSync(outputFile, JSON.stringify(processedReleases, null, 2));
    
    console.log(`Releases data saved to ${outputFile} - contains ${processedReleases.length} releases`);
    
    // Create summary with stats
    const mcVersions = new Set();
    processedReleases.forEach(release => {
      if (release.mcVersion) {
        mcVersions.add(release.mcVersion);
      }
    });
    
    const stableReleases = processedReleases.filter(r => r.releaseType === 'stable').length;
    const betaReleases = processedReleases.filter(r => r.releaseType === 'beta').length;
    const alphaReleases = processedReleases.filter(r => r.releaseType === 'alpha').length;
    
    const summary = `
    # PocketMine-MP Releases Summary
    
    **Total Releases:** ${processedReleases.length}
    
    ## Release Types
    - Stable: ${stableReleases}
    - Beta: ${betaReleases}
    - Alpha: ${alphaReleases}
    
    ## Minecraft Versions
    ${Array.from(mcVersions).sort().map(v => `- ${v}`).join('\n')}
    
    _Last updated: ${new Date().toISOString()}_
    `;
    
    fs.writeFileSync(path.join(dataDir, 'summary.md'), summary);
    console.log('Summary file created successfully');
  } catch (error) {
    console.error('Error processing releases:', error);
  }
}

// Run the script
processAndSaveReleases(); 