// API base is same-origin when the Express server serves this page.
const API_BASE = "";
const form = document.querySelector("#search-form");
const keywordInput = document.querySelector("#keyword");
const domainSelect = document.querySelector("#domain");
const list = document.querySelector("#internship-list");
const count = document.querySelector("#results-count");
const status = document.querySelector("#form-status");
const resetButton = document.querySelector("#reset-btn");
const applicationForm = document.querySelector("#application-form");
const applicationSelect = document.querySelector("#application-internship");
const applicationStatus = document.querySelector("#application-status");
const applicationSubmit = document.querySelector("#application-submit");
let internships = [];
let isLoading = false;

function showLoading() {
  list.replaceChildren();
  const loading = document.createElement("div");
  loading.className = "loading-state";
  loading.textContent = "Loading internships…";
  list.append(loading);
  list.setAttribute("aria-busy", "true");
  count.textContent = "Loading listings…";
}

function showState(kind, heading, message) {
  const state = document.createElement("div");
  state.className = kind === "error" ? "error-state" : "empty-state";
  const icon = document.createElement("div");
  icon.className = "state-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = kind === "error" ? "!" : "⌕";
  const title = document.createElement("h3");
  title.textContent = heading;
  const copy = document.createElement("p");
  copy.textContent = message;
  state.append(icon, title, copy);
  if (kind === "empty") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "reset-btn";
    button.textContent = "Clear filters";
    button.addEventListener("click", resetFilters);
    state.append(button);
  }
  if (kind === "error") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "retry-btn";
    button.textContent = "Try again";
    button.addEventListener("click", loadInternships);
    state.append(button);
  }
  list.append(state);
}

function makeCard(job) {
  const article = document.createElement("article");
  article.className = "card";
  const top = document.createElement("div");
  top.className = "card-top";
  const logo = document.createElement("div");
  logo.className = "company-icon";
  logo.setAttribute("aria-hidden", "true");
  logo.textContent = job.title.split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase();
  const type = document.createElement("span");
  type.className = "type-pill";
  type.textContent = job.mode;
  top.append(logo, type);

  const title = document.createElement("h3");
  title.textContent = job.title;
  const company = document.createElement("div");
  company.className = "company";
  company.textContent = `Internship ID: ${job.id}`;

  const details = document.createElement("div");
  details.className = "details";
  [`ID: ${job.id}`, job.location, job.domain, `${job.openings} opening${job.openings === 1 ? "" : "s"}`].forEach(value => {
    const item = document.createElement("span");
    item.textContent = value;
    details.append(item);
  });

  const tags = document.createElement("div");
  tags.className = "tags";
  (job.skills || []).forEach(skill => {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = skill;
    tags.append(tag);
  });

  const bottom = document.createElement("div");
  bottom.className = "card-bottom";
  const openings = document.createElement("span");
  openings.className = "stipend";
  openings.textContent = `${job.openings} opening${job.openings === 1 ? "" : "s"}`;
  const link = document.createElement("a");
  link.className = "apply-link";
  link.href = "#application-section";
  link.textContent = "Apply";
  link.setAttribute("aria-label", `Apply for ${job.title}, internship ID ${job.id}`);
  link.addEventListener("click", () => {
    applicationSelect.value = job.id;
    window.setTimeout(() => document.querySelector("#applicant-name").focus(), 0);
  });
  bottom.append(openings, link);
  article.append(top, title, company, details, tags, bottom);
  return article;
}

function render(jobs) {
  list.replaceChildren();
  list.setAttribute("aria-busy", "false");
  if (!Array.isArray(jobs)) {
    count.textContent = "Listings could not be loaded";
    showState("error", "Something went wrong", "We couldn't display the internships. Check that the API is running, then try again.");
    status.textContent = "Error: internship data is unavailable.";
    return;
  }
  if (jobs.length === 0) {
    count.textContent = "No internships found";
    showState("empty", "No matches just yet", "Try a different keyword or choose another domain to see more opportunities.");
    status.textContent = "No results. Adjust your search or clear the filters.";
    return;
  }
  jobs.forEach(job => list.append(makeCard(job)));
  count.textContent = `Showing ${jobs.length} of ${internships.length} internships`;
  status.textContent = "Results updated. Use Tab to move through the Apply buttons.";
}

function applyFilters(event) {
  if (event) event.preventDefault();
  const keyword = keywordInput.value.trim().toLocaleLowerCase();
  const domain = domainSelect.value;
  const filtered = internships.filter(job => {
    const searchable = [job.id, job.title, job.domain, job.mode, job.location, String(job.openings), ...(job.skills || [])].join(" ").toLocaleLowerCase();
    return (!keyword || searchable.includes(keyword)) && (domain === "all" || job.domain === domain);
  });
  render(filtered);
}

function resetFilters() {
  keywordInput.value = "";
  domainSelect.value = "all";
  render(internships);
  keywordInput.focus();
}

async function requestWithRetry(url, options = {}, attempts = 2) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url, { ...options, headers: { Accept: "application/json", ...(options.headers || {}) } });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const error = new Error(payload?.error?.message || `Request failed (${response.status})`);
        error.status = response.status;
        // Do not retry client errors such as validation failures or rate limiting.
        if (response.status < 500) throw error;
        throw error;
      }
      if (response.status === 204) return null;
      return await response.json();
    } catch (error) {
      lastError = error;
      if (error.status && error.status < 500) throw error;
      if (attempt + 1 < attempts) await new Promise(resolve => setTimeout(resolve, 350 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function loadInternships() {
  if (isLoading) return;
  isLoading = true;
  showLoading();
  status.textContent = "Connecting to the internship service…";
  try {
    const payload = await requestWithRetry(`${API_BASE}/api/internships?page=1&limit=100`);
    if (!payload || !Array.isArray(payload.data)) throw new Error("The API returned an unexpected response.");
    internships = payload.data;
    const domains = [...new Set(internships.map(job => job.domain))].sort();
    const selected = domainSelect.value;
    domainSelect.replaceChildren(new Option("All domains", "all"));
    domains.forEach(domain => domainSelect.add(new Option(domain, domain)));
    domainSelect.value = domains.includes(selected) ? selected : "all";
    applicationSelect.replaceChildren(new Option("Choose an internship", ""));
    internships.forEach(job => {
      const option = new Option(`${job.title} (${job.id})`, job.id);
      if (job.applications_open === false) option.disabled = true;
      applicationSelect.add(option);
    });
    applyFilters();
  } catch (error) {
    list.replaceChildren();
    list.setAttribute("aria-busy", "false");
    count.textContent = "Listings unavailable";
    showState("error", "We couldn't connect", error.message || "The API may be unavailable. Please try again.");
    status.textContent = "Could not load internship data.";
  } finally {
    isLoading = false;
  }
}

applicationForm.addEventListener("submit", async event => {
  event.preventDefault();
  applicationStatus.className = "status";
  applicationStatus.textContent = "";
  if (!applicationForm.reportValidity()) return;
  const data = new FormData(applicationForm);
  const body = {
    name: String(data.get("name") || "").trim(),
    email: String(data.get("email") || "").trim(),
    internshipId: String(data.get("internshipId") || ""),
    resumeUrl: String(data.get("resumeUrl") || "").trim() || undefined
  };
  applicationSubmit.disabled = true;
  applicationSubmit.textContent = "Submitting…";
  applicationStatus.textContent = "Submitting your application…";
  try {
    const result = await requestWithRetry(`${API_BASE}/api/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }, 1);
    applicationStatus.className = "status success";
    applicationStatus.textContent = `Application received. Reference: ${result.data.id}`;
    applicationForm.reset();
  } catch (error) {
    applicationStatus.className = "status failure";
    applicationStatus.textContent = error.message || "Application could not be submitted. Please try again.";
  } finally {
    applicationSubmit.disabled = false;
    applicationSubmit.textContent = "Submit application";
  }
});

form.addEventListener("submit", applyFilters);
keywordInput.addEventListener("input", applyFilters);
domainSelect.addEventListener("change", applyFilters);
resetButton.addEventListener("click", resetFilters);
loadInternships();
resetButton.addEventListener("click", resetFilters);
loadInternships();
