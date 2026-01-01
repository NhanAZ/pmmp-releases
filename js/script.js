// Global variables
let allReleases = [];
let filteredReleases = [];
let currentPage = 1;
let releasesPerPage = 10;
let mcVersions = new Set();
let viewMode = 'grid';

// DOM Elements
const searchInput = document.getElementById('search');
const mcVersionSelect = document.getElementById('mcVersion');
const releaseTypeSelect = document.getElementById('releaseType');
const resetFiltersBtn = document.getElementById('resetFilters');
const sortOrderSelect = document.getElementById('sortOrder');
const itemsPerPageSelect = document.getElementById('itemsPerPage');
const viewGridBtn = document.getElementById('viewGrid');
const viewListBtn = document.getElementById('viewList');
const releasesContainer = document.getElementById('releases');
const paginationContainer = document.getElementById('pagination');
const loadingIndicator = document.getElementById('loading');
const totalReleasesEl = document.getElementById('totalReleases');
const latestVersionEl = document.getElementById('latestVersion');
const latestMCVersionEl = document.getElementById('latestMCVersion');
const showingResultsEl = document.getElementById('showingResults');

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initialize);

// Initialize the application
async function initialize() {
    try {
        await fetchReleases();
        
        // Set initial values for controls
        itemsPerPageSelect.value = releasesPerPage.toString();
        
        setupEventListeners();
        extractMcVersions();
        populateMcVersionsDropdown();
        filterReleases();
    } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to initialize the application. Please check console for details.');
    }
}

// Fetch releases data
async function fetchReleases() {
    try {
        // Load the releases data from the JSON file (populated by GitHub Actions)
        const response = await fetch('data/releases.json');
        
        if (!response.ok) {
            throw new Error(`Failed to fetch releases data: ${response.status} ${response.statusText}`);
        }
        
        allReleases = await response.json();
        console.log(`Loaded ${allReleases.length} releases from data file`);
        
        // Update statistics
        totalReleasesEl.textContent = allReleases.length;
        
        if (allReleases.length > 0) {
            latestVersionEl.textContent = allReleases[0].tag_name;
            
            // Extract MC version - should already be in the processed data
            if (allReleases[0].mcVersion) {
                latestMCVersionEl.textContent = allReleases[0].mcVersion;
            } else {
                // Fallback to extracting from body if not already processed
                const mcVersionMatch = allReleases[0].body.match(/For Minecraft: Bedrock Edition (\d+\.\d+\.\d+)/i);
                if (mcVersionMatch && mcVersionMatch[1]) {
                    latestMCVersionEl.textContent = mcVersionMatch[1];
                }
            }
        }
    } catch (error) {
        console.error('Error fetching releases:', error);
        showError('Failed to fetch releases data. Make sure the GitHub Actions workflow has run to generate the data file.');
    } finally {
        // Hide loading indicator
        loadingIndicator.style.display = 'none';
    }
}

// Extract Minecraft versions from release bodies
function extractMcVersions() {
    allReleases.forEach(release => {
        // If the release already has a mcVersion property (from GitHub Actions processing),
        // use it; otherwise, extract it from the body
        if (release.mcVersion) {
            mcVersions.add(release.mcVersion);
        } else {
            const mcVersionMatch = release.body.match(/For Minecraft: Bedrock Edition (\d+\.\d+\.\d+)/i);
            if (mcVersionMatch && mcVersionMatch[1]) {
                mcVersions.add(mcVersionMatch[1]);
                release.mcVersion = mcVersionMatch[1];
            }
        }
        
        // If releaseType is not already set by GitHub Actions, determine it here
        if (!release.releaseType) {
            if (release.tag_name.includes('alpha')) {
                release.releaseType = 'alpha';
            } else if (release.tag_name.includes('beta')) {
                release.releaseType = 'beta';
            } else {
                release.releaseType = 'stable';
            }
        }
    });
}

// Populate Minecraft versions dropdown
function populateMcVersionsDropdown() {
    // Convert Set to Array and sort versions
    const sortedVersions = Array.from(mcVersions).sort((a, b) => {
        const partsA = a.split('.').map(Number);
        const partsB = b.split('.').map(Number);
        
        for (let i = 0; i < 3; i++) {
            if (partsA[i] !== partsB[i]) {
                return partsB[i] - partsA[i]; // Descending order (newest first)
            }
        }
        
        return 0;
    });
    
    // Add options to select
    sortedVersions.forEach(version => {
        const option = document.createElement('option');
        option.value = version;
        option.textContent = version;
        mcVersionSelect.appendChild(option);
    });
}

// Setup event listeners
function setupEventListeners() {
    // Filter events
    searchInput.addEventListener('input', debounce(filterReleases, 300));
    mcVersionSelect.addEventListener('change', filterReleases);
    releaseTypeSelect.addEventListener('change', filterReleases);
    resetFiltersBtn.addEventListener('click', resetFilters);
    sortOrderSelect.addEventListener('change', () => {
        sortReleases();
        displayReleases();
    });
    
    // Items per page event
    itemsPerPageSelect.addEventListener('change', () => {
        if (itemsPerPageSelect.value === 'custom') {
            // Ask for custom value
            const customValue = prompt('Enter number of releases per page (10-1000):', '50');
            
            if (customValue === null) {
                // If canceled, revert to previous value
                itemsPerPageSelect.value = releasesPerPage.toString();
                return;
            }
            
            // Parse and validate the input
            const parsedValue = parseInt(customValue);
            if (isNaN(parsedValue) || parsedValue < 1) {
                alert('Please enter a valid number greater than 0.');
                itemsPerPageSelect.value = releasesPerPage.toString();
                return;
            }
            
            // Apply the custom value
            releasesPerPage = parsedValue;
            
            // Add option to select if it doesn't exist
            let customOption = Array.from(itemsPerPageSelect.options).find(opt => opt.value === parsedValue.toString());
            if (!customOption) {
                customOption = document.createElement('option');
                customOption.value = parsedValue.toString();
                customOption.textContent = `${parsedValue} per page`;
                // Insert before the "All" option
                const allOption = Array.from(itemsPerPageSelect.options).find(opt => opt.value === '0');
                itemsPerPageSelect.insertBefore(customOption, allOption);
            }
            
            // Select the new custom option
            itemsPerPageSelect.value = parsedValue.toString();
        } else {
            // Normal case - parse the selected value
            releasesPerPage = parseInt(itemsPerPageSelect.value);
        }
        
        currentPage = 1; // Reset to first page when changing items per page
        displayReleases();
    });
    
    // View mode events
    viewGridBtn.addEventListener('click', () => changeViewMode('grid'));
    viewListBtn.addEventListener('click', () => changeViewMode('list'));
}

// Reset all filters
function resetFilters() {
    searchInput.value = '';
    mcVersionSelect.value = '';
    releaseTypeSelect.value = '';
    sortOrderSelect.value = 'newest';
    filterReleases();
}

// Filter releases based on search, MC version, and release type
function filterReleases() {
    const searchTerm = searchInput.value.toLowerCase();
    const selectedMcVersion = mcVersionSelect.value;
    const selectedReleaseType = releaseTypeSelect.value;
    
    filteredReleases = allReleases.filter(release => {
        // Text search (title, body, tag)
        const matchesSearch = searchTerm === '' || 
            release.name.toLowerCase().includes(searchTerm) || 
            release.body.toLowerCase().includes(searchTerm) ||
            release.tag_name.toLowerCase().includes(searchTerm);
        
        // MC version filter
        const matchesMcVersion = selectedMcVersion === '' || 
            release.mcVersion === selectedMcVersion;
        
        // Release type filter
        const matchesReleaseType = selectedReleaseType === '' || 
            release.releaseType === selectedReleaseType;
        
        return matchesSearch && matchesMcVersion && matchesReleaseType;
    });
    
    // Sort, reset to page 1, and display
    sortReleases();
    currentPage = 1;
    displayReleases();
}

// Sort releases based on selected sort order
function sortReleases() {
    const sortOrder = sortOrderSelect.value;
    
    filteredReleases.sort((a, b) => {
        const dateA = new Date(a.created_at);
        const dateB = new Date(b.created_at);
        
        if (sortOrder === 'newest') {
            return dateB - dateA;
        } else {
            return dateA - dateB;
        }
    });
}

// Display releases with pagination
function displayReleases() {
    // Update showing results text
    showingResultsEl.textContent = `Showing ${filteredReleases.length} of ${allReleases.length} releases`;
    
    // Clear releases container
    releasesContainer.innerHTML = '';
    
    // Get releases to display based on pagination setting
    let currentReleases;
    
    if (releasesPerPage === 0) {
        // Display all releases if "All" is selected
        currentReleases = filteredReleases;
    } else {
        // Calculate start and end indices for current page
        const startIndex = (currentPage - 1) * releasesPerPage;
        const endIndex = Math.min(startIndex + releasesPerPage, filteredReleases.length);
        
        // Get current page releases
        currentReleases = filteredReleases.slice(startIndex, endIndex);
    }
    
    // If no releases found
    if (currentReleases.length === 0) {
        const noResultsEl = document.createElement('div');
        noResultsEl.className = 'col-12 text-center py-5';
        noResultsEl.innerHTML = `
            <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i>
                No releases found matching your criteria. Try adjusting your filters.
            </div>
            <button class="btn btn-outline-secondary mt-3" onclick="resetFilters()">
                <i class="fas fa-undo me-2"></i>Reset Filters
            </button>
        `;
        releasesContainer.appendChild(noResultsEl);
    } else {
        // Add classes based on view mode
        releasesContainer.className = viewMode === 'list' ? 'list-view' : 'row g-4';
        
        // Create and append release cards
        currentReleases.forEach(release => {
            const releaseCard = createReleaseCard(release);
            releasesContainer.appendChild(releaseCard);
        });
    }
    
    // Update pagination (only if not showing all)
    if (releasesPerPage > 0) {
        updatePagination();
    } else {
        // Clear pagination when showing all
        paginationContainer.innerHTML = '';
    }
}

// Create a release card element
function createReleaseCard(release) {
    // Clone the template
    const template = document.getElementById('release-card-template');
    const releaseEl = template.content.cloneNode(true);
    
    // Get the root element and set data attribute for release tag
    const rootElement = releaseEl.querySelector('.release-item');
    rootElement.dataset.tag = release.tag_name;
    
    // Get MC version from the release object or body
    let mcVersion = release.mcVersion;
    if (!mcVersion) {
        const mcVersionMatch = release.body.match(/For Minecraft: Bedrock Edition (\d+\.\d+\.\d+)/i) || 
                                release.body.match(/For Minecraft: PE v?(\d+\.\d+\.\d+)/i) ||
                                release.body.match(/For Minecraft: PE(?: alpha)? v?(\d+\.\d+\.\d+)/i);
        mcVersion = mcVersionMatch ? mcVersionMatch[1] : 'Unknown';
    }
    
    // Get creation date
    const releaseDate = new Date(release.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
    
    // Find the PHP download link
    const phpDownloadLink = release.assets.find(asset => 
        asset.name.includes('PocketMine-MP.phar') || 
        asset.name.endsWith('.phar')
    );
    
    // Set release version badge
    const versionBadge = releaseEl.querySelector('.bg-version');
    versionBadge.textContent = release.tag_name;
    
    // Set MC version badge
    const mcVersionBadge = releaseEl.querySelector('.bg-mc-version');
    mcVersionBadge.textContent = `MC ${mcVersion}`;
    
    // Set release type badge
    const typeBadge = releaseEl.querySelector('.bg-type');
    typeBadge.textContent = release.releaseType.charAt(0).toUpperCase() + release.releaseType.slice(1);
    typeBadge.classList.add(`bg-type-${release.releaseType}`);
    
    // Set title
    releaseEl.querySelector('.release-title').textContent = release.name;
    
    // Set release date
    releaseEl.querySelector('.release-date').textContent = `Released on: ${releaseDate}`;
    
    // Set body - limit to first few paragraphs
    const bodyElement = releaseEl.querySelector('.release-body');
    
    // Split by double newline to get paragraphs
    const paragraphs = release.body.split('\n\n');
    // Take only first 2 paragraphs
    const limitedContent = paragraphs.slice(0, 2).join('\n\n');
    
    bodyElement.innerHTML = marked.parse(limitedContent);
    
    // Set links
    const detailsLink = releaseEl.querySelector('.view-details');
    detailsLink.href = `#release-${release.tag_name}`;
    detailsLink.setAttribute('data-tag', release.tag_name);
    
    const downloadLink = releaseEl.querySelector('.download');
    if (phpDownloadLink) {
        downloadLink.href = phpDownloadLink.browser_download_url;
    } else {
        downloadLink.href = release.html_url;
    }
    
    return releaseEl.firstElementChild;
}

// Update pagination controls
function updatePagination() {
    paginationContainer.innerHTML = '';
    
    // If showing all, don't show pagination
    if (releasesPerPage === 0) {
        return;
    }
    
    const totalPages = Math.ceil(filteredReleases.length / releasesPerPage);
    
    if (totalPages <= 1) {
        return;
    }
    
    const paginationNav = document.createElement('nav');
    paginationNav.setAttribute('aria-label', 'Releases pagination');
    
    const paginationList = document.createElement('ul');
    paginationList.className = 'pagination';
    
    // First page button
    const firstItem = document.createElement('li');
    firstItem.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
    
    const firstLink = document.createElement('a');
    firstLink.className = 'page-link';
    firstLink.href = '#';
    firstLink.innerHTML = '&laquo;&laquo;';
    firstLink.setAttribute('aria-label', 'First');
    firstLink.setAttribute('title', 'First Page');
    
    if (currentPage > 1) {
        firstLink.addEventListener('click', (e) => {
            e.preventDefault();
            currentPage = 1;
            displayReleases();
            window.scrollTo(0, 0);
        });
    }
    
    firstItem.appendChild(firstLink);
    paginationList.appendChild(firstItem);
    
    // Previous button
    const prevItem = document.createElement('li');
    prevItem.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
    
    const prevLink = document.createElement('a');
    prevLink.className = 'page-link';
    prevLink.href = '#';
    prevLink.innerHTML = '&laquo;';
    prevLink.setAttribute('aria-label', 'Previous');
    
    if (currentPage > 1) {
        prevLink.addEventListener('click', (e) => {
            e.preventDefault();
            currentPage--;
            displayReleases();
            window.scrollTo(0, 0);
        });
    }
    
    prevItem.appendChild(prevLink);
    paginationList.appendChild(prevItem);
    
    // Page numbers
    const displayPages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(displayPages / 2));
    let endPage = Math.min(totalPages, startPage + displayPages - 1);
    
    if (endPage - startPage + 1 < displayPages) {
        startPage = Math.max(1, endPage - displayPages + 1);
    }
    
    // Add first page number with ellipsis if not starting from page 1
    if (startPage > 1) {
        const firstPageItem = document.createElement('li');
        firstPageItem.className = 'page-item';
        
        const firstPageLink = document.createElement('a');
        firstPageLink.className = 'page-link';
        firstPageLink.href = '#';
        firstPageLink.textContent = '1';
        
        firstPageLink.addEventListener('click', (e) => {
            e.preventDefault();
            currentPage = 1;
            displayReleases();
            window.scrollTo(0, 0);
        });
        
        firstPageItem.appendChild(firstPageLink);
        paginationList.appendChild(firstPageItem);
        
        if (startPage > 2) {
            const ellipsisItem = document.createElement('li');
            ellipsisItem.className = 'page-item disabled';
            
            const ellipsisSpan = document.createElement('span');
            ellipsisSpan.className = 'page-link';
            ellipsisSpan.innerHTML = '&hellip;';
            
            ellipsisItem.appendChild(ellipsisSpan);
            paginationList.appendChild(ellipsisItem);
        }
    }
    
    // Regular page numbers
    for (let i = startPage; i <= endPage; i++) {
        const pageItem = document.createElement('li');
        pageItem.className = `page-item ${i === currentPage ? 'active' : ''}`;
        
        const pageLink = document.createElement('a');
        pageLink.className = 'page-link';
        pageLink.href = '#';
        pageLink.textContent = i;
        
        if (i !== currentPage) {
            pageLink.addEventListener('click', (e) => {
                e.preventDefault();
                currentPage = i;
                displayReleases();
                window.scrollTo(0, 0);
            });
        }
        
        pageItem.appendChild(pageLink);
        paginationList.appendChild(pageItem);
    }
    
    // Add last page number with ellipsis if not ending at last page
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const ellipsisItem = document.createElement('li');
            ellipsisItem.className = 'page-item disabled';
            
            const ellipsisSpan = document.createElement('span');
            ellipsisSpan.className = 'page-link';
            ellipsisSpan.innerHTML = '&hellip;';
            
            ellipsisItem.appendChild(ellipsisSpan);
            paginationList.appendChild(ellipsisItem);
        }
        
        const lastPageItem = document.createElement('li');
        lastPageItem.className = 'page-item';
        
        const lastPageLink = document.createElement('a');
        lastPageLink.className = 'page-link';
        lastPageLink.href = '#';
        lastPageLink.textContent = totalPages;
        
        lastPageLink.addEventListener('click', (e) => {
            e.preventDefault();
            currentPage = totalPages;
            displayReleases();
            window.scrollTo(0, 0);
        });
        
        lastPageItem.appendChild(lastPageLink);
        paginationList.appendChild(lastPageItem);
    }
    
    // Next button
    const nextItem = document.createElement('li');
    nextItem.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
    
    const nextLink = document.createElement('a');
    nextLink.className = 'page-link';
    nextLink.href = '#';
    nextLink.innerHTML = '&raquo;';
    nextLink.setAttribute('aria-label', 'Next');
    
    if (currentPage < totalPages) {
        nextLink.addEventListener('click', (e) => {
            e.preventDefault();
            currentPage++;
            displayReleases();
            window.scrollTo(0, 0);
        });
    }
    
    nextItem.appendChild(nextLink);
    paginationList.appendChild(nextItem);
    
    // Last page button
    const lastItem = document.createElement('li');
    lastItem.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
    
    const lastLink = document.createElement('a');
    lastLink.className = 'page-link';
    lastLink.href = '#';
    lastLink.innerHTML = '&raquo;&raquo;';
    lastLink.setAttribute('aria-label', 'Last');
    lastLink.setAttribute('title', 'Last Page');
    
    if (currentPage < totalPages) {
        lastLink.addEventListener('click', (e) => {
            e.preventDefault();
            currentPage = totalPages;
            displayReleases();
            window.scrollTo(0, 0);
        });
    }
    
    lastItem.appendChild(lastLink);
    paginationList.appendChild(lastItem);
    
    // Go to page input
    const goToPageItem = document.createElement('li');
    goToPageItem.className = 'page-item ms-2';
    
    const goToPageInput = document.createElement('div');
    goToPageInput.className = 'd-flex align-items-center';
    goToPageInput.innerHTML = `
        <input type="number" class="form-control form-control-sm goto-page-input" min="1" max="${totalPages}" 
               value="${currentPage}" style="width: 60px;"> 
        <button class="btn btn-sm btn-secondary goto-page-btn ms-1">Go</button>
    `;
    
    goToPageItem.appendChild(goToPageInput);
    paginationList.appendChild(goToPageItem);
    
    // Add event listener to Go button
    paginationNav.appendChild(paginationList);
    paginationContainer.appendChild(paginationNav);
    
    // Add event listener for the Go button
    const gotoBtn = paginationContainer.querySelector('.goto-page-btn');
    const gotoInput = paginationContainer.querySelector('.goto-page-input');
    
    gotoBtn.addEventListener('click', () => {
        const page = parseInt(gotoInput.value);
        if (!isNaN(page) && page >= 1 && page <= totalPages) {
            currentPage = page;
            displayReleases();
            window.scrollTo(0, 0);
        } else {
            alert(`Please enter a valid page number between 1 and ${totalPages}`);
            gotoInput.value = currentPage;
        }
    });
    
    // Add event listener for Enter key in the input
    gotoInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            gotoBtn.click();
        }
    });
}

// Change view mode (grid or list)
function changeViewMode(mode) {
    viewMode = mode;
    
    // Update active class on buttons
    if (mode === 'grid') {
        viewGridBtn.classList.add('active');
        viewListBtn.classList.remove('active');
    } else {
        viewGridBtn.classList.remove('active');
        viewListBtn.classList.add('active');
    }
    
    // Redisplay releases
    displayReleases();
}

// Show error message
function showError(message) {
    loadingIndicator.style.display = 'none';
    
    const errorEl = document.createElement('div');
    errorEl.className = 'alert alert-danger fade-in';
    errorEl.innerHTML = `
        <i class="fas fa-exclamation-triangle me-2"></i>
        ${message}
    `;
    
    releasesContainer.innerHTML = '';
    releasesContainer.appendChild(errorEl);
}

// Utility function: Debounce
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Make allReleases available globally for the detail view
window.allReleases = allReleases; 