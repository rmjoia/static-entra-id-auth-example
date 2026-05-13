// Reads /.auth/me and renders Bootstrap-styled user controls into #user-area.
// Sign-in returns the user to the current page; sign-out always sends them home.

(async function renderUserArea() {
  const mount = document.getElementById("user-area");
  if (!mount) return;

  const here = encodeURIComponent(window.location.pathname + window.location.search);
  const home = encodeURIComponent("/");

  try {
    const res = await fetch("/.auth/me", { credentials: "include" });
    const data = await res.json();
    const principal = data && data.clientPrincipal;

    if (principal) {
      const name = principal.userDetails || "Signed in";
      mount.innerHTML = `
        <div class="dropdown">
          <button class="btn btn-outline-light btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
            <i class="bi bi-person-circle me-1"></i>${escapeHtml(name)}
          </button>
          <ul class="dropdown-menu dropdown-menu-end">
            <li><span class="dropdown-item-text small text-muted">Signed in via ${escapeHtml(principal.identityProvider)}</span></li>
            <li><hr class="dropdown-divider" /></li>
            <li><a class="dropdown-item" href="/.auth/logout?post_logout_redirect_uri=${home}"><i class="bi bi-box-arrow-right me-2"></i>Sign out</a></li>
          </ul>
        </div>
      `;
    } else {
      mount.innerHTML = `
        <a class="btn btn-light btn-sm" href="/.auth/login/aad?post_login_redirect_uri=${here}">
          <i class="bi bi-microsoft me-1"></i>Sign in
        </a>
      `;
    }
  } catch (err) {
    mount.innerHTML = `
      <a class="btn btn-light btn-sm" href="/.auth/login/aad?post_login_redirect_uri=${here}">
        <i class="bi bi-microsoft me-1"></i>Sign in
      </a>
    `;
  }
})();

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
