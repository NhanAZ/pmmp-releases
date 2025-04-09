// Release Detail Modal functionality

// Create modal HTML and append to the body
function createModal() {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'releaseDetailModal';
    modal.tabIndex = '-1';
    modal.setAttribute('aria-labelledby', 'releaseDetailModalLabel');
    modal.setAttribute('aria-hidden', 'true');
    
    modal.innerHTML = `
        <div class="modal-dialog modal-lg modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="releaseDetailModalLabel">Release Details</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <div>
                            <span class="badge rounded-pill bg-version me-2">v0.0.0</span>
                            <span class="badge rounded-pill bg-mc-version me-2">MC 0.0.0</span>
                            <span class="badge rounded-pill bg-type">type</span>
                        </div>
                        <small class="text-muted release-date">Released on: Date</small>
                    </div>
                    <div class="release-content"></div>
                </div>
                <div class="modal-footer">
                    <a href="#" class="btn btn-primary download-btn" target="_blank">
                        <i class="fas fa-download me-1"></i> Download
                    </a>
                    <a href="#" class="btn btn-secondary github-btn" target="_blank">
                        <i class="fab fa-github me-1"></i> View on GitHub
                    </a>
                    <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Close</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    return new bootstrap.Modal(document.getElementById('releaseDetailModal'));
}

// Initialize modal when DOM is loaded
let releaseModal;
document.addEventListener('DOMContentLoaded', () => {
    releaseModal = createModal();
    
    // Add event delegation for release detail buttons
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('view-details') || 
            e.target.parentElement.classList.contains('view-details')) {
            
            e.preventDefault();
            const releaseCard = e.target.closest('.release-item');
            if (releaseCard) {
                const releaseTag = releaseCard.dataset.tag;
                showReleaseDetail(releaseTag);
            }
        }
    });
});

// Show release detail in modal
function showReleaseDetail(tagName) {
    // Find the release by tag name
    const release = allReleases.find(r => r.tag_name === tagName);
    if (!release) {
        console.error('Release not found:', tagName);
        return;
    }
    
    // Get elements
    const modalTitle = document.getElementById('releaseDetailModalLabel');
    const versionBadge = document.querySelector('#releaseDetailModal .bg-version');
    const mcVersionBadge = document.querySelector('#releaseDetailModal .bg-mc-version');
    const typeBadge = document.querySelector('#releaseDetailModal .bg-type');
    const releaseDate = document.querySelector('#releaseDetailModal .release-date');
    const releaseContent = document.querySelector('#releaseDetailModal .release-content');
    const downloadBtn = document.querySelector('#releaseDetailModal .download-btn');
    const githubBtn = document.querySelector('#releaseDetailModal .github-btn');
    
    // Set modal title
    modalTitle.textContent = release.name;
    
    // Set badges
    versionBadge.textContent = release.tag_name;
    
    // Get MC version
    const mcVersionMatch = release.body.match(/For Minecraft: Bedrock Edition (\d+\.\d+\.\d+)/i);
    const mcVersion = mcVersionMatch ? mcVersionMatch[1] : 'Unknown';
    mcVersionBadge.textContent = `MC ${mcVersion}`;
    
    // Set release type badge
    typeBadge.textContent = release.releaseType.charAt(0).toUpperCase() + release.releaseType.slice(1);
    typeBadge.className = `badge rounded-pill bg-type-${release.releaseType} bg-type`;
    
    // Set date
    const formattedDate = new Date(release.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    releaseDate.textContent = `Released on: ${formattedDate}`;
    
    // Set content
    releaseContent.innerHTML = marked.parse(release.body);
    
    // Set buttons
    githubBtn.href = release.html_url;
    
    // Find PHP download link
    const phpDownloadLink = release.assets.find(asset => 
        asset.name.includes('PocketMine-MP.phar') || 
        asset.name.endsWith('.phar')
    );
    
    if (phpDownloadLink) {
        downloadBtn.href = phpDownloadLink.browser_download_url;
        downloadBtn.style.display = 'inline-block';
    } else {
        downloadBtn.style.display = 'none';
    }
    
    // Show modal
    releaseModal.show();
}

// Expose the function globally
window.showReleaseDetail = showReleaseDetail; 