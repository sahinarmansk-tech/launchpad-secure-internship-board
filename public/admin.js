const keyInput = document.getElementById("adminKey");
const message = document.getElementById("message");
const count = document.getElementById("count");
const tbody = document.getElementById("applications");
const emptyMessage = document.getElementById("emptyMessage");
const loadButton = document.getElementById("loadButton");
const totalApplications = document.getElementById("totalApplications");
const totalInternships = document.getElementById("totalInternships");
const openInternships = document.getElementById("openInternships");

function clearStats() {
  totalApplications.textContent = "—";
  totalInternships.textContent = "—";
  openInternships.textContent = "—";
}
document.getElementById("accessForm")
  .addEventListener("submit", async (event) => {
    event.preventDefault();

    const key = keyInput.value.trim();
    tbody.replaceChildren();
    count.textContent = "Not loaded";
    clearStats();

    if (!key) {
      message.textContent = "Please enter your admin key.";
      return;
    }

    message.textContent = "Loading applications...";
    loadButton.disabled = true;

    try {
      const response = await fetch("/api/admin/applications", {
        headers: { Authorization: "Bearer " + key },
        cache: "no-store"
      });

      if (!response.ok) {
        message.textContent = response.status === 401
          ? "Invalid admin key."
          : "Unable to load applications (HTTP " +
            response.status + ").";
        emptyMessage.hidden = false;
        return;
      }

      const result = await response.json();
      const applications = result.data || [];

      for (const item of applications) {
        const row = document.createElement("tr");

        for (const value of [
          item.id,
          item.name,
          item.email,
          item.internship_title || item.internship_id
        ]) {
          const cell = document.createElement("td");
          cell.textContent = value || "—";
          row.appendChild(cell);
        }

        const resumeCell = document.createElement("td");

        if (item.resume_url) {
          try {
            const url = new URL(item.resume_url);

            if (url.protocol === "https:" ||
                url.protocol === "http:") {
              const link = document.createElement("a");
              link.href = url.href;
              link.target = "_blank";
              link.rel = "noopener noreferrer";
              link.textContent = "View resume";
              resumeCell.appendChild(link);
            } else {
              resumeCell.textContent = "Unavailable";
            }
          } catch {
            resumeCell.textContent = "Unavailable";
          }
        } else {
          resumeCell.textContent = "—";
        }

        row.appendChild(resumeCell);
        tbody.appendChild(row);
      }

      count.textContent = applications.length + " applications";
      emptyMessage.hidden = applications.length > 0;
      emptyMessage.textContent = applications.length
        ? ""
        : "No applications have been submitted yet.";
      const statsResponse = await fetch("/api/admin/stats", {
  headers: { Authorization: "Bearer " + key },
  cache: "no-store"
});

if (statsResponse.ok) {
  const statsResult = await statsResponse.json();
  const stats = statsResult.data;

  totalApplications.textContent = stats.totalApplications;
  totalInternships.textContent = stats.totalInternships;
  openInternships.textContent = stats.openInternships;

  message.textContent = "Dashboard loaded successfully.";
} else {
  message.textContent =
    "Applications loaded, but statistics could not be retrieved.";
}
    } catch {
      message.textContent = "Network error. Please try again.";
      emptyMessage.hidden = false;
    } finally {
      loadButton.disabled = false;
    }
  });

document.getElementById("clearButton")
  .addEventListener("click", () => {
    keyInput.value = "";
    tbody.replaceChildren();
    count.textContent = "Not loaded";
    clearStats();
    message.textContent = "Cleared.";
    emptyMessage.hidden = false;
    emptyMessage.textContent =
      "Enter your admin key above to load applications.";
  });
