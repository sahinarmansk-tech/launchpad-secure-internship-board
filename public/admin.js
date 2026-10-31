const keyInput = document.getElementById("adminKey");
const message = document.getElementById("message");
const count = document.getElementById("count");
const keyInput = document.getElementById("adminKey");
const message = document.getElementById("message");
const count = document.getElementById("count");
const tbody = document.getElementById("applications");
const emptyMessage = document.getElementById("emptyMessage");
const loadButton = document.getElementById("loadButton");

document.getElementById("accessForm")
  .addEventListener("submit", async (event) => {
    event.preventDefault();

    const key = keyInput.value.trim();
    tbody.replaceChildren();
    count.textContent = "Not loaded";

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
      message.textContent = "Applications loaded successfully.";
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
    message.textContent = "Cleared.";
    emptyMessage.hidden = false;
    emptyMessage.textContent =
      "Enter your admin key above to load applications.";
  });
