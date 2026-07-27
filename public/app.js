let csrf = "";
let activeRoles = [];
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);

async function api(path, options = {}) {
  const headers = { ...(csrf ? { "x-csrf-token": csrf } : {}), ...options.headers };
  if (!(options.body instanceof FormData)) headers["content-type"] = "application/json";
  const response = await fetch(path, { ...options, headers });
  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) throw new Error("The application API is not available. Open the full demo server instead of the static preview.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

const roleOptions = ["employee", "manager", "hr", "owner", "tenant_admin"];
const roleChecks = (selected = []) => roleOptions.map((role) => `<label class="check"><input type="checkbox" name="roles" value="${role}" ${selected.includes(role) ? "checked" : ""}>${role.replace("_", " ")}</label>`).join("");

async function renderAdministration(container) {
  const [memberData, settings, auditData] = await Promise.all([api("/api/admin/members"), api("/api/admin/settings"), activeRoles.includes("tenant_admin") ? api("/api/audit") : Promise.resolve({ events: [] })]);
  container.innerHTML = `<h2>Tenant administration</h2>
    <p class="muted">This development preview accepts synthetic <code>.example.invalid</code> users only. Email delivery is disabled.</p>
    <div class="admin-grid">
      <section><h3>Workspace settings</h3><form id="settings-form" class="compact">
        <label>Company name<input name="name" value="${escapeHtml(settings.name)}" required></label>
        <label>IANA timezone<input name="timezone" value="${escapeHtml(settings.timezone)}" required></label>
        <label>Retention days<input name="retentionDays" type="number" min="30" max="3650" value="${settings.retentionDays}" required></label>
        <label>Reminder days<input name="reminderDays" value="${settings.reminderDays.join(", ")}" required></label>
        <label class="check"><input name="inAppNotifications" type="checkbox" ${settings.inAppNotifications ? "checked" : ""}>Enable in-app notifications</label>
        <button>Save settings</button><p class="form-status" role="status"></p>
      </form></section>
      <section><h3>Create synthetic user</h3><form id="member-form" class="compact">
        <label>Display name<input name="displayName" required maxlength="120"></label>
        <label>Work email<input name="email" type="email" placeholder="person@northstar.example.invalid" required></label>
        <label>Temporary password<input name="password" type="password" minlength="14" required></label>
        <fieldset><legend>Roles</legend><div class="role-grid">${roleChecks(["employee"])}</div></fieldset>
        <button>Create user</button><p class="form-status" role="status"></p>
      </form></section>
    </div>
    <h3>Users and roles</h3><div class="list">${memberData.members.map((member) => `<article class="item member ${member.deactivatedAt ? "inactive" : ""}">
      <div><strong>${escapeHtml(member.displayName)}</strong><br><span>${escapeHtml(member.email)}</span>${member.deactivatedAt ? "<br><em>Deactivated</em>" : ""}</div>
      ${member.deactivatedAt ? "" : `<form class="role-form compact" data-id="${member.membershipId}"><fieldset><legend class="sr-only">Roles for ${escapeHtml(member.displayName)}</legend><div class="role-grid">${roleChecks(member.roles)}</div></fieldset><div class="actions"><button>Update roles</button><button type="button" class="danger deactivate">Deactivate</button></div><p class="form-status" role="status"></p></form>`}
    </article>`).join("")}</div>${activeRoles.includes("tenant_admin") ? `<h3>Recent audit events</h3><div class="list">${auditData.events.map((event) => `<article class="item"><strong>${escapeHtml(event.action)}</strong><br>${escapeHtml(event.resourceType)} · ${new Date(event.occurredAt).toLocaleString()} · ${escapeHtml(event.outcome)}</article>`).join("") || "<p>No audit events.</p>"}</div>` : ""}`;

  $("#settings-form").onsubmit = async (event) => {
    event.preventDefault(); const form = event.currentTarget; const status = form.querySelector(".form-status"); status.textContent = "Saving…";
    try {
      const data = new FormData(form);
      await api("/api/admin/settings", { method: "PATCH", body: JSON.stringify({ name: data.get("name"), timezone: data.get("timezone"), retentionDays: Number(data.get("retentionDays")), reminderDays: String(data.get("reminderDays")).split(",").map((value) => Number(value.trim())), inAppNotifications: data.has("inAppNotifications") }) });
      status.textContent = "Settings saved.";
    } catch (error) { status.textContent = error.message; status.classList.add("error"); }
  };
  $("#member-form").onsubmit = async (event) => {
    event.preventDefault(); const form = event.currentTarget; const status = form.querySelector(".form-status"); status.textContent = "Creating…";
    try {
      const data = new FormData(form); await api("/api/admin/members", { method: "POST", body: JSON.stringify({ displayName: data.get("displayName"), email: data.get("email"), password: data.get("password"), roles: data.getAll("roles") }) });
      await renderAdministration(container);
    } catch (error) { status.textContent = error.message; status.classList.add("error"); }
  };
  document.querySelectorAll(".role-form").forEach((form) => {
    form.onsubmit = async (event) => {
      event.preventDefault(); const status = form.querySelector(".form-status"); status.textContent = "Saving…";
      try { const data = new FormData(form); await api(`/api/admin/members/${form.dataset.id}/roles`, { method: "PUT", body: JSON.stringify({ roles: data.getAll("roles") }) }); status.textContent = "Roles updated."; }
      catch (error) { status.textContent = error.message; status.classList.add("error"); }
    };
    form.querySelector(".deactivate").onclick = async () => {
      const status = form.querySelector(".form-status"); status.textContent = "Deactivating…";
      try { await api(`/api/admin/members/${form.dataset.id}/deactivate`, { method: "POST", body: "{}" }); await renderAdministration(container); }
      catch (error) { status.textContent = error.message; status.classList.add("error"); }
    };
  });
}

async function show(view) {
  document.querySelectorAll("nav button").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  const container = $("#content"); container.innerHTML = "<p>Loading…</p>";
  try {
    if (view === "dashboard") {
      const data = await api("/api/dashboard");
      container.innerHTML = `<h2>Today</h2><div class="grid">${Object.entries(data).map(([key, value]) => `<div class="metric"><span>${escapeHtml(key.replaceAll(/([A-Z])/g, " $1"))}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}</div>`;
    }
    if (view === "employees") {
      const data = await api("/api/employees");
      container.innerHTML = `<h2>Authorized people</h2><div class="list">${data.employees.map((employee) => `<article class="item employee-row"><div><strong>${escapeHtml(employee.displayName)}</strong><br>${escapeHtml(employee.position)} · ${escapeHtml(employee.departmentName)}</div><button class="secondary employee-detail" data-id="${employee.id}">View record</button></article>`).join("") || "<p>No authorized records.</p>"}</div><section id="employee-operations" aria-live="polite"></section>`;
      document.querySelectorAll(".employee-detail").forEach((button) => {
        button.onclick = async () => {
          const detail = $("#employee-operations"); detail.innerHTML = "<p>Loading operational record…</p>";
          try {
            const operations = await api(`/api/employees/${button.dataset.id}/operations`);
            const rows = (items, render) => items.map(render).join("") || "<p class=\"muted\">None recorded.</p>";
            detail.innerHTML = `<h3>Operational record</h3><div class="record-grid"><section><h4>Training</h4>${rows(operations.training, (item) => `<p><strong>${escapeHtml(item.title)}</strong><br>${escapeHtml(item.status)}${item.dueAt ? ` · due ${new Date(item.dueAt).toLocaleDateString()}` : ""}</p>`)}</section><section><h4>Certifications</h4>${rows(operations.certifications, (item) => `<p><strong>${escapeHtml(item.certificationType)}</strong><br>${escapeHtml(item.status)}${item.expiresAt ? ` · expires ${new Date(item.expiresAt).toLocaleDateString()}` : ""}</p>`)}</section><section><h4>Equipment</h4>${rows(operations.equipment, (item) => `<p><strong>${escapeHtml(item.assetTag)}</strong><br>${escapeHtml(item.description)}${item.returnedAt ? " · returned" : ""}</p>`)}</section></div>`;
          } catch (error) { detail.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`; }
        };
      });
    }
    if (view === "documents") {
      const data = await api("/api/documents");
      const manage = activeRoles.includes("tenant_admin");
      container.innerHTML = `<h2>Policy library</h2>${manage ? `<form id="document-upload" class="compact"><label>Policy title<input name="title" required maxlength="200"></label><label>Audience roles<input name="audience" value="employee,manager,hr,owner,tenant_admin" required></label><label>PDF, DOCX, CSV, or XLSX file<input name="file" type="file" accept=".pdf,.docx,.csv,.xlsx" required></label><button>Upload for extraction</button><p class="form-status" role="status"></p></form>` : ""}<div class="list">${data.documents.map((document) => `<article class="item employee-row"><div><strong>${escapeHtml(document.title)}</strong><br>Version ${escapeHtml(document.version)} · ${escapeHtml(document.state)}</div>${manage && document.state === "review" ? `<button class="approve-document" data-id="${document.id}">Approve current version</button>` : ""}</article>`).join("") || "<p>No approved policies yet.</p>"}</div>`;
      if (manage) {
        $("#document-upload").onsubmit = async (event) => { event.preventDefault(); const form = event.currentTarget; const status = form.querySelector(".form-status"); const data = new FormData(form); const title = data.get("title"); const audience = data.get("audience"); status.textContent = "Uploading…"; try { await api(`/api/documents?title=${encodeURIComponent(title)}&audience=${encodeURIComponent(audience)}`, { method: "POST", body: data }); status.textContent = "Uploaded. The isolated worker will extract it for review."; } catch (error) { status.textContent = error.message; status.classList.add("error"); } };
        document.querySelectorAll(".approve-document").forEach((button) => { button.onclick = async () => { await api(`/api/documents/${button.dataset.id}/approve`, { method: "POST", body: "{}" }); await show("documents"); }; });
      }
    }
    if (view === "deadlines") {
      const data = await api("/api/deadlines");
      container.innerHTML = `<h2>Operational deadlines</h2><div class="list">${data.deadlines.map((deadline) => `<article class="item"><strong>${escapeHtml(deadline.title)}</strong><br>${escapeHtml(deadline.employeeName)} · ${new Date(deadline.dueAt).toLocaleDateString()} · ${escapeHtml(deadline.window)}</article>`).join("") || "<p>No deadlines in your scope.</p>"}</div>`;
    }
    if (view === "notifications") {
      const data = await api("/api/notifications");
      container.innerHTML = `<h2>Notifications</h2><div class="list">${data.notifications.map((notification) => `<article class="item"><strong>${escapeHtml(notification.title)}</strong><br>${escapeHtml(notification.body)}<br><span class="muted">${new Date(notification.createdAt).toLocaleString()}</span></article>`).join("") || "<p>No notifications.</p>"}</div>`;
    }
    if (view === "imports") {
      container.innerHTML = `<h2>Import fictional employees</h2><p class="muted">Use the canonical column headers from the sample workbook. Preview and correct every row before committing.</p><form id="import-form" class="compact"><label>CSV or XLSX file<input name="file" type="file" accept=".csv,.xlsx" required></label><button>Validate and preview</button><p class="form-status" role="status"></p></form><div id="import-preview"></div>`;
      $("#import-form").onsubmit = async (event) => { event.preventDefault(); const form = event.currentTarget; const status = form.querySelector(".form-status"); status.textContent = "Validating…"; try { const preview = await api("/api/imports/preview", { method: "POST", body: new FormData(form) }); const errors = preview.rows.flatMap((row) => row.errors.map((error) => `Row ${row.rowNumber}: ${error}`)); $("#import-preview").innerHTML = `<h3>Preview</h3><p>${preview.validRows} valid · ${preview.invalidRows} invalid</p>${errors.length ? `<ul>${errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul>` : `<button id="commit-import">Commit ${preview.validRows} rows</button>`}`; status.textContent = "Preview ready. No records have been changed."; if (!errors.length) $("#commit-import").onclick = async () => { const result = await api(`/api/imports/${preview.id}/commit`, { method: "POST", body: "{}" }); $("#import-preview").innerHTML = `<p><strong>Import complete:</strong> ${result.created} created, ${result.skipped} skipped.</p>`; }; } catch (error) { status.textContent = error.message; status.classList.add("error"); } };
    }
    if (view === "chat") {
      container.innerHTML = `<h2>Ask an approved-policy question</h2><form id="ask"><label>Question<textarea name="question" rows="4" required placeholder="What should I do if I am sick today?"></textarea></label><button>Find an approved answer</button></form><div id="answer"></div>`;
      $("#ask").onsubmit = async (event) => {
        event.preventDefault(); const question = new FormData(event.currentTarget).get("question"); $("#answer").innerHTML = "<p>Checking authorized sources…</p>";
        try { const answer = await api("/api/chat/ask", { method: "POST", body: JSON.stringify({ question }) }); $("#answer").innerHTML = `<h3>Answer</h3><div class="answer"></div><p>${answer.citations.length} approved source(s)</p>`; $("#answer .answer").textContent = answer.answer; }
        catch (error) { $("#answer").textContent = error.message; }
      };
    }
    if (view === "admin") await renderAdministration(container);
  } catch (error) { container.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`; }
}

async function signIn(fields, button) {
  const originalText = button?.textContent; $("#login-error").textContent = ""; if (button) { button.disabled = true; button.textContent = "Opening demo…"; }
  try {
    const data = await api("/api/auth/login", { method: "POST", body: JSON.stringify(fields) });
    csrf = data.csrfToken; activeRoles = data.user.roles; $("#admin-nav").hidden = !activeRoles.some((role) => role === "owner" || role === "tenant_admin"); $("#imports-nav").hidden = !activeRoles.some((role) => role === "hr" || role === "tenant_admin");
    $("#login").hidden = true; $("#app").hidden = false; show("dashboard");
  } catch (error) { $("#login-error").textContent = error.message; if (button) { button.disabled = false; button.textContent = originalText; } }
}
$("#login-form").onsubmit = async (event) => {
  event.preventDefault(); await signIn(Object.fromEntries(new FormData(event.currentTarget)), event.submitter);
};
$("#demo-login").onclick = async (event) => signIn({ tenantSlug: "northstar", email: "casey.bennett@northstar.example.invalid", password: "Synthetic-Demo-Only-Change-Me!" }, event.currentTarget);
document.querySelectorAll("nav button").forEach((button) => { button.onclick = () => show(button.dataset.view); });
$("#logout").onclick = async () => { await api("/api/auth/logout", { method: "POST", body: "{}" }); location.reload(); };
