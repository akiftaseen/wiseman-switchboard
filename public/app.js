"use strict";

const serviceList = document.querySelector("#service-list");
const serviceSummary = document.querySelector("#service-summary");
const refreshButton = document.querySelector("#refresh");
const requestList = document.querySelector("#request-list");
const requestFeedback = document.querySelector("#request-feedback");
const openCount = document.querySelector("#open-count");
const form = document.querySelector("#request-form");
const formFeedback = document.querySelector("#form-feedback");
const serviceIcons = { email: "✉", vpn: "◇", "file-share": "▤" };
const dateFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});
let requests = [];

async function api(path, options) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "The request could not be completed.");
  return data;
}

function feedback(element, message, error = false) {
  element.textContent = message;
  element.dataset.error = String(error);
}

function statusPill(element, status) {
  element.textContent = status;
  element.dataset.state = status;
}

async function loadServices() {
  refreshButton.disabled = true;
  feedback(serviceSummary, "Loading service statuses…");
  try {
    const services = await api("/api/services");
    const cards = services.map((service) => {
      const card = document.querySelector("#service-template").content.cloneNode(true);
      card.querySelector(".service-icon").textContent = serviceIcons[service.id];
      card.querySelector("h3").textContent = service.name;
      card.querySelector(".service-description").textContent = service.description;
      statusPill(card.querySelector(".service-status"), service.status);
      const time = card.querySelector("time");
      time.dateTime = service.checked_at;
      time.textContent = dateFormat.format(new Date(service.checked_at));
      return card;
    });
    serviceList.replaceChildren(...cards);
    const up = services.filter((service) => service.status === "Up").length;
    feedback(serviceSummary, `${up} of ${services.length} services up`);
  } catch (error) {
    serviceList.replaceChildren();
    feedback(serviceSummary, `${error.message} Use Refresh to try again.`, true);
  } finally {
    refreshButton.disabled = false;
  }
}

function renderRequests() {
  const count = requests.filter((request) => !request.resolved_at).length;
  openCount.hidden = false;
  openCount.textContent = `${count} open`;
  const items = requests.map((request) => {
    const item = document.querySelector("#request-template").content.cloneNode(true);
    item.querySelector("h3").textContent = `#${request.id} · ${request.issue_type}`;
    item.querySelector(".request-meta").textContent =
      `${request.name} · ${dateFormat.format(new Date(request.created_at))}`;
    item.querySelector(".request-description").textContent = request.description;
    statusPill(item.querySelector(".request-status"), request.resolved_at ? "Resolved" : "Open");

    const bottom = item.querySelector(".request-bottom");
    if (request.resolved_at) {
      bottom.textContent = `Resolved ${dateFormat.format(new Date(request.resolved_at))}`;
    } else {
      const button = document.createElement("button");
      button.className = "button button-secondary button-small";
      button.type = "button";
      button.textContent = "Mark resolved";
      button.setAttribute("aria-label", `Mark request ${request.id} resolved`);
      button.addEventListener("click", () => resolveRequest(request, button));
      bottom.append(button);
    }
    return item;
  });
  requestList.replaceChildren(...items);
}

async function resolveRequest(request, button) {
  button.disabled = true;
  try {
    const updated = await api(`/api/requests/${request.id}/resolve`, { method: "PATCH" });
    requests = requests.map((item) => item.id === updated.id ? updated : item);
    renderRequests();
    feedback(requestFeedback, `Request #${updated.id} resolved.`);
  } catch (error) {
    feedback(requestFeedback, error.message, true);
  } finally {
    button.disabled = false;
  }
}

async function loadRequests() {
  try {
    requests = await api("/api/requests");
    renderRequests();
    feedback(requestFeedback, requests.length ? "" : "No requests yet. Submitted issues will appear here.");
  } catch (error) {
    feedback(requestFeedback, `${error.message} Reload the page to try again.`, true);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("button");
  button.disabled = true;
  feedback(formFeedback, "Saving…");
  try {
    await initialRequests;
    const saved = await api("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    form.reset();
    requests = [saved, ...requests];
    renderRequests();
    feedback(requestFeedback, "");
    feedback(formFeedback, `Request #${saved.id} submitted.`);
  } catch (error) {
    feedback(formFeedback, error.message, true);
  } finally {
    button.disabled = false;
  }
});

refreshButton.addEventListener("click", loadServices);
loadServices();
const initialRequests = loadRequests();
